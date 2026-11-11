import { FETCHERS } from "../../src/sources/fetchers.js";
import { createHttpClient, RETRY_DELAY_MS } from "../../src/sources/http.js";
import type { DelayFn } from "../../src/sources/http.js";
import { SOURCE_IDS } from "../../src/sources/source-id.js";
import type { SourceId } from "../../src/sources/source-id.js";
import { parseSnapshot } from "../../src/sources/snapshot.js";
import type { Snapshot } from "../../src/sources/snapshot.js";
import { listFixtureSets } from "./fixture-files.js";
import { loadFixtureSet, replayFetch } from "./fixture-replay.js";

// Builds the boot snapshot from recorded fixtures only (requirements 15.4, 16.3), through the same
// `fetchX` functions the server uses.

/**
 * The retry wait passes at once; the request timeout never fires, so a replayed response is never
 * cut short.
 */
const replayDelay: DelayFn = (ms) =>
  ms === RETRY_DELAY_MS ? Promise.resolve() : new Promise<void>(() => undefined);

type Entry<S extends SourceId> = Snapshot["sources"][S];

async function entryFor<S extends SourceId>(root: string, source: S): Promise<Entry<S>> {
  for (const set of listFixtureSets(root, source)) {
    const loaded = loadFixtureSet(root, set);
    const http = createHttpClient({
      fetch: replayFetch(loaded),
      delay: replayDelay,
    });
    const outcome = await FETCHERS[source](http, loaded.now);
    if (outcome.ok) return { fetchedAt: outcome.fetchedAt, value: outcome.value } as Entry<S>;
  }
  throw new Error(`no fixture set of ${source} replays to ok`);
}

/** The snapshot of the newest replayable fixture set of each source. Throws when a source has none. */
export async function buildSnapshot(fixturesRoot: string): Promise<Snapshot> {
  const entries = await Promise.all(
    SOURCE_IDS.map(async (source) => [source, await entryFor(fixturesRoot, source)] as const),
  );
  const result = parseSnapshot({ version: 1, sources: Object.fromEntries(entries) });
  if (!result.ok) throw new Error(`built snapshot is invalid: ${result.issuePaths.join(", ")}`);
  return result.snapshot;
}

/** The text of `snapshot.json`: 2-space JSON and one final LF. */
export function snapshotText(snapshot: Snapshot): string {
  return `${JSON.stringify(snapshot, null, 2)}\n`;
}
