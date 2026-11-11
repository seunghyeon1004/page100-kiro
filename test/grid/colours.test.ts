import { describe, expect, it } from "vitest";
import { COLOUR_LETTER, COLOUR_RGB, COLOURS, isColour } from "../../src/grid/colours.js";
import { BLANK_CELL } from "../../src/grid/blank-cell.js";
import {
  CONTENT_FIRST_ROW,
  CONTENT_ROW_COUNT,
  GRID_COLS,
  GRID_ROWS,
} from "../../src/grid/dimensions.js";

describe("dimensions (requirement 2.1)", () => {
  it("defines the page and content sizes", () => {
    expect(GRID_ROWS).toBe(24);
    expect(GRID_COLS).toBe(40);
    expect(CONTENT_FIRST_ROW).toBe(2);
    expect(CONTENT_ROW_COUNT).toBe(20);
  });
});

describe("blank cell (requirement 2.3)", () => {
  it("is a frozen white-on-black text space", () => {
    expect(BLANK_CELL).toEqual({ kind: "text", ch: " ", fg: "white", bg: "black", conceal: false });
    expect(Object.isFrozen(BLANK_CELL)).toBe(true);
  });
});

describe("colours (requirements 3.1 to 3.3)", () => {
  it("lists the eight colours in grid-rules.md order (3.1)", () => {
    expect(COLOURS).toEqual([
      "black",
      "red",
      "green",
      "yellow",
      "blue",
      "magenta",
      "cyan",
      "white",
    ]);
  });

  it("gives each colour its RGB value from the colour table (3.2)", () => {
    expect(COLOUR_RGB).toEqual({
      black: [0, 0, 0],
      red: [255, 0, 0],
      green: [0, 255, 0],
      yellow: [255, 255, 0],
      blue: [0, 0, 255],
      magenta: [255, 0, 255],
      cyan: [0, 255, 255],
      white: [255, 255, 255],
    });
  });

  it("gives each colour its foreground letter; the background letter is its upper case (3.3)", () => {
    expect(COLOUR_LETTER).toEqual({
      black: "k",
      red: "r",
      green: "g",
      yellow: "y",
      blue: "b",
      magenta: "m",
      cyan: "c",
      white: "w",
    });
    for (const colour of COLOURS) {
      expect(COLOUR_LETTER[colour].toUpperCase()).toMatch(/^[KRGYBMCW]$/);
    }
  });

  it("accepts only the eight colour names in isColour", () => {
    expect(COLOURS.every((colour) => isColour(colour))).toBe(true);
    for (const value of ["Red", "", "grey", 0, null, undefined]) {
      expect(isColour(value)).toBe(false);
    }
  });
});
