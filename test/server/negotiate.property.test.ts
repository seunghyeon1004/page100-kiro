import { brotliDecompressSync, gunzipSync } from "node:zlib";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { createRouter } from "../../src/server/router.js";
import { NOW } from "../compilers/boot-snapshot.js";
import { storeOfBootPages, testAssets } from "./render-fixtures.js";
import { acceptEncodingHeader } from "./server-arbitraries.js";

// Property 9 (server-and-viewer design.md): the encoding is one the client accepts, and decoding it gives the identity body.

const assets = testAssets();
const router = createRouter({ store: storeOfBootPages(), assets, clock: () => NOW });

const URLS: readonly string[] = [
  "/",
  "/201",
  "/201.txt",
  "/201.ansi",
  "/300.json",
  "/200.frag",
  "/123",
  "/201?s=9",
  "/nope",
  "/go?p=1",
  "/robots.txt",
  "/favicon.svg",
  assets.urls.css,
  assets.urls.js,
  assets.urls.font,
];

/** The q of a coding in an Accept-Encoding header, read independently of the router: the specific entry, else `*`, else 0. */
function qOf(header: string | undefined, token: string): number {
  if (header === undefined) return 0;
  let specific: number | undefined;
  let wildcard: number | undefined;
  for (const item of header.split(",")) {
    const [name = "", ...params] = item.split(";").map((part) => part.trim());
    let q = 1;
    let valid = name !== "";
    for (const param of params) {
      const match = /^q=(0(?:\.\d{0,3})?|1(?:\.0{0,3})?)$/i.exec(param);
      if (match === null) valid = false;
      else q = Number(match[1]);
    }
    if (!valid) continue;
    if (name.toLowerCase() === token && specific === undefined) specific = q;
    if (name === "*" && wildcard === undefined) wildcard = q;
  }
  return specific ?? wildcard ?? 0;
}

describe("negotiation properties", () => {
  it("Property 9: the response is encoded only with a coding the header accepts, decodes to the identity body, and a woff2 is never encoded", () => {
    fc.assert(
      fc.property(fc.constantFrom(...URLS), acceptEncodingHeader, (url, header) => {
        const response = router({
          method: "GET",
          url,
          headers: { "accept-encoding": header },
        });
        const reference = router({ method: "GET", url, headers: {} });
        const encoding = response.headers["Content-Encoding"];

        if (url === assets.urls.font) expect(encoding).toBeUndefined();
        if (encoding === undefined) {
          expect(Buffer.from(response.body).equals(Buffer.from(reference.body))).toBe(true);
          return;
        }
        expect(["br", "gzip"]).toContain(encoding);
        expect(qOf(header, encoding)).toBeGreaterThan(0);
        const body = Buffer.from(response.body);
        const plain = encoding === "br" ? brotliDecompressSync(body) : gunzipSync(body);
        expect(plain.equals(Buffer.from(reference.body))).toBe(true);
      }),
      { numRuns: 300 },
    );
  });
});
