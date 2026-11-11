import { z } from "zod";
import type { HttpClient } from "./http.js";
import { cleanNumber, NormalNumber } from "./normal-number.js";
import type { FetchOutcome, ParseOutcome, SourceFailure } from "./outcome.js";
import { parseWith } from "./outcome.js";
import { plainText } from "./plain-text.js";
import { sourceRequests } from "./source-requests.js";

// Wire shape from test/fixtures/sources/wikimedia-feed/2026-11-11-featured-today.json and
// 2026-11-11-featured-yesterday.json. The yesterday file has no `news` key, which is why `news`,
// `mostread` and `tfa` are optional on a day (sources.md: the keys vary by day).

export const ArticleSummaryWire = z.object({
  titles: z.object({ normalized: z.string() }),
  extract: z.string(),
  content_urls: z.object({ desktop: z.object({ page: z.string() }) }),
});

const FeaturedDayWire = z.object({
  news: z.array(z.object({ story: z.string(), links: z.array(ArticleSummaryWire) })).optional(),
  mostread: z
    .object({
      articles: z.array(ArticleSummaryWire.extend({ rank: z.number(), views: z.number() })),
    })
    .optional(),
  tfa: ArticleSummaryWire.optional(),
});

export const ArticleRef = z.strictObject({
  title: z.string(),
  extract: z.string().nullable(),
  url: z.string().nullable(),
});
export type ArticleRef = z.infer<typeof ArticleRef>;

export const NewsStory = z.strictObject({ text: z.string(), articles: z.array(ArticleRef) });
export type NewsStory = z.infer<typeof NewsStory>;

export const MostRead = z.strictObject({
  rank: NormalNumber,
  title: z.string(),
  views: NormalNumber,
  extract: z.string().nullable(),
});
export type MostRead = z.infer<typeof MostRead>;

/** One day of the featured feed: each key is `null` when that day did not carry it. */
export const FeaturedDay = z.strictObject({
  news: z.array(NewsStory).nullable(),
  mostRead: z.array(MostRead).nullable(),
  featuredArticle: ArticleRef.nullable(),
});
export type FeaturedDay = z.infer<typeof FeaturedDay>;

/** The merged feed: `date` is the UTC date requested, `YYYY-MM-DD`. */
export const FeaturedFeed = FeaturedDay.extend({ date: z.string() });
export type FeaturedFeed = z.infer<typeof FeaturedFeed>;

export type ArticleSummaryWire = z.infer<typeof ArticleSummaryWire>;

/** The normalised form of an article summary object. */
export function articleRef(wire: ArticleSummaryWire): ArticleRef {
  return {
    title: wire.titles.normalized,
    extract: wire.extract,
    url: wire.content_urls.desktop.page,
  };
}

/** Checks one day's response and normalises it (requirements 12.1, 12.2). Never throws. */
export function parseWikimediaFeed(body: unknown): ParseOutcome<FeaturedDay> {
  const parsed = parseWith(FeaturedDayWire, body);
  if (!parsed.ok) return parsed;
  const { news, mostread, tfa } = parsed.value;
  return {
    ok: true,
    value: {
      news:
        news?.map((item) => ({
          text: plainText(item.story),
          articles: item.links.map(articleRef),
        })) ?? null,
      mostRead:
        mostread?.articles.map((a) => ({
          rank: cleanNumber(a.rank),
          title: a.titles.normalized,
          views: cleanNumber(a.views),
          extract: a.extract,
        })) ?? null,
      featuredArticle: tfa === undefined ? null : articleRef(tfa),
    },
  };
}

/** Each key from today when present, else from yesterday, else `null` (requirement 13.1). */
export function mergeFeatured(
  today: FeaturedDay | null,
  yesterday: FeaturedDay | null,
): FeaturedDay {
  return {
    news: today?.news ?? yesterday?.news ?? null,
    mostRead: today?.mostRead ?? yesterday?.mostRead ?? null,
    featuredArticle: today?.featuredArticle ?? yesterday?.featuredArticle ?? null,
  };
}

/**
 * Fetches today and yesterday and merges them (requirement 13.1). Succeeds when at least one day
 * parses; when neither does, fails with today's failure. Never throws.
 */
export async function fetchWikimediaFeed(
  http: HttpClient,
  now: Date,
): Promise<FetchOutcome<FeaturedFeed>> {
  const [todayRequest, yesterdayRequest] = sourceRequests("wikimedia-feed", now);
  if (todayRequest === undefined || yesterdayRequest === undefined) {
    // Unreachable: sourceRequests always lists both days. Kept so that this function never throws.
    return { ok: false, source: "wikimedia-feed", url: "", failure: { kind: "network" } };
  }

  async function day(url: string): Promise<{ day: FeaturedDay } | { failure: SourceFailure }> {
    const response = await http.getJson(url, { retry: true });
    if (!response.ok) return { failure: response.failure };
    const parsed = parseWikimediaFeed(response.body);
    return parsed.ok
      ? { day: parsed.value }
      : { failure: { kind: "schema", issuePaths: parsed.issuePaths } };
  }

  const [today, yesterday] = await Promise.all([day(todayRequest.url), day(yesterdayRequest.url)]);
  if ("failure" in today && "failure" in yesterday) {
    return { ok: false, source: "wikimedia-feed", url: todayRequest.url, failure: today.failure };
  }
  const merged = mergeFeatured(
    "day" in today ? today.day : null,
    "day" in yesterday ? yesterday.day : null,
  );
  return {
    ok: true,
    value: { date: now.toISOString().slice(0, 10), ...merged },
    fetchedAt: now.toISOString(),
  };
}
