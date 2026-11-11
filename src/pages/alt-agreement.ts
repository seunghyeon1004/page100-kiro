import { foldText } from "../grid/fold-text.js";
import { toNonEmpty } from "../grid/non-empty.js";
import type { NonEmpty, Rows } from "../grid/types.js";
import type { AltBlock } from "./alt-block.js";

export type AgreementResult =
  { readonly ok: true } | { readonly ok: false; readonly missing: NonEmpty<string> };

/** The words of a string: maximal runs of letters or digits, in lower case (requirement 9.1). */
export function wordsOf(s: string): string[] {
  return s.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
}

/** Every string a block shows to a reader. Link targets are not words. */
function stringsOf(block: AltBlock): string[] {
  switch (block.kind) {
    case "heading":
    case "paragraph":
      return [block.text];
    case "list":
      return [...block.items];
    case "table":
      return [...block.headers, ...block.rows.flat()];
    case "link":
      return [block.text];
    case "concealed":
      return [block.summary, block.text];
    default: {
      const unreachable: never = block;
      return unreachable;
    }
  }
}

/** An alt word as the grid would hold it: folded into the repertoire when folding succeeds. */
function foldedWord(word: string): string {
  const folded = foldText(word);
  return folded.ok ? folded.text.toLowerCase() : word;
}

/** One string per content row: text cells as they are, mosaic cells as spaces. */
function rowStrings(content: Rows): string[] {
  return content.map((row) => row.map((cell) => (cell.kind === "text" ? cell.ch : " ")).join(""));
}

/**
 * Checks that every word on the grid's content rows (concealed cells included) is a word of the
 * text alternative (requirement 9.1). Lists each missing word once, in order of first appearance.
 */
export function checkAltAgreement(content: Rows, alt: readonly AltBlock[]): AgreementResult {
  const altWords = new Set<string>();
  for (const block of alt) {
    for (const text of stringsOf(block)) {
      for (const word of wordsOf(text)) altWords.add(foldedWord(word));
    }
  }

  const missing: string[] = [];
  for (const row of rowStrings(content)) {
    for (const word of wordsOf(row)) {
      if (!altWords.has(word) && !missing.includes(word)) missing.push(word);
    }
  }

  const list = toNonEmpty(missing);
  return list === undefined ? { ok: true } : { ok: false, missing: list };
}
