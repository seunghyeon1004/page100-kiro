import type { NonEmpty } from "../grid/types.js";
import { toNonEmpty } from "../grid/non-empty.js";

// Wrapping and fitting by the rules of editorial.md, "Fitting and truncation" (rule-compilers
// requirement 3). Nothing here inserts a hyphen, cuts a word, or throws.

export type FitResult =
  | { readonly ok: true; readonly rows: NonEmpty<string> }
  | { readonly ok: false; readonly reason: "empty" | "word-too-long" | "too-long" };

/** Words that must not be left in front of `...` (design.md, "Fitting"). Compared in lower case. */
export const UNIT_WORDS: readonly string[] = Object.freeze([
  "km",
  "km/h",
  "mm",
  "cm",
  "m",
  "kg",
  "t",
  "°c",
  "°f",
  "%",
  "mph",
  "ft",
  "mi",
  "per",
  "cent",
  "percent",
]);

/** Spelled-out numbers of editorial.md, "Numeric fidelity check". Compared in lower case. */
export const NUMBER_WORDS: readonly string[] = Object.freeze([
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
  "eleven",
  "twelve",
  "thirteen",
  "fourteen",
  "fifteen",
  "sixteen",
  "seventeen",
  "eighteen",
  "nineteen",
  "twenty",
  "dozen",
  "hundred",
  "thousand",
  "million",
  "billion",
]);

const ABBREVIATIONS: readonly string[] = [
  "Mr.",
  "Mrs.",
  "Ms.",
  "Dr.",
  "St.",
  "Mt.",
  "Jr.",
  "Sr.",
  "No.",
  "vs.",
];

function length(s: string): number {
  return Array.from(s).length;
}

/** The words of a text: split on U+0020, empty words dropped. */
function wordsOf(text: string): string[] {
  return text.split(" ").filter((w) => w !== "");
}

/**
 * The parts a word may be broken into: after a hyphen that is neither the first nor the last
 * character. Each part keeps its hyphen.
 */
function partsOf(word: string): string[] {
  const chars = Array.from(word);
  const parts: string[] = [];
  let current = "";
  chars.forEach((ch, i) => {
    current += ch;
    if (ch === "-" && i > 0 && i < chars.length - 1) {
      parts.push(current);
      current = "";
    }
  });
  if (current !== "") parts.push(current);
  return parts;
}

function tooWide(words: readonly string[], width: number): boolean {
  return words.some((w) => partsOf(w).some((p) => length(p) > width));
}

function wrapWordList(words: readonly string[], width: number, maxRows: number): FitResult {
  if (words.length === 0) return { ok: false, reason: "empty" };
  if (tooWide(words, width)) return { ok: false, reason: "word-too-long" };
  const rows: string[] = [];
  let row = "";
  for (const word of words) {
    let parts = partsOf(word);
    while (parts.length > 0) {
      const whole = parts.join("");
      const separator = row === "" ? "" : " ";
      if (length(row) + length(separator) + length(whole) <= width) {
        row += separator + whole;
        parts = [];
        break;
      }
      // The longest run of leading parts that fits after the row so far.
      let k = parts.length - 1;
      while (
        k >= 1 &&
        length(row) + length(separator) + length(parts.slice(0, k).join("")) > width
      ) {
        k -= 1;
      }
      if (k >= 1) {
        rows.push(row + separator + parts.slice(0, k).join(""));
        row = "";
        parts = parts.slice(k);
      } else {
        // Nothing fits here: close the row. It cannot be empty, because every part fits the width.
        rows.push(row);
        row = "";
      }
    }
    if (rows.length > maxRows) return { ok: false, reason: "too-long" };
  }
  if (row !== "") rows.push(row);
  const result = toNonEmpty(rows);
  if (result === undefined) return { ok: false, reason: "empty" };
  if (result.length > maxRows) return { ok: false, reason: "too-long" };
  return { ok: true, rows: result };
}

