import { describe, expect, it } from "vitest";
import type { AltBlock } from "../../src/pages/alt-block.js";
import { renderAlt, row22Text } from "../../src/server/render-alt.js";
import { renderFrag, renderHtml } from "../../src/server/render-html.js";
import { renderJson, renderStatusJson } from "../../src/server/render-json.js";
import { renderPlain } from "../../src/server/render-plain.js";
import { missingSubpageView, notInServiceView, pageView } from "../../src/server/views.js";
import { NOW } from "../compilers/boot-snapshot.js";
import { publishedNumbered, storeOfBootPages, URLS } from "./render-fixtures.js";

// server-and-viewer requirements 9, 10 and 11 on real published pages.

const ALT_MARKUP = (html: string): string => html.slice(html.indexOf('<section id="alt"'));

describe("renderHtml head and body (requirements 9.1, 9.2)", () => {
  const view = pageView(publishedNumbered(201), 0, NOW, false);
  const html = renderHtml(view, URLS);

  it("has the exact head", () => {
    expect(html.slice(0, html.indexOf("</head>") + 7)).toBe(
      '<!doctype html><html lang="en"><head><meta charset="utf-8">' +
        '<meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="dark">' +
        "<title>201 Five-day outlook - Page 100</title>" +
        '<meta name="description" content="Page 201, Five-day outlook: one 40 by 24 character screen with a text version.">' +
        '<link rel="stylesheet" href="/assets/app.0123456789ab.css">' +
        '<link rel="preload" href="/assets/bedstead-extended-subset.0123456789ab.woff2" as="font" type="font/woff2" crossorigin>' +
        '<link rel="icon" href="/favicon.svg" type="image/svg+xml">' +
        '<script type="module" src="/assets/app.0123456789ab.js"></script></head>',
    );
  });

  it("has no inline script, style element, style attribute or on* attribute", () => {
    expect(html).not.toMatch(/<style|\sstyle=|\son[a-z]+=/);
    expect(html.match(/<script/g)).toHaveLength(1);
  });

  it("has exactly one h1, one live region and a hidden keypad", () => {
    expect(html.match(/<h1[ >]/g)).toHaveLength(1);
    expect(html.match(/aria-live="polite"/g)).toHaveLength(1);
    expect(html).not.toContain("assertive");
    expect(html).toContain('<div id="keypad" class="keypad" hidden>');
  });

  it("ends the controls with the About link and the source link", () => {
    expect(html).toContain(
      '<div class="foot"><a id="about" href="/801">About</a>' +
        '<a id="src" href="https://github.com/seunghyeon1004/page100-kiro" rel="noopener noreferrer">Source on GitHub</a></div></main>',
    );
  });

  it("embeds the fragment byte for byte", () => {
    expect(html).toContain(renderFrag(view));
  });

  it("has the reveal checkbox, checked only when revealed", () => {
    expect(html).toContain('<input type="checkbox" id="reveal" class="reveal"><label');
    const revealed = renderHtml(pageView(publishedNumbered(550), 0, NOW, true), URLS);
    expect(revealed).toContain('id="reveal" class="reveal" checked>');
  });

  it("has the form of frontend.md", () => {
    expect(html).toContain('<form class="go" action="/go" method="get">');
    expect(html).toContain(
      '<input id="p" name="p" inputmode="numeric" pattern="[0-9]{3}" maxlength="3" required autocomplete="off">',
    );
  });

  it("has four quick links with the colour name in the accessible name", () => {
    expect(html).toContain(
      '<a id="q1" class="q br" href="/100"><span class="vh">Red: </span>Index</a>',
    );
    expect(html).toContain(
      '<a id="q4" class="q bb" href="/300"><span class="vh">Blue: </span>Rates</a>',
    );
  });
});

describe("renderFrag (requirement 11.4)", () => {
  it("is the #view element with the data attributes, the screen and the text alternative", () => {
    const frag = renderFrag(pageView(publishedNumbered(201), 1, NOW, false));
    expect(frag.startsWith('<div id="view" class="view" data-page="201"')).toBe(true);
    expect(frag).toContain('data-title="Five-day outlook"');
    expect(frag).toContain('data-s="2"');
    expect(frag).toContain('data-m="6"');
    expect(frag).toContain('data-prev="200"');
    expect(frag).toContain('data-next="300"');
    expect(frag).toContain('data-links="100 Index|200 Now|110 News|300 Rates"');
    expect(frag).toContain('<div class="screen" aria-hidden="true">');
    expect(frag).toContain("<p>Subpage 2 of 6</p>");
    expect(frag.endsWith("</section></div>")).toBe(true);
  });
});

