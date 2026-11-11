import { brotliDecompressSync, gunzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { CSP } from "../../src/server/headers.js";
import { createRouter } from "../../src/server/router.js";
import type { RouterDeps, RouterRequest, RouterResponse } from "../../src/server/router.js";
import { createStore } from "../../src/server/store.js";
import { NOW } from "../compilers/boot-snapshot.js";
import { COMPILED, storeOfBootPages, testAssets } from "./render-fixtures.js";

// server-and-viewer requirements 7 and 8: every row of the design's "Routes" table.

const ASSETS = testAssets();

function routerOver(store = storeOfBootPages()) {
  return createRouter({ store, assets: ASSETS, clock: () => NOW });
}

const router = routerOver();

function get(
  url: string,
  headers: Record<string, string | undefined> = {},
  method = "GET",
): RouterResponse {
  const request: RouterRequest = { method, url, headers };
  return router(request);
}

function text(response: RouterResponse): string {
  return new TextDecoder().decode(response.body);
}

function decoded(response: RouterResponse): string {
  const encoding = response.headers["Content-Encoding"];
  const body = Buffer.from(response.body);
  if (encoding === "br") return brotliDecompressSync(body).toString("utf8");
  if (encoding === "gzip") return gunzipSync(body).toString("utf8");
  return body.toString("utf8");
}

describe("RouterDeps", () => {
  it("has exactly store, assets and clock", () => {
    const keys = { store: 1, assets: 1, clock: 1 } satisfies Record<keyof RouterDeps, 1>;
    expect(Object.keys(keys).sort()).toEqual(["assets", "clock", "store"]);
  });
});

describe("page routes (requirements 7.2 to 7.5)", () => {
  it("serves / as page 100 in HTML", () => {
    const response = get("/");
    expect(response.status).toBe(200);
    expect(response.headers["Content-Type"]).toBe("text/html; charset=utf-8");
    expect(text(response)).toContain("<title>100 Index - Page 100</title>");
    expect(text(get("/100"))).toBe(text(response));
  });

  it("serves each format of a page", () => {
    expect(get("/201.txt").headers["Content-Type"]).toBe("text/plain; charset=utf-8");
    expect(text(get("/201.txt")).split("\n")).toHaveLength(25);
    expect(get("/201.ansi").headers["Content-Type"]).toBe("text/plain; charset=utf-8");
    expect(text(get("/201.ansi"))).toContain("\u001b[38;2;");
    expect(get("/201.json").headers["Content-Type"]).toBe("application/json; charset=utf-8");
    expect(text(get("/201.frag")).startsWith('<div id="view"')).toBe(true);
  });

  it("selects a subpage with s, 1-based", () => {
    expect(text(get("/201?s=3"))).toContain('data-s="3"');
    expect(text(get("/201.txt?s=2"))).not.toBe(text(get("/201.txt?s=1")));
    expect(text(get("/201"))).toBe(text(get("/201?s=1")));
  });

  it("answers 404 with the missing-subpage screen for a bad s, without echoing it", () => {
    for (const query of ["?s=7", "?s=0", "?s=", "?s=10", "?s=1&s=2", "?s=x", "?s=%31%32"]) {
      const response = get(`/201${query}`);
      expect(response.status, query).toBe(404);
      expect(text(response), query).toContain("Page 201 has 6 subpages.");
    }
    expect(text(get("/201.txt?s=7"))).toContain("Page 201 has 6 subpages.");
  });

  it("ignores s for the json format", () => {
    expect(get("/201.json?s=7").status).toBe(200);
  });

  it("answers 404 with the not-in-service screen in the requested format", () => {
    const html = get("/123");
    expect(html.status).toBe(404);
    expect(text(html)).toContain("<title>123 Page not in service - Page 100</title>");
    const txt = get("/123.txt");
    expect(txt.status).toBe(404);
    expect(text(txt)).toContain("Page 123 is not in service.");
    expect(get("/123.json").status).toBe(404);
    expect(text(get("/123.frag"))).toContain('data-page="123"');
    expect(txt.headers.ETag).toBeUndefined();
  });

  it("answers the plain 404 page for anything else", () => {
    for (const url of [
      "/099",
      "/900",
      "/000",
      "/abc",
      "//100",
      "/100/",
      "/100.html",
      "/%31%30%30",
      "/a.b",
    ]) {
      const response = get(url);
      expect(response.status, url).toBe(404);
      expect(text(response), url).toContain("<h1>Not found</h1>");
    }
  });

  it("answers 404 for a path over 1,024 characters", () => {
    expect(get(`/${"a".repeat(1024)}`).status).toBe(404);
    expect(get(`/${"1".repeat(3000)}`).status).toBe(404);
  });

  it("answers 503 with Retry-After for a page in service that is not published yet", () => {
    const store = createStore({ aiEditor: false });
    const only100 = COMPILED.find((p) => p.number === 100);
    if (only100 === undefined) throw new Error("no page 100");
    store.publish(only100, { now: NOW, stale: false });
    const response = routerOver(store)({ method: "GET", url: "/200", headers: {} });
    expect(response.status).toBe(503);
    expect(response.headers["Retry-After"]).toBe("60");
    expect(response.headers["Cache-Control"]).toBe("no-store");
  });

  it("shows concealed cells with reveal=1 in text and the checkbox in HTML", () => {
    expect(text(get("/550.txt?reveal=1"))).not.toBe(text(get("/550.txt")));
    expect(text(get("/550?reveal=1"))).toContain('id="reveal" class="reveal" checked>');
    expect(text(get("/550?reveal=0"))).not.toContain(" checked>");
  });

  it("answers ANSI for a terminal agent at / and /:page, and not for a browser", () => {
    for (const agent of ["curl/8.4.0", "Wget/1.21"]) {
      for (const url of ["/", "/201"]) {
        const response = get(url, { "user-agent": agent });
        expect(response.headers["Content-Type"], `${agent} ${url}`).toBe(
          "text/plain; charset=utf-8",
        );
        expect(text(response)).toContain("\u001b[38;2;");
      }
      expect(text(get("/201.txt", { "user-agent": agent }))).not.toContain("\u001b");
    }
    expect(text(get("/", { "user-agent": "Mozilla/5.0" }))).toContain("<!doctype html>");
  });
});

describe("/go (requirement 7.6)", () => {
  it("redirects a three-digit number with 303", () => {
    const response = get("/go?p=300");
    expect(response.status).toBe(303);
    expect(response.headers.Location).toBe("/300");
    expect(response.body).toHaveLength(0);
    expect(get("/go?p=123").headers.Location).toBe("/123");
  });

  it("answers 400 with the plain page and the form otherwise", () => {
    for (const url of ["/go?p=12", "/go", "/go?p=abcd", "/go?p=3000", "/go?p="]) {
      const response = get(url);
      expect(response.status, url).toBe(400);
      expect(text(response)).toContain("<h1>Enter a page number</h1>");
      expect(text(response)).toContain('action="/go"');
    }
  });
});

describe("/api (requirement 7.8)", () => {
  it("answers health ok once the store holds a page, and starting before", () => {
    expect(text(get("/api/health"))).toBe("ok\n");
    const empty = routerOver(createStore({ aiEditor: false }))({
      method: "GET",
      url: "/api/health",
      headers: {},
    });
    expect(empty.status).toBe(503);
    expect(text(empty)).toBe("starting\n");
  });

  it("answers status as no-store JSON in registry order", () => {
    const response = get("/api/status");
    expect(response.headers["Cache-Control"]).toBe("no-store");
    const parsed = JSON.parse(text(response)) as { pages: { number: number }[] };
    expect(parsed.pages.map((p) => p.number)).toEqual(COMPILED.map((p) => p.number));
  });
});

describe("assets and constants (requirements 8.2, 8.5)", () => {
  it("serves an asset at its exact key, immutable, with an ETag", () => {
    const response = get(ASSETS.urls.css);
    expect(response.status).toBe(200);
    expect(response.headers["Cache-Control"]).toBe("public, max-age=31536000, immutable");
    expect(response.headers.ETag).toMatch(/^"[0-9a-f]{12}"$/);
    expect(response.headers["Content-Type"]).toBe("text/css; charset=utf-8");
  });

  it("encodes the stylesheet with brotli when accepted and never the font", () => {
    const css = get(ASSETS.urls.css, { "accept-encoding": "gzip, br" });
    expect(css.headers["Content-Encoding"]).toBe("br");
    expect(css.headers.ETag).toMatch(/-br"$/);
    expect(css.headers.Vary).toBe("Accept-Encoding");
    const font = get(ASSETS.urls.font, { "accept-encoding": "gzip, br" });
    expect(font.status).toBe(200);
    expect(font.headers["Content-Encoding"]).toBeUndefined();
    expect(font.headers["Content-Type"]).toBe("font/woff2");
  });

  it("answers 404 for any other asset path", () => {
    for (const url of [
      "/assets/",
      "/assets/app.css",
      `${ASSETS.urls.css}x`,
      "/assets/../robots.txt",
    ]) {
      expect(get(url).status, url).toBe(404);
    }
  });

  it("serves robots.txt and favicon.svg for a day", () => {
    const robots = get("/robots.txt");
    expect(text(robots)).toContain("Disallow: /api/");
    expect(robots.headers["Cache-Control"]).toBe("public, max-age=86400");
    const icon = get("/favicon.svg");
    expect(icon.headers["Content-Type"]).toBe("image/svg+xml");
    expect(icon.headers["Cache-Control"]).toBe("public, max-age=86400");
  });
});

describe("headers (requirements 8.1 to 8.4)", () => {
  it("sends the CSP, the three security headers and a Content-Length on every kind of response", () => {
    for (const url of [
      "/",
      "/201.txt",
      "/123",
      "/nope",
      "/go?p=1",
      "/go?p=300",
      "/api/health",
      ASSETS.urls.js,
      "/robots.txt",
    ]) {
      const response = get(url);
      expect(response.headers["Content-Security-Policy"], url).toBe(CSP);
      expect(response.headers["X-Content-Type-Options"]).toBe("nosniff");
      expect(response.headers["Referrer-Policy"]).toBe("no-referrer");
      expect(response.headers["Cross-Origin-Opener-Policy"]).toBe("same-origin");
      expect(response.headers["Content-Length"]).toBe(String(response.body.byteLength));
      expect(response.headers["Set-Cookie"]).toBeUndefined();
    }
  });

  it("caches pages and not-found screens for 60 seconds and the rest not at all", () => {
    expect(get("/201").headers["Cache-Control"]).toBe("public, max-age=60");
    expect(get("/123").headers["Cache-Control"]).toBe("public, max-age=60");
    expect(get("/201?s=9").headers["Cache-Control"]).toBe("public, max-age=60");
    expect(get("/nope").headers["Cache-Control"]).toBe("no-store");
    expect(get("/go?p=300").headers["Cache-Control"]).toBe("no-store");
  });

  it("varies / and /:page on encoding and agent, other formats on encoding", () => {
    expect(get("/").headers.Vary).toBe("Accept-Encoding, User-Agent");
    expect(get("/201").headers.Vary).toBe("Accept-Encoding, User-Agent");
    expect(get("/201.txt").headers.Vary).toBe("Accept-Encoding");
    expect(get("/201.json").headers.Vary).toBe("Accept-Encoding");
  });

  it("gives each representation its own strong ETag", () => {
    const tags = [
      get("/201").headers.ETag,
      get("/201?s=2").headers.ETag,
      get("/201.txt").headers.ETag,
      get("/201", { "accept-encoding": "br" }).headers.ETag,
      get("/201", { "accept-encoding": "gzip" }).headers.ETag,
      get("/550?reveal=1").headers.ETag,
      get("/550").headers.ETag,
    ];
    expect(new Set(tags).size).toBe(tags.length);
    for (const tag of tags) expect(tag).toMatch(/^"[0-9a-f]{20}-(\d|a)-[a-z]+(-r)?(-br|-gz)?"$/);
  });

  it("answers 304 with no body for a matching tag, strong or weak, and a changed one gets 200", () => {
    const first = get("/201", { "accept-encoding": "br" });
    const tag = first.headers.ETag ?? "";
    for (const header of [tag, `W/${tag}`, `"x", ${tag}`, "*"]) {
      const response = get("/201", { "accept-encoding": "br", "if-none-match": header });
      expect(response.status, header).toBe(304);
      expect(response.body).toHaveLength(0);
      expect(response.headers.ETag).toBe(tag);
      expect(response.headers["Cache-Control"]).toBe("public, max-age=60");
    }
    expect(get("/201", { "accept-encoding": "br", "if-none-match": '"other"' }).status).toBe(200);
    // The tag of the br representation does not match the identity one.
    expect(get("/201", { "if-none-match": tag }).status).toBe(200);
  });

  it("answers 304 for an asset with its tag", () => {
    const tag = get(ASSETS.urls.js).headers.ETag ?? "";
    expect(get(ASSETS.urls.js, { "if-none-match": tag }).status).toBe(304);
  });

  it("encodes a page with brotli, then gzip, then not at all, and the body decodes to the same text", () => {
    const plain = text(get("/201"));
    const br = get("/201", { "accept-encoding": "br, gzip" });
    expect(br.headers["Content-Encoding"]).toBe("br");
    expect(decoded(br)).toBe(plain);
    const gz = get("/201", { "accept-encoding": "gzip" });
    expect(gz.headers["Content-Encoding"]).toBe("gzip");
    expect(decoded(gz)).toBe(plain);
    expect(
      get("/201", { "accept-encoding": "identity" }).headers["Content-Encoding"],
    ).toBeUndefined();
    expect(br.body.byteLength).toBeLessThan(plain.length / 3);
  });

  it("serves the same encoded bytes twice within a second, from the cache", () => {
    const a = get("/300", { "accept-encoding": "br" });
    const b = get("/300", { "accept-encoding": "br" });
    expect(Buffer.from(b.body).equals(Buffer.from(a.body))).toBe(true);
  });
});

describe("methods (requirement 7.7)", () => {
  it("answers HEAD with the headers of GET and no body", () => {
    for (const url of ["/201", "/201.txt", "/123", "/nope", ASSETS.urls.css, "/api/health"]) {
      const head = get(url, {}, "HEAD");
      const full = get(url);
      expect(head.status, url).toBe(full.status);
      expect(head.body, url).toHaveLength(0);
      expect(head.headers, url).toEqual(full.headers);
    }
  });

  it("answers any other method with 405 and Allow", () => {
    for (const method of ["POST", "PUT", "DELETE", "PATCH", "OPTIONS", "TRACE", "get", ""]) {
      const response = get("/100", {}, method);
      expect(response.status, method).toBe(405);
      expect(response.headers.Allow).toBe("GET, HEAD");
    }
  });
});
