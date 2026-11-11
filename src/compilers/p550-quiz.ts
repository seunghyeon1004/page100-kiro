import { CYAN, WHITE, YELLOW, entryTime, finishPage } from "./compile-helpers.js";
import type { CompileResult, SourceEntry } from "./compile-types.js";
import { createContentBuilder, joinRows } from "./content-builder.js";
import { foldedEntries } from "./day-entries.js";
import { fitBody } from "./fit-text.js";
import { formatYear } from "./format.js";
import { noDataPage } from "./no-data-page.js";

// Page 550: the quiz of the day (rule-compilers requirement 14.3, design.md, "Selection rules" and
// "Page layouts").

const QUESTIONS = 5;
const TEXT_WIDTH = 37;
const TEXT_ROWS = 2;

/** MurmurHash3's 32-bit finaliser. */
function fmix32(value: number): number {
  let h = value >>> 0;
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

/** The number tokens of a text (`\d+(?:[.,]\d+)*`) with their commas and points removed. */
export function numberTokens(text: string): string[] {
  return (text.match(/\d+(?:[.,]\d+)*/g) ?? []).map((t) => t.replace(/[.,]/g, ""));
}

interface Candidate {
  readonly year: number;
  readonly rows: readonly string[];
  readonly tokens: readonly string[];
}

/** The date of `now` as the seed YYYYMMDD (UTC). */
export function quizSeed(now: Date): number {
  return now.getUTCFullYear() * 10_000 + (now.getUTCMonth() + 1) * 100 + now.getUTCDate();
}

/** The questions chosen for `now`: up to five events, in the order of the seeded rule. */
export function chooseQuestions(entry: SourceEntry<"wikimedia-onthisday">, now: Date): Candidate[] {
  const eligible: Candidate[] = [];
  for (const day of foldedEntries(entry.value.events)) {
    if (!Number.isInteger(day.year) || Math.abs(day.year) < 10) continue;
    const fit = fitBody(day.text, TEXT_WIDTH, TEXT_ROWS);
    if (!fit.ok) continue;
    const tokens = numberTokens(fit.rows.join(" "));
    if (tokens.includes(String(Math.abs(day.year)))) continue;
    eligible.push({ year: day.year, rows: fit.rows, tokens });
  }
  const seed = quizSeed(now);
  const ordered = eligible
    .map((candidate, index) => ({
      candidate,
      index,
      key: fmix32((seed + Math.imul(0x9e3779b9, index)) >>> 0),
    }))
    .sort((a, b) => a.key - b.key || a.index - b.index)
    .map((item) => item.candidate);

  const chosen: Candidate[] = [];
  for (const candidate of ordered) {
    if (chosen.length >= QUESTIONS) break;
    const digits = String(Math.abs(candidate.year));
    const clashes = chosen.some(
      (c) => c.tokens.includes(digits) || candidate.tokens.includes(String(Math.abs(c.year))),
    );
    if (!clashes) chosen.push(candidate);
  }
  return chosen;
}

export function compile550(entry: SourceEntry<"wikimedia-onthisday">, now: Date): CompileResult {
  const questions = chooseQuestions(entry, now);
  if (questions.length === 0) return noDataPage(550, "no-data");

  const b = createContentBuilder();
  b.lines(0, 1, ["In which year did each of these happen?"], YELLOW);
  questions.forEach((q, k) => {
    const row = 2 + 3 * k;
    b.text(row, 1, String(k + 1), YELLOW);
    q.rows.forEach((line, r) => {
      b.text(row + r, 3, line, WHITE);
    });
    b.alt({ kind: "paragraph", text: `Question ${String(k + 1)}: ${joinRows(q.rows)}` });
    b.concealed(
      row + q.rows.length,
      3,
      ["Year:", CYAN],
      [formatYear(q.year), YELLOW],
      "Show answer",
    );
  });
  b.lines(18, 1, ["Press Reveal to show the answers."], WHITE);
  return finishPage(550, [b.build()], entryTime(entry.fetchedAt));
}
