import { describe, expect, it } from "vitest";
import { CITIES } from "../../src/sources/cities.js";
import { createHttpClient } from "../../src/sources/http.js";
import { Weather, fetchOpenMeteo, parseOpenMeteo } from "../../src/sources/open-meteo.js";
import { sourceRequests } from "../../src/sources/source-requests.js";
import { fakeDelay, textResponse } from "./fake-http.js";
import {
  recorded,
  recordedBases,
  recordedFetch,
  recordedMeta,
  syntheticFixtures,
} from "./fixtures.js";

const BASE = "2026-11-11-forecast";
const NOW = new Date(recordedMeta("open-meteo", BASE).fetchedAt);

function parsedReal() {
  const result = parseOpenMeteo(recorded("open-meteo", BASE));
  if (!result.ok) throw new Error(`fixture did not parse: ${result.issuePaths.join(", ")}`);
  return result.value;
}

function okValue(body: unknown) {
  const result = parseOpenMeteo(body);
  if (!result.ok) throw new Error(`did not parse: ${result.issuePaths.join(", ")}`);
  expect(Weather.safeParse(result.value).success).toBe(true);
  return result.value;
}

function synthetic(name: string): unknown {
  const found = syntheticFixtures("open-meteo").find((f) => f.name === name);
  if (found === undefined) throw new Error(`no synthetic fixture ${name}`);
  return found.body;
}

describe("parseOpenMeteo on the recorded fixture (requirements 12.1, 13.2, 18.1)", () => {
  it.each(recordedBases("open-meteo"))(
    "parses %s and the value passes the normalised schema",
    (base) => {
      const result = parseOpenMeteo(recorded("open-meteo", base));
      expect(result.ok).toBe(true);
      if (result.ok) expect(Weather.safeParse(result.value).success).toBe(true);
    },
  );

  it("matches the 24 results to CITIES by position (the recorded order is the request order)", () => {
    const weather = parsedReal();
    expect(weather.cities.map((c) => c.cityId)).toEqual(CITIES.map((c) => c.id));
    const raw = recorded("open-meteo", BASE) as { latitude: number; longitude: number }[];
    raw.forEach((entry, i) => {
      const city = CITIES[i];
      expect(
        Math.abs(entry.latitude - (city?.latitude ?? Number.NaN)),
        `latitude ${String(i)}`,
      ).toBeLessThan(0.5);
      expect(
        Math.abs(entry.longitude - (city?.longitude ?? Number.NaN)),
        `longitude ${String(i)}`,
      ).toBeLessThan(0.5);
    });
  });

  it("has the request the fixture was recorded with in its meta file", () => {
    const [request] = sourceRequests("open-meteo", NOW);
    expect(recordedMeta("open-meteo", BASE).url).toBe(request?.url);
    expect(recordedMeta("open-meteo", BASE).query).toEqual(request?.query);
  });

  it("reads London: current values, UTC time and five daily forecasts", () => {
    const london = parsedReal().cities[0];
    expect(london).toEqual({
      cityId: "london",
      observedAt: "2026-11-11T07:15:00.000Z",
      temperatureC: 8.2,
      weatherCode: 53,
      windKmh: 13,
      daily: [
        { date: "2026-11-11", weatherCode: 53, maxC: 9.8, minC: 8.1, precipitationPct: 100 },
        { date: "2026-11-12", weatherCode: 3, maxC: 8.1, minC: 4.5, precipitationPct: 0 },
        { date: "2026-11-13", weatherCode: 3, maxC: 7.2, minC: 2.4, precipitationPct: 0 },
        { date: "2026-11-14", weatherCode: 3, maxC: 6.9, minC: 1, precipitationPct: 0 },
        { date: "2026-11-15", weatherCode: 3, maxC: 7.8, minC: 2.2, precipitationPct: 42 },
      ],
    });
  });

  it("converts local time to UTC with utc_offset_seconds (Tokyo is UTC+9)", () => {
    const raw = recorded("open-meteo", BASE) as { current: { time: string } }[];
    const tokyoLocal = raw[12]?.current.time ?? "";
    const tokyo = parsedReal().cities[12];
    expect(tokyo?.cityId).toBe("tokyo");
    const expected = new Date(Date.parse(`${tokyoLocal}Z`) - 9 * 3600 * 1000).toISOString();
    expect(tokyo?.observedAt).toBe(expected);
  });

  it("has five daily entries for every city", () => {
    for (const city of parsedReal().cities) expect(city.daily, city.cityId).toHaveLength(5);
  });
});