/** Greedy word wrap into at most `maxRows` rows of at most `width` cells. Changes no word. */
export function wrapWords(text: string, width: number, maxRows: number): FitResult {
  return wrapWordList(wordsOf(text), width, maxRows);
}

/**
 * A headline: one leading `A `, `An ` or `The ` and one final `.` removed, the first letter made
 * upper case, and the whole text fitted. Never shortened, never ends in `...`.
 */
export function fitHeadline(text: string, width: number, maxRows: number): FitResult {
  let words = wordsOf(text);
  const first = words[0];
  if (first === "A" || first === "An" || first === "The") words = words.slice(1);
  const stem = words.map((w, i) => (i === words.length - 1 ? w.replace(/\.$/, "") : w));
  words = stem.filter((w) => w !== "");
  const head = words[0];
  if (head !== undefined) {
    const chars = Array.from(head);
    words = [(chars[0] ?? "").toUpperCase() + chars.slice(1).join(""), ...words.slice(1)];
  }
  return wrapWordList(words, width, maxRows);
}

function endsSentence(word: string, next: string | undefined): boolean {
  if (next === undefined) return false;
  const bare = word.replace(/["']+$/, "");
  if (!/[.?!]$/.test(bare)) return false;
  if (!/^[\p{Lu}\p{Nd}"']/u.test(next)) return false;
  if (/^\p{L}\.$/u.test(bare)) return false;
  if (bare.slice(0, -1).includes(".")) return false;
  return !ABBREVIATIONS.includes(bare);
}

function sentencesOf(words: readonly string[]): string[][] {
  const sentences: string[][] = [];
  let current: string[] = [];
  words.forEach((word, i) => {
    current.push(word);
    if (endsSentence(word, words[i + 1])) {
      sentences.push(current);
      current = [];
    }
  });
  if (current.length > 0) sentences.push(current);
  return sentences;
}

function stripEnd(word: string): string {
  return word.replace(/[,;:("'-]+$/, "");
}

function leavesDanglingNumber(word: string): boolean {
  const bare = word.replace(/[,;:]+$/, "").toLowerCase();
  return /\d/.test(bare) || NUMBER_WORDS.includes(bare) || UNIT_WORDS.includes(bare);
}

/** The words before `...` after requirement 3.7, or `undefined` when none are left. */
function cutBeforeEllipsis(prefix: readonly string[]): string[] | undefined {
  const words = [...prefix];
  for (;;) {
    const last = words[words.length - 1];
    if (last === undefined) return undefined;
    const stripped = stripEnd(last);
    if (stripped === "") {
      words.pop();
      continue;
    }
    if (leavesDanglingNumber(stripped) || leavesDanglingNumber(last)) {
      words.pop();
      const previous = words[words.length - 1];
      if (previous !== undefined) words[words.length - 1] = stripEnd(previous);
      continue;
    }
    words[words.length - 1] = stripped;
    return words;
  }
}

/**
 * Body text: the longest run of whole leading sentences that fits; else the longest run of the
 * first sentence's leading words that fits with `...` joined to the last word, never leaving a
 * number or unit word in front of it.
 */
export function fitBody(text: string, width: number, maxRows: number): FitResult {
  const words = wordsOf(text);
  if (words.length === 0) return { ok: false, reason: "empty" };
  const sentences = sentencesOf(words);
  for (let n = sentences.length; n >= 1; n -= 1) {
    const result = wrapWordList(sentences.slice(0, n).flat(), width, maxRows);
    if (result.ok) return result;
  }
  const firstSentence = sentences[0] ?? [];
  for (let n = firstSentence.length; n >= 1; n -= 1) {
    const kept = cutBeforeEllipsis(firstSentence.slice(0, n));
    if (kept === undefined) continue;
    const last = kept[kept.length - 1] ?? "";
    const candidate = [...kept.slice(0, -1), `${last}...`];
    const result = wrapWordList(candidate, width, maxRows);
    if (result.ok) return result;
  }
  const head = words[0] ?? "";
  return { ok: false, reason: tooWide([head], width) ? "word-too-long" : "too-long" };
}
