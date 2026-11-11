import { createHash } from "node:crypto";
import type { Cell, NonEmpty, ValidPage } from "../grid/types.js";
import type { AltBlock } from "../pages/alt-block.js";
import type { EditorKind } from "../pages/page-def.js";

// The content key of a page and its ETag (server-and-viewer 4.4, design.md, "Store and ETags").

/** What a format shows of a page apart from the request clock. */
export interface KeyParts {
  readonly number: number;
  readonly editor: EditorKind;
  readonly dataAt: Date | null;
  readonly stale: boolean;
  readonly alts: NonEmpty<NonEmpty<AltBlock>>;
  readonly screens: NonEmpty<ValidPage>;
}

const CLOCK_FIRST = 21;

function cellKey(cell: Cell): unknown[] {
  return cell.kind === "text"
    ? ["text", cell.ch, cell.fg, cell.bg, cell.conceal, null]
    : ["mosaic", cell.bits, cell.fg, cell.bg, cell.conceal, cell.separated];
}

function screenKey(screen: ValidPage): (unknown[] | null)[][] {
  return screen.map((row, r) =>
    row.map((cell, c) => (r === 0 && c >= CLOCK_FIRST ? null : cellKey(cell))),
  );
}

/**
 * Everything a format shows except the clock cells (row 0, cols 21 to 39), as text. Two versions
 * have the same key exactly when no format can tell them apart.
 */
export function contentKey(parts: KeyParts): string {
  return JSON.stringify([
    parts.number,
    parts.editor,
    parts.dataAt === null ? null : parts.dataAt.toISOString(),
    parts.stale,
    parts.alts,
    parts.screens.map(screenKey),
  ]);
}

/** The first 20 hex digits of the SHA-256 of the content key. */
export function pageEtag(parts: KeyParts): string {
  return createHash("sha256").update(contentKey(parts), "utf8").digest("hex").slice(0, 20);
}
