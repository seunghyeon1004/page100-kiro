const NAMED: Readonly<Record<string, string>> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
};

function decodeEntity(whole: string, body: string): string {
  const named = NAMED[body];
  if (named !== undefined) return named;
  const numeric = /^#(?:x([0-9a-fA-F]+)|([0-9]+))$/.exec(body);
  if (numeric === null) return whole;
  const codePoint = numeric[1] !== undefined ? parseInt(numeric[1], 16) : Number(numeric[2]);
  const valid =
    Number.isInteger(codePoint) &&
    codePoint > 0 &&
    codePoint <= 0x10ffff &&
    !(codePoint >= 0xd800 && codePoint <= 0xdfff);
  return valid ? String.fromCodePoint(codePoint) : whole;
}

/**
 * Markup to plain text (requirement 12.5): comments and tags removed, then `&amp; &lt; &gt; &quot;`
 * and numeric references (`&#39;`, `&#x27;`) decoded in one pass, so `&amp;lt;` becomes `&lt;`.
 * Runs of spaces, tabs and line breaks become one space, and the ends are trimmed. Does not fold
 * text into the repertoire: compilers do that.
 */
export function plainText(markup: string): string {
  return markup
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<[^>]*>/g, "")
    .replace(/&(#x[0-9a-fA-F]+|#[0-9]+|amp|lt|gt|quot);/g, decodeEntity)
    .replace(/[ \t\r\n]+/g, " ")
    .trim();
}
