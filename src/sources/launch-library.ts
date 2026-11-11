import { z } from "zod";
import type { HttpClient } from "./http.js";
import type { FetchOutcome, ParseOutcome } from "./outcome.js";
import { parseWith } from "./outcome.js";
import { sourceRequests } from "./source-requests.js";

// Wire shape from test/fixtures/sources/launch-library/2026-11-11-launches.json (`mode=list`): an
// object with `results`, each `{ id, name, net, status: { abbrev } }`. `name` is
// `<rocket> | <mission>`. The list mode has no provider and no pad (owner answer 6).

const SEPARATOR = " | ";

const LaunchWire = z.object({
  id: z.string(),
  name: z.string(),
  net: z.string().refine((t) => Number.isFinite(Date.parse(t)), { message: "not a date" }),
  status: z.object({ abbrev: z.string() }),
});

const LaunchLibraryWire = z.object({ results: z.array(LaunchWire) });

export const Launch = z.strictObject({
  id: z.string(),
  rocket: z.string().nullable(),
  mission: z.string(),
  net: z.string(),
  status: z.string().nullable(),
});
export type Launch = z.infer<typeof Launch>;

export const Launches = z.strictObject({ launches: z.array(Launch) });
export type Launches = z.infer<typeof Launches>;

/** Splits `Rocket | Mission` at the first separator; with none, the whole name is the mission. */
function splitName(name: string): { rocket: string | null; mission: string } {
  const at = name.indexOf(SEPARATOR);
  if (at < 0) return { rocket: null, mission: name };
  return { rocket: name.slice(0, at), mission: name.slice(at + SEPARATOR.length) };
}

/** Checks the response and normalises it, keeping the order delivered (requirements 12.1, 12.2). Never throws. */
export function parseLaunchLibrary(body: unknown): ParseOutcome<Launches> {
  const parsed = parseWith(LaunchLibraryWire, body);
  if (!parsed.ok) return parsed;
  return {
    ok: true,
    value: {
      launches: parsed.value.results.map((r) => ({
        id: r.id,
        ...splitName(r.name),
        net: new Date(r.net).toISOString(),
        status: r.status.abbrev,
      })),
    },
  };
}

/** One request, never retried (requirement 13.5). Never throws. */
export async function fetchLaunchLibrary(
  http: HttpClient,
  now: Date,
): Promise<FetchOutcome<Launches>> {
  const request = sourceRequests("launch-library", now)[0];
  if (request === undefined) {
    // Unreachable: sourceRequests always lists the request. Kept so that this function never throws.
    return { ok: false, source: "launch-library", url: "", failure: { kind: "network" } };
  }
  const response = await http.getJson(request.url, { retry: false });
  if (!response.ok) {
    return { ok: false, source: "launch-library", url: request.url, failure: response.failure };
  }
  const parsed = parseLaunchLibrary(response.body);
  if (!parsed.ok) {
    return {
      ok: false,
      source: "launch-library",
      url: request.url,
      failure: { kind: "schema", issuePaths: parsed.issuePaths },
    };
  }
  return { ok: true, value: parsed.value, fetchedAt: now.toISOString() };
}
