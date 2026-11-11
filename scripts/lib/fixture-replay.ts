import type { FetchFn, HttpResponse } from "../../src/sources/http.js";
import { readBody, readMeta } from "./fixture-files.js";
import type { FixtureSet } from "./fixture-files.js";

// Replays a recorded fixture set through the injected `fetch`. No network (requirement 16.3).

export interface LoadedFixtureSet {
  /** The first `fetchedAt` of the set: the `now` the recorder used, so the request URLs match. */
  readonly now: Date;
  /** Recorded responses by URL. */
  readonly responses: ReadonlyMap<string, { readonly status: number; readonly body: string }>;
}

/** Reads every file of a set. Throws when the set is empty or a meta file is malformed. */
export function loadFixtureSet(root: string, set: FixtureSet): LoadedFixtureSet {
  const responses = new Map<string, { status: number; body: string }>();
  let earliest: string | null = null;
  for (const base of set.bases) {
    const meta = readMeta(root, set.source, base);
    responses.set(meta.url, { status: meta.status, body: readBody(root, set.source, base) });
    if (earliest === null || meta.fetchedAt < earliest) earliest = meta.fetchedAt;
  }
  const now = new Date(earliest ?? Number.NaN);
  if (Number.isNaN(now.getTime())) {
    throw new Error(`fixture set ${set.source} ${set.date} has no usable fetchedAt`);
  }
  return { now, responses };
}

/** A `fetch` that serves the recorded responses; any other URL rejects with a `TypeError`. */
export function replayFetch(set: LoadedFixtureSet): FetchFn {
  return (url): Promise<HttpResponse> => {
    const recorded = set.responses.get(url);
    if (recorded === undefined) {
      return Promise.reject(new TypeError(`no recorded response for ${url}`));
    }
    return Promise.resolve(new Response(recorded.body, { status: recorded.status }));
  };
}
