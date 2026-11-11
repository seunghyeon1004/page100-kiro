import { describe, expect, it } from "vitest";
import { createHttpClient } from "../../src/sources/http.js";
import {
  FeaturedDay,
  FeaturedFeed,
  fetchWikimediaFeed,
  parseWikimediaFeed,
} from "../../src/sources/wikimedia-feed.js";
import { fakeDelay, textResponse } from "./fake-http.js";
import {
  recorded,
  recordedBases,
  recordedFetch,
  recordedMeta,
  syntheticFixtures,
} from "./fixtures.js";

const TODAY = "2026-11-11-featured-today";
const YESTERDAY = "2026-11-11-featured-yesterday";
const TODAY_URL = "https://api.wikimedia.org/feed/v1/wikipedia/en/featured/2026/11/11";
const YESTERDAY_URL = "https://api.wikimedia.org/feed/v1/wikipedia/en/featured/2026/11/10";
const NOW = new Date(recordedMeta("wikimedia-feed", TODAY).fetchedAt);

function httpFor(fetch: ReturnType<typeof recordedFetch>["fetch"]) {
  return createHttpClient({ fetch, delay: fakeDelay().delay });
}

function parsed(base: string) {
  const result = parseWikimediaFeed(recorded("wikimedia-feed", base));
  if (!result.ok) throw new Error(`${base}: ${result.issuePaths.join(", ")}`);
  return result.value;
}

describe("parseWikimediaFeed on recorded fixtures (requirements 12.1, 18.1)", () => {
  it("has the two recorded featured days", () => {
    expect(recordedBases("wikimedia-feed")).toEqual([TODAY, YESTERDAY]);
  });

  it.each(recordedBases("wikimedia-feed"))(
    "parses %s and the value passes the normalised schema",
    (base) => {
      const result = parseWikimediaFeed(recorded("wikimedia-feed", base));
      expect(result.ok).toBe(true);
      if (result.ok) expect(FeaturedDay.safeParse(result.value).success).toBe(true);
    },
  );

  it("reads the news of 2026-11-11-featured-today as plain text with article summaries", () => {
    const day = parsed(TODAY);
    expect(day.news).toHaveLength(5);
    expect(day.news?.map((n) => n.text)).toEqual([
      "In stock car racing, Kyle Larson wins the NASCAR Cup Series.",
      "A mass shooting in the Main Square of Kraków, Poland, leaves six people dead and sixteen others injured.",
      "President of Paraguay Santiago Peña is impeached, arrested, and replaced by Vice President Pedro Alliana amid a banking crisis involving Ueno Bank.",
      "In the United States, the Democratic Party wins a majority in both the House of Representatives and the Senate in the midterm elections.",
      "In motorsport, Kimi Antonelli becomes the youngest ever winner of the Formula One World Championship.",
    ]);
  });

  it("gives every news link an extract and a page URL (owner answer 1, 2026-11-11-featured-today)", () => {
    const day = parsed(TODAY);
    expect(day.news?.map((n) => n.articles.length)).toEqual([2, 3, 4, 4, 3]);
    for (const story of day.news ?? []) {
      for (const article of story.articles) {
        expect(typeof article.extract).toBe("string");
        expect(article.extract?.length ?? 0).toBeGreaterThan(0);
        expect(article.url?.startsWith("https://en.wikipedia.org/wiki/")).toBe(true);
      }
    }
    expect(day.news?.[0]?.articles[0]).toMatchObject({
      title: "2026 NASCAR Cup Series",
      url: "https://en.wikipedia.org/wiki/2026_NASCAR_Cup_Series",
    });
    expect(
      day.news?.[0]?.articles[0]?.extract?.startsWith("The 2026 NASCAR Cup Series was the 78th"),
    ).toBe(true);
  });

  it("reads most read and the featured article of 2026-11-11-featured-today", () => {
    const day = parsed(TODAY);
    expect(day.mostRead).toHaveLength(43);
    expect(day.mostRead?.[0]).toMatchObject({ rank: 2, title: "Ramayana: Part 1", views: 840888 });
    expect(day.mostRead?.map((m) => m.rank)).toEqual(
      [...(day.mostRead?.map((m) => m.rank) ?? [])].sort((a, b) => a - b),
    );
    expect(day.featuredArticle).toMatchObject({
      title: "U.S. Route 101",
      url: "https://en.wikipedia.org/wiki/U.S._Route_101",
    });
  });

  it("has no news key on 2026-11-11-featured-yesterday, so news is null (sources.md: keys vary by day)", () => {
    const day = parsed(YESTERDAY);
    expect(day.news).toBeNull();
    expect(day.mostRead).toHaveLength(42);
    expect(day.featuredArticle?.title).toBe("Regulus (Turner)");
  });
});

