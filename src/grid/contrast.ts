import { COLOUR_RGB, type Rgb } from "./colours.js";
import type { Colour } from "./types.js";

/** The WCAG 2.x threshold for text, compared unrounded (grid-rules.md, Text contrast). */
const TEXT_CONTRAST_MIN = 4.5;

/** Converts one 0 to 255 channel to linear light, as WCAG 2.x defines it. */
function linearise(channel: number): number {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/** WCAG 2.x relative luminance of an RGB triple, from 0 (black) to 1 (white), unrounded. */
export function relativeLuminance([r, g, b]: Rgb): number {
  return 0.2126 * linearise(r) + 0.7152 * linearise(g) + 0.0722 * linearise(b);
}

/**
 * Contrast ratio of two colours. It runs from 1 (identical colours) up to the ratio of black on
 * white. The result is the same whichever colour is the foreground.
 */
export function contrastRatio(a: Colour, b: Colour): number {
  const luminanceA = relativeLuminance(COLOUR_RGB[a]);
  const luminanceB = relativeLuminance(COLOUR_RGB[b]);
  return (Math.max(luminanceA, luminanceB) + 0.05) / (Math.min(luminanceA, luminanceB) + 0.05);
}

/** True when text in `fg` on `bg` meets the 4.5:1 threshold, compared unrounded. */
export function isLegibleText(fg: Colour, bg: Colour): boolean {
  return contrastRatio(fg, bg) >= TEXT_CONTRAST_MIN;
}
