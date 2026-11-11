import { escapeHtml } from "./escape-html.js";
import type { AssetUrls } from "./render-html.js";

// The plain 404 and 400 pages (server-and-viewer design.md, "Other formats and not-found screens").

export type PlainKind = "not-found" | "bad-request";

const HEADING: Readonly<Record<PlainKind, string>> = {
  "not-found": "Not found",
  "bad-request": "Enter a page number",
};

const SENTENCE = "Page numbers have three digits, from 100 to 899.";

/** The page as text (for a terminal agent) or as a small document with a link to 100 and the form. */
export function renderPlain(kind: PlainKind, terminal: boolean, urls: AssetUrls): string {
  const heading = HEADING[kind];
  if (terminal) return `${heading}\n${SENTENCE}\nTry /100\n`;
  return (
    '<!doctype html><html lang="en"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="dark">' +
    `<title>${heading} - Page 100</title>` +
    `<link rel="stylesheet" href="${escapeHtml(urls.css)}">` +
    '<link rel="icon" href="/favicon.svg" type="image/svg+xml"></head>' +
    `<body><main class="plain"><h1>${heading}</h1><p>${SENTENCE}</p>` +
    '<p><a href="/100">Go to page 100</a></p>' +
    '<form class="go" action="/go" method="get"><label for="p">Page number</label>' +
    '<input id="p" name="p" inputmode="numeric" pattern="[0-9]{3}" maxlength="3" required autocomplete="off">' +
    '<button type="submit">Go</button></form></main></body></html>'
  );
}