describe("previous and next page, subpage links (requirement 9.7)", () => {
  it("wraps from page 100 to 899 and from 899 to 100", () => {
    const first = renderHtml(pageView(publishedNumbered(100), 0, NOW, false), URLS);
    expect(first).toContain('<a id="prev" href="/899">');
    expect(first).toContain('<a id="next" href="/110">');
    const last = renderHtml(pageView(publishedNumbered(899), 0, NOW, false), URLS);
    expect(last).toContain('<a id="prev" href="/802">');
    expect(last).toContain('<a id="next" href="/100">');
  });

  it("disables the subpage links of a one-subpage page", () => {
    const html = renderHtml(pageView(publishedNumbered(100), 0, NOW, false), URLS);
    expect(html).toContain('<a id="sup" aria-disabled="true">Subpage up</a>');
    expect(html).toContain('<a id="sdown" aria-disabled="true">Subpage down</a>');
  });

  it("wraps the subpage links of page 201", () => {
    const first = renderHtml(pageView(publishedNumbered(201), 0, NOW, false), URLS);
    expect(first).toContain('<a id="sup" href="/201?s=6">');
    expect(first).toContain('<a id="sdown" href="/201?s=2">');
    const last = renderHtml(pageView(publishedNumbered(201), 5, NOW, false), URLS);
    expect(last).toContain('<a id="sup" href="/201?s=5">');
    expect(last).toContain('<a id="sdown" href="/201">');
  });

  it("links the text view with the current subpage", () => {
    const html = renderHtml(pageView(publishedNumbered(201), 2, NOW, false), URLS);
    expect(html).toContain('<a id="txt" class="nojs" href="/201.txt?s=3">Text</a>');
  });
});

describe("renderAlt (requirement 10)", () => {
  const base = publishedNumbered(100);
  function altOf(...blocks: AltBlock[]): string {
    const [first, ...rest] = blocks;
    if (first === undefined) throw new Error("no blocks");
    return renderAlt({ ...base, alts: [[first, ...rest]] }, 0);
  }

  it("writes each block kind", () => {
    const html = altOf(
      { kind: "heading", level: 2, text: "H2" },
      { kind: "heading", level: 3, text: "H3" },
      { kind: "paragraph", text: "P & Q" },
      { kind: "list", ordered: false, items: ["a", "b"] },
      { kind: "list", ordered: true, items: ["c"] },
      { kind: "table", headers: ["Name", "Value"], rows: [["x", "1"], ["y"]] },
      { kind: "link", text: "Local", target: { page: 300 } },
      { kind: "link", text: "Outside", target: { url: "https://example.org/a?b=1&c=2" } },
      { kind: "link", text: "Unsafe", target: { url: "javascript:alert(1)" } },
      { kind: "link", text: "Plain http", target: { url: "http://example.org/" } },
      { kind: "concealed", summary: "Show answer", text: "42" },
    );
    expect(html).toContain("<h2>H2</h2><h3>H3</h3><p>P &amp; Q</p>");
    expect(html).toContain("<ul><li>a</li><li>b</li></ul><ol><li>c</li></ol>");
    expect(html).toContain(
      '<table><thead><tr><th scope="col">Name</th><th scope="col">Value</th></tr></thead>' +
        '<tbody><tr><th scope="row">x</th><td>1</td></tr><tr><th scope="row">y</th><td></td></tr></tbody></table>',
    );
    expect(html).toContain('<p><a href="/300">Local</a></p>');
    expect(html).toContain(
      '<p><a href="https://example.org/a?b=1&amp;c=2" rel="noopener noreferrer">Outside</a></p>',
    );
    expect(html).toContain("<p>Unsafe</p><p>Plain http</p>");
    expect(html).toContain("<details><summary>Show answer</summary><p>42</p></details>");
  });

  it("has one h1 with the number and title, and no subpage line for one subpage", () => {
    const html = altOf({ kind: "paragraph", text: "x" });
    expect(html).toContain('<h1 id="alt-h">100 Index</h1><p>x</p>');
    expect(html).not.toContain("Subpage");
  });

  it("names the subpage when there are several", () => {
    expect(ALT_MARKUP(renderAlt(publishedNumbered(201), 3))).toContain("<p>Subpage 4 of 6</p>");
  });
});

