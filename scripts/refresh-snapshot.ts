import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { buildSnapshot, snapshotText } from "./lib/build-snapshot.js";
import { FIXTURES_ROOT_RELATIVE } from "./lib/fixture-files.js";

// Rebuilds src/sources/snapshot/snapshot.json from the recorded fixtures. No network.
// Run: `npx tsx scripts/refresh-snapshot.ts`.

const ROOT = resolve(import.meta.dirname, "..");
const target = resolve(ROOT, "src", "sources", "snapshot", "snapshot.json");

const snapshot = await buildSnapshot(resolve(ROOT, FIXTURES_ROOT_RELATIVE));
mkdirSync(dirname(target), { recursive: true });
writeFileSync(target, snapshotText(snapshot), "utf8");
console.log(`wrote ${target}`);
for (const [source, entry] of Object.entries(snapshot.sources)) {
  console.log(`  ${source}: fetched ${entry.fetchedAt}`);
}
