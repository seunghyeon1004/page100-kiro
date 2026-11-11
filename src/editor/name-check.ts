// The name check (ai-editor requirement 7.10, owner answer 3): a capitalised word in a draft that
// does not start a sentence or a row must be a word of the source text. It rejects some honest
// rewording (a word the source has in lower case); the rules fallback covers that.

const WORD = /\p{L}+/gu;

/** Month and weekday abbreviations of editorial.md; compared as written. */
const CALENDAR_WORDS: ReadonlySet<string> = new Set([
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
  "Mon",
  "Tue",
  "Wed",
  "Thu",
  "Fri",
  "Sat",
  "Sun",
]);

function isCapitalised(word: string): boolean {
  const first = Array.from(word)[0] ?? "";
  return first !== first.toLowerCase();
}

function isAllCapitals(word: string): boolean {
  return Array.from(word).length >= 2 && word === word.toUpperCase();
}

/** True when nothing but marks stands before the word in the row, or a sentence has just ended. */
function startsSentence(before: string): boolean {
  if (/^[^\p{L}\p{N}]*$/u.test(before)) return true;
  return /[.!?]["')\]]?\s+["'(]?$/u.test(before);
}

/**
 * The words of `rows` that break the rule, each once as written and in order of first
 * appearance, as `name "X" not in input`.
 */
export function checkNames(inputTexts: readonly string[], rows: readonly string[]): string[] {
  const known = new Set<string>();
  for (const text of inputTexts) {
    for (const match of text.matchAll(WORD)) known.add(match[0].toLowerCase());
  }
  const violations: string[] = [];
  const reported = new Set<string>();
  for (const row of rows) {
    for (const match of row.matchAll(WORD)) {
      const word = match[0];
      if (!isCapitalised(word) || isAllCapitals(word) || CALENDAR_WORDS.has(word)) continue;
      if (known.has(word.toLowerCase()) || reported.has(word)) continue;
      if (startsSentence(row.slice(0, match.index))) continue;
      reported.add(word);
      violations.push(`name "${word}" not in input`);
    }
  }
  return violations;
}
