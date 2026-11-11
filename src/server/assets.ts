import { createHash } from "node:crypto";
import { compress } from "./compress.js";
import type { AssetUrls } from "./render-html.js";

// The asset table (server-and-viewer 8.2, 8.4, 8.6, design.md, "Files"): the stylesheet, the
// script and the font under content-hashed names, compressed once at boot.

export type { AssetUrls } from "./render-html.js";

/** The one place a stylesheet names the font; `buildAssets` rewrites it to the hashed URL. */
export const FONT_PLACEHOLDER = "/assets/bedstead-extended-subset.woff2";

export interface Asset {
  readonly contentType: string;
  readonly body: Uint8Array;
  /** `null` for the font, which is never encoded. */
  readonly br: Uint8Array | null;
  readonly gzip: Uint8Array | null;
  /** The strong ETag, quoted: `"<hash>"`. */
  readonly etag: string;
}

export interface AssetTable {
  readonly urls: AssetUrls;
  /** The asset at an exact path such as `/assets/app.0123456789ab.css`, or `undefined`. */
  get(path: string): Asset | undefined;
}

export interface AssetFiles {
  readonly css: string;
  readonly js: string;
  readonly font: Uint8Array;
}

/** Sixteen red, green, yellow and blue bands: the four quick-link colours. */
export const FAVICON_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 12">' +
  '<rect width="4" height="12" fill="#f00"/><rect x="4" width="4" height="12" fill="#0f0"/>' +
  '<rect x="8" width="4" height="12" fill="#ff0"/><rect x="12" width="4" height="12" fill="#00f"/></svg>';

export const ROBOTS_TXT = "User-agent: *\nDisallow: /api/\nDisallow: /go\nDisallow: /*.frag\n";

function hashOf(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex").slice(0, 12);
}

function asset(contentType: string, body: Uint8Array, encode: boolean, hash: string): Asset {
  return {
    contentType,
    body,
    br: encode ? compress(body, "br", "asset") : null,
    gzip: encode ? compress(body, "gzip", "asset") : null,
    etag: `"${hash}"`,
  };
}

/** Hashes the font, rewrites the stylesheet's font URL to it, hashes the rewritten stylesheet and the script, and compresses. */
export function buildAssets(files: AssetFiles): AssetTable {
  const encoder = new TextEncoder();
  const fontHash = hashOf(files.font);
  const fontPath = `/assets/bedstead-extended-subset.${fontHash}.woff2`;
  const css = encoder.encode(files.css.replaceAll(FONT_PLACEHOLDER, fontPath));
  const js = encoder.encode(files.js);
  const cssHash = hashOf(css);
  const jsHash = hashOf(js);
  const urls: AssetUrls = {
    css: `/assets/app.${cssHash}.css`,
    js: `/assets/app.${jsHash}.js`,
    font: fontPath,
  };
  const table = new Map<string, Asset>([
    [urls.css, asset("text/css; charset=utf-8", css, true, cssHash)],
    [urls.js, asset("text/javascript; charset=utf-8", js, true, jsHash)],
    [urls.font, asset("font/woff2", files.font, false, fontHash)],
  ]);
  return { urls, get: (path) => table.get(path) };
}