describe("parseWikimediaFeed on synthetic fixtures and bad shapes", () => {
  const synthetic = syntheticFixtures("wikimedia-feed");

  it("has a comment on every synthetic fixture (requirement 16.4)", () => {
    expect(synthetic.length).toBeGreaterThan(0);
    for (const fixture of synthetic)
      expect(fixture.comment.length, fixture.name).toBeGreaterThan(0);
  });

  it("keeps an empty news list as [] and the absent keys as null (empty-news.json)", () => {
    const body = synthetic.find((f) => f.name === "empty-news.json")?.body;
    expect(parseWikimediaFeed(body)).toEqual({
      ok: true,
      value: { news: [], mostRead: null, featuredArticle: null },
    });
  });

  it("gives null for every key when the day carries none (no-keys.json)", () => {
    const body = synthetic.find((f) => f.name === "no-keys.json")?.body;
    expect(parseWikimediaFeed(body)).toEqual({
      ok: true,
      value: { news: null, mostRead: null, featuredArticle: null },
    });
  });

  it("removes tags and decodes entities in the story (story-with-entities.json)", () => {
    const body = synthetic.find((f) => f.name === "story-with-entities.json")?.body;
    const result = parseWikimediaFeed(body);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.news?.[0]?.text).toBe("Fish & chips: a <b> \"quoted\" 'one' 'two'.");
    }
  });

  it("fails with issue paths, and no body text, for wrong shapes", () => {
    expect(parseWikimediaFeed(null)).toEqual({ ok: false, issuePaths: ["(root)"] });
    expect(parseWikimediaFeed([])).toEqual({ ok: false, issuePaths: ["(root)"] });
    const bad = parseWikimediaFeed({ news: [{ story: 7, links: "SECRET" }] });
    expect(bad).toEqual({ ok: false, issuePaths: ["news.0.story", "news.0.links"] });
    expect(JSON.stringify(bad)).not.toContain("SECRET");
  });

  it("fails when a used field of an article is missing", () => {
    const article = {
      titles: { normalized: "A" },
      content_urls: { desktop: { page: "https://en.wikipedia.org/wiki/A" } },
    };
    const result = parseWikimediaFeed({ tfa: article });
    expect(result).toEqual({ ok: false, issuePaths: ["tfa.extract"] });
  });

  it("maps -0 views to 0 and rejects the normalised -0", () => {
    const article = {
      titles: { normalized: "A" },
      extract: "E",
      content_urls: { desktop: { page: "https://en.wikipedia.org/wiki/A" } },
      rank: -0,
      views: -0,
    };
    const result = parseWikimediaFeed({ mostread: { articles: [article] } });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(Object.is(result.value.mostRead?.[0]?.rank, 0)).toBe(true);
      expect(Object.is(result.value.mostRead?.[0]?.views, 0)).toBe(true);
    }
  });
});

describe("fetchWikimediaFeed with the recorded two-day feed (requirement 13.1)", () => {
  it("takes every key from today when today carries it", async () => {
    const { fetch, requested } = recordedFetch("wikimedia-feed");
    const result = await fetchWikimediaFeed(httpFor(fetch), NOW);
    expect(requested).toEqual([TODAY_URL, YESTERDAY_URL]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.fetchedAt).toBe(NOW.toISOString());
    expect(FeaturedFeed.safeParse(result.value).success).toBe(true);
    expect(result.value.date).toBe("2026-11-11");
    expect(result.value.news).toHaveLength(5);
    expect(result.value.mostRead).toHaveLength(43);
    expect(result.value.featuredArticle?.title).toBe("U.S. Route 101");
  });

  it("falls back to yesterday for every key when today fails, so news is null", async () => {
    const { fetch } = recordedFetch("wikimedia-feed", {
      [TODAY_URL]: () => Promise.resolve(textResponse(404, "gone")),
    });
    const result = await fetchWikimediaFeed(httpFor(fetch), NOW);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.news).toBeNull();
    expect(result.value.mostRead).toHaveLength(42);
    expect(result.value.featuredArticle?.title).toBe("Regulus (Turner)");
  });

  it("succeeds when only today returns", async () => {
    const { fetch } = recordedFetch("wikimedia-feed", {
      [YESTERDAY_URL]: () => Promise.resolve(textResponse(404, "gone")),
    });
    const result = await fetchWikimediaFeed(httpFor(fetch), NOW);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.news).toHaveLength(5);
  });

  it("uses yesterday's value for a key today does not carry", async () => {
    const todayWithoutMostRead = JSON.stringify({
      tfa: (recorded("wikimedia-feed", TODAY) as { tfa: unknown }).tfa,
    });
    const { fetch } = recordedFetch("wikimedia-feed", {
      [TODAY_URL]: () => Promise.resolve(textResponse(200, todayWithoutMostRead)),
    });
    const result = await fetchWikimediaFeed(httpFor(fetch), NOW);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.news).toBeNull();
    expect(result.value.featuredArticle?.title).toBe("U.S. Route 101");
    expect(result.value.mostRead).toHaveLength(42);
  });

  it("fails with today's failure when neither day returns", async () => {
    const { fetch } = recordedFetch("wikimedia-feed", {
      [TODAY_URL]: () => Promise.resolve(textResponse(404, "gone")),
      [YESTERDAY_URL]: () => Promise.resolve(textResponse(500, "broken")),
    });
    const result = await fetchWikimediaFeed(httpFor(fetch), NOW);
    expect(result).toEqual({
      ok: false,
      source: "wikimedia-feed",
      url: TODAY_URL,
      failure: { kind: "status", status: 404 },
    });
  });

  it("reports a schema failure with issue paths when neither day parses", async () => {
    const { fetch } = recordedFetch("wikimedia-feed", {
      [TODAY_URL]: () => Promise.resolve(textResponse(200, '{"tfa": 5}')),
      [YESTERDAY_URL]: () => Promise.resolve(textResponse(200, "[]")),
    });
    const result = await fetchWikimediaFeed(httpFor(fetch), NOW);
    expect(result).toEqual({
      ok: false,
      source: "wikimedia-feed",
      url: TODAY_URL,
      failure: { kind: "schema", issuePaths: ["tfa"] },
    });
  });
});
