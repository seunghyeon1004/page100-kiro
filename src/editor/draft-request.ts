import type { DraftRows, EditorialInput } from "../compilers/editorial-input.js";
import type { NonEmpty } from "../grid/types.js";
import type { DraftRequest } from "./editor-types.js";
import { inputKey } from "./draft-cache.js";

// Builds the request for one attempt (ai-editor requirement 3.2).

/** The rows of a draft as a model reply lists them: slots in order, `""` between slots. */
export function replyRowsOf(rows: DraftRows): string[] {
  const out: string[] = [];
  rows.forEach((slot, i) => {
    if (i > 0) out.push("");
    out.push(...slot);
  });
  return out;
}

export function draftRequest(
  input: EditorialInput,
  rules: DraftRows,
  attempt: 0 | 1 | 2,
  previous: { readonly rows: readonly string[]; readonly violations: NonEmpty<string> } | null,
): DraftRequest {
  return {
    page: input.page,
    totalRows: input.totalRows,
    slots: input.slots.map((slot, i) => ({
      id: slot.id,
      mode: slot.mode,
      maxRows: slot.maxRows,
      width: slot.width,
      optional: (rules[i]?.length ?? 0) === 0,
      text: slot.text,
    })),
    inputKey: inputKey(input),
    attempt,
    previous: attempt === 0 ? null : previous,
  };
}
