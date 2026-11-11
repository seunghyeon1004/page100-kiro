import { brotliDecompressSync, gunzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { FAVICON_SVG, FONT_PLACEHOLDER, ROBOTS_TXT, buildAssets } from "../../src/server/assets.js";

// server-and-viewer 8.2, 8.4, 8.5, 8.6 (assets) and design.md, "Routing", "Files".

const FONT = new Uint8Array([0x77, 0x4f, 0x46, 0x32, 1, 2, 3, 4]);
const CSS = `@font-face{font-family:Bedstead;src:url(${FONT_PLACEHOLDER}) format("woff2")}.screen{color:#fff}`;
const JS = "// script\n";

describe("buildAssets", () => {
  const table = buildAssets({ css: CSS, js: JS, font: FONT });

  it("names each asset by a 12-digit content hash", () => {
    expect(table.urls.css).toMatch(/^\/assets\/app\.[0-9a-f]{12}\.css$/);
    expect(table.urls.js).toMatch(/^\/assets\/app\.[0-9a-f]{12}\.js$/);
    expect(table.urls.font).toMatch(/^\/assets\/bedstead-extended-subset\.[0-9a-f]{12}\.woff2$/);
  });

  it("serves exact paths only", () => {
    expect(table.get(table.urls.css)).toBeDefined();
    expect(table.get(`${table.urls.css}/`)).toBeUndefined();
    expect(table.get("/assets/app.css")).toBeUndefined();
    expect(table.get("/assets/../assets/" + table.urls.css.slice(8))).toBeUndefined();
    expect(table.get("")).toBeUndefined();
  });

  it("rewrites the font URL in the stylesheet to the hashed one", () => {
    const css = new TextDecoder().decode(table.get(table.urls.css)?.body);
    expect(css).not.toContain(FONT_PLACEHOLDER);
    expect(css).toContain(`url(${table.urls.font})`);
  });

  it("changes the stylesheet's name when the font changes", () => {
    const other = buildAssets({ css: CSS, js: JS, font: new Uint8Array([9, 9]) });
    expect(other.urls.css).not.toBe(table.urls.css);
    expect(other.urls.js).toBe(table.urls.js);
  });

  it("gives a strong ETag equal to the hash and the right content types", () => {
    expect(table.get(table.urls.css)?.etag).toBe(`"${table.urls.css.split(".")[1] ?? ""}"`);
    expect(table.get(table.urls.css)?.contentType).toBe("text/css; charset=utf-8");
    expect(table.get(table.urls.js)?.contentType).toBe("text/javascript; charset=utf-8");
    expect(table.get(table.urls.font)?.contentType).toBe("font/woff2");
  });

  it("compresses the stylesheet and the script once, and never the font", () => {
    for (const url of [table.urls.css, table.urls.js]) {
      const item = table.get(url);
      if (item === undefined || item.br === null || item.gzip === null)
        throw new Error("not encoded");
      expect(Buffer.from(brotliDecompressSync(item.br))).toEqual(Buffer.from(item.body));
      expect(Buffer.from(gunzipSync(item.gzip))).toEqual(Buffer.from(item.body));
    }
    const font = table.get(table.urls.font);
    expect(font?.br).toBeNull();
    expect(font?.gzip).toBeNull();
    expect(font?.body).toEqual(FONT);
  });
});

describe("constants", () => {
  it("keeps the favicon under 300 bytes, four bands of the quick-link colours", () => {
    expect(new TextEncoder().encode(FAVICON_SVG).byteLength).toBeLessThan(300);
    expect(FAVICON_SVG).toContain('viewBox="0 0 16 12"');
    expect(FAVICON_SVG.match(/<rect /g)).toHaveLength(4);
    expect(FAVICON_SVG).not.toMatch(/<script|style=/);
  });

  it("disallows the API, /go and fragments in robots.txt", () => {
    expect(ROBOTS_TXT).toBe("User-agent: *\nDisallow: /api/\nDisallow: /go\nDisallow: /*.frag\n");
  });
});
