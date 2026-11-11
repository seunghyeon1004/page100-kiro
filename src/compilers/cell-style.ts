import type { Colour } from "../grid/types.js";

/** Colours of a run of cells. Default white on black, unconcealed. */
export interface CellStyle {
  readonly fg: Colour;
  readonly bg: Colour;
  readonly conceal?: boolean;
}

/** White on black. */
export const DEFAULT_STYLE: CellStyle = Object.freeze({ fg: "white", bg: "black" });
