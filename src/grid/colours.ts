import type { Colour } from "./types.js";

/** The eight colour names, in grid-rules.md order. */
export const COLOURS = [
  "black",
  "red",
  "green",
  "yellow",
  "blue",
  "magenta",
  "cyan",
  "white",
] as const satisfies readonly Colour[];

/** An RGB triple, each channel 0 to 255. */
export type Rgb = readonly [number, number, number];

/** The exact RGB values of grid-rules.md. The CSS, ANSI and JSON renderers use these. */
export const COLOUR_RGB: Readonly<Record<Colour, Rgb>> = Object.freeze({
  black: [0, 0, 0],
  red: [255, 0, 0],
  green: [0, 255, 0],
  yellow: [255, 255, 0],
  blue: [0, 0, 255],
  magenta: [255, 0, 255],
  cyan: [0, 255, 255],
  white: [255, 255, 255],
});

/**
 * The foreground markup letter of each colour, `{r}` for red and so on. The background letter is
 * the same letter in upper case, `{R}`.
 */
export const COLOUR_LETTER: Readonly<Record<Colour, string>> = Object.freeze({
  black: "k",
  red: "r",
  green: "g",
  yellow: "y",
  blue: "b",
  magenta: "m",
  cyan: "c",
  white: "w",
});

/** True when `value` is one of the eight colour names. */
export function isColour(value: unknown): value is Colour {
  return COLOURS.some((colour) => colour === value);
}
