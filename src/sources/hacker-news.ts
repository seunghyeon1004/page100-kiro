import { z } from "zod";
import type { HttpClient } from "./http.js";
import { cleanNumber, NormalNumber } from "./normal-number.js";
import type { FetchOutcome, NonEmpty, ParseOutcome, SourceFailure } from "./outcome.js";
import { parseWith } from "./outcome.js";
import { HN_IDS_PER_LIST, hnItemUrl, selectItemIds, sourceRequests } from "./source-requests.js";
import type { HnLists } from "./source-requests.js";

// Wire shapes from test/fixtures/sources/hacker-news: an id list is an array of numbers
// (2026-11-11-topstories.json and the other two); an item (2026-11-11-item-<id>.json) has
// `by, descendants, id, score, time, title, type` and, on some items, `url`, `text` and `kids`.
// `url` is absent on 12 of the 36 recorded items, so it is optional. The recorded items include
// none that is dead, deleted or null; those are handled before the item schema (see `storyOf`),
// and are covered by the synthetic fixtures.

const IdListWire = z.array(z.number());

const ItemWire = z.object({
  id: z.number(),
  title: z.string(),
  by: z.string(),
  score: z.number(),
  descendants: z.number(),
  time: z.number().refine((t) => Number.isFinite(new Date(t * 1000).getTime()), {
    message: "time out of range",
  }),
  url: z.string().optional(),
});

const ItemFlagsWire = z.object({
  dead: z.boolean().optional(),
  deleted: z.boolean().optional(),
});

export const HnStory = z.strictObject({
  id: NormalNumber,
  title: z.string(),
  by: z.string().nullable(),
  score: NormalNumber.nullable(),
  comments: NormalNumber.nullable(),
  time: z.string(),
  url: z.string().nullable(),
});
export type HnStory = z.infer<typeof HnStory>;

export const HackerNews = z.strictObject({
  top: z.array(HnStory),
  show: z.array(HnStory),
  ask: z.array(HnStory),
});
export type HackerNews = z.infer<typeof HackerNews>;

/** Parses one id list; the value is the ids in the order delivered. */
export function parseHnIdList(body: unknown): ParseOutcome<number[]> {
  return parseWith(IdListWire, body);
}

/**
 * One item body as a story, or `null` when the item is `null`, deleted, dead, or does not match the
 * item schema (requirement 13.4). Never throws.
 */
export function storyOf(body: unknown): HnStory | null {
  if (body === null) return null;
  const flags = ItemFlagsWire.safeParse(body);
  if (!flags.success || flags.data.dead === true || flags.data.deleted === true) return null;
  const item = ItemWire.safeParse(body);
  if (!item.success) return null;
  const { id, title, by, score, descendants, time, url } = item.data;
  return {
    id: cleanNumber(id),
    title,
    by,
    score: cleanNumber(score),
    comments: cleanNumber(descendants),
    time: new Date(time * 1000).toISOString(),
    url: url ?? null,
  };
}

/** The first 12 ids of each list, as stories, in list order. Ids without a usable item are left out. */
export function assembleHackerNews(
  lists: HnLists,
  items: ReadonlyMap<number, unknown>,
): HackerNews {
  const stories = (ids: readonly number[]): HnStory[] =>
    ids.slice(0, HN_IDS_PER_LIST).flatMap((id) => {
      const story = storyOf(items.get(id) ?? null);
      return story === null ? [] : [story];
    });
  return { top: stories(lists.top), show: stories(lists.show), ask: stories(lists.ask) };
}

export interface HackerNewsBodies {
  readonly top: unknown;
  readonly show: unknown;
  readonly ask: unknown;
  /** Item bodies by id. An id with no entry counts as a failed request. */
  readonly items: ReadonlyMap<number, unknown>;
}

/** Checks the three id lists and builds the stories (requirements 12.1, 12.2). Never throws. */
export function parseHackerNews(bodies: HackerNewsBodies): ParseOutcome<HackerNews> {
  const top = parseHnIdList(bodies.top);
  const show = parseHnIdList(bodies.show);
  const ask = parseHnIdList(bodies.ask);
  const problems = [
    ...(top.ok ? [] : top.issuePaths.map((p) => (p === "(root)" ? "top" : `top.${p}`))),
    ...(show.ok ? [] : show.issuePaths.map((p) => (p === "(root)" ? "show" : `show.${p}`))),
    ...(ask.ok ? [] : ask.issuePaths.map((p) => (p === "(root)" ? "ask" : `ask.${p}`))),
  ];
  const [first, ...rest] = problems;
  if (first !== undefined) {
    const issuePaths: NonEmpty<string> = [first, ...rest];
    return { ok: false, issuePaths };
  }
  if (!top.ok || !show.ok || !ask.ok) return { ok: false, issuePaths: ["(root)"] };
  return {
    ok: true,
    value: assembleHackerNews({ top: top.value, show: show.value, ask: ask.value }, bodies.items),
  };
}

/** At most this many item requests are in flight at once (requirement 13.4). */
export const MAX_ITEMS_IN_FLIGHT = 6;

/**
 * Fetches the three id lists (with retry), then each distinct selected item once (no retry, at most
 * 6 in flight). Skips items that fail or are unusable, and fails only when an id list fails.
 * Never throws.
 */
export async function fetchHackerNews(
  http: HttpClient,
  now: Date,
): Promise<FetchOutcome<HackerNews>> {
  const requests = sourceRequests("hacker-news", now);
  const [topRequest, showRequest, askRequest] = requests;
  if (topRequest === undefined || showRequest === undefined || askRequest === undefined) {
    // Unreachable: sourceRequests always lists the three lists. Kept so that this function never throws.
    return { ok: false, source: "hacker-news", url: "", failure: { kind: "network" } };
  }

  const responses = await Promise.all(
    [topRequest, showRequest, askRequest].map((r) => http.getJson(r.url, { retry: true })),
  );
  const lists: number[][] = [];
  for (const [index, response] of responses.entries()) {
    const request = requests[index];
    const url = request?.url ?? "";
    if (!response.ok) return { ok: false, source: "hacker-news", url, failure: response.failure };
    const parsed = parseHnIdList(response.body);
    if (!parsed.ok) {
      const failure: SourceFailure = { kind: "schema", issuePaths: parsed.issuePaths };
      return { ok: false, source: "hacker-news", url, failure };
    }
    lists.push(parsed.value);
  }
  const [top = [], show = [], ask = []] = lists;

  const ids = selectItemIds({ top, show, ask });
  const items = new Map<number, unknown>();
  let next = 0;
  async function worker(): Promise<void> {
    for (;;) {
      const id = ids[next];
      next += 1;
      if (id === undefined) return;
      const response = await http.getJson(hnItemUrl(id), { retry: false });
      if (response.ok) items.set(id, response.body);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(MAX_ITEMS_IN_FLIGHT, ids.length) }, () => worker()),
  );

  return {
    ok: true,
    value: assembleHackerNews({ top, show, ask }, items),
    fetchedAt: now.toISOString(),
  };
}
