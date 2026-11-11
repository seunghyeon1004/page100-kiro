import { toNonEmpty } from "./non-empty.js";
import { isRepertoireCodePoint } from "./repertoire.js";
import type { NonEmpty } from "./types.js";

export type FoldResult =
  | { readonly ok: true; readonly text: string }
  | {
      readonly ok: false;
      readonly code: "fold-unrepresentable";
      readonly codePoints: NonEmpty<number>;
    };

/** Step 2: the fixed replacements of requirement 7.13, keyed by code point. */
const FIXED_REPLACEMENTS: ReadonlyMap<number, string> = new Map<number, string>([
  [0x2018, "'"], // left single quotation mark
  [0x2019, "'"], // right single quotation mark
  [0x201c, '"'], // left double quotation mark
  [0x201d, '"'], // right double quotation mark
  [0x2013, "-"], // en dash
  [0x2014, "-"], // em dash
  [0x2026, "..."], // horizontal ellipsis
  [0x00a0, " "], // no-break space
  [0x00d7, "x"], // multiplication sign
  [0x0141, "L"], // L with stroke
  [0x0142, "l"], // l with stroke
  [0x0110, "D"], // D with stroke
  [0x0111, "d"], // d with stroke
  [0x0152, "OE"], // OE ligature
  [0x0153, "oe"], // oe ligature
  [0x0131, "i"], // dotless i
  [0x00ab, '"'], // left-pointing double angle quotation mark
  [0x00bb, '"'], // right-pointing double angle quotation mark
  [0x2002, " "], // en space
  [0x2003, " "], // em space
  [0x2009, " "], // thin space
  [0x202f, " "], // narrow no-break space
  [0x00ad, ""], // soft hyphen, removed
  [0x2010, "-"], // hyphen
  [0x2011, "-"], // non-breaking hyphen
  [0x2212, "-"], // minus sign
  [0x2032, "'"], // prime
  [0x2033, '"'], // double prime
]);

/** Keeps a repertoire code point, and drops the marks of any other one. */
function stripMarks(ch: string): string {
  return isRepertoireCodePoint(ch.codePointAt(0) ?? Number.NaN)
    ? ch
    : ch.normalize("NFD").replace(/\p{M}/gu, "");
}

/**
 * Brings source text into the repertoire, or reports the code points it cannot represent
 * (grid-rules.md, Character repertoire). Never throws. Never prints a substitute character.
 */
export function foldText(input: string): FoldResult {
  // Step 1: compose.
  const composed = input.normalize("NFC");

  // Step 2: fixed replacements, one code point at a time.
  let replaced = "";
  for (const ch of composed) {
    replaced += FIXED_REPLACEMENTS.get(ch.codePointAt(0) ?? Number.NaN) ?? ch;
  }

  // Step 3: only code points still outside the repertoire lose their marks.
  let stripped = "";
  for (const ch of replaced) {
    stripped += stripMarks(ch);
  }

  // Step 4: compose again.
  const text = stripped.normalize("NFC");

  // Step 5: list what is still outside the repertoire, once each, in order of first appearance.
  const outside: number[] = [];
  for (const ch of text) {
    const cp = ch.codePointAt(0) ?? Number.NaN;
    if (!isRepertoireCodePoint(cp) && !outside.includes(cp)) {
      outside.push(cp);
    }
  }

  const codePoints = toNonEmpty(outside);
  if (codePoints === undefined) {
    return { ok: true, text };
  }
  return { ok: false, code: "fold-unrepresentable", codePoints };
}
