import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { isBlankCell } from "../../src/grid/blank-cell.js";
import { mosaicBitsOf } from "../../src/grid/mosaic-code-point.js";
import { validateContentRows } from "../../src/grid/validate-content-rows.js";
import { validateGrid } from "../../src/grid/validate-grid.js";
import type { ValidPage } from "../../src/grid/types.js";
import { parseContent } from "../../src/markup/parse-content.js";
import { parsePage } from "../../src/markup/parse-page.js";
import { serialiseContent } from "../../src/markup/serialise-content.js";
import { serialisePage } from "../../src/markup/serialise-page.js";
import { validContent, validGrid } from "../grid/arbitraries.js";
import { type NoiseChoices, joinGroups, noiseFor, rowGroups } from "./markup-arbitraries.js";

/** The 20 tags of requirements 14.1 and 14.2, as a sticky pattern so that it can be tested at an index. */
const TAG_AT = /\{(?:[krgybmcw]|[KRGYBMCW]|\?|\/\?|~|\/~)\}/y;

/**
 * Checks one canonical line from its text alone (Property 20). Returns the first rule the line
 * breaks, or `undefined` when it follows them all.
 */
function canonicalProblem(line: string): string | undefined {
  // Current state, written as the markup letters: bg and fg as letters, modes as booleans.
  let bg = "K";
  let fg = "w";
  let conceal = false;
  let separated = false;
  let pending: string[] = [];
  let lastBlank: boolean | undefined;

  let i = 0;
  while (i < line.length) {
    if (line[i] === "{" && line[i + 1] !== "{") {
      TAG_AT.lastIndex = i;
      const match = TAG_AT.exec(line);
      if (match === null) return `unknown tag at index ${String(i)}`;
      pending.push(match[0]);
      i += match[0].length;
      continue;
    }

    // One cell: the `{{` escape, or one code point.
    const isEscape = line[i] === "{";
    const cp = isEscape ? 0x7b : (line.codePointAt(i) ?? 0);
    i += isEscape ? 2 : cp > 0xffff ? 2 : 1;
    const isMosaic = !isEscape && cp !== 0x20 && mosaicBitsOf(cp) !== undefined;

    // Rule 1: each tag changes the state, and the tags come in the order bg, fg, conceal, separated.
    let previousOrder = -1;
    for (const tag of pending) {
      const body = tag.slice(1, -1);
      const order = /^[KRGYBMCW]$/.test(body)
        ? 0
        : /^[krgybmcw]$/.test(body)
          ? 1
          : body.includes("?")
            ? 2
            : 3;
      if (order < previousOrder) return `tags out of order before cell ${String(cp)}`;
      previousOrder = order;
      if (order === 0) {
        if (body === bg) return `${tag} repeats the background`;
        bg = body;
      } else if (order === 1) {
        if (body === fg) return `${tag} repeats the foreground`;
        fg = body;
      } else if (body === "?") {
        if (conceal) return "{?} while conceal is on";
        conceal = true;
      } else if (body === "/?") {
        if (!conceal) return "{/?} while conceal is off";
        conceal = false;
      } else if (body === "~") {
        if (separated) return "{~} while separated mosaics are on";
        separated = true;
      } else {
        if (!separated) return "{/~} while separated mosaics are off";
        separated = false;
      }
    }

    // Rule 2: a separated tag appears only in the run directly before a mosaic character.
    const hasSeparatedTag = pending.some((tag) => tag === "{~}" || tag === "{/~}");
    if (hasSeparatedTag && !isMosaic) return "separated tag before a text cell";
    pending = [];

    lastBlank = !isMosaic && !isEscape && cp === 0x20 && bg === "K" && fg === "w" && !conceal;
  }

  if (pending.length > 0) return "tags with no cell after them";
  if (lastBlank === true) return "the line ends with a blank cell";
  return undefined;
}

/** True when every `{` in the text is `{{` or one of the 20 tags (requirement 16.7). */
function bracesAreAllowed(text: string): boolean {
  for (let i = 0; i < text.length; i++) {
    if (text[i] !== "{") continue;
    if (text[i + 1] === "{") {
      i += 1;
      continue;
    }
    TAG_AT.lastIndex = i;
    if (!TAG_AT.test(text)) return false;
  }
  return true;
}

/** Noise for one row of a noisy page. */
interface RowNoise {
  /** How many blank cells to write after the last non-blank cell, as a raw number reduced to fit. */
  readonly extra: number;
  /** Whether to write `{w}{K}` (the default colours, redundantly) at the start of the line. */
  readonly prefix: boolean;
  readonly noise: NoiseChoices;
}

const rowNoise: fc.Arbitrary<RowNoise> = fc.record({
  extra: fc.integer({ min: 0, max: 40 }),
  prefix: fc.boolean(),
  noise: noiseFor(40),
});

