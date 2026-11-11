import { z } from "zod";
import type { HttpClient } from "./http.js";
import { cleanNumber, NormalNumber } from "./normal-number.js";
import type { FetchOutcome, ParseOutcome } from "./outcome.js";
import { parseWith } from "./outcome.js";
import { sourceRequests } from "./source-requests.js";

// Wire shape from test/fixtures/sources/usgs/2026-11-11-quakes.json: a GeoJSON collection with
// `metadata.generated` (milliseconds) and `features`, each `{ id, properties: { mag, place, time },
// geometry: { coordinates: [longitude, latitude, depthKm] } }`. The USGS documentation says `mag`,
// `place` and the depth coordinate can be null (owner answer 7), so exactly those three allow null
// and normalise to `null`. A feature with a null magnitude is dropped.

const MillisecondsWire = z.number().refine((ms) => Number.isFinite(new Date(ms).getTime()), {
  message: "time out of range",
});

const UsgsWire = z.object({
  metadata: z.object({ generated: MillisecondsWire }),
  features: z.array(
    z.object({
      id: z.string(),
      properties: z.object({
        mag: z.number().nullable(),
        place: z.string().nullable(),
        time: MillisecondsWire,
      }),
      geometry: z.object({ coordinates: z.tuple([z.number(), z.number(), z.number().nullable()]) }),
    }),
  ),
});

export const Quake = z.strictObject({
  id: z.string(),
  magnitude: NormalNumber.nullable(),
  place: z.string().nullable(),
  time: z.string(),
  depthKm: NormalNumber.nullable(),
  latitude: NormalNumber,
  longitude: NormalNumber,
});
export type Quake = z.infer<typeof Quake>;

export const Quakes = z.strictObject({ generatedAt: z.string(), quakes: z.array(Quake) });
export type Quakes = z.infer<typeof Quakes>;

/** Checks the response and normalises it, keeping the order delivered (requirements 12.1, 12.2). Never throws. */
export function parseUsgs(body: unknown): ParseOutcome<Quakes> {
  const parsed = parseWith(UsgsWire, body);
  if (!parsed.ok) return parsed;
  const { metadata, features } = parsed.value;
  return {
    ok: true,
    value: {
      generatedAt: new Date(metadata.generated).toISOString(),
      quakes: features.flatMap((f) => {
        const [longitude, latitude, depthKm] = f.geometry.coordinates;
        const mag = f.properties.mag;
        if (mag === null) return [];
        return {
          id: f.id,
          magnitude: cleanNumber(mag),
          place: f.properties.place,
          time: new Date(f.properties.time).toISOString(),
          depthKm: depthKm === null ? null : cleanNumber(depthKm),
          latitude: cleanNumber(latitude),
          longitude: cleanNumber(longitude),
        };
      }),
    },
  };
}

/** One request for the magnitude 4.5+ feed of the past day. Never throws. */
export async function fetchUsgs(http: HttpClient, now: Date): Promise<FetchOutcome<Quakes>> {
  const request = sourceRequests("usgs", now)[0];
  if (request === undefined) {
    // Unreachable: sourceRequests always lists the request. Kept so that this function never throws.
    return { ok: false, source: "usgs", url: "", failure: { kind: "network" } };
  }
  const response = await http.getJson(request.url, { retry: true });
  if (!response.ok) {
    return { ok: false, source: "usgs", url: request.url, failure: response.failure };
  }
  const parsed = parseUsgs(response.body);
  if (!parsed.ok) {
    return {
      ok: false,
      source: "usgs",
      url: request.url,
      failure: { kind: "schema", issuePaths: parsed.issuePaths },
    };
  }
  return { ok: true, value: parsed.value, fetchedAt: now.toISOString() };
}
