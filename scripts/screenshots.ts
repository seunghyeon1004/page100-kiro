import { mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { chromium } from "@playwright/test";
import { appRoot, readAppFiles } from "../src/server/app-files.js";
import { startServer } from "../src/server/run.js";
import { realTimers } from "../src/server/timers.js";
import { SOURCE_IDS } from "../src/sources/source-id.js";

// `npx tsx scripts/screenshots.ts`: desktop (1280 x 800) and phone (390 x 844) screenshots of the
// pages listed in server-and-viewer design.md ("Browser tests") into docs/screens/<page>-<view>.png
// (requirement 15.3). Starts the app in-process on 127.0.0.1 with no refresh and no editor
// client, and a headless Chromium. Makes no request beyond 127.0.0.1.

const PAGES = [100, 110, 120, 200, 201, 300, 301, 400, 500, 550, 600, 601, 610, 700, 802, 899, 123];
const VIEWS = [
  { name: "desktop", viewport: { width: 1280, height: 800 }, mobile: false },
  { name: "phone", viewport: { width: 390, height: 844 }, mobile: true },
] as const;

const outDir = resolve(import.meta.dirname, "..", "docs", "screens");
mkdirSync(outDir, { recursive: true });

const read = readAppFiles(appRoot(), false);
if (!read.ok) throw new Error(read.problem);
const snapshotTime = new Date(
  Math.max(...SOURCE_IDS.map((id) => Date.parse(read.files.snapshot.sources[id].fetchedAt))),
);
const started = await startServer({
  env: { REFRESH: "off", EDITOR_CLIENT: "off" },
  clock: () => snapshotTime,
  timers: realTimers(),
  random: () => 0.5,
  fetch: () => Promise.reject(new Error("screenshots make no outbound request")),
  log: () => undefined,
  port: 0,
  host: "127.0.0.1",
});
if (!started.ok) throw new Error(started.problems.join("; "));

const browser = await chromium.launch({ headless: true });
let count = 0;
try {
  for (const view of VIEWS) {
    const context = await browser.newContext({
      viewport: view.viewport,
      hasTouch: view.mobile,
      isMobile: view.mobile,
    });
    const page = await context.newPage();
    for (const number of PAGES) {
      await page.goto(`http://127.0.0.1:${String(started.port)}/${String(number)}`);
      await page.screenshot({ path: join(outDir, `${String(number)}-${view.name}.png`) });
      count++;
    }
    await context.close();
  }
} finally {
  await browser.close();
  await started.shutdown();
}
console.log(`${String(count)} screenshots in docs/screens`);
