/**
 * Splits text on LF. A final LF does not start another line, so `"a\n"` has one line. The empty
 * string has no lines, and `"\n"` has one empty line.
 */
export function splitLines(text: string): string[] {
  if (text === "") return [];
  const lines = text.split("\n");
  if (lines[lines.length - 1] === "") lines.pop();
  return lines;
}
