import type { Colour } from "./types.js";

/** The codes a grid validator can report. A code is never renamed or reused (requirement 10.1). */
export const GRID_VIOLATION_CODES = [
  "not-array",
  "row-count",
  "row-not-array",
  "row-length",
  "unreadable",
  "cell-not-object",
  "cell-kind",
  "cell-field-unknown",
  "text-ch",
  "text-repertoire",
  "mosaic-bits",
  "mosaic-separated",
  "colour",
  "conceal",
  "contrast",
] as const;

export type GridViolationCode = (typeof GRID_VIOLATION_CODES)[number];

/** The fields every violation has. `row` and `col` are `null` when the problem has no such place. */
interface Located<C extends GridViolationCode> {
  readonly code: C;
  readonly row: number | null;
  readonly col: number | null;
  readonly message: string;
}

/** One problem found by `validateGrid` or `validateContentRows`, discriminated on `code`. */
export type GridViolation =
  | Located<"not-array">
  | (Located<"row-count"> & { readonly expected: number; readonly actual: number })
  | Located<"row-not-array">
  | (Located<"row-length"> & { readonly expected: 40; readonly actual: number })
  | Located<"unreadable">
  | Located<"cell-not-object">
  | Located<"cell-kind">
  | (Located<"cell-field-unknown"> & { readonly field: string })
  | Located<"text-ch">
  | (Located<"text-repertoire"> & { readonly codePoint: number })
  | Located<"mosaic-bits">
  | Located<"mosaic-separated">
  | (Located<"colour"> & { readonly field: "fg" | "bg" })
  | Located<"conceal">
  | (Located<"contrast"> & { readonly fg: Colour; readonly bg: Colour; readonly ratio: number });

/** A code point as `U+` and at least four upper-case hex digits, for example `U+0009`. */
export function formatCodePoint(codePoint: number): string {
  return `U+${codePoint.toString(16).toUpperCase().padStart(4, "0")}`;
}

/** The text in double quotes when it is 1 to 32 printable ASCII characters, otherwise `undefined`. */
export function quoteIfSafe(text: string): string | undefined {
  return /^[ -~]{1,32}$/.test(text) ? `"${text}"` : undefined;
}

/** The position prefix of a message: `row R col C: `, `row R: `, or nothing when there is no row. */
export function locate(row: number | null, col: number | null): string {
  if (row === null) return "";
  return col === null ? `row ${String(row)}: ` : `row ${String(row)} col ${String(col)}: `;
}
