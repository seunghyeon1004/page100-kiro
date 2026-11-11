import { foldText } from "../grid/fold-text.js";
import { toNonEmpty } from "../grid/non-empty.js";
import type { NonEmpty } from "../grid/types.js";
import type { DraftRows } from "../compilers/editorial-input.js";
import { checkNames } from "./name-check.js";
import { checkNumericFidelity } from "./numeric-fidelity.js";
import type { DraftRequest, RequestSlot } from "./editor-types.js";

// The editor's draft checks (ai-editor requirement 7, design.md, "Draft checks"). A reply becomes
// a draft only through `checkEditorDraft`. Never throws.

export type CheckedDraft =
  | { readonly ok: true; readonly rows: DraftRows }
  | { readonly ok: false; readonly violations: NonEmpty<string> };

/** All-capitals words that need no source (editorial.md, "Abbreviations"). */
const ALLOWED_CAPITALS: ReadonlySet<string> = new Set([
  "US",
  "UK",
  "UN",
  "EU",
  "NATO",
  "WHO",
  "IMF",
  "UTC",
  "AI",
]);

const HEADLINE_WORDS = ["breaking", "shock", "shocking", "slams"];

function cells(text: string): number {
  return Array.from(text).length;
}

function codePointLabel(codePoint: number): string {
  return `U+${codePoint.toString(16).toUpperCase().padStart(4, "0")}`;
}

function isStringList(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

/** Splits reply rows on `""` into one group per slot. */
function groupsOf(rows: readonly string[]): string[][] {
  const groups: string[][] = [[]];
  for (const row of rows) {
    if (row === "") groups.push([]);
    else groups[groups.length - 1]?.push(row);
  }
  return groups;
}

function wordsOf(text: string, pattern: RegExp): string[] {
  return text.match(pattern) ?? [];
}

/** The all-capitals words of a text: runs of 2 or more letters A to Z bounded by non-letters. */
function capitalWords(text: string): string[] {
  return wordsOf(text, /(?<!\p{L})[A-Z]{2,}(?!\p{L})/gu);
}

function hasWord(text: string, word: string): boolean {
  return wordsOf(text.toLowerCase(), /\p{L}+/gu).includes(word);
}

interface FoldedRow {
  readonly text: string;
  readonly label: string;
}

/** Stage 4: the shape of one folded row. */
function shapeViolations(slot: RequestSlot, row: FoldedRow): string[] {
  const found: string[] = [];
  const size = cells(row.text);
  if (size > slot.width)
    found.push(`${row.label} is ${String(size)} cells, limit ${String(slot.width)}`);
  if (row.text.trim() === "") {
    found.push(`${row.label} is blank`);
  } else {
    if (row.text.startsWith(" ") || row.text.endsWith(" ")) {
      found.push(`${row.label} starts or ends with a space`);
    }
    if (row.text.includes("  ")) found.push(`${row.label} has two spaces in a row`);
  }
  if (row.text.includes("{")) found.push(`${row.label} contains "{"`);
  return found;
}

/** Stage 5: the voice rules that code can decide. */
function voiceViolations(slot: RequestSlot, row: FoldedRow): string[] {
  const found: string[] = [];
  for (const mark of ["!", "?"]) {
    if (row.text.includes(mark) && !slot.text.includes(mark)) {
      found.push(`${row.label} has "${mark}", which is not in its source`);
    }
  }
  const lower = wordsOf(row.text.toLowerCase(), /\p{L}+/gu);
  for (const word of HEADLINE_WORDS) {
    if (lower.includes(word) && !hasWord(slot.text, word))
      found.push(`${row.label} uses "${word}"`);
  }
  const sourceCapitals = new Set(capitalWords(slot.text));
  const seen = new Set<string>();
  for (const word of capitalWords(row.text)) {
    if (ALLOWED_CAPITALS.has(word) || sourceCapitals.has(word) || seen.has(word)) continue;
    seen.add(word);
    found.push(`${row.label} has "${word}" in capitals`);
  }
  return found;
}

/**
 * Checks reply rows against the request. On success the rows are folded, one array per slot.
 * Violations are the exact sentences of the design table, in check order.
 */
export function checkEditorDraft(request: DraftRequest, replyRows: unknown): CheckedDraft {
  if (!isStringList(replyRows)) {
    return { ok: false, violations: ["reply was not a list of rows"] };
  }
  const groups = groupsOf(replyRows);
  const { slots } = request;

  // Stage 1: one group per slot.
  if (groups.length !== slots.length) {
    return {
      ok: false,
      violations: [`reply has ${String(groups.length)} slots, expected ${String(slots.length)}`],
    };
  }

  const violations: string[] = [];
  const folded: (FoldedRow | undefined)[][] = [];

  // Stage 2: rows per slot.
  slots.forEach((slot, s) => {
    const count = groups[s]?.length ?? 0;
    if (count > slot.maxRows) {
      violations.push(`slot ${slot.id} has ${String(count)} rows, limit ${String(slot.maxRows)}`);
    }
    if (count === 0 && !slot.optional) violations.push(`slot ${slot.id} is empty`);
  });

  // Stage 3: fold every row.
  slots.forEach((slot, s) => {
    folded[s] = (groups[s] ?? []).map((raw, r) => {
      const label = `slot ${slot.id} row ${String(r + 1)}`;
      const result = foldText(raw);
      if (result.ok) return { text: result.text, label };
      violations.push(
        `${label} has ${codePointLabel(result.codePoints[0])}, which is outside the character set`,
      );
      return undefined;
    });
  });

  // Stages 4 and 5: per row, for the rows that folded.
  const stage4: string[] = [];
  const stage5: string[] = [];
  slots.forEach((slot, s) => {
    const rows = folded[s] ?? [];
    rows.forEach((row) => {
      if (row === undefined) return;
      stage4.push(...shapeViolations(slot, row));
      stage5.push(...voiceViolations(slot, row));
    });
    if (slot.mode === "headline") {
      const last = rows[rows.length - 1];
      if (last?.text.endsWith("...") === true) {
        stage5.push(`slot ${slot.id} ends with "..."`);
      } else if (last?.text.endsWith(".") === true) {
        stage5.push(`slot ${slot.id} ends with "."`);
      }
    }
  });
  violations.push(...stage4, ...stage5);

  // Stage 6: total rows. Stages 7 and 8 use the rows that folded.
  const texts = folded.flat().flatMap((row) => (row === undefined ? [] : [row.text]));
  if (texts.length > request.totalRows) {
    violations.push(`draft has ${String(texts.length)} rows, limit ${String(request.totalRows)}`);
  }
  const sources = slots.map((slot) => slot.text);
  violations.push(...checkNumericFidelity(sources, texts));
  violations.push(...checkNames(sources, texts));

  const failed = toNonEmpty(violations);
  if (failed !== undefined) return { ok: false, violations: failed };
  return {
    ok: true,
    rows: folded.map((rows) => rows.flatMap((row) => (row === undefined ? [] : [row.text]))),
  };
}
