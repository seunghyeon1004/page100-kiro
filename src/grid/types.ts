/** The eight colours of the grid (grid-rules.md, Colours). */
export type Colour = "black" | "red" | "green" | "yellow" | "blue" | "magenta" | "cyan" | "white";

export interface TextCell {
  readonly kind: "text";
  readonly ch: string;
  readonly fg: Colour;
  readonly bg: Colour;
  readonly conceal: boolean;
}

export interface MosaicCell {
  readonly kind: "mosaic";
  readonly bits: number;
  readonly separated: boolean;
  readonly fg: Colour;
  readonly bg: Colour;
  readonly conceal: boolean;
}

export type Cell = TextCell | MosaicCell;

/** A list of rows of cells. The row and cell counts are checked by the validators, not by the type. */
export type Rows = readonly (readonly Cell[])[];

/** 24 rows of 40 cells by contract. Only `validateGrid` can produce a `ValidPage`. */
export type Grid = Rows;

/** 20 rows of 40 cells (page rows 2 to 21) by contract. */
export type ContentRows = Rows;

declare const validPageBrand: unique symbol;
declare const validContentBrand: unique symbol;

/** A 24 x 40 grid that `validateGrid` has checked. A plain `Grid` is not assignable to it. */
export type ValidPage = Grid & { readonly [validPageBrand]: true };

/** A 20 x 40 set of content rows that `validateContentRows` has checked. */
export type ValidContent = ContentRows & { readonly [validContentBrand]: true };

/** An array with at least one element. */
export type NonEmpty<T> = readonly [T, ...T[]];
