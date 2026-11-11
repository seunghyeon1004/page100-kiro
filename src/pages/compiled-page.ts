import type { NonEmpty, ValidContent } from "../grid/types.js";
import type { AltBlock } from "./alt-block.js";
import type { EditorKind } from "./page-def.js";

/** One screen's content rows (page rows 2 to 21) and its text alternative. */
export interface Subpage {
  readonly content: ValidContent;
  readonly alt: NonEmpty<AltBlock>;
}

/** What a compiler hands the frame builder (requirement 4.2). `dataAt` is the time of the last good fetch. */
export interface CompiledPage {
  readonly number: number;
  readonly subpages: NonEmpty<Subpage>;
  readonly dataAt: Date | null;
  readonly editor: EditorKind;
}
