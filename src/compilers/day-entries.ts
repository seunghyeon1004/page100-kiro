import type { DayEntry } from "../sources/wikimedia-onthisday.js";
import { folded } from "./compile-helpers.js";
import { pickSpread } from "./pick-spread.js";

// The on-this-day entries that pages 500, 501 and 550 share (design.md, "Selection rules").

export interface Day {
  readonly year: number;
  /** Folded text. */
  readonly text: string;
}

/** The entries whose text folds, in source order. */
export function foldedEntries(list: readonly DayEntry[]): Day[] {
  return list.flatMap((entry) => {
    const text = folded(entry.text);
    return text === undefined ? [] : [{ year: entry.year, text }];
  });
}

/** `count` entries spread over the list sorted by year ascending (stable), by `pickSpread`. */
export function spreadByYear(list: readonly DayEntry[], count: number): Day[] {
  const sorted = foldedEntries(list)
    .map((day, index) => ({ day, index }))
    .sort((a, b) => a.day.year - b.day.year || a.index - b.index)
    .map((item) => item.day);
  return pickSpread(sorted.length, count).flatMap((i) => {
    const day = sorted[i];
    return day === undefined ? [] : [day];
  });
}
