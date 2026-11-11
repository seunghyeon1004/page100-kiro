import { isRepertoireCodePoint } from "../grid/repertoire.js";
import type { CompileProblem } from "./compile-types.js";
import { fitBody, fitHeadline } from "./fit-text.js";

// The seam between the pages the AI editor may write and the code that lays them out (rule-compilers
// requirement 8, design.md, "Types"). A page gives the editor `EditorialInput`; the editor, or
// `rulesDraft`, answers with `DraftRows`; `checkDraft` rejects a draft that breaks a limit.

export interface EditorialSlot {
  /** Stable name, for example `story-3` or `lead`. */
  readonly id: string;
  readonly mode: "headline" | "body";
  /** Source text, folded into the repertoire. */
  readonly text: string;
  readonly maxRows: number;
  readonly width: number;
}

export interface EditorialInput {
  readonly page: number;
  readonly slots: readonly EditorialSlot[];
  /** The most rows all slots may take together. */
  readonly totalRows: number;
}

/** One array of rows per slot, in slot order; `[]` leaves the slot out. */
export type DraftRows = readonly (readonly string[])[];

/** The page row of row `row` (0-based) of slot `slot` (0-based) in the page layout. */
export type RowLocator = (slot: number, row: number) => number;

/**
 * The draft the rules make: each slot fitted with `fitHeadline` or `fitBody`, a slot that fails
 * given no rows, and a slot that would take the total past `totalRows` given none, with every
 * later slot (requirement 8.3).
 */
export function rulesDraft(input: EditorialInput): DraftRows {
  let used = 0;
  let ended = false;
  return input.slots.map((slot): readonly string[] => {
    if (ended) return [];
    const fit =
      slot.mode === "headline"
        ? fitHeadline(slot.text, slot.width, slot.maxRows)
        : fitBody(slot.text, slot.width, slot.maxRows);
    if (!fit.ok) return [];
    if (used + fit.rows.length > input.totalRows) {
      ended = true;
      return [];
    }
    used += fit.rows.length;
    return fit.rows;
  });
}

function problem(
  code: CompileProblem["code"],
  row: number | null,
  col: number | null,
  message: string,
): CompileProblem {
  return { code, subpage: null, row, col, message };
}

function isStringArray(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function cells(text: string): number {
  return Array.from(text).length;
}

/**
 * The problems of a draft (requirement 8.4); empty when the draft may be laid out. Rows are
 * rejected, never trimmed. Accepts any value for `rows` and never throws.
 */
export function checkDraft(
  input: EditorialInput,
  rows: unknown,
  rowOf: RowLocator,
): CompileProblem[] {
  if (!Array.isArray(rows) || rows.length !== input.slots.length) {
    const actual = Array.isArray(rows) ? rows.length : 0;
    return [
      problem(
        "slot-count",
        null,
        null,
        `draft has ${String(actual)} slots, input has ${String(input.slots.length)}`,
      ),
    ];
  }
  const found: CompileProblem[] = [];
  let total = 0;
  input.slots.forEach((slot, s) => {
    const draft: unknown = rows[s];
    if (!isStringArray(draft)) {
      found.push(problem("slot-rows", rowOf(s, 0), null, `slot ${slot.id} is not a list of rows`));
      return;
    }
    total += draft.length;
    if (draft.length > slot.maxRows) {
      found.push(
        problem(
          "slot-rows",
          rowOf(s, 0),
          null,
          `slot ${slot.id} has ${String(draft.length)} rows, limit ${String(slot.maxRows)}`,
        ),
      );
    }
    draft.forEach((text, r) => {
      const at = rowOf(s, r);
      const size = cells(text);
      if (size > slot.width) {
        found.push(
          problem(
            "row-width",
            at,
            slot.width,
            `row ${String(at)} is ${String(size)} cells, limit ${String(slot.width)}`,
          ),
        );
      }
      if (text === "" || text.startsWith(" ") || text.endsWith(" ") || text.includes("  ")) {
        found.push(
          problem(
            "row-space",
            at,
            null,
            `row ${String(at)} is empty, starts or ends with a space, or has two spaces in a row`,
          ),
        );
      }
      Array.from(text).forEach((ch, c) => {
        if (!isRepertoireCodePoint(ch.codePointAt(0) ?? Number.NaN)) {
          found.push(
            problem(
              "not-repertoire",
              at,
              c,
              `row ${String(at)} col ${String(c)}: character is not in the repertoire`,
            ),
          );
        }
      });
    });
  });
  if (total > input.totalRows) {
    found.push(
      problem(
        "total-rows",
        null,
        null,
        `draft has ${String(total)} rows, limit ${String(input.totalRows)}`,
      ),
    );
  }
  return found;
}

/** How many rows each slot of an unchecked draft holds: 0 for anything that is not a list. */
export function rowCounts(rows: unknown): number[] {
  return Array.isArray(rows) ? rows.map((r: unknown) => (Array.isArray(r) ? r.length : 0)) : [];
}

/** The rows of slot `slot` in an unchecked draft, or `[]` when it is not a list of strings. */
export function rowsOfSlot(rows: unknown, slot: number): readonly string[] {
  const one: unknown = Array.isArray(rows) ? rows[slot] : undefined;
  return isStringArray(one) ? one : [];
}
