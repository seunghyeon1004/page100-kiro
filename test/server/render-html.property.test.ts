import fc from "fast-check";
import { describe, expect, it } from "vitest";
import type { AltBlock } from "../../src/pages/alt-block.js";
import { escapeHtml } from "../../src/server/escape-html.js";
import { renderHtml } from "../../src/server/render-html.js";
import type { PublishedPage } from "../../src/server/store.js";
import { pageView } from "../../src/server/views.js";
import { NOW } from "../compilers/boot-snapshot.js";
import { validGrid } from "../grid/arbitraries.js";
import { publishedNumbered, URLS } from "./render-fixtures.js";
import { hostileText, hostileUrl } from "./server-arbitraries.js";

// Property 3 (server-and-viewer design.md): nothing from data reaches the document unescaped.

const TAGS = [
  "html",
  "head",
  "meta",
  "title",
  "link",
  "script",
  "body",
  "main",
  "input",
  "label",
  "div",
  "span",
  "section",
  "h1",
  "h2",
  "h3",
  "p",
  "ul",
  "ol",
  "li",
  "table",
  "thead",
  "tbody",
  "tr",
  "th",
  "td",
  "details",
  "summary",
  "a",
  "nav",
  "form",
  "button",
] as const;

const NAME = TAGS.join("|");
const OPEN = new RegExp(
  `<(?:${NAME})(?:\\s+[a-z-]+(?:="[^"<>&]*(?:&(?:amp|lt|gt|quot|#39);[^"<>&]*)*")?)*\\s*>`,
  "g",
);
const CLOSE = new RegExp(`</(?:${NAME})>`, "g");

const MARK = "ZQ";
const BASE = publishedNumbered(201);

/** The page with its alt blocks replaced by blocks built from hostile text, and its first screen by a hostile grid. */
function hostilePage(
  texts: readonly string[],
  urls: readonly string[],
  grid: PublishedPage["screens"][0],
): PublishedPage {
  const blocks: AltBlock[] = [
    ...texts.map((t): AltBlock => ({ kind: "paragraph", text: `${MARK}${t}${MARK}` })),
    ...texts.map((t): AltBlock => ({ kind: "heading", level: 2, text: `${MARK}${t}${MARK}` })),
    { kind: "list", ordered: false, items: [`${MARK}${texts.join("")}${MARK}`] },
    {
      kind: "table",
      headers: [`${MARK}${texts[0] ?? ""}${MARK}`, "b"],
      rows: [[`${MARK}${texts[0] ?? ""}${MARK}`, "x"]],
    },
    {
      kind: "concealed",
      summary: `${MARK}${texts[0] ?? ""}${MARK}`,
      text: `${MARK}${texts[0] ?? ""}${MARK}`,
    },
    ...urls.map((u): AltBlock => ({
      kind: "link",
      text: `${MARK}${texts[0] ?? ""}${MARK}`,
      target: { url: u },
    })),
  ];
  const [first, ...rest] = blocks;
  if (first === undefined) throw new Error("no blocks");
  const [, ...screens] = BASE.screens;
  const [, ...alts] = BASE.alts;
  return { ...BASE, screens: [grid, ...screens], alts: [[first, ...rest], ...alts] };
}

describe("renderHtml properties", () => {
  it("Property 3: every < starts a template tag, every & an entity, every attribute value is quoted and escaped, hostile text appears only escaped, and no href has another scheme", () => {
    fc.assert(
      fc.property(
        fc.array(hostileText, { minLength: 1, maxLength: 4 }),
        fc.array(hostileUrl, { minLength: 1, maxLength: 4 }),
        validGrid,
        fc.boolean(),
        (texts, urls, grid, reveal) => {
          const page = hostilePage(texts, urls, grid);
          const html = renderHtml(pageView(page, 0, NOW, reveal), URLS);

          // Strip every well-formed tag; what is left is text, and text has no raw < or >.
          const withoutTags = html
            .replace("<!doctype html>", "")
            .replace(OPEN, "")
            .replace(CLOSE, "");
          expect(withoutTags).not.toMatch(/[<>]/);

          for (const match of html.matchAll(/&/g)) {
            expect(html.slice(match.index)).toMatch(/^&(?:amp|lt|gt|quot|#39);/);
          }

          for (const text of texts) {
            const escaped = escapeHtml(text);
            expect(html).toContain(`${MARK}${escaped}${MARK}`);
            // The raw form must not appear, unless it is itself the escaped form of another
            // generated text ("&amp;1" is what "&1" escapes to), which is then correct output.
            const isAnothersEscape = texts.some((other) => escapeHtml(other) === text);
            if (escaped !== text && !isAnothersEscape) {
              expect(html).not.toContain(`${MARK}${text}${MARK}`);
            }
          }

          for (const match of html.matchAll(/\b(?:href|src|action)="([^"]*)"/g)) {
            const value = (match[1] ?? "").replaceAll("&amp;", "&");
            expect(value.startsWith("/") || value.startsWith("https://"), value).toBe(true);
          }
          expect(html).not.toMatch(/\son[a-z]+=|\sstyle=|javascript:|data:text/i);
        },
      ),
    );
  });
});
