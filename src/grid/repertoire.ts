/** Inclusive code point ranges of the character repertoire, in ascending order. */
const RANGES: readonly (readonly [number, number])[] = [
  [0x20, 0x7e], // printable ASCII, space included
  [0xa3, 0xa3], // pound sign
  [0xb0, 0xb0], // degree sign
  [0xc0, 0xd6], // Latin-1 letters, before the multiplication sign
  [0xd8, 0xf6], // Latin-1 letters, between the multiplication and division signs
  [0xf8, 0xff], // Latin-1 letters, after the division sign
  [0x20ac, 0x20ac], // euro sign
];

/** The 160 code points a text cell may hold, in ascending order (grid-rules.md, Repertoire). */
export const REPERTOIRE: readonly number[] = Object.freeze(
  RANGES.flatMap(([low, high]) => Array.from({ length: high - low + 1 }, (_, i) => low + i)),
);

/** True exactly when `cp` is one of the code points in `REPERTOIRE`. */
export function isRepertoireCodePoint(cp: number): boolean {
  return Number.isInteger(cp) && RANGES.some(([low, high]) => cp >= low && cp <= high);
}
