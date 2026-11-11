import { describe, expect, it } from "vitest";
import { createHttpClient } from "../../src/sources/http.js";
import { Quakes, fetchUsgs, parseUsgs } from "../../src/sources/usgs.js";
import { fakeDelay, textResponse } from "./fake-http.js";
import {
  recorded,
  recordedBases,
  recordedFetch,
  recordedMeta,
  syntheticFixtures,
} from "./fixtures.js";

const BASE = "2026-11-11-quakes";
const NOW = new Date(recordedMeta("usgs", BASE).fetchedAt);
const URL = recordedMeta("usgs", BASE).url;

function real() {
  const result = parseUsgs(recorded("usgs", BASE));
  if (!result.ok) throw new Error(`fixture did not parse: ${result.issuePaths.join(", ")}`);
  return result.value;
}

describe("parseUsgs on the recorded fixture (requirements 12.1, 18.1)", () => {
  it.each(recordedBases("usgs"))("parses %s and the value passes the normalised schema", (base) => {
    const result = parseUsgs(recorded("usgs", base));
    expect(result.ok).toBe(true);
    if (result.ok) expect(Quakes.safeParse(result.value).success).toBe(true);
  });

  it("reads the generated time and 14 quakes in the order delivered", () => {
    const { generatedAt, quakes } = real();
    expect(generatedAt).toBe(new Date(1794381366000).toISOString());
    expect(quakes).toHaveLength(14);
    const times = quakes.map((q) => q.time);
    expect(times).toEqual([...times].sort().reverse());
  });

  it("reads the first quake: magnitude, place, UTC time, depth and position", () => {
    expect(real().quakes[0]).toEqual({
      id: "us7000txhi",
      magnitude: 5.1,
      place: "Balleny Islands region",
      time: new Date(1794378105383).toISOString(),
      depthKm: 10,
      latitude: -62.4284,
      longitude: 155.0206,
    });
  });

  it("has every magnitude at 4.5 or more, as the feed promises", () => {
    for (const q of real().quakes) expect(q.magnitude ?? 0, q.id).toBeGreaterThanOrEqual(4.5);
  });
});

