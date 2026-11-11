import type { NonEmpty } from "../grid/types.js";
import type { CompiledPage } from "../pages/compiled-page.js";
import type { SourceId } from "../sources/source-id.js";
import type { Snapshot } from "../sources/snapshot.js";

/** A source's `{ fetchedAt, value }` in the snapshot. */
export type SourceEntry<S extends SourceId> = Snapshot["sources"][S];

/** `compiled` for a page with data, `no-data` for the page that says it has none. */
export type Outcome = "compiled" | "no-data";

export type CompileProblemCode =
  // The content builder and the static pages.
  | "out-of-bounds"
  | "overlap"
  | "not-repertoire"
  | "markup"
  | "grid"
  | "alt-empty"
  | "alt-missing"
  // Laying out a draft (`assemble`).
  | "slot-count"
  | "slot-rows"
  | "row-width"
  | "row-space"
  | "total-rows"
  // `compileAll`.
  | "page-check"
  | "frame"
  | "threw";

/** One problem. `subpage` is 0-based, `row` is a page row, `col` a cell index; `null` when unknown. */
export interface CompileProblem {
  readonly code: CompileProblemCode;
  readonly subpage: number | null;
  readonly row: number | null;
  readonly col: number | null;
  readonly message: string;
}

export type CompileResult =
  | { readonly ok: true; readonly page: CompiledPage; readonly outcome: Outcome }
  | { readonly ok: false; readonly problems: NonEmpty<CompileProblem> };

/** The text of the four hand-written files in `pages/`, read by the caller (Departure 2). */
export type PageFiles = Readonly<Record<666 | 800 | 801 | 899, string>>;
