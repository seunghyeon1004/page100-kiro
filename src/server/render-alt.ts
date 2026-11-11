import { ATTRIBUTION } from "../pages/attribution.js";
import type { AltBlock } from "../pages/alt-block.js";
import { formatUtcTime } from "../pages/frame-time.js";
import { escapeHtml } from "./escape-html.js";
import type { PublishedPage } from "./store.js";

// The text alternative (server-and-viewer requirement 10, design.md, "Alt blocks"), built from
// the compiled page's blocks, never read back from the grid.

/** The https form of a URL, or `null` for anything else (requirement 9.6). */
function httpsHref(url: string): string | null {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" ? parsed.href : null;
  } catch {
    return null;
  }
}

function tableHtml(headers: readonly string[], rows: readonly (readonly string[])[]): string {
  const head = headers.map((h) => `<th scope="col">${escapeHtml(h)}</th>`).join("");
  const body = rows
    .map((row) => {
      const cells = headers.map((_, i) => row[i] ?? "");
      const [first = "", ...rest] = cells;
      return `<tr><th scope="row">${escapeHtml(first)}</th>${rest.map((c) => `<td>${escapeHtml(c)}</td>`).join("")}</tr>`;
    })
    .join("");
  return `<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}

function blockHtml(block: AltBlock): string {
  switch (block.kind) {
    case "heading": {
      const tag = block.level === 2 ? "h2" : "h3";
      return `<${tag}>${escapeHtml(block.text)}</${tag}>`;
    }
    case "paragraph":
      return `<p>${escapeHtml(block.text)}</p>`;
    case "list": {
      const tag = block.ordered ? "ol" : "ul";
      return `<${tag}>${block.items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</${tag}>`;
    }
    case "table":
      return tableHtml(block.headers, block.rows);
    case "link": {
      if ("page" in block.target) {
        return `<p><a href="/${String(block.target.page)}">${escapeHtml(block.text)}</a></p>`;
      }
      const href = httpsHref(block.target.url);
      return href === null
        ? `<p>${escapeHtml(block.text)}</p>`
        : `<p><a href="${escapeHtml(href)}" rel="noopener noreferrer">${escapeHtml(block.text)}</a></p>`;
    }
    case "concealed":
      return `<details><summary>${escapeHtml(block.summary)}</summary><p>${escapeHtml(block.text)}</p></details>`;
    default: {
      const unreachable: never = block;
      return unreachable;
    }
  }
}

/**
 * The paragraph of row 22, built from `ATTRIBUTION`, `dataAt` and `stale` (requirement 10.2);
 * `null` for a static page.
 */
export function row22Text(page: PublishedPage): string | null {
  const { source } = page.def;
  if (source === "static") return null;
  if (page.stale) {
    return page.dataAt === null
      ? "Data delayed."
      : `Data delayed: last good ${formatUtcTime(page.dataAt)}.`;
  }
  const updated = page.dataAt === null ? "" : ` Updated ${formatUtcTime(page.dataAt)}.`;
  return `Source: ${ATTRIBUTION[source]}.${updated}`;
}

/** `<section id="alt">` for one subpage (0-based): the one `h1`, the subpage line, the blocks, row 22. */
export function renderAlt(page: PublishedPage, subpage: number): string {
  const count = page.alts.length;
  const blocks = page.alts[subpage] ?? page.alts[0];
  const index = page.alts[subpage] === undefined ? 0 : subpage;
  const parts = [
    `<h1 id="alt-h">${escapeHtml(`${String(page.number)} ${page.def.title}`)}</h1>`,
    ...(count > 1 ? [`<p>Subpage ${String(index + 1)} of ${String(count)}</p>`] : []),
    ...blocks.map(blockHtml),
  ];
  const row22 = row22Text(page);
  if (row22 !== null) parts.push(`<p>${escapeHtml(row22)}</p>`);
  return `<section id="alt" class="alt vh" aria-labelledby="alt-h">${parts.join("")}</section>`;
}