describe("parseOpenMeteo on synthetic fixtures", () => {
  it("has a comment on every synthetic fixture (requirement 16.4)", () => {
    for (const f of syntheticFixtures("open-meteo"))
      expect(f.comment.length, f.name).toBeGreaterThan(0);
  });

  it("rejects 23 elements (23-cities.json)", () => {
    expect(parseOpenMeteo(synthetic("23-cities.json"))).toEqual({
      ok: false,
      issuePaths: ["(root)"],
    });
  });

  it("rejects two cities in the wrong order (swapped-cities.json)", () => {
    expect(parseOpenMeteo(synthetic("swapped-cities.json"))).toEqual({
      ok: false,
      issuePaths: ["12.latitude", "12.longitude", "13.latitude", "13.longitude"],
    });
  });

  it("normalises a null current temperature to null (null-temperature.json)", () => {
    const tokyo = okValue(synthetic("null-temperature.json")).cities[12];
    expect(tokyo?.cityId).toBe("tokyo");
    expect(tokyo?.temperatureC).toBeNull();
    expect(tokyo?.weatherCode).not.toBeNull();
    expect(tokyo?.windKmh).not.toBeNull();
  });

  it("normalises a null current weather code to null (null-current-weather-code.json)", () => {
    const tokyo = okValue(synthetic("null-current-weather-code.json")).cities[12];
    expect(tokyo?.weatherCode).toBeNull();
    expect(tokyo?.temperatureC).not.toBeNull();
  });

  it("normalises a null current wind speed to null (null-current-wind.json)", () => {
    const tokyo = okValue(synthetic("null-current-wind.json")).cities[12];
    expect(tokyo?.windKmh).toBeNull();
    expect(tokyo?.temperatureC).not.toBeNull();
  });

  it("normalises a null element of each daily array to null (null-daily-values.json)", () => {
    const daily = okValue(synthetic("null-daily-values.json")).cities[12]?.daily ?? [];
    expect(daily[0]?.weatherCode).toBeNull();
    expect(daily[1]?.maxC).toBeNull();
    expect(daily[2]?.minC).toBeNull();
    expect(daily[3]?.precipitationPct).toBeNull();
    expect(daily[0]?.maxC).not.toBeNull();
    expect(daily[4]).not.toMatchObject({ weatherCode: null });
  });

  it("still rejects a null where the schema does not allow one (latitude, current.time, daily.time)", () => {
    const edits: ((r: Record<string, unknown>[]) => void)[] = [
      (r) => {
        const city = r[0];
        if (city) city.latitude = null;
      },
      (r) => {
        const current = r[0]?.current as Record<string, unknown> | undefined;
        if (current) current.time = null;
      },
      (r) => {
        const daily = r[0]?.daily as { time: unknown[] } | undefined;
        if (daily) daily.time[0] = null;
      },
    ];
    for (const edit of edits) {
      const raw = JSON.parse(JSON.stringify(recorded("open-meteo", BASE))) as Record<
        string,
        unknown
      >[];
      edit(raw);
      expect(parseOpenMeteo(raw).ok).toBe(false);
    }
  });

  it("maps -0 to 0 (negative-zero.json)", () => {
    const result = parseOpenMeteo(synthetic("negative-zero.json"));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const london = result.value.cities[0];
    expect(Object.is(london?.temperatureC, 0)).toBe(true);
    expect(Object.is(london?.daily[0]?.minC, 0)).toBe(true);
  });

  it("fails for non-array bodies and daily series of different lengths", () => {
    expect(parseOpenMeteo({})).toEqual({ ok: false, issuePaths: ["(root)"] });
    expect(parseOpenMeteo(null)).toEqual({ ok: false, issuePaths: ["(root)"] });
    const raw = JSON.parse(JSON.stringify(recorded("open-meteo", BASE))) as {
      daily: { temperature_2m_max: number[] };
    }[];
    raw[3]?.daily.temperature_2m_max.pop();
    expect(parseOpenMeteo(raw)).toEqual({ ok: false, issuePaths: ["3.daily"] });
  });

  it("fails for a local time that is not a real date", () => {
    const raw = JSON.parse(JSON.stringify(recorded("open-meteo", BASE))) as {
      current: { time: string };
    }[];
    if (raw[0] !== undefined) raw[0].current.time = "2026-13-45T25:61";
    expect(parseOpenMeteo(raw)).toEqual({ ok: false, issuePaths: ["0.current.time"] });
  });
});

describe("fetchOpenMeteo", () => {
  const delay = fakeDelay().delay;

  it("makes the one forecast request and returns the weather", async () => {
    const { fetch, requested } = recordedFetch("open-meteo");
    const result = await fetchOpenMeteo(createHttpClient({ fetch, delay }), NOW);
    expect(requested).toEqual([recordedMeta("open-meteo", BASE).url]);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.fetchedAt).toBe(NOW.toISOString());
      expect(result.value.cities).toHaveLength(24);
    }
  });

  it("fails with the HTTP failure, and with a schema failure for a wrong body", async () => {
    const url = recordedMeta("open-meteo", BASE).url;
    const down = recordedFetch("open-meteo", {
      [url]: () => Promise.resolve(textResponse(500, "x")),
    });
    expect(await fetchOpenMeteo(createHttpClient({ fetch: down.fetch, delay }), NOW)).toEqual({
      ok: false,
      source: "open-meteo",
      url,
      failure: { kind: "status", status: 500 },
    });
    const wrong = recordedFetch("open-meteo", {
      [url]: () => Promise.resolve(textResponse(200, "[]")),
    });
    expect(await fetchOpenMeteo(createHttpClient({ fetch: wrong.fetch, delay }), NOW)).toEqual({
      ok: false,
      source: "open-meteo",
      url,
      failure: { kind: "schema", issuePaths: ["(root)"] },
    });
  });
});
