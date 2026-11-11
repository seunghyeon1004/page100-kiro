import fc from "fast-check";
import { describe, expect, it } from "vitest";
import type { FeaturedDay } from "../../src/sources/wikimedia-feed.js";
import { mergeFeatured } from "../../src/sources/wikimedia-feed.js";

// Every value is a fresh object, so `toBe` shows which day a key came from.
const newsValue = fc
  .array(fc.string(), { maxLength: 3 })
  .map((texts) => texts.map((text) => ({ text, articles: [] })));
const mostReadValue = fc
  .array(fc.string(), { maxLength: 3 })
  .map((titles) => titles.map((title, i) => ({ rank: i + 1, title, views: i, extract: null })));
const articleValue = fc.string().map((title) => ({ title, extract: null, url: null }));

const featuredDay: fc.Arbitrary<FeaturedDay> = fc.record({
  news: fc.option(newsValue, { nil: null }),
  mostRead: fc.option(mostReadValue, { nil: null }),
  featuredArticle: fc.option(articleValue, { nil: null }),
});

describe("mergeFeatured properties", () => {
  it("Property 8: each key comes from today when present, else yesterday, else null", () => {
    fc.assert(
      fc.property(
        fc.option(featuredDay, { nil: null }),
        fc.option(featuredDay, { nil: null }),
        (today, yesterday) => {
          const merged = mergeFeatured(today, yesterday);
          for (const key of ["news", "mostRead", "featuredArticle"] as const) {
            const fromToday = today === null ? null : today[key];
            const fromYesterday = yesterday === null ? null : yesterday[key];
            if (fromToday !== null) {
              expect(merged[key]).toBe(fromToday);
            } else if (fromYesterday !== null) {
              expect(merged[key]).toBe(fromYesterday);
            } else {
              expect(merged[key]).toBeNull();
            }
          }
        },
      ),
    );
  });
});
