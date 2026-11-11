import type { ServiceStatus } from "../../src/compilers/service-status.js";
import { REGISTRY } from "../../src/pages/registry.js";

/**
 * The status that `grid:check` gives page 802: every counter at its widest (99,999) and one entry
 * per registry page, compiled at `now` by the page's own editor, so that 802 is checked as wide as
 * it can get.
 */
export function CHECK_STATUS(now: Date): ServiceStatus {
  return {
    aiEditor: true,
    modelCalls: { used: 99_999, cap: 99_999 },
    drafts: { accepted: 99_999, rejected: 99_999 },
    pages: REGISTRY.map((def) => ({ number: def.number, compiledAt: now, editor: def.editor })),
  };
}
