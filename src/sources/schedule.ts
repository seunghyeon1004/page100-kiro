import type { SourceId } from "./source-id.js";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

/** How often a source is fetched and when it counts as stale (requirement 14.1; sources.md). */
export interface ScheduleEntry {
  readonly intervalMs: number;
  /** Twice the interval (48 hours for on this day). */
  readonly staleAfterMs: number;
  /** Whether the HTTP client may retry once (Launch Library never does). */
  readonly retry: boolean;
  /** For the scheduler (server spec): also fetch at boot and after 00:00 UTC. */
  readonly alignToUtcMidnight: boolean;
  /** For the scheduler (server spec): at most one request per interval, failures included. */
  readonly strictInterval: boolean;
}

function entry(
  intervalMs: number,
  flags: { retry?: boolean; alignToUtcMidnight?: boolean; strictInterval?: boolean } = {},
): ScheduleEntry {
  return Object.freeze({
    intervalMs,
    staleAfterMs: 2 * intervalMs,
    retry: flags.retry ?? true,
    alignToUtcMidnight: flags.alignToUtcMidnight ?? false,
    strictInterval: flags.strictInterval ?? false,
  });
}

export const SCHEDULE: Readonly<Record<SourceId, ScheduleEntry>> = Object.freeze({
  "wikimedia-feed": entry(30 * MINUTE),
  "wikimedia-onthisday": entry(24 * HOUR, { alignToUtcMidnight: true }),
  "open-meteo": entry(30 * MINUTE),
  frankfurter: entry(HOUR),
  "hacker-news": entry(10 * MINUTE),
  usgs: entry(10 * MINUTE),
  "launch-library": entry(HOUR, { retry: false, strictInterval: true }),
});

/** Each interval is stretched by up to this fraction at random, so sources do not fire together. */
export const JITTER_FRACTION = 0.1;

/** True when the last good data is older than twice the source's interval (requirement 14.2). */
export function isStale(source: SourceId, lastGoodAt: Date, now: Date): boolean {
  return now.getTime() - lastGoodAt.getTime() > SCHEDULE[source].staleAfterMs;
}
