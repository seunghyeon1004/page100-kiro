import { describe, expect, it } from "vitest";
import { createHttpClient } from "../../src/sources/http.js";
import {
  Launches,
  fetchLaunchLibrary,
  parseLaunchLibrary,
} from "../../src/sources/launch-library.js";
import { fakeDelay, textResponse } from "./fake-http.js";
import {
  recorded,
  recordedBases,
  recordedFetch,
  recordedMeta,
  syntheticFixtures,
} from "./fixtures.js";

const BASE = "2026-11-11-launches";
const NOW = new Date(recordedMeta("launch-library", BASE).fetchedAt);
const URL = recordedMeta("launch-library", BASE).url;

function okValue(body: unknown) {
  const result = parseLaunchLibrary(body);
  if (!result.ok) throw new Error(`did not parse: ${result.issuePaths.join(", ")}`);
  expect(Launches.safeParse(result.value).success).toBe(true);
  return result.value;
}

function synthetic(name: string): unknown {
  const found = syntheticFixtures("launch-library").find((f) => f.name === name);
  if (found === undefined) throw new Error(`no synthetic fixture ${name}`);
  return found.body;
}

describe("parseLaunchLibrary on the recorded fixture (requirements 12.1, 18.1)", () => {
  it.each(recordedBases("launch-library"))("parses %s and the value passes the schema", (base) => {
    const result = parseLaunchLibrary(recorded("launch-library", base));
    expect(result.ok).toBe(true);
    if (result.ok) expect(Launches.safeParse(result.value).success).toBe(true);
  });

  it("reads 8 launches in the order delivered", () => {
    const { launches } = okValue(recorded("launch-library", BASE));
    expect(launches).toHaveLength(8);
    expect(launches.map((l) => l.net)).toEqual([...launches.map((l) => l.net)].sort());
  });

  it("splits the name into rocket and mission, and reads net and status.abbrev", () => {
    const { launches } = okValue(recorded("launch-library", BASE));
    expect(launches[0]).toEqual({
      id: "d66590ab-b273-47ff-b85a-608b62851b4b",
      rocket: "Long March 2D",
      mission: "Unknown Payload",
      net: "2026-11-11T11:40:00.000Z",
      status: "Go",
    });
    expect(launches[5]).toMatchObject({
      rocket: "Starship",
      mission: "Starlink Group 31-2 (Starship Flight 15)",
      status: "TBC",
    });
  });

  it("has no provider or pad in the normalised value", () => {
    for (const l of okValue(recorded("launch-library", BASE)).launches) {
      expect(Object.keys(l).sort()).toEqual(["id", "mission", "net", "rocket", "status"]);
    }
  });
});

describe("parseLaunchLibrary on synthetic fixtures and bad shapes", () => {
  it("has a comment on every synthetic fixture (requirement 16.4)", () => {
    for (const f of syntheticFixtures("launch-library"))
      expect(f.comment.length, f.name).toBeGreaterThan(0);
  });

  it("makes the whole name the mission when there is no separator, and splits at the first one", () => {
    const { launches } = okValue(synthetic("names-without-or-with-extra-separator.json"));
    expect(launches[0]).toMatchObject({ rocket: null, mission: "Unnamed Rocket" });
    expect(launches[1]).toMatchObject({ rocket: "A", mission: "B | C" });
  });

  it("accepts an empty list (no-launches.json)", () => {
    expect(okValue(synthetic("no-launches.json"))).toEqual({ launches: [] });
  });

  it("fails with issue paths for wrong shapes, a null status and a bad time", () => {
    expect(parseLaunchLibrary(null)).toEqual({ ok: false, issuePaths: ["(root)"] });
    expect(parseLaunchLibrary({})).toEqual({ ok: false, issuePaths: ["results"] });
    const raw = JSON.parse(JSON.stringify(recorded("launch-library", BASE))) as {
      results: { status: unknown; net: unknown }[];
    };
    const [a, b] = raw.results;
    if (a === undefined || b === undefined) throw new Error("fixture has no results");
    a.status = null;
    b.net = "soon";
    expect(parseLaunchLibrary(raw)).toEqual({
      ok: false,
      issuePaths: ["results.0.status", "results.1.net"],
    });
  });
});

describe("fetchLaunchLibrary", () => {
  const delay = fakeDelay().delay;

  it("makes one request and returns the launches", async () => {
    const { fetch, requested } = recordedFetch("launch-library");
    const result = await fetchLaunchLibrary(createHttpClient({ fetch, delay }), NOW);
    expect(requested).toEqual([URL]);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.fetchedAt).toBe(NOW.toISOString());
      expect(result.value.launches).toHaveLength(8);
    }
  });

  it("never retries: a 503 gives one request and the HTTP failure (requirement 13.5)", async () => {
    const down = recordedFetch("launch-library", {
      [URL]: () => Promise.resolve(textResponse(503, "x")),
    });
    expect(await fetchLaunchLibrary(createHttpClient({ fetch: down.fetch, delay }), NOW)).toEqual({
      ok: false,
      source: "launch-library",
      url: URL,
      failure: { kind: "status", status: 503 },
    });
    expect(down.requested).toEqual([URL]);
  });

  it("gives a schema failure for a wrong body", async () => {
    const wrong = recordedFetch("launch-library", {
      [URL]: () => Promise.resolve(textResponse(200, "{}")),
    });
    expect(
      await fetchLaunchLibrary(createHttpClient({ fetch: wrong.fetch, delay }), NOW),
    ).toMatchObject({
      ok: false,
      failure: { kind: "schema" },
    });
  });
});
