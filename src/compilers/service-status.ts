import type { EditorKind } from "../pages/page-def.js";

/** What the server tells page 802 (requirement 16.1). */
export interface ServiceStatus {
  /** False when there is no API key. */
  readonly aiEditor: boolean;
  readonly modelCalls: { readonly used: number; readonly cap: number };
  readonly drafts: { readonly accepted: number; readonly rejected: number };
  readonly pages: readonly {
    readonly number: number;
    readonly compiledAt: Date | null;
    readonly editor: EditorKind;
  }[];
}
