import { describe, expect, it } from "vitest";
import { validateContentRows } from "../../src/grid/validate-content-rows.js";
import {
  SYMBOL_BITMAPS,
  drawSymbol,
  symbolCells,
  weatherKind,
  weatherLabel,
} from "../../src/compilers/weather-symbol.js";
import type { WeatherKind } from "../../src/compilers/weather-symbol.js";

const KINDS: readonly WeatherKind[] = ["clear", "cloud", "rain", "snow", "storm", "fog"];

describe("weatherKind: the WMO table of requirement 5.4", () => {
  it("maps every code of the design table", () => {
    const expected = new Map<number, WeatherKind>();
    const add = (kind: WeatherKind, codes: number[]): void => {
      codes.forEach((c) => expected.set(c, kind));
    };
    add("clear", [0, 1]);
    add("cloud", [2, 3]);
    add("fog", [45, 48]);
    add("rain", [51, 52, 53, 54, 55, 56, 57, 61, 62, 63, 64, 65, 66, 67, 80, 81, 82]);
    add("snow", [71, 72, 73, 74, 75, 76, 77, 85, 86]);
    add("storm", [95, 96, 97, 98, 99]);
    for (let code = -2; code <= 120; code++) {
      expect(weatherKind(code), `code ${String(code)}`).toBe(expected.get(code) ?? null);
    }
  });

  it("gives null for null and for a code that is not a whole number", () => {
    expect(weatherKind(null)).toBeNull();
    expect(weatherKind(1.5)).toBeNull();
    expect(weatherKind(Number.NaN)).toBeNull();
  });

  it("labels each symbol and n/a for none", () => {
    expect(KINDS.map(weatherLabel)).toEqual(["Clear", "Cloudy", "Rain", "Snow", "Storm", "Fog"]);
    expect(weatherLabel(null)).toBe("n/a");
  });
});

describe("symbols", () => {
  it("draws each bitmap of the design exactly", () => {
    const design: Record<WeatherKind, string> = {
      clear: "..##../.####./######/######/.####./..##..",
      cloud: "....../..##../.####./######/######/......",
      rain: ".####./######/....../#.#.#./.#.#.#/#.#.#.",
      snow: ".####./######/....../#..#../..#..#/#..#..",
      storm: ".####./######/...#../..##../.##.../.#....",
      fog: "######/....../######/....../######/......",
    };
    for (const kind of KINDS) {
      expect(SYMBOL_BITMAPS[kind].join("/")).toBe(design[kind]);
      const canvas = drawSymbol(kind);
      expect(canvas.cols).toBe(3);
      expect(canvas.rows).toBe(2);
      const drawn = canvas.pixels.map((row) => row.map((on) => (on ? "#" : ".")).join(""));
      expect(drawn.join("/")).toBe(design[kind]);
    }
  });

  it("makes cells that are valid content in the symbol's colour", () => {
    expect(symbolCells("clear")[0]?.[1]).toMatchObject({ fg: "yellow", bg: "black" });
    expect(symbolCells("rain")[1]?.[0]).toMatchObject({ fg: "cyan" });
    const rows = Array.from({ length: 20 }, (_, r) =>
      Array.from(
        { length: 40 },
        (_, c) =>
          symbolCells("storm")[r]?.[c] ?? {
            kind: "text" as const,
            ch: " ",
            fg: "white" as const,
            bg: "black" as const,
            conceal: false,
          },
      ),
    );
    expect(validateContentRows(rows).ok).toBe(true);
  });
});