describe("parseUsgs on synthetic fixtures and bad shapes", () => {
  it("has a comment on every synthetic fixture (requirement 16.4)", () => {
    for (const f of syntheticFixtures("usgs")) expect(f.comment.length, f.name).toBeGreaterThan(0);
  });

  it("accepts a day with no quakes (no-quakes.json)", () => {
    const body = syntheticFixtures("usgs").find((f) => f.name === "no-quakes.json")?.body;
    expect(parseUsgs(body)).toEqual({
      ok: true,
      value: { generatedAt: new Date(1794381366000).toISOString(), quakes: [] },
    });
  });

  function synthetic(name: string): unknown {
    const found = syntheticFixtures("usgs").find((f) => f.name === name);
    if (found === undefined) throw new Error(`no synthetic fixture ${name}`);
    return found.body;
  }

  function okQuakes(body: unknown) {
    const result = parseUsgs(body);
    if (!result.ok) throw new Error(`did not parse: ${result.issuePaths.join(", ")}`);
    expect(Quakes.safeParse(result.value).success).toBe(true);
    return result.value.quakes;
  }

  it("drops a feature with a null magnitude and keeps the other 13 in order (null-magnitude.json)", () => {
    const quakes = okQuakes(synthetic("null-magnitude.json"));
    expect(quakes).toHaveLength(13);
    expect(quakes.map((q) => q.id)).toEqual(
      real()
        .quakes.slice(1)
        .map((q) => q.id),
    );
  });

  it("normalises a null place to null (null-place.json)", () => {
    const quakes = okQuakes(synthetic("null-place.json"));
    expect(quakes).toHaveLength(14);
    expect(quakes[0]).toMatchObject({ id: "us7000txhi", magnitude: 5.1, place: null, depthKm: 10 });
  });

  it("normalises a null depth to null (null-depth.json)", () => {
    const quakes = okQuakes(synthetic("null-depth.json"));
    expect(quakes).toHaveLength(14);
    expect(quakes[0]).toMatchObject({
      id: "us7000txhi",
      place: "Balleny Islands region",
      depthKm: null,
    });
  });

  it("names the provider documentation in the comment of each null fixture", () => {
    for (const name of ["null-magnitude.json", "null-place.json", "null-depth.json"]) {
      const f = syntheticFixtures("usgs").find((x) => x.name === name);
      expect(f?.comment, name).toContain("USGS GeoJSON feed documentation");
    }
  });

  it("still fails for wrong types, null elsewhere (id, time, longitude) and bad coordinates", () => {
    const raw = JSON.parse(JSON.stringify(recorded("usgs", BASE))) as {
      features: {
        id: unknown;
        properties: { mag: unknown; time: unknown };
        geometry: { coordinates: unknown };
      }[];
    };
    const [first, second, third] = raw.features;
    if (first === undefined || second === undefined || third === undefined)
      throw new Error("fixture has no features");
    first.properties.mag = "5";
    second.geometry.coordinates = [1, 2];
    third.properties.time = null;
    expect(parseUsgs(raw)).toEqual({
      ok: false,
      issuePaths: [
        "features.0.properties.mag",
        "features.1.geometry.coordinates",
        "features.2.properties.time",
      ],
    });
    const lon = JSON.parse(JSON.stringify(recorded("usgs", BASE))) as typeof raw;
    const f0 = lon.features[0];
    if (f0 === undefined) throw new Error("fixture has no features");
    f0.geometry.coordinates = [null, 1, 2];
    expect(parseUsgs(lon).ok).toBe(false);
    expect(parseUsgs(null)).toEqual({ ok: false, issuePaths: ["(root)"] });
    expect(parseUsgs({ metadata: { generated: "now" }, features: [] })).toEqual({
      ok: false,
      issuePaths: ["metadata.generated"],
    });
  });

  it("fails for a time that is not a real date", () => {
    const result = parseUsgs({ metadata: { generated: 1e300 }, features: [] });
    expect(result).toEqual({ ok: false, issuePaths: ["metadata.generated"] });
  });

  it("maps -0 coordinates to 0", () => {
    const result = parseUsgs({
      metadata: { generated: 0 },
      features: [
        {
          id: "x",
          properties: { mag: 4.5, place: "p", time: 0 },
          geometry: { coordinates: [-0, -0, -0] },
        },
      ],
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      const q = result.value.quakes[0];
      expect([q?.longitude, q?.latitude, q?.depthKm].every((n) => Object.is(n, 0))).toBe(true);
    }
  });
});

describe("fetchUsgs", () => {
  const delay = fakeDelay().delay;

  it("makes one request and returns the quakes", async () => {
    const { fetch, requested } = recordedFetch("usgs");
    const result = await fetchUsgs(createHttpClient({ fetch, delay }), NOW);
    expect(requested).toEqual([URL]);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.fetchedAt).toBe(NOW.toISOString());
      expect(result.value.quakes).toHaveLength(14);
    }
  });

  it("fails with the HTTP failure, or a schema failure for a wrong body", async () => {
    const down = recordedFetch("usgs", { [URL]: () => Promise.resolve(textResponse(503, "x")) });
    expect(await fetchUsgs(createHttpClient({ fetch: down.fetch, delay }), NOW)).toEqual({
      ok: false,
      source: "usgs",
      url: URL,
      failure: { kind: "status", status: 503 },
    });
    const wrong = recordedFetch("usgs", { [URL]: () => Promise.resolve(textResponse(200, "{}")) });
    expect(await fetchUsgs(createHttpClient({ fetch: wrong.fetch, delay }), NOW)).toMatchObject({
      ok: false,
      failure: { kind: "schema" },
    });
  });
});
