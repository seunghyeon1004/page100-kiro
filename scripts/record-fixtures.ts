import { resolve } from "node:path";
import { realDelay, createHttpClient } from "../src/sources/http.js";
import type { HttpResponse } from "../src/sources/http.js";
import { SOURCE_IDS } from "../src/sources/source-id.js";
import { FIXTURES_ROOT_RELATIVE, writeRecorded } from "./lib/fixture-files.js";
import { recordSource } from "./lib/record.js";

// Records raw responses for every source into test/fixtures/sources (sources.md, "Fixtures and the
// boot snapshot"). This is the only code allowed to use the network besides `npm install`. Run it
// by hand: `npx tsx scripts/record-fixtures.ts`.

const FEATURED_KEYS = ["news", "mostread", "tfa", "dyk", "onthisday", "image"] as const;

/** Which of the featured keys a recorded featured body contains. */
function featuredKeys(body: string): string[] {
  try {
    const parsed: unknown = JSON.parse(body);
    if (typeof parsed !== "object" || parsed === null) return [];
    return FEATURED_KEYS.filter((key) => key in parsed);
  } catch {
    return [];
  }
}

async function main(): Promise<void> {
  const now = new Date(); // The only clock read of the first request of each source.
  const root = resolve(import.meta.dirname, "..", FIXTURES_ROOT_RELATIVE);
  const http = createHttpClient({
    fetch: (url, init): Promise<HttpResponse> => fetch(url, init),
    delay: realDelay,
  });

  let failed = 0;
  for (const source of SOURCE_IDS) {
    const { files, failures } = await recordSource(http, source, now, () => new Date());
    writeRecorded(root, files);
    console.log(`${source}: ${String(files.length)} recorded, ${String(failures.length)} failed`);
    for (const failure of failures) {
      failed += 1;
      console.log(`  FAILED ${failure.url}: ${JSON.stringify(failure.failure)}`);
    }
    if (source === "wikimedia-feed") {
      for (const file of files) {
        console.log(`  ${file.base}: keys ${featuredKeys(file.body).join(", ") || "(none)"}`);
      }
    }
  }
  if (failed > 0) {
    console.log(`${String(failed)} request(s) failed`);
    process.exitCode = 1;
  }
}

await main();
