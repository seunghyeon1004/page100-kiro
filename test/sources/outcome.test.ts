import { describe, expect, it } from "vitest";
import { cleanNumber, NormalNumber } from "../../src/sources/normal-number.js";
import { HackerNews } from "../../src/sources/hacker-news.js";
import { issuePathsOf, parseWith } from "../../src/sources/outcome.js";
import { parseWikimediaOnThisDay } from "../../src/sources/wikimedia-onthisday.js";

describe("issuePathsOf and parseWith (requirement 12.2)", () => {
  // Real parsers and schemas of the project, so that this file needs no import of zod.
  it("joins each path with a dot and never includes the body", () => {
    const result = parseWikimediaOnThisDay({
      events: [{ year: "SECRET-VALUE", text: "t", pages: [] }],
      births: [],
      deaths: [{ year: 1, text: 5, pages: [] }],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issuePaths).toEqual(["events.0.year", "deaths.0.text"]);
      expect(JSON.stringify(result)).not.toContain("SECRET-VALUE");
    }
  });

  it("names a root failure (root)", () => {
    expect(parseWith(HackerNews, 7)).toEqual({ ok: false, issuePaths: ["(root)"] });
  });

  it("lists each path once", () => {
    const result = HackerNews.safeParse({ top: [], show: "no", ask: [] });
    expect(result.success).toBe(false);
    if (!result.success) expect(issuePathsOf(result.error)).toEqual(["show"]);
  });

  it("returns the value on success", () => {
    const value = { top: [], show: [], ask: [] };
    expect(parseWith(HackerNews, value)).toEqual({ ok: true, value });
  });
});

describe("NormalNumber and cleanNumber (design.md, 'Normalised types')", () => {
  it("rejects NaN, Infinity, -Infinity and -0", () => {
    for (const bad of [Number.NaN, Infinity, -Infinity, -0]) {
      expect(NormalNumber.safeParse(bad).success, String(bad)).toBe(false);
    }
  });

  it("accepts 0, negative and large finite numbers", () => {
    for (const good of [0, -1.5, 1e308, Number.MIN_VALUE]) {
      expect(NormalNumber.safeParse(good).success, String(good)).toBe(true);
    }
  });

  it("turns -0 into 0 and leaves other numbers alone", () => {
    expect(Object.is(cleanNumber(-0), 0)).toBe(true);
    expect(cleanNumber(3.5)).toBe(3.5);
    expect(cleanNumber(-2)).toBe(-2);
  });
});
