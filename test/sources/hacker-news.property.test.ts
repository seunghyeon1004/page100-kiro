import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { fetchHackerNews } from "../../src/sources/hacker-news.js";
import type { FetchFn, HttpResponse } from "../../src/sources/http.js";
import { createHttpClient } from "../../src/sources/http.js";
import { hnItemUrl, selectItemIds } from "../../src/sources/source-requests.js";
import { fakeDelay, fakeResponse, textResponse } from "./fake-http.js";

type Behaviour = "story" | "null" | "deleted" | "dead" | "network" | "bad-shape";

interface ItemPlan {
  readonly behaviour: Behaviour;
  /** How many microtask turns the fake waits before answering. */
  readonly ticks: number;
}

const POOL = Array.from({ length: 60 }, (_, i) => i + 1);

const idList = fc.uniqueArray(fc.constantFrom(...POOL), { minLength: 0, maxLength: 40 });
const plan: fc.Arbitrary<ItemPlan> = fc.record({
  behaviour: fc.constantFrom<Behaviour>("story", "null", "deleted", "dead", "network", "bad-shape"),
  ticks: fc.integer({ min: 0, max: 8 }),
});
const plans = fc.array(plan, { minLength: POOL.length, maxLength: POOL.length });

function itemBody(id: number, behaviour: Behaviour): string | null {
  const story = {
    id,
    title: `Story ${String(id)}`,
    by: "someone",
    score: id,
    descendants: 0,
    time: 1_794_371_337,
    type: "story",
  };
  switch (behaviour) {
    case "story":
      return JSON.stringify(story);
    case "null":
      return "null";
    case "deleted":
      return JSON.stringify({ id, deleted: true, time: 1_794_371_337, type: "story" });
    case "dead":
      return JSON.stringify({ ...story, dead: true });
    case "bad-shape":
      return JSON.stringify({ id });
    case "network":
      return null;
  }
}

const wait = async (ticks: number): Promise<void> => {
  for (let i = 0; i < ticks; i++) await Promise.resolve();
};

describe("Hacker News fetch properties", () => {
  it("Property 9: at most 6 item requests in flight, each selected id once, at most 12 usable stories per list in list order", async () => {
    await fc.assert(
      fc.asyncProperty(idList, idList, idList, plans, async (top, show, ask, itemPlans) => {
        const selected = selectItemIds({ top, show, ask });
        const itemRequests: number[] = [];
        let inFlight = 0;
        let maxInFlight = 0;

        const fetch: FetchFn = async (url): Promise<HttpResponse> => {
          const lists: Record<string, number[]> = {
            "https://hacker-news.firebaseio.com/v0/topstories.json": top,
            "https://hacker-news.firebaseio.com/v0/showstories.json": show,
            "https://hacker-news.firebaseio.com/v0/askstories.json": ask,
          };
          const list = lists[url];
          if (list !== undefined) return textResponse(200, JSON.stringify(list));

          const id = POOL.find((candidate) => hnItemUrl(candidate) === url);
          const itemPlan = id === undefined ? undefined : itemPlans[id - 1];
          if (id === undefined || itemPlan === undefined) return textResponse(404, "unknown");
          itemRequests.push(id);

          // The request counts as in flight until its body has been read (second pull) or it failed.
          inFlight += 1;
          maxInFlight = Math.max(maxInFlight, inFlight);
          let released = false;
          const release = (): void => {
            if (!released) {
              released = true;
              inFlight -= 1;
            }
          };
          await wait(itemPlan.ticks);
          const body = itemBody(id, itemPlan.behaviour);
          if (body === null) {
            release();
            throw new Error("network down");
          }
          let pulls = 0;
          return fakeResponse({
            status: 200,
            body: new ReadableStream<Uint8Array>({
              pull(controller) {
                pulls += 1;
                if (pulls === 1) {
                  controller.enqueue(new TextEncoder().encode(body));
                } else {
                  controller.close();
                  release();
                }
              },
              cancel: release,
            }),
          });
        };

        const http = createHttpClient({ fetch, delay: fakeDelay().delay });
        const result = await fetchHackerNews(http, new Date("2026-11-11T12:00:00.000Z"));

        expect(result.ok).toBe(true);
        if (!result.ok) return;

        expect(maxInFlight).toBeLessThanOrEqual(6);
        expect([...itemRequests].sort((a, b) => a - b)).toEqual(
          [...selected].sort((a, b) => a - b),
        );
        expect(new Set(itemRequests).size).toBe(itemRequests.length);

        const usable = (id: number): boolean => itemPlans[id - 1]?.behaviour === "story";
        for (const [stories, ids] of [
          [result.value.top, top],
          [result.value.show, show],
          [result.value.ask, ask],
        ] as const) {
          expect(stories.length).toBeLessThanOrEqual(12);
          expect(stories.map((s) => s.id)).toEqual(ids.slice(0, 12).filter(usable));
        }
      }),
    );
  });
});