/**
 * A noisy markup text for a valid page (Property 18). It writes every cell with its tags, adds
 * optional redundant tags, and writes some blank cells past the last non-blank cell. The final
 * LF may be left out when the last line is not blank.
 */
function noisyPage(grid: ValidPage, rows: readonly RowNoise[], omitFinalLf: boolean): string {
  const lines = grid.map((cells, r) => {
    const choice = rows[r];
    const last = cells.reduce((acc, cell, index) => (isBlankCell(cell) ? acc : index), -1);
    const room = 40 - (last + 1);
    const extra = choice === undefined || room === 0 ? 0 : choice.extra % (room + 1);
    const groups = rowGroups(
      cells.slice(0, last + 1 + extra),
      choice?.noise ?? { repeatColour: [], togglePair: [] },
    );
    return `${choice?.prefix === true ? "{w}{K}" : ""}${joinGroups(groups)}`;
  });
  const text = lines.map((line) => `${line}\n`).join("");
  const lastLine = lines[lines.length - 1] ?? "";
  return omitFinalLf && lastLine !== "" ? text.slice(0, -1) : text;
}

describe("canonical page properties (Properties 15, 17, 18, 19 and 20)", () => {
  it("Property 15: a serialised page parses back to the same grid", () => {
    fc.assert(
      fc.property(validGrid, (grid) => {
        const parsed = parsePage(serialisePage(grid));
        expect(parsed.ok).toBe(true);
        if (!parsed.ok) return;
        expect(parsed.value).toEqual(grid);
      }),
    );
  });

  it("Property 17: a canonical page parses, validates and serialises to the same text", () => {
    fc.assert(
      fc.property(validGrid, (grid) => {
        const text = serialisePage(grid);
        const parsed = parsePage(text);
        expect(parsed.ok).toBe(true);
        if (!parsed.ok) return;
        const checked = validateGrid(parsed.value);
        expect(checked.ok).toBe(true);
        if (!checked.ok) return;
        expect(serialisePage(checked.page)).toBe(text);
      }),
    );
  });

  it("Property 17 (content): canonical content parses, validates and serialises to the same text", () => {
    fc.assert(
      fc.property(validContent, (content) => {
        const text = serialiseContent(content);
        const parsed = parseContent(text);
        expect(parsed.ok).toBe(true);
        if (!parsed.ok) return;
        const checked = validateContentRows(parsed.value);
        expect(checked.ok).toBe(true);
        if (!checked.ok) return;
        expect(serialiseContent(checked.content)).toBe(text);
      }),
    );
  });

  it("Property 18: noisy markup of a page parses to the same grid and serialises canonically", () => {
    fc.assert(
      fc.property(
        validGrid,
        fc.array(rowNoise, { minLength: 24, maxLength: 24 }),
        fc.boolean(),
        (grid, rows, omitFinalLf) => {
          const parsed = parsePage(noisyPage(grid, rows, omitFinalLf));
          expect(parsed.ok).toBe(true);
          if (!parsed.ok) return;
          expect(parsed.value).toEqual(grid);
          const checked = validateGrid(parsed.value);
          expect(checked.ok).toBe(true);
          if (!checked.ok) return;
          expect(serialisePage(checked.page)).toBe(serialisePage(grid));
        },
      ),
    );
  });

  it("Property 19: a serialised page has 24 LFs, no CR, and only the allowed braces", () => {
    fc.assert(
      fc.property(validGrid, (grid) => {
        const text = serialisePage(grid);
        expect(text.split("\n")).toHaveLength(25);
        expect(text.includes("\r")).toBe(false);
        expect(bracesAreAllowed(text)).toBe(true);
      }),
    );
  });

  it("Property 19 (content): serialised content has 1 to 20 lines, ends with one LF, and its last line is not blank", () => {
    fc.assert(
      fc.property(validContent, (content) => {
        const text = serialiseContent(content);
        expect(text.endsWith("\n")).toBe(true);
        expect(text.endsWith("\n\n")).toBe(false);
        const lines = text.slice(0, -1).split("\n");
        expect(lines.length).toBeGreaterThanOrEqual(1);
        expect(lines.length).toBeLessThanOrEqual(20);
        if (lines.length > 1) {
          expect(lines[lines.length - 1]).not.toBe("");
        }
        expect(text.includes("\r")).toBe(false);
        expect(bracesAreAllowed(text)).toBe(true);
      }),
    );
  });

  it("Property 20: in every line, tags change state, appear in order, and the line does not end blank", () => {
    fc.assert(
      fc.property(validGrid, (grid) => {
        for (const line of serialisePage(grid).split("\n")) {
          expect(canonicalProblem(line), JSON.stringify(line)).toBeUndefined();
        }
      }),
    );
  });
});
