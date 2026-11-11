import type { SourceId } from "../sources/source-id.js";

/** Who writes a page's words: a hand-written file, the rule-based compiler, or the AI editor with a rules fallback. */
export type EditorKind = "rules" | "ai" | "static";

/** Where a page's data comes from: a source, nothing (`static`), or the compile time (`computed`). */
export type PageSource = SourceId | "static" | "computed";

/** One coloured quick link of row 23: a label of 1 to 8 characters and the page it opens. */
export interface QuickLink {
  readonly label: string;
  readonly target: number;
}

/** One registry entry (requirement 2). Links are in the order red, green, yellow, blue. */
export interface PageDef {
  readonly number: number;
  readonly title: string;
  readonly banner: string;
  readonly source: PageSource;
  readonly editor: EditorKind;
  readonly links: readonly [QuickLink, QuickLink, QuickLink, QuickLink];
}
