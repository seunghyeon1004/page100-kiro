import { z } from "zod";
import type { HttpClient } from "./http.js";
import { cleanNumber, NormalNumber } from "./normal-number.js";
import type { FetchOutcome, ParseOutcome } from "./outcome.js";
import { parseWith } from "./outcome.js";
import { sourceRequests } from "./source-requests.js";

// Wire shape from test/fixtures/sources/wikimedia-onthisday/2026-11-11-onthisday.json: the lists
// `events`, `births` and `deaths` hold `{ text, year, pages }`, and `selected` is a separate list of
// curated entries of the same shape. The compilers use only `year` and `text`, so the wire schema
// lists only those two and the linked pages are not read (owner answer 4 of rule-compilers, which
// amends requirement 12.7). `selected` is optional: the synthetic fixtures leave it out.

const DayEntryWire = z.object({
  year: z.number(),
  text: z.string(),
});

const OnThisDayWire = z.object({
  events: z.array(DayEntryWire),
  births: z.array(DayEntryWire),
  deaths: z.array(DayEntryWire),
  selected: z.array(DayEntryWire).optional(),
});

/** At most this many entries of each list are kept, besides the `selected` ones (requirement 12.7). */
export const MAX_DAY_ENTRIES = 40;

export const DayEntry = z.strictObject({
  year: NormalNumber,
  text: z.string(),
});
export type DayEntry = z.infer<typeof DayEntry>;

/** The three lists of the response, in the order delivered. */
export const OnThisDayLists = z.strictObject({
  events: z.array(DayEntry),
  births: z.array(DayEntry),
  deaths: z.array(DayEntry),
});
export type OnThisDayLists = z.infer<typeof OnThisDayLists>;

/** The lists plus the UTC month and day that were requested. */
export const OnThisDay = OnThisDayLists.extend({ month: NormalNumber, day: NormalNumber });
export type OnThisDay = z.infer<typeof OnThisDay>;

function entryKey(e: z.infer<typeof DayEntryWire>): string {
  return JSON.stringify([e.year, e.text]);
}

/**
 * The first `MAX_DAY_ENTRIES` entries in the order delivered, plus every later entry that the
 * response's `selected` list also holds (same year and same text), in the order delivered.
 */
function entries(
  list: readonly z.infer<typeof DayEntryWire>[],
  selectedKeys: ReadonlySet<string>,
): DayEntry[] {
  return list
    .filter((e, i) => i < MAX_DAY_ENTRIES || selectedKeys.has(entryKey(e)))
    .map((e) => ({ year: cleanNumber(e.year), text: e.text }));
}

/** Checks the response and normalises it (requirements 12.1, 12.2). Never throws. */
export function parseWikimediaOnThisDay(body: unknown): ParseOutcome<OnThisDayLists> {
  const parsed = parseWith(OnThisDayWire, body);
  if (!parsed.ok) return parsed;
  const { events, births, deaths, selected } = parsed.value;
  const selectedKeys = new Set((selected ?? []).map(entryKey));
  return {
    ok: true,
    value: {
      events: entries(events, selectedKeys),
      births: entries(births, selectedKeys),
      deaths: entries(deaths, selectedKeys),
    },
  };
}

/** One request for the UTC month and day of `now`. Never throws. */
export async function fetchWikimediaOnThisDay(
  http: HttpClient,
  now: Date,
): Promise<FetchOutcome<OnThisDay>> {
  const request = sourceRequests("wikimedia-onthisday", now)[0];
  if (request === undefined) {
    // Unreachable: sourceRequests always lists the request. Kept so that this function never throws.
    return { ok: false, source: "wikimedia-onthisday", url: "", failure: { kind: "network" } };
  }
  const response = await http.getJson(request.url, { retry: true });
  if (!response.ok) {
    return {
      ok: false,
      source: "wikimedia-onthisday",
      url: request.url,
      failure: response.failure,
    };
  }
  const parsed = parseWikimediaOnThisDay(response.body);
  if (!parsed.ok) {
    return {
      ok: false,
      source: "wikimedia-onthisday",
      url: request.url,
      failure: { kind: "schema", issuePaths: parsed.issuePaths },
    };
  }
  return {
    ok: true,
    value: { month: now.getUTCMonth() + 1, day: now.getUTCDate(), ...parsed.value },
    fetchedAt: now.toISOString(),
  };
}
