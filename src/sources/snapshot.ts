import { z } from "zod";
import { Rates } from "./frankfurter.js";
import { HackerNews } from "./hacker-news.js";
import { Launches } from "./launch-library.js";
import { Weather } from "./open-meteo.js";
import type { NonEmpty } from "./outcome.js";
import { issuePathsOf } from "./outcome.js";
import { Quakes } from "./usgs.js";
import { FeaturedFeed } from "./wikimedia-feed.js";
import { OnThisDay } from "./wikimedia-onthisday.js";

/** A time written by `Date.prototype.toISOString()`. */
const Iso = z.string().refine(
  (t) => {
    const ms = Date.parse(t);
    return Number.isFinite(ms) && new Date(ms).toISOString() === t;
  },
  { message: "not an ISO time" },
);

function entry<T extends z.ZodType>(value: T) {
  return z.strictObject({ fetchedAt: Iso, value });
}

/** The last good data of every source (requirement 15.1). */
export const Snapshot = z.strictObject({
  version: z.literal(1),
  sources: z.strictObject({
    "wikimedia-feed": entry(FeaturedFeed),
    "wikimedia-onthisday": entry(OnThisDay),
    "open-meteo": entry(Weather),
    frankfurter: entry(Rates),
    "hacker-news": entry(HackerNews),
    usgs: entry(Quakes),
    "launch-library": entry(Launches),
  }),
});
export type Snapshot = z.infer<typeof Snapshot>;

export type ParseSnapshotOutcome =
  | { readonly ok: true; readonly snapshot: Snapshot }
  | { readonly ok: false; readonly issuePaths: NonEmpty<string> };

/** Checks a parsed JSON value against `Snapshot` (requirement 15.2). Never throws. */
export function parseSnapshot(value: unknown): ParseSnapshotOutcome {
  const result = Snapshot.safeParse(value);
  return result.success
    ? { ok: true, snapshot: result.data }
    : { ok: false, issuePaths: issuePathsOf(result.error) };
}
