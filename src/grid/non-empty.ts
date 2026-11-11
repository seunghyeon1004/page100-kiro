import type { NonEmpty } from "./types.js";

/** The items as a `NonEmpty` array, or `undefined` when there are none. */
export function toNonEmpty<T>(items: readonly T[]): NonEmpty<T> | undefined {
  return items.length === 0 ? undefined : (items as NonEmpty<T>);
}
