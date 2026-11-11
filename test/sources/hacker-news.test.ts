import { describe, expect, it } from "vitest";
import {
  HackerNews,
  assembleHackerNews,
  fetchHackerNews,
  parseHackerNews,
  parseHnIdList,
  storyOf,
} from "../../src/sources/hacker-news.js";
import { createHttpClient } from "../../src/sources/http.js";
import { hnItemUrl, selectItemIds } from "../../src/sources/source-requests.js";
import { fakeDelay, textResponse } from "./fake-http.js";
import {
  recorded,
  recordedBases,
  recordedFetch,
  recordedMeta,
  syntheticFixtures,
} from "./fixtures.js";

const DAY = "2026-11-11";
const NOW = new Date(recordedMeta("hacker-news", `${DAY}-topstories`).fetchedAt);
const LIST_URLS = [
  "https://hacker-news.firebaseio.com/v0/topstories.json",
  "https://hacker-news.firebaseio.com/v0/showstories.json",
  "https://hacker-news.firebaseio.com/v0/askstories.json",
];

const top = recorded("hacker-news", `${DAY}-topstories`);
const show = recorded("hacker-news", `${DAY}-showstories`);
const ask = recorded("hacker-news", `${DAY}-askstories`);

function recordedItems(): Map<number, unknown> {
  const items = new Map<number, unknown>();
  for (const base of recordedBases("hacker-news")) {
    const match = /^2026-11-11-item-(\d+)$/.exec(base);
    if (match?.[1] !== undefined) items.set(Number(match[1]), recorded("hacker-news", base));
  }
  return items;
}

function synthetic(name: string): unknown {
  const found = syntheticFixtures("hacker-news").find((f) => f.name === name);
  if (found === undefined) throw new Error(`no synthetic fixture ${name}`);
  return found.body;
}

describe("Hacker News recorded fixtures (requirements 12.1, 18.1)", () => {
  it("parses the three id lists", () => {
    for (const [body, length] of [
      [top, 500],
      [show, 153],
      [ask, 32],
    ] as const) {
      const result = parseHnIdList(body);
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value).toHaveLength(length);
    }
  });

  it("turns every recorded item into a story", () => {
    const items = recordedItems();
    expect(items.size).toBe(36);
    for (const [id, body] of items) {
      const story = storyOf(body);
      expect(story, String(id)).not.toBeNull();
      expect(story?.id).toBe(id);
    }
  });

  it("reads a story with a URL, a Show HN story and an Ask HN story", () => {
    const items = recordedItems();
    expect(storyOf(items.get(50449748))).toEqual({
      id: 50449748,
      title: "Protecting SSH Keys with macOS Secure Enclave",
      by: "js2",
      score: 99,
      comments: 37,
      time: "2026-11-11T04:28:57.000Z",
      url: "https://gatezh.com/posts/macos-secure-enclave-ssh-keys/",
    });
    expect(storyOf(items.get(50443812))).toMatchObject({
      title: "Show HN: Get your coding agent off ~2019 JavaScript, onto modern web primitives",
      by: "paulirish",
      score: 338,
      comments: 101,
      time: "2026-11-10T18:01:15.000Z",
    });
    // Ask HN items have no url field in the recorded files.
    expect(storyOf(items.get(50449938))).toEqual({
      id: 50449938,
      title: "What are your favorite tools?",
      by: "d675",
      score: 3,
      comments: 1,
      time: "2026-11-11T05:07:09.000Z",
      url: null,
    });
  });

  it("builds 12 stories per list, in list order, from the recorded lists and items", () => {
    const items = recordedItems();
    const result = parseHackerNews({ top, show, ask, items });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(HackerNews.safeParse(result.value).success).toBe(true);
    const topIds = (top as number[]).slice(0, 12);
    expect(result.value.top.map((s) => s.id)).toEqual(topIds);
    expect(result.value.show.map((s) => s.id)).toEqual((show as number[]).slice(0, 12));
    expect(result.value.ask.map((s) => s.id)).toEqual((ask as number[]).slice(0, 12));
  });

  it("fails with the name of the list when a list has the wrong shape", () => {
    const items = recordedItems();
    expect(parseHackerNews({ top, show: { not: "a list" }, ask: [1, "x"], items })).toEqual({
      ok: false,
      issuePaths: ["show", "ask.1"],
    });
  });
});

