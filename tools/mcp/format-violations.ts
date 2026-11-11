/** The fields a grid violation and a markup error have in common. */
export interface Located {
  readonly code: string;
  readonly row: number | null;
  readonly col: number | null;
  readonly message: string;
}

/** One line per problem: `row 7, col 3, contrast: message`. A missing row or column reads `-`. */
export function formatViolations(items: readonly Located[]): string {
  return items
    .map((item) => {
      const row = item.row === null ? "-" : String(item.row);
      const col = item.col === null ? "-" : String(item.col);
      return `row ${row}, col ${col}, ${item.code}: ${item.message}`;
    })
    .join("\n");
}

/** `INVALID: n violation(s)` followed by one line per problem. */
export function invalidReport(items: readonly Located[]): string {
  const noun = items.length === 1 ? "violation" : "violations";
  return `INVALID: ${String(items.length)} ${noun}\n${formatViolations(items)}`;
}
