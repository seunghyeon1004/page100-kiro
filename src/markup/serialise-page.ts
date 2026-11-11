import type { ValidPage } from "../grid/types.js";
import { serialiseRow } from "./serialise-row.js";

/** The canonical markup of a full page: 24 lines, each followed by one LF (requirement 16.5). */
export function serialisePage(page: ValidPage): string {
  return page.map((row) => `${serialiseRow(row)}\n`).join("");
}
