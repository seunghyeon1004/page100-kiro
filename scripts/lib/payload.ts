import { request } from "node:http";
import { brotliDecompressSync } from "node:zlib";
import { appRoot, readAppFiles } from "../../src/server/app-files.js";
import { startServer } from "../../src/server/run.js";
import { realTimers } from "../../src/server/timers.js";
import { SOURCE_IDS } from "../../src/sources/source-id.js";

// The byte budgets of server-and-viewer requirement 14, measured against the real app: the same
// `startServer` as production, on 127.0.0.1 with no refresh and no editor client, and a request
// with `Accept-Encoding: br` for every page, fragment and asset.

const KIB = 1024;

/** The budgets in bytes (requirement 14.1; `frontend.md`, "Byte budgets"). */
export const BUDGETS = {
  firstLoad: 24 * KIB,
  html: 6 * KIB,
  frag: 4 * KIB,
  js: 12 * KIB,
  css: 6 * KIB,
  font: 6 * KIB,
} as const;

export interface Item {
  readonly name: string;
  readonly bytes: number;
}

export interface Measurement {
  /** The parts of the first load of `/100`, as sent with `Accept-Encoding: br`. */
  readonly firstLoad: readonly Item[];
  /** Every page's HTML document, brotli, including the not-in-service screen. */
  readonly documents: readonly Item[];
  /** Every `/:page.frag`, brotli. */
  readonly fragments: readonly Item[];
  /** The script, stylesheet and font as stored, uncompressed. */
  readonly js: Item;
  readonly css: Item;
  readonly font: Item;
}

export interface BudgetRow {
  readonly name: string;
  readonly limit: number;
  /** The largest measured value and the item that has it. */
  readonly actual: number;
  readonly item: string;
  readonly ok: boolean;
}

function largest(items: readonly Item[]): Item {
  return items.reduce((a, b) => (b.bytes > a.bytes ? b : a), { name: "(none)", bytes: 0 });
}

function sum(items: readonly Item[]): number {
  return items.reduce((total, item) => total + item.bytes, 0);
}

/** One row per budget. A row is ok when its largest value is within the limit. */
export function checkBudgets(m: Measurement): BudgetRow[] {
  const row = (name: string, limit: number, found: Item): BudgetRow => ({
    name,
    limit,
    actual: found.bytes,
    item: found.name,
    ok: found.bytes > 0 && found.bytes <= limit,
  });
  return [
    row("First load of /100 (br)", BUDGETS.firstLoad, {
      name: "/100 and assets",
      bytes: sum(m.firstLoad),
    }),
    row("Largest HTML document (br)", BUDGETS.html, largest(m.documents)),
    row("Largest fragment (br)", BUDGETS.frag, largest(m.fragments)),
    row("app.js (raw)", BUDGETS.js, m.js),
    row("app.css (raw)", BUDGETS.css, m.css),
    row("Font (woff2)", BUDGETS.font, m.font),
  ];
}

/** The table `npm run payload` prints. */
export function formatTable(rows: readonly BudgetRow[]): string {
  const header = ["Budget", "Limit", "Largest", "Item", "Status"];
  const body = rows.map((r) => [
    r.name,
    `${String(r.limit)} B`,
    `${String(r.actual)} B`,
    r.item,
    r.ok ? "ok" : "OVER",
  ]);
  const widths = header.map((h, i) => Math.max(h.length, ...body.map((b) => b[i]?.length ?? 0)));
  const line = (cells: readonly string[]): string =>
    cells
      .map((c, i) => c.padEnd(widths[i] ?? 0))
      .join("  ")
      .trimEnd();
  return [line(header), line(widths.map((w) => "-".repeat(w))), ...body.map(line)].join("\n");
}

interface Answer {
  readonly status: number;
  readonly bytes: number;
  readonly body: Buffer;
}

function get(port: number, path: string, encoding: "br" | "identity"): Promise<Answer> {
  return new Promise((resolve, reject) => {
    const req = request(
      {
        host: "127.0.0.1",
        port,
        path,
        agent: false,
        headers: { "Accept-Encoding": encoding, Connection: "close" },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => chunks.push(chunk));
        res.on("end", () => {
          const body = Buffer.concat(chunks);
          resolve({ status: res.statusCode ?? 0, bytes: body.length, body });
        });
      },
    );
    req.on("error", reject);
    req.end();
  });
}

async function ok(port: number, path: string, encoding: "br" | "identity"): Promise<Answer> {
  const answer = await get(port, path, encoding);
  if (answer.status !== 200 && answer.status !== 404) {
    throw new Error(`${path} answered ${String(answer.status)}`);
  }
  return answer;
}

/** Starts the app on a free local port, measures everything of requirement 14.2 and stops it. */
export async function measurePayload(): Promise<Measurement> {
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
    fetch: () => Promise.reject(new Error("payload makes no outbound request")),
    log: () => undefined,
    port: 0,
    host: "127.0.0.1",
  });
  if (!started.ok) throw new Error(started.problems.join("; "));
  try {
    const { port } = started;
    const home = await ok(port, "/100", "br");
    const assetPaths = [
      ...new Set(
        [
          ...brotliDecompressSync(home.body)
            .toString("utf8")
            .matchAll(/(?:href|src)="(\/(?:assets\/|favicon)[^"]*)"/g),
        ].map((m) => m[1] ?? ""),
      ),
    ];
    const firstLoad: Item[] = [{ name: "/100", bytes: home.bytes }];
    for (const path of assetPaths)
      firstLoad.push({ name: path, bytes: (await ok(port, path, "br")).bytes });

    const raw = async (suffix: string): Promise<Item> => {
      const path = assetPaths.find((p) => p.endsWith(suffix));
      if (path === undefined) throw new Error(`the page does not reference *${suffix}`);
      return { name: path, bytes: (await ok(port, path, "identity")).bytes };
    };

    const documents: Item[] = [];
    const fragments: Item[] = [];
    const measureView = async (number: number, subpage: number): Promise<void> => {
      const query = subpage > 1 ? `?s=${String(subpage)}` : "";
      const base = `/${String(number)}`;
      documents.push({
        name: `${base}${query}`,
        bytes: (await ok(port, `${base}${query}`, "br")).bytes,
      });
      fragments.push({
        name: `${base}.frag${query}`,
        bytes: (await ok(port, `${base}.frag${query}`, "br")).bytes,
      });
    };
    for (const page of started.app.store.list()) {
      for (let s = 1; s <= page.screens.length; s++) await measureView(page.number, s);
    }
    await measureView(123, 1);

    return {
      firstLoad,
      documents,
      fragments,
      js: await raw(".js"),
      css: await raw(".css"),
      font: await raw(".woff2"),
    };
  } finally {
    await started.shutdown();
  }
}
