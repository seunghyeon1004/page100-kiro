const SPACE = 0x20;
const LEFT_HALF_BLOCK = 0x258c;
const RIGHT_HALF_BLOCK = 0x2590;
const FULL_BLOCK = 0x2588;
const SEXTANT_FIRST = 0x1fb00;
const SEXTANT_LAST = 0x1fb3b;

/**
 * The Unicode code point for a 2x3 mosaic pattern v, from 0 to 63 (grid-rules.md, Mosaics).
 * Returns `undefined` when v is not an integer from 0 to 63.
 */
export function mosaicCodePoint(v: number): number | undefined {
  if (!Number.isInteger(v) || v < 0 || v > 63) return undefined;
  if (v === 0) return SPACE;
  if (v === 21) return LEFT_HALF_BLOCK;
  if (v === 42) return RIGHT_HALF_BLOCK;
  if (v === 63) return FULL_BLOCK;
  // Skip the two patterns (21 and 42) that have their own block code points.
  return SEXTANT_FIRST + v - 1 - (v > 21 ? 1 : 0) - (v > 42 ? 1 : 0);
}

/**
 * The pattern v for a code point, the inverse of `mosaicCodePoint`. Returns `undefined` for any
 * code point that is not one of the 64 mosaic forms.
 */
export function mosaicBitsOf(cp: number): number | undefined {
  if (cp === SPACE) return 0;
  if (cp === LEFT_HALF_BLOCK) return 21;
  if (cp === RIGHT_HALF_BLOCK) return 42;
  if (cp === FULL_BLOCK) return 63;
  if (cp >= SEXTANT_FIRST && cp <= SEXTANT_LAST) {
    const k = cp - SEXTANT_FIRST + 1;
    return k + (k >= 21 ? 1 : 0) + (k >= 41 ? 1 : 0);
  }
  return undefined;
}
