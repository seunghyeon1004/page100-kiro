import type { NonEmpty } from "../grid/types.js";

/** The codes the markup parser can report. A code is never renamed or reused (requirement 15.1). */
export const MARKUP_ERROR_CODES = [
  "row-count",
  "cr",
  "row-too-long",
  "tag-unknown",
  "tag-unterminated",
  "mode-already-on",
  "mode-not-on",
  "char-not-allowed",
] as const;

export type MarkupErrorCode = (typeof MARKUP_ERROR_CODES)[number];

/** The fields every markup error has. `col` is a cell index, or `null` for `row-count` only. */
interface Positioned<C extends MarkupErrorCode> {
  readonly code: C;
  readonly row: number;
  readonly col: number | null;
  readonly message: string;
}

/** One problem found by the parser, discriminated on `code`. */
export type MarkupError =
  | (Positioned<"row-count"> & { readonly expected: number; readonly actual: number })
  | Positioned<"cr">
  | (Positioned<"row-too-long"> & { readonly cells: number })
  | (Positioned<"tag-unknown"> & { readonly tag: string })
  | Positioned<"tag-unterminated">
  | (Positioned<"mode-already-on"> & { readonly mode: "conceal" | "separated" })
  | (Positioned<"mode-not-on"> & { readonly mode: "conceal" | "separated" })
  | (Positioned<"char-not-allowed"> & { readonly codePoint: number });

/** The parser's answer: the parsed value, or at least one error. */
export type ParseResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly errors: NonEmpty<MarkupError> };
