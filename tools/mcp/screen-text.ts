import { COLOUR_LETTER } from "../../src/grid/colours.js";
import { mosaicCodePoint } from "../../src/grid/mosaic-code-point.js";
import type { Cell, ValidPage } from "../../src/grid/types.js";
import type { AltBlock } from "../../src/pages/alt-block.js";

function glyph(cell: Cell): string {
  if (cell.kind === "text") return cell.ch;
  const codePoint = mosaicCodePoint(cell.bits);
  return codePoint === undefined ? "?" : String.fromCodePoint(codePoint);
}

/** The 24 rows as plain text, mosaics as Unicode, one line per row, 40 characters each. */
export function screenText(page: ValidPage): string {
  return page.map((row) => row.map(glyph).join("")).join("\n");
}

/** The 24 rows with every cell shown as the letter of its foreground colour (k r g y b m c w). */
export function screenColours(page: ValidPage): string {
  return page.map((row) => row.map((cell) => COLOUR_LETTER[cell.fg]).join("")).join("\n");
}

/** How many cells are concealed and how many mosaic cells are separated, as one line. */
export function screenModes(page: ValidPage): string {
  let concealed = 0;
  let separated = 0;
  for (const row of page) {
    for (const cell of row) {
      if (cell.conceal) concealed += 1;
      if (cell.kind === "mosaic" && cell.separated) separated += 1;
    }
  }
  return `concealed cells: ${String(concealed)}; separated mosaic cells: ${String(separated)}`;
}

function blockText(block: AltBlock): string {
  switch (block.kind) {
    case "heading":
      return `${"#".repeat(block.level)} ${block.text}`;
    case "paragraph":
      return block.text;
    case "list":
      return block.items
        .map((item, i) => (block.ordered ? `${String(i + 1)}. ${item}` : `- ${item}`))
        .join("\n");
    case "table":
      return [block.headers, ...block.rows].map((row) => row.join(" | ")).join("\n");
    case "link":
      return "page" in block.target
        ? `${block.text} -> page ${String(block.target.page)}`
        : `${block.text} -> ${block.target.url}`;
    case "concealed":
      return `[hidden: ${block.summary}] ${block.text}`;
    default: {
      const unreachable: never = block;
      return unreachable;
    }
  }
}

/** The text alternative as plain text, one blank line between blocks. */
export function altText(blocks: readonly AltBlock[]): string {
  return blocks.map(blockText).join("\n\n");
}

/** The shared report of `preview_markup` and `render_page`. */
export function screenReport(heading: string, page: ValidPage, alt: readonly AltBlock[]): string {
  return [
    heading,
    "",
    "-- screen: 24 rows of 40 cells, row 0 first --",
    screenText(page),
    "",
    "-- foreground colour of every cell (k black, r red, g green, y yellow, b blue, m magenta, c cyan, w white) --",
    screenColours(page),
    "",
    screenModes(page),
    "",
    "-- text alternative --",
    altText(alt),
  ].join("\n");
}
