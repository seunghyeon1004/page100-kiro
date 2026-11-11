import { isBlankCell } from "../grid/blank-cell.js";
import type { ValidContent } from "../grid/types.js";
import { serialiseRow } from "./serialise-row.js";

/**
 * The canonical markup of content rows (requirement 16.6). It writes the rows up to the last one
 * that has a non-blank cell, each followed by one LF. When every row is blank it writes one LF.
 */
export function serialiseContent(content: ValidContent): string {
  let last = -1;
  content.forEach((row, index) => {
    if (row.some((cell) => !isBlankCell(cell))) last = index;
  });
  if (last === -1) return "\n";
  return content
    .slice(0, last + 1)
    .map((row) => `${serialiseRow(row)}\n`)
    .join("");
}
