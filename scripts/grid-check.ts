import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { exitCodeOf, runGridCheck } from "./lib/run-grid-check.js";

// `npm run grid:check`: compiles every page from the boot snapshot and the files of `pages/`, and
// prints one line per problem (rule-compilers requirement 19). Makes no network request. Exits 1
// when there is any problem.

const ROOT = resolve(import.meta.dirname, "..");
const PAGES_DIR = join(ROOT, "pages");

const snapshotText = readFileSync(
  join(ROOT, "src", "sources", "snapshot", "snapshot.json"),
  "utf8",
);
const files = readdirSync(PAGES_DIR)
  .filter((name) => name.endsWith(".page"))
  .sort()
  .map((name) => ({ name, text: readFileSync(join(PAGES_DIR, name), "utf8") }));

const report = runGridCheck(snapshotText, files);
for (const line of report.lines) console.log(line);
process.exitCode = exitCodeOf(report);
