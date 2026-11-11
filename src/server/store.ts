import type { EditorStatus } from "../editor/run-edition.js";
import { toNonEmpty } from "../grid/non-empty.js";
import type { NonEmpty, ValidPage } from "../grid/types.js";
import type { AltBlock } from "../pages/alt-block.js";
import { buildScreen } from "../pages/build-screen.js";
import { checkCompiledPage } from "../pages/check-compiled-page.js";
import type { CompiledPage } from "../pages/compiled-page.js";
import type { EditorKind, PageDef } from "../pages/page-def.js";
import { findPage } from "../pages/registry.js";
import { pageEtag } from "./etag.js";

// The store: the only holder of published pages (server-and-viewer requirement 4). Everything
// that enters goes through `framePage`, which is `checkCompiledPage` plus `buildScreen` plus
// `validateGrid`, so nothing invalid is ever held (grid-rules.md, invariant 2).

export interface PublishedPage {
  readonly number: number;
  readonly def: PageDef;
  readonly screens: NonEmpty<ValidPage>;
  readonly alts: NonEmpty<NonEmpty<AltBlock>>;
  readonly etag: string;
  readonly compiledAt: Date;
  readonly dataAt: Date | null;
  readonly stale: boolean;
  readonly editor: EditorKind;
}

export type PublishOutcome =
  | { readonly ok: true; readonly page: PublishedPage }
  | { readonly ok: false; readonly codes: NonEmpty<string> };

export interface StoreReader {
  get(n: number): PublishedPage | undefined;
  /** Every held page, ascending by number. */
  list(): readonly PublishedPage[];
  /** How many publishes of this number were rejected. */
  failures(n: number): number;
  editorStatus(): EditorStatus | null;
  aiEditor(): boolean;
}

export interface Store extends StoreReader {
  publish(
    compiled: CompiledPage,
    frame: { readonly now: Date; readonly stale: boolean },
  ): PublishOutcome;
  setEditorStatus(status: EditorStatus): void;
}

function deepFreeze<T>(value: T): T {
  if (typeof value === "object" && value !== null && !Object.isFrozen(value)) {
    // A Date cannot be made read-only by freezing; the copy held here is never handed out as a setter target.
    if (!(value instanceof Date)) Object.freeze(value);
    for (const inner of Object.values(value)) deepFreeze(inner);
  }
  return value;
}

/**
 * Frames a compiled page for `def` (rows 0, 1, 22 and 23 from the frame, `stale` and `now` as
 * given) and returns a deeply frozen copy that shares no object with the input, with its ETag.
 * Never throws. The codes are the `CompiledProblem` codes and the `ScreenResult` errors.
 */
export function framePage(
  def: PageDef,
  compiled: CompiledPage,
  frame: { readonly now: Date; readonly stale: boolean },
): PublishOutcome {
  try {
    const codes: string[] = checkCompiledPage(def, compiled).map((problem) => problem.code);
    const screens: ValidPage[] = [];
    compiled.subpages.forEach((_, index) => {
      const built = buildScreen(def, compiled, index, {
        now: frame.now,
        stale: frame.stale,
        lastGoodAt: compiled.dataAt,
      });
      if (built.ok) screens.push(structuredClone(built.page));
      else codes.push(built.error);
    });
    const failed = toNonEmpty([...new Set(codes)]);
    if (failed !== undefined) return { ok: false, codes: failed };

    const heldScreens = toNonEmpty(screens);
    const alts = toNonEmpty(compiled.subpages.map((subpage) => structuredClone(subpage.alt)));
    if (heldScreens === undefined || alts === undefined) {
      return { ok: false, codes: ["subpage-count"] };
    }
    const dataAt = compiled.dataAt === null ? null : new Date(compiled.dataAt.getTime());
    const parts = { number: def.number, editor: compiled.editor, dataAt, stale: frame.stale };
    const page: PublishedPage = deepFreeze({
      ...parts,
      def,
      screens: heldScreens,
      alts,
      etag: pageEtag({ ...parts, alts, screens: heldScreens }),
      compiledAt: new Date(frame.now.getTime()),
    });
    return { ok: true, page };
  } catch {
    return { ok: false, codes: ["threw"] };
  }
}

export function createStore(options: { readonly aiEditor: boolean }): Store {
  const pages = new Map<number, PublishedPage>();
  const failed = new Map<number, number>();
  let status: EditorStatus | null = null;

  return {
    get: (n) => pages.get(n),
    list: () => [...pages.values()].sort((a, b) => a.number - b.number),
    failures: (n) => failed.get(n) ?? 0,
    editorStatus: () => status,
    aiEditor: () => options.aiEditor,
    publish(compiled, frame) {
      const def = findPage(compiled.number);
      const outcome: PublishOutcome =
        def === undefined
          ? { ok: false, codes: ["unknown-page"] }
          : framePage(def, compiled, frame);
      if (outcome.ok) pages.set(outcome.page.number, outcome.page);
      else failed.set(compiled.number, (failed.get(compiled.number) ?? 0) + 1);
      return outcome;
    },
    setEditorStatus(next) {
      status = structuredClone(next);
    },
  };
}
