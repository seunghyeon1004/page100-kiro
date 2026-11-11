import { brotliDecompressSync, gunzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { compress, createBodyCache } from "../../src/server/compress.js";
import { CSP, baseHeaders } from "../../src/server/headers.js";

// server-and-viewer 8.1, 8.5, 8.6.

const TEXT = new TextEncoder().encode("<p>teletext</p>".repeat(200));

describe("compress", () => {
  it("round-trips brotli and gzip, for pages and assets", () => {
    for (const kind of ["page", "asset"] as const) {
      expect(Buffer.from(brotliDecompressSync(compress(TEXT, "br", kind)))).toEqual(
        Buffer.from(TEXT),
      );
      expect(Buffer.from(gunzipSync(compress(TEXT, "gzip", kind)))).toEqual(Buffer.from(TEXT));
    }
  });

  it("returns identity bodies as they are", () => {
    expect(compress(TEXT, "identity", "page")).toBe(TEXT);
  });

  it("makes repetitive text much smaller", () => {
    expect(compress(TEXT, "br", "page").byteLength).toBeLessThan(TEXT.byteLength / 10);
    expect(compress(TEXT, "gzip", "page").byteLength).toBeLessThan(TEXT.byteLength / 10);
  });
});

describe("createBodyCache", () => {
  const a = new Uint8Array([1]);
  const b = new Uint8Array([2]);

  it("hits only for the same clock text", () => {
    const cache = createBodyCache();
    cache.set('"p1-1-html-br"', "14:05:09", a);
    expect(cache.get('"p1-1-html-br"', "14:05:09")).toBe(a);
    expect(cache.get('"p1-1-html-br"', "14:05:10")).toBeUndefined();
    expect(cache.get('"p1-1-html-gz"', "14:05:09")).toBeUndefined();
  });

  it("keeps one entry per representation", () => {
    const cache = createBodyCache();
    cache.set('"p1-1-html-br"', "14:05:09", a);
    cache.set('"p1-1-html-br"', "14:05:10", b);
    expect(cache.size()).toBe(1);
    expect(cache.get('"p1-1-html-br"', "14:05:10")).toBe(b);
  });

  it("evicts every representation of a replaced page version and no other", () => {
    const cache = createBodyCache();
    cache.set('"p1-1-html-br"', "t", a);
    cache.set('"p1-2-json"', "t", a);
    cache.set('"p10-1-html-br"', "t", b);
    cache.set('"q1-1-html"', "t", b);
    cache.evict("p1");
    expect(cache.size()).toBe(2);
    expect(cache.get('"p10-1-html-br"', "t")).toBe(b);
    expect(cache.get('"q1-1-html"', "t")).toBe(b);
  });
});

describe("baseHeaders (requirement 8.1)", () => {
  it("holds the CSP of frontend.md exactly, the three security headers and the content type", () => {
    expect(CSP).toBe(
      "default-src 'none'; script-src 'self'; style-src 'self'; font-src 'self'; img-src 'self'; connect-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
    );
    expect(baseHeaders("text/html; charset=utf-8")).toEqual({
      "Content-Security-Policy": CSP,
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
      "Cross-Origin-Opener-Policy": "same-origin",
      "Content-Type": "text/html; charset=utf-8",
    });
  });
});
