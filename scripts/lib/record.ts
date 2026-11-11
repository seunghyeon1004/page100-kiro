import type { HttpClient, HttpFailure } from "../../src/sources/http.js";
import type { SourceId } from "../../src/sources/source-id.js";
import { hnItemUrl, selectItemIds, sourceRequests } from "../../src/sources/source-requests.js";

// Records the raw responses of one source. No file system here: the caller writes the files.

export interface FixtureMeta {
  readonly url: string;
  readonly fetchedAt: string;
  readonly status: number;
  readonly query: Readonly<Record<string, string>>;
}

export interface RecordedFile {
  readonly source: SourceId;
  /** File name without extension: `<yyyy-mm-dd>-<what>`. */
  readonly base: string;
  /** The body exactly as received. */
  readonly body: string;
  readonly meta: FixtureMeta;
}

export interface RecordFailure {
  readonly source: SourceId;
  readonly url: string;
  readonly failure: HttpFailure;
}

export interface RecordResult {
  readonly files: RecordedFile[];
  readonly failures: RecordFailure[];
}

const MAX_IN_FLIGHT = 6;

function queryOf(url: string): Record<string, string> {
  const query: Record<string, string> = {};
  for (const [key, value] of new URL(url).searchParams) query[key] = value;
  return query;
}

/** The ids of a Hacker News list body, or an empty list when the body is not an array of numbers. */
function idsOf(body: string): number[] {
  try {
    const parsed: unknown = JSON.parse(body);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((id): id is number => typeof id === "number");
  } catch {
    return [];
  }
}

/** Runs `task` over `items`, with at most `limit` running at once, and returns the results in order. */
async function mapLimited<T, R>(
  items: readonly T[],
  limit: number,
  task: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R | undefined>(items.length);
  let next = 0;
  async function worker(): Promise<void> {
    for (;;) {
      const index = next;
      next += 1;
      const item = items[index];
      if (item === undefined) return;
      results[index] = await task(item);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return results.filter((r): r is R => r !== undefined);
}

/**
 * Sends the requests of `sourceRequests(source, now)` (and, for Hacker News, the item requests of
 * requirement 13.4) and returns the raw bodies with their metadata. The first request's
 * `fetchedAt` is `now`; later ones read `clock`.
 */
export async function recordSource(
  http: HttpClient,
  source: SourceId,
  now: Date,
  clock: () => Date,
): Promise<RecordResult> {
  const day = now.toISOString().slice(0, 10);
  const files: RecordedFile[] = [];
  const failures: RecordFailure[] = [];
  let sent = 0;

  async function record(name: string, url: string, retry: boolean): Promise<string | null> {
    const fetchedAt = (sent === 0 ? now : clock()).toISOString();
    sent += 1;
    const result = await http.getText(url, { retry });
    if (!result.ok) {
      failures.push({ source, url, failure: result.failure });
      return null;
    }
    files.push({
      source,
      base: `${day}-${name}`,
      body: result.body,
      meta: { url, fetchedAt, status: result.status, query: queryOf(url) },
    });
    return result.body;
  }

  const requests = sourceRequests(source, now);
  const bodies: Record<string, string | null> = {};
  for (const request of requests) {
    bodies[request.name] = await record(request.name, request.url, true);
  }

  if (source === "hacker-news") {
    const top = idsOf(bodies.topstories ?? "");
    const show = idsOf(bodies.showstories ?? "");
    const ask = idsOf(bodies.askstories ?? "");
    const ids = selectItemIds({ top, show, ask });
    // Item requests are sent in parallel, so fetchedAt is read for each when it is sent.
    await mapLimited(ids, MAX_IN_FLIGHT, (id) =>
      record(`item-${String(id)}`, hnItemUrl(id), false),
    );
  }

  return { files, failures };
}
