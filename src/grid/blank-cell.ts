import type { Cell, TextCell } from "./types.js";

/** A white-on-black text space. Every blank cell in the grid is this value or equal to it. */
export const BLANK_CELL: TextCell = Object.freeze({
  kind: "text",
  ch: " ",
  fg: "white",
  bg: "black",
  conceal: false,
});

/** True when the cell is a white-on-black, unconcealed text space. */
export function isBlankCell(cell: Cell): boolean {
  return (
    cell.kind === "text" &&
    cell.ch === " " &&
    cell.fg === "white" &&
    cell.bg === "black" &&
    !cell.conceal
  );
}
