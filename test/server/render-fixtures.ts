import { compileAll } from "../../src/compilers/compile-all.js";
import type { CompiledPage } from "../../src/pages/compiled-page.js";
import type { AssetUrls } from "../../src/server/render-html.js";
import { createStore } from "../../src/server/store.js";
import type { PublishedPage, Store } from "../../src/server/store.js";
import { NOW, PAGE_FILES, SNAPSHOT, STATUS } from "../compilers/boot-snapshot.js";

// Shared by the document-renderer tests: the boot snapshot compiled and published for real.

export const URLS: AssetUrls = {
  css: "/assets/app.0123456789ab.css",
  js: "/assets/app.0123456789ab.js",
  font: "/assets/bedstead-extended-subset.0123456789ab.woff2",
};

export const COMPILED: readonly CompiledPage[] = compileAll(
  SNAPSHOT,
  STATUS,
  NOW,
  PAGE_FILES,
).pages;

export function compiledNumbered(n: number): CompiledPage {
  const page = COMPILED.find((p) => p.number === n);
  if (page === undefined) throw new Error(`no compiled page ${String(n)}`);
  return page;
}

export function storeOfBootPages(stale = false): Store {
  const store = createStore({ aiEditor: false });
  for (const page of COMPILED) store.publish(page, { now: NOW, stale });
  return store;
}

export function publishedNumbered(n: number, stale = false): PublishedPage {
  const page = storeOfBootPages(stale).get(n);
  if (page === undefined) throw new Error(`page ${String(n)} not published`);
  return page;
}

// The asset table the router tests use: the real font, a small stylesheet and script.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { FONT_PLACEHOLDER, buildAssets } from "../../src/server/assets.js";
import type { AssetTable } from "../../src/server/assets.js";

const FONT_FILE = resolve(
  import.meta.dirname,
  "..",
  "..",
  "public",
  "fonts",
  "bedstead-extended-subset.woff2",
);

export function testAssets(): AssetTable {
  return buildAssets({
    css: `@font-face{font-family:Bedstead;src:url(${FONT_PLACEHOLDER})}.screen{color:#fff}`,
    js: "// test script\n",
    font: new Uint8Array(readFileSync(FONT_FILE)),
  });
}
