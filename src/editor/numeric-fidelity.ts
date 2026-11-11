import { NUMBER_WORDS } from "../compilers/fit-text.js";

// The numeric fidelity check of editorial.md (ai-editor requirement 8): every number in a draft
// must be in the input, as a digit token or as a spelled-out number word.

const TOKEN = /\d+(?:[.,]\d+)*|[A-Za-zÀ-ÿ]+/g;
const NUMBER_TOKEN = /\d+(?:[.,]\d+)*/g;

/** Every number token of the text, with the commas removed. */
export function numberTokensOf(text: string): string[] {
  return (text.match(NUMBER_TOKEN) ?? []).map((token) => token.replaceAll(",", ""));
}

function isDigits(token: string): boolean {
  return /^\d/.test(token);
}

/**
 * The violations of a draft against the texts it was made from: `number "41" not in input` and
 * `number word "twelve" not in input`, each distinct token once, in order of first appearance.
 */
export function checkNumericFidelity(
  inputTexts: readonly string[],
  draftRows: readonly string[],
): string[] {
  const numbers = new Set<string>();
  const words = new Set<string>();
  for (const text of inputTexts) {
    for (const token of numberTokensOf(text)) numbers.add(token);
    for (const match of text.matchAll(TOKEN)) {
      if (!isDigits(match[0])) words.add(match[0].toLowerCase());
    }
  }
  const spelled = new Set<string>(NUMBER_WORDS);
  const seen = new Set<string>();
  const violations: string[] = [];
  for (const row of draftRows) {
    for (const match of row.matchAll(TOKEN)) {
      const raw = match[0];
      if (isDigits(raw)) {
        const token = raw.replaceAll(",", "");
        const key = `n:${token}`;
        if (numbers.has(token) || seen.has(key)) continue;
        seen.add(key);
        violations.push(`number "${token}" not in input`);
      } else {
        const word = raw.toLowerCase();
        const key = `w:${word}`;
        if (!spelled.has(word) || words.has(word) || seen.has(key)) continue;
        seen.add(key);
        violations.push(`number word "${word}" not in input`);
      }
    }
  }
  return violations;
}