describe("Hacker News synthetic fixtures", () => {
  it("has a comment on every synthetic fixture (requirement 16.4)", () => {
    for (const f of syntheticFixtures("hacker-news"))
      expect(f.comment.length, f.name).toBeGreaterThan(0);
  });

  it("skips null, deleted and dead items", () => {
    expect(storyOf(synthetic("item-null.json"))).toBeNull();
    expect(storyOf(synthetic("item-deleted.json"))).toBeNull();
    expect(storyOf(synthetic("item-dead.json"))).toBeNull();
  });

  it("skips items of the wrong shape, and non-objects", () => {
    for (const bad of [undefined, 5, "story", [], {}, { id: 1, title: "t" }]) {
      expect(storyOf(bad), JSON.stringify(bad)).toBeNull();
    }
    const real = recordedItems().get(50449748) as Record<string, unknown>;
    expect(storyOf({ ...real, time: 1e300 })).toBeNull();
    expect(storyOf({ ...real, score: "99" })).toBeNull();
  });

  it("leaves skipped and missing ids out and keeps the order of the rest", () => {
    const items = new Map<number, unknown>([
      [1, recordedItems().get(50449748)],
      [2, synthetic("item-deleted.json")],
      [3, synthetic("item-null.json")],
      [5, recordedItems().get(50443812)],
    ]);
    const result = assembleHackerNews({ top: [1, 2, 3, 4, 5], show: [], ask: [2] }, items);
    expect(result.top.map((s) => s.title)).toEqual([
      "Protecting SSH Keys with macOS Secure Enclave",
      "Show HN: Get your coding agent off ~2019 JavaScript, onto modern web primitives",
    ]);
    expect(result.show).toEqual([]);
    expect(result.ask).toEqual([]);
  });

  it("uses only the first 12 ids of a list", () => {
    const items = new Map<number, unknown>();
    const ids = Array.from({ length: 20 }, (_, i) => 100 + i);
    const real = recordedItems().get(50449748) as Record<string, unknown>;
    for (const id of ids) items.set(id, { ...real, id });
    const result = assembleHackerNews({ top: ids, show: [], ask: [] }, items);
    expect(result.top.map((s) => s.id)).toEqual(ids.slice(0, 12));
  });
});

describe("fetchHackerNews with the recorded fixtures (requirement 13.4)", () => {
  const delay = fakeDelay().delay;
  const ids = selectItemIds({
    top: top as number[],
    show: show as number[],
    ask: ask as number[],
  });

  it("requests the three lists and each of the 36 selected items once", async () => {
    const { fetch, requested } = recordedFetch("hacker-news");
    const result = await fetchHackerNews(createHttpClient({ fetch, delay }), NOW);
    expect(ids).toHaveLength(36);
    expect(requested.slice(0, 3).sort()).toEqual([...LIST_URLS].sort());
    expect(requested.slice(3).sort()).toEqual(ids.map(hnItemUrl).sort());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.fetchedAt).toBe(NOW.toISOString());
    expect(HackerNews.safeParse(result.value).success).toBe(true);
    expect(result.value.top).toHaveLength(12);
    expect(result.value.show).toHaveLength(12);
    expect(result.value.ask).toHaveLength(12);
  });

  it("skips an item whose request fails, and still succeeds", async () => {
    const failing = (top as number[])[1] ?? 0;
    const { fetch } = recordedFetch("hacker-news", {
      [hnItemUrl(failing)]: () => Promise.resolve(textResponse(500, "x")),
    });
    const result = await fetchHackerNews(createHttpClient({ fetch, delay }), NOW);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.top.map((s) => s.id)).not.toContain(failing);
      expect(result.value.top).toHaveLength(11);
    }
  });

  it("does not retry item requests", async () => {
    const failing = (top as number[])[0] ?? 0;
    const { fetch, requested } = recordedFetch("hacker-news", {
      [hnItemUrl(failing)]: () => Promise.resolve(textResponse(503, "x")),
    });
    await fetchHackerNews(createHttpClient({ fetch, delay }), NOW);
    expect(requested.filter((u) => u === hnItemUrl(failing))).toHaveLength(1);
  });

  it("retries a failing id list once, then fails with that list's URL", async () => {
    const { fetch, requested } = recordedFetch("hacker-news", {
      [LIST_URLS[1] ?? ""]: () => Promise.resolve(textResponse(503, "x")),
    });
    const result = await fetchHackerNews(createHttpClient({ fetch, delay }), NOW);
    expect(result).toEqual({
      ok: false,
      source: "hacker-news",
      url: LIST_URLS[1],
      failure: { kind: "status", status: 503 },
    });
    expect(requested.filter((u) => u === LIST_URLS[1])).toHaveLength(2);
  });

  it("fails with a schema failure when a list is not an array of numbers", async () => {
    const { fetch } = recordedFetch("hacker-news", {
      [LIST_URLS[2] ?? ""]: () => Promise.resolve(textResponse(200, '{"a":1}')),
    });
    const result = await fetchHackerNews(createHttpClient({ fetch, delay }), NOW);
    expect(result).toEqual({
      ok: false,
      source: "hacker-news",
      url: LIST_URLS[2],
      failure: { kind: "schema", issuePaths: ["(root)"] },
    });
  });
});
