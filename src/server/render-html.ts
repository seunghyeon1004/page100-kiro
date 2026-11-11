import { COLOUR_LETTER } from "../grid/colours.js";
import type { Colour, ValidPage } from "../grid/types.js";
import { nextInService, previousInService } from "../pages/page-lookup.js";
import { stampClock } from "../pages/stamp-clock.js";
import { escapeHtml } from "./escape-html.js";
import { renderAlt } from "./render-alt.js";
import { renderScreenHtml } from "./render-screen.js";
import type { View } from "./views.js";

// The HTML document and the fragment (server-and-viewer requirements 9 and 11.4, design.md,
// "HTML document"). The fragment is the `#view` element, and the document embeds that very string.

/** The content-hashed URLs of the three assets a page loads. */
export interface AssetUrls {
  readonly css: string;
  readonly js: string;
  readonly font: string;
}

const QUICK_COLOURS: readonly Colour[] = ["red", "green", "yellow", "blue"];

function capitalised(colour: Colour): string {
  return `${colour.slice(0, 1).toUpperCase()}${colour.slice(1)}`;
}

/** The screen of a view, stamped with the request clock. */
export function screenOf(view: View): ValidPage {
  const screen = view.page.screens[view.subpage] ?? view.page.screens[0];
  return stampClock(screen, view.now);
}

function pageHref(number: number | undefined, fallback: number): string {
  return `/${String(number ?? fallback)}`;
}

/** The `#view` element: the screen, then the text alternative, with the data attributes of the client. */
export function renderFrag(view: View): string {
  const { page } = view;
  const index = page.screens[view.subpage] === undefined ? 0 : view.subpage;
  const links = page.def.links.map((link) => `${String(link.target)} ${link.label}`).join("|");
  const attributes = [
    `data-page="${String(page.number)}"`,
    `data-title="${escapeHtml(page.def.title)}"`,
    `data-s="${String(index + 1)}"`,
    `data-m="${String(page.screens.length)}"`,
    `data-prev="${String(previousInService(page.number) ?? 100)}"`,
    `data-next="${String(nextInService(page.number) ?? 100)}"`,
    `data-links="${escapeHtml(links)}"`,
  ];
  return `<div id="view" class="view" ${attributes.join(" ")}>${renderScreenHtml(screenOf(view))}${renderAlt(page, index)}</div>`;
}

function subpageHref(number: number, subpage: number): string {
  return subpage === 1 ? `/${String(number)}` : `/${String(number)}?s=${String(subpage)}`;
}

function navHtml(view: View): string {
  const { page } = view;
  const count = page.screens.length;
  const index = page.screens[view.subpage] === undefined ? 0 : view.subpage;
  const current = index + 1;
  const quick = page.def.links.map((link, k) => {
    const colour = QUICK_COLOURS[k] ?? "red";
    return (
      `<a id="q${String(k + 1)}" class="q b${COLOUR_LETTER[colour]}" href="/${String(link.target)}">` +
      `<span class="vh">${capitalised(colour)}: </span>${escapeHtml(link.label)}</a>`
    );
  });
  const up = current === 1 ? count : current - 1;
  const down = current === count ? 1 : current + 1;
  const subpageLink = (id: string, label: string, target: number): string =>
    count > 1
      ? `<a id="${id}" href="${subpageHref(page.number, target)}">${label}</a>`
      : `<a id="${id}" aria-disabled="true">${label}</a>`;
  const textHref =
    current === 1
      ? `/${String(page.number)}.txt`
      : `/${String(page.number)}.txt?s=${String(current)}`;
  const movement = [
    `<a id="prev" href="${pageHref(previousInService(page.number), 100)}">Previous page</a>`,
    `<a id="next" href="${pageHref(nextInService(page.number), 100)}">Next page</a>`,
    subpageLink("sup", "Subpage up", up),
    subpageLink("sdown", "Subpage down", down),
    `<a id="txt" class="nojs" href="${textHref}">Text</a>`,
    `<button id="tv" type="button" aria-pressed="false" class="js-only" hidden>Text</button>`,
    `<a id="idx" href="/100">Index</a>`,
  ];
  return `<nav class="nav" aria-label="Page links">${[...quick, ...movement].join("")}</nav>`;
}

function keypadHtml(view: View): string {
  const key = (value: string, label: string, pressed?: boolean): string =>
    `<button type="button" data-key="${value}"${pressed === undefined ? "" : ` aria-pressed="${String(pressed)}"`}>${label}</button>`;
  const buttons = [
    ...["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => key(d, d)),
    key("h", "Hold", false),
    key("0", "0"),
    key("r", "Reveal", view.reveal),
  ];
  return `<div id="keypad" class="keypad" hidden>${buttons.join("")}</div>`;
}

const FORM =
  '<form class="go" action="/go" method="get"><label for="p">Page number</label>' +
  '<input id="p" name="p" inputmode="numeric" pattern="[0-9]{3}" maxlength="3" required autocomplete="off">' +
  '<button type="submit">Go</button></form>';

/** The thin row of small links under the keypad (owner's viewer notes, 2026-11-11). */
const FOOT =
  '<div class="foot"><a id="about" href="/801">About</a>' +
  '<a id="src" href="https://github.com/seunghyeon1004/page100-kiro" rel="noopener noreferrer">Source on GitHub</a></div>';

/** The complete document of a view. */
export function renderHtml(view: View, urls: AssetUrls): string {
  const { page } = view;
  const title = `${String(page.number)} ${page.def.title}`;
  const description = `Page ${String(page.number)}, ${page.def.title}: one 40 by 24 character screen with a text version.`;
  const head =
    '<!doctype html><html lang="en"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="dark">' +
    `<title>${escapeHtml(title)} - Page 100</title>` +
    `<meta name="description" content="${escapeHtml(description)}">` +
    `<link rel="stylesheet" href="${escapeHtml(urls.css)}">` +
    `<link rel="preload" href="${escapeHtml(urls.font)}" as="font" type="font/woff2" crossorigin>` +
    `<link rel="icon" href="/favicon.svg" type="image/svg+xml"><script type="module" src="${escapeHtml(urls.js)}"></script>` +
    "</head>";
  const body =
    `<body><main class="tv"><input type="checkbox" id="reveal" class="reveal"${view.reveal ? " checked" : ""}>` +
    '<label for="reveal" class="nojs">Reveal</label>' +
    renderFrag(view) +
    navHtml(view) +
    FORM +
    keypadHtml(view) +
    FOOT +
    '</main><div id="live" class="vh" aria-live="polite"></div></body></html>';
  return head + body;
}
