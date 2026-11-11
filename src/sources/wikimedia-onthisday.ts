import { z } from "zod";
import type { HttpClient } from "./http.js";
import { cleanNumber, NormalNumber } from "./normal-number.js";
import type { FetchOutcome, ParseOutcome } from "./outcome.js";
import { parseWith } from "./outcome.js";
import { sourceRequests } from "./source-requests.js";
import { ArticleRef, ArticleSummaryWire, articleRef } from "./wikimedia-feed.js";

// Wire shape from test/fixtures/sources/wikimedia-onthisday/2026-11-11-onthisday.json: the lists
// `events`, `births` and `deaths` hold `{ text, year, pages }`, where each page is the same article
// summary object as in the featured feed. The response also has `selected` and `holidays`, which
// Page 100 does not read.

const DayEntryWire = z.object({
  year: z.number(),
  text: z.string(),
  pages: z.array(ArticleSummaryWire),
});

const OnThisDayWire = z.object({
  events: z.array(DayEntryWire),
  births: z.array(DayEntryWire),
  deaths: z.array(DayEntryWire),
});

export const DayEntry = z.strictObject({
  year: NormalNumber,
  text: z.string(),
  articles: z.array(ArticleRef),
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

function entries(list: readonly z.infer<typeof DayEntryWire>[]): DayEntry[] {
  return list.map((e) => ({
    year: cleanNumber(e.year),
    text: e.text,
    articles: e.pages.map(articleRef),
  }));
}

/** Checks the response and normalises it (requirements 12.1, 12.2). Never throws. */
export function parseWikimediaOnThisDay(body: unknown): ParseOutcome<OnThisDayLists> {
  const parsed = parseWith(OnThisDayWire, body);
  if (!parsed.ok) return parsed;
  const { events, births, deaths } = parsed.value;
  return {
    ok: true,
    value: { events: entries(events), births: entries(births), deaths: entries(deaths) },
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
