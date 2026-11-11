import type { Cell, Colour } from "../grid/types.js";
import { canvasToCells, createCanvas, setPixel } from "./mosaic-canvas.js";
import type { Canvas } from "./mosaic-canvas.js";

// WMO weather codes to six symbols (rule-compilers requirement 5.4, design.md, "Drawing").

export type WeatherKind = "clear" | "cloud" | "rain" | "snow" | "storm" | "fog";

function between(code: number, low: number, high: number): boolean {
  return code >= low && code <= high;
}

/** The symbol of a WMO weather code, or `null` for a missing or unknown code. */
export function weatherKind(code: number | null): WeatherKind | null {
  if (code === null || !Number.isInteger(code)) return null;
  if (code === 0 || code === 1) return "clear";
  if (code === 2 || code === 3) return "cloud";
  if (code === 45 || code === 48) return "fog";
  if (between(code, 51, 57) || between(code, 61, 67) || between(code, 80, 82)) return "rain";
  if (between(code, 71, 77) || code === 85 || code === 86) return "snow";
  if (between(code, 95, 99)) return "storm";
  return null;
}

const LABELS: Readonly<Record<WeatherKind, string>> = {
  clear: "Clear",
  cloud: "Cloudy",
  fog: "Fog",
  rain: "Rain",
  snow: "Snow",
  storm: "Storm",
};

/** `Clear`, `Cloudy`, `Fog`, `Rain`, `Snow`, `Storm`, or `n/a` for no symbol. */
export function weatherLabel(kind: WeatherKind | null): string {
  return kind === null ? "n/a" : LABELS[kind];
}

/** Six rows of six pixels, `#` on, top to bottom. */
export const SYMBOL_BITMAPS: Readonly<Record<WeatherKind, readonly string[]>> = {
  clear: ["..##..", ".####.", "######", "######", ".####.", "..##.."],
  cloud: ["......", "..##..", ".####.", "######", "######", "......"],
  rain: [".####.", "######", "......", "#.#.#.", ".#.#.#", "#.#.#."],
  snow: [".####.", "######", "......", "#..#..", "..#..#", "#..#.."],
  storm: [".####.", "######", "...#..", "..##..", ".##...", ".#...."],
  fog: ["######", "......", "######", "......", "######", "......"],
};

/** The colour of each symbol. */
export const SYMBOL_COLOURS: Readonly<Record<WeatherKind, Colour>> = {
  clear: "yellow",
  cloud: "white",
  rain: "cyan",
  snow: "white",
  storm: "yellow",
  fog: "white",
};

/** The symbol's 6 x 6 pixels as a canvas of 3 columns by 2 rows. */
export function drawSymbol(kind: WeatherKind): Canvas {
  const canvas = createCanvas(3, 2);
  SYMBOL_BITMAPS[kind].forEach((line, y) => {
    Array.from(line).forEach((ch, x) => {
      if (ch === "#") setPixel(canvas, x, y);
    });
  });
  return canvas;
}

/** The symbol as 2 rows of 3 cells on black, in the symbol's colour. */
export function symbolCells(kind: WeatherKind): Cell[][] {
  return canvasToCells(drawSymbol(kind), { fg: SYMBOL_COLOURS[kind], bg: "black" });
}
