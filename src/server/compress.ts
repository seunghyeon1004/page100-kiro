import { brotliCompressSync, constants, gzipSync } from "node:zlib";
import type { Encoding } from "./negotiate.js";

// Compression and the compressed-body cache (server-and-viewer 8.5, 8.6, design.md,
// "Negotiation and compression"). This is the only file in `src` that imports `node:zlib`.

export type Kind = "page" | "asset";

/**
 * The body in `encoding`. Pages: brotli quality 5 in text mode, gzip level 6. Assets (once, at
 * boot): brotli quality 11, gzip level 9. `identity` returns the bytes as they are.
 */
export function compress(body: Uint8Array, encoding: Encoding, kind: Kind): Uint8Array {
  if (encoding === "identity") return body;
  if (encoding === "gzip") return gzipSync(body, { level: kind === "page" ? 6 : 9 });
  return brotliCompressSync(body, {
    params: {
      [constants.BROTLI_PARAM_QUALITY]: kind === "page" ? 5 : 11,
      [constants.BROTLI_PARAM_MODE]: constants.BROTLI_MODE_TEXT,
      [constants.BROTLI_PARAM_SIZE_HINT]: body.byteLength,
    },
  });
}

export interface BodyCache {
  /** The body stored under this representation ETag, when it was stored for the same clock text. */
  get(representation: string, clock: string): Uint8Array | undefined;
  set(representation: string, clock: string, body: Uint8Array): void;
  /** Drops every entry of a page version that has been replaced (the page ETag, without quotes). */
  evict(pageEtag: string): void;
  size(): number;
}

/**
 * Maps a representation ETag (`"<etag>-<s>-<format>…"`) to its encoded body and the clock text it
 * was made for; one entry per representation, so a new second replaces the old body.
 */
export function createBodyCache(): BodyCache {
  const entries = new Map<string, { readonly clock: string; readonly body: Uint8Array }>();
  return {
    get(representation, clock) {
      const entry = entries.get(representation);
      return entry?.clock === clock ? entry.body : undefined;
    },
    set(representation, clock, body) {
      entries.set(representation, { clock, body });
    },
    evict(pageEtag) {
      const prefix = `"${pageEtag}-`;
      for (const key of entries.keys()) {
        if (key.startsWith(prefix)) entries.delete(key);
      }
    },
    size: () => entries.size,
  };
}
