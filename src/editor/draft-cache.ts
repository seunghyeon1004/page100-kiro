import { createHash } from "node:crypto";
import type { DraftRows, EditorialInput } from "../compilers/editorial-input.js";

// The draft cache (ai-editor requirement 11): per input, either the accepted rows or `rejected`,
// so an unchanged input costs no call. Entries are found by the SHA-256 of the canonical input
// and used only when the canonical text is equal.

export type CacheValue =
  { readonly kind: "accepted"; readonly rows: DraftRows } | { readonly kind: "rejected" };

export interface DraftCache {
  /** The entry for this input, or `undefined`. Counts as a use in the current edition. */
  get(input: EditorialInput): CacheValue | undefined;
  set(input: EditorialInput, value: CacheValue): void;
  drop(input: EditorialInput): void;
  /** Deletes every entry that was not read or written since the previous call. */
  endEdition(): void;
}

/** The text that the key is made from: everything the model sees of the input. */
export function canonicalInput(input: EditorialInput): string {
  return JSON.stringify([
    input.page,
    input.totalRows,
    input.slots.map((s) => [s.id, s.mode, s.maxRows, s.width, s.text]),
  ]);
}

/** The SHA-256 of the canonical input, as 64 lower-case hex digits. */
export function inputKey(input: EditorialInput): string {
  return createHash("sha256").update(canonicalInput(input), "utf8").digest("hex");
}

interface Entry {
  readonly canonical: string;
  readonly value: CacheValue;
}

/**
 * `keyOf` is the key function; it defaults to `inputKey`. A test passes a function that makes
 * different inputs collide, to show that the canonical text is compared.
 */
export function createDraftCache(keyOf: (input: EditorialInput) => string = inputKey): DraftCache {
  const entries = new Map<string, Entry>();
  let used = new Set<string>();
  return {
    get(input) {
      const key = keyOf(input);
      used.add(key);
      const entry = entries.get(key);
      return entry?.canonical === canonicalInput(input) ? entry.value : undefined;
    },
    set(input, value) {
      const key = keyOf(input);
      used.add(key);
      entries.set(key, { canonical: canonicalInput(input), value });
    },
    drop(input) {
      const key = keyOf(input);
      if (entries.get(key)?.canonical === canonicalInput(input)) entries.delete(key);
    },
    endEdition() {
      for (const key of [...entries.keys()]) {
        if (!used.has(key)) entries.delete(key);
      }
      used = new Set();
    },
  };
}
