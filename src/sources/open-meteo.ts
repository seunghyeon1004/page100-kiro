import { z } from "zod";
import type { CityId } from "./cities.js";
import { CITIES } from "./cities.js";
import type { HttpClient } from "./http.js";
import { cleanNumber, NormalNumber } from "./normal-number.js";
import type { FetchOutcome, NonEmpty, ParseOutcome } from "./outcome.js";
import { parseWith } from "./outcome.js";
import { sourceRequests } from "./source-requests.js";

// Wire shape from test/fixtures/sources/open-meteo/2026-11-11-forecast.json: an array with one
// object per requested city, in request order. `current.time` is local time as `YYYY-MM-DDTHH:MM`
// and `utc_offset_seconds` converts it to UTC. The recorded response has no null values, but the
// Open-Meteo documentation says a value is null when the model has none, so null is allowed for
// exactly `current.temperature_2m`, `current.weather_code`, `current.wind_speed_10m` and each
// element of the four daily arrays (owner answer 7). It is normalised to `null`.

const LOCAL_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
const LOCAL_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** The most a returned coordinate may differ from the requested one: Open-Meteo snaps to a grid (requirement 13.2). */
const MAX_COORDINATE_DRIFT = 0.5;

export const OpenMeteoCityWire = z.object({
  latitude: z.number(),
  longitude: z.number(),
  utc_offset_seconds: z.number(),
  current: z.object({
    time: z.string().regex(LOCAL_TIME),
    temperature_2m: z.number().nullable(),
    weather_code: z.number().nullable(),
    wind_speed_10m: z.number().nullable(),
  }),
  daily: z
    .object({
      time: z.array(z.string().regex(LOCAL_DATE)),
      weather_code: z.array(z.number().nullable()),
      temperature_2m_max: z.array(z.number().nullable()),
      temperature_2m_min: z.array(z.number().nullable()),
      precipitation_probability_max: z.array(z.number().nullable()),
    })
    .refine(
      (d) =>
        [
          d.weather_code,
          d.temperature_2m_max,
          d.temperature_2m_min,
          d.precipitation_probability_max,
        ].every((series) => series.length === d.time.length),
      { message: "daily series differ in length" },
    ),
});

const OpenMeteoWire = z.array(OpenMeteoCityWire);

export const DayForecast = z.strictObject({
  date: z.string(),
  weatherCode: NormalNumber.nullable(),
  maxC: NormalNumber.nullable(),
  minC: NormalNumber.nullable(),
  precipitationPct: NormalNumber.nullable(),
});
export type DayForecast = z.infer<typeof DayForecast>;

const CITY_IDS: CityId[] = CITIES.map((c) => c.id);

export const CityWeather = z.strictObject({
  cityId: z.literal(CITY_IDS),
  observedAt: z.string(),
  temperatureC: NormalNumber.nullable(),
  weatherCode: NormalNumber.nullable(),
  windKmh: NormalNumber.nullable(),
  daily: z.array(DayForecast),
});
export type CityWeather = z.infer<typeof CityWeather>;

export const Weather = z.strictObject({ cities: z.array(CityWeather) });
export type Weather = z.infer<typeof Weather>;

type CityWire = z.infer<typeof OpenMeteoCityWire>;

/** A wire number or null to a normalised number or `null`; `-0` becomes `0`. */
function clean(n: number | null): number | null {
  return n === null ? null : cleanNumber(n);
}

/** Local `YYYY-MM-DDTHH:MM` and a UTC offset in seconds to a UTC ISO string, or `null` when the time is not a real date. */
function toUtcIso(localTime: string, offsetSeconds: number): string | null {
  const local = Date.parse(`${localTime}Z`);
  if (!Number.isFinite(local)) return null;
  const utc = new Date(local - offsetSeconds * 1000);
  return Number.isNaN(utc.getTime()) ? null : utc.toISOString();
}

/**
 * Checks the response and normalises it (requirements 12.1, 12.2, 13.2). Fails unless the array
 * has 24 elements and each element's coordinates are within 0.5 degrees of the city at the same
 * position in `CITIES`. Never throws.
 */
export function parseOpenMeteo(body: unknown): ParseOutcome<Weather> {
  const parsed = parseWith(OpenMeteoWire, body);
  if (!parsed.ok) return parsed;
  const wire: readonly CityWire[] = parsed.value;
  if (wire.length !== CITIES.length) return { ok: false, issuePaths: ["(root)"] };

  const problems: string[] = [];
  const cities: CityWeather[] = [];
  CITIES.forEach((city, i) => {
    const entry = wire[i];
    if (entry === undefined) return;
    if (Math.abs(entry.latitude - city.latitude) > MAX_COORDINATE_DRIFT) {
      problems.push(`${String(i)}.latitude`);
    }
    if (Math.abs(entry.longitude - city.longitude) > MAX_COORDINATE_DRIFT) {
      problems.push(`${String(i)}.longitude`);
    }
    const observedAt = toUtcIso(entry.current.time, entry.utc_offset_seconds);
    if (observedAt === null) {
      problems.push(`${String(i)}.current.time`);
      return;
    }
    const daily: DayForecast[] = [];
    entry.daily.time.forEach((date, d) => {
      const weatherCode = entry.daily.weather_code[d];
      const maxC = entry.daily.temperature_2m_max[d];
      const minC = entry.daily.temperature_2m_min[d];
      const precipitationPct = entry.daily.precipitation_probability_max[d];
      if (
        weatherCode === undefined ||
        maxC === undefined ||
        minC === undefined ||
        precipitationPct === undefined
      ) {
        // The schema checked that the series have equal lengths, so this does not happen.
        problems.push(`${String(i)}.daily`);
        return;
      }
      daily.push({
        date,
        weatherCode: clean(weatherCode),
        maxC: clean(maxC),
        minC: clean(minC),
        precipitationPct: clean(precipitationPct),
      });
    });
    cities.push({
      cityId: city.id,
      observedAt,
      temperatureC: clean(entry.current.temperature_2m),
      weatherCode: clean(entry.current.weather_code),
      windKmh: clean(entry.current.wind_speed_10m),
      daily,
    });
  });

  const [first, ...rest] = problems;
  if (first !== undefined) {
    const issuePaths: NonEmpty<string> = [first, ...rest];
    return { ok: false, issuePaths };
  }
  return { ok: true, value: { cities } };
}

/** One request for all 24 cities. Never throws. */
export async function fetchOpenMeteo(http: HttpClient, now: Date): Promise<FetchOutcome<Weather>> {
  const request = sourceRequests("open-meteo", now)[0];
  if (request === undefined) {
    // Unreachable: sourceRequests always lists the request. Kept so that this function never throws.
    return { ok: false, source: "open-meteo", url: "", failure: { kind: "network" } };
  }
  const response = await http.getJson(request.url, { retry: true });
  if (!response.ok) {
    return { ok: false, source: "open-meteo", url: request.url, failure: response.failure };
  }
  const parsed = parseOpenMeteo(response.body);
  if (!parsed.ok) {
    return {
      ok: false,
      source: "open-meteo",
      url: request.url,
      failure: { kind: "schema", issuePaths: parsed.issuePaths },
    };
  }
  return { ok: true, value: parsed.value, fetchedAt: now.toISOString() };
}