describe("row22Text (requirement 10.2)", () => {
  it("is none for a static page", () => {
    expect(row22Text(publishedNumbered(100))).toBeNull();
    expect(renderAlt(publishedNumbered(899), 0)).not.toContain("Source:");
  });

  it("names the source and the time of the last good fetch when fresh", () => {
    const text = row22Text(publishedNumbered(600));
    expect(text).toMatch(/^Source: USGS, public domain\. Updated \d\d:\d\d UTC\.$/);
  });

  it("says the data is delayed, with the last good time, when stale", () => {
    expect(row22Text(publishedNumbered(600, true))).toMatch(
      /^Data delayed: last good \d\d:\d\d UTC\.$/,
    );
    expect(row22Text({ ...publishedNumbered(600, true), dataAt: null })).toBe("Data delayed.");
  });

  it("names a computed page's source and its compile time", () => {
    expect(row22Text(publishedNumbered(601))).toBe(
      "Source: Computed by Page 100. Updated 14:05 UTC.",
    );
  });
});

describe("not-in-service and missing-subpage views (requirement 11.4)", () => {
  it("frames page 123 with a 404 status and no ETag", () => {
    const view = notInServiceView(123, NOW);
    expect(view?.status).toBe(404);
    expect(view?.page.etag).toBe("");
    expect(view?.page.screens).toHaveLength(1);
    const html = renderHtml(view ?? pageView(publishedNumbered(100), 0, NOW, false), URLS);
    expect(html).toContain("<title>123 Page not in service - Page 100</title>");
    expect(html).toContain('href="/120"');
    expect(html).toContain('href="/200"');
  });

  it("gives none for a page in service or out of range", () => {
    expect(notInServiceView(201, NOW)).toBeUndefined();
    expect(notInServiceView(99, NOW)).toBeUndefined();
  });

  it("says how many subpages the page has, without echoing the request", () => {
    const view = missingSubpageView(publishedNumbered(201), NOW);
    expect(view?.status).toBe(404);
    const html = renderHtml(view ?? pageView(publishedNumbered(100), 0, NOW, false), URLS);
    expect(html).toContain("Page 201 has 6 subpages.");
    expect(html).toContain('<a href="/201">201 Five-day outlook</a>');
  });

  it("uses the singular for a page with one subpage", () => {
    const view = missingSubpageView(publishedNumbered(100), NOW);
    const html = renderAlt(view?.page ?? publishedNumbered(100), 0);
    expect(html).toContain("Page 100 has 1 subpage.");
  });
});

describe("renderJson (requirement 11.3)", () => {
  it("holds the fields, every subpage's 24 rows and its alt", () => {
    const parsed: unknown = JSON.parse(renderJson(pageView(publishedNumbered(201), 0, NOW, false)));
    expect(parsed).toMatchObject({
      number: 201,
      title: "Five-day outlook",
      editor: "rules",
      stale: false,
    });
    const subpages = (parsed as { subpages: { rows: string[]; alt: unknown[] }[] }).subpages;
    expect(subpages).toHaveLength(6);
    for (const subpage of subpages) {
      expect(subpage.rows).toHaveLength(24);
      expect(subpage.alt.length).toBeGreaterThan(0);
    }
    expect(subpages[0]?.rows[0]).toContain("Wed 11 Nov 14:05:09");
  });
});

describe("renderStatusJson", () => {
  it("lists every held page in order with its failure count", () => {
    const store = storeOfBootPages();
    const parsed = JSON.parse(renderStatusJson(store)) as {
      aiEditor: boolean;
      editor: unknown;
      pages: { number: number; publishFailures: number }[];
    };
    expect(parsed.aiEditor).toBe(false);
    expect(parsed.editor).toBeNull();
    expect(parsed.pages.map((p) => p.number)).toEqual(store.list().map((p) => p.number));
    expect(parsed.pages.every((p) => p.publishFailures === 0)).toBe(true);
  });
});

describe("renderPlain", () => {
  it("gives text for a terminal and a document with a link and the form otherwise", () => {
    expect(renderPlain("not-found", true, URLS)).toBe(
      "Not found\nPage numbers have three digits, from 100 to 899.\nTry /100\n",
    );
    const html = renderPlain("bad-request", false, URLS);
    expect(html).toContain("<h1>Enter a page number</h1>");
    expect(html).toContain('<a href="/100">');
    expect(html).toContain('action="/go"');
  });
});
