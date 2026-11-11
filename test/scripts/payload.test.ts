import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { BUDGETS, checkBudgets, formatTable, measurePayload } from "../../scripts/lib/payload.js";
import type { Measurement } from "../../scripts/lib/payload.js";

// server-and-viewer 14.1 to 14.3: the budgets of frontend.md, measured on the real app over
// 127.0.0.1 (the same function `npm run payload` uses).

const ROOT = resolve(import.meta.dirname, "..", "..");

describe("BUDGETS (14.1)", () => {
  it("equal the table of frontend.md", () => {
    const text = readFileSync(resolve(ROOT, ".kiro/steering/frontend.md"), "utf8");
    const kib = (label: RegExp): number => {
      const match = label.exec(text);
      if (!match) throw new Error(`frontend.md has no row ${String(label)}`);
      return Number(match[1]) * 1024;
    };
    expect(BUDGETS.firstLoad).toBe(kib(/First load[^|]*\| (\d+) KiB total/));
    expect(BUDGETS.html).toBe(kib(/Any page's HTML document, brotli \| (\d+) KiB/));
    expect(BUDGETS.frag).toBe(kib(/Any `\/:page\.frag`, brotli \| (\d+) KiB/));
    expect(BUDGETS.js).toBe(kib(/client script, uncompressed \| (\d+) KiB/));
    expect(BUDGETS.css).toBe(kib(/CSS, uncompressed \| (\d+) KiB/));
    expect(BUDGETS.font).toBe(kib(/Font subset \(woff2\) \| (\d+) KiB/));
  });
});

describe("checkBudgets", () => {
  const within: Measurement = {
    firstLoad: [{ name: "/100", bytes: 2000 }],
    documents: [{ name: "/100", bytes: 2000 }],
    fragments: [{ name: "/100.frag", bytes: 1000 }],
    js: { name: "app.js", bytes: 1000 },
    css: { name: "app.css", bytes: 1000 },
    font: { name: "font", bytes: 1000 },
  };

  it("passes a measurement inside every budget", () => {
    expect(checkBudgets(within).every((row) => row.ok)).toBe(true);
  });

  it.each([
    ["First load", { firstLoad: [{ name: "x", bytes: BUDGETS.firstLoad + 1 }] }],
    ["HTML", { documents: [{ name: "x", bytes: BUDGETS.html + 1 }] }],
    ["fragment", { fragments: [{ name: "x", bytes: BUDGETS.frag + 1 }] }],
    ["app.js", { js: { name: "x", bytes: BUDGETS.js + 1 } }],
    ["app.css", { css: { name: "x", bytes: BUDGETS.css + 1 } }],
    ["Font", { font: { name: "x", bytes: BUDGETS.font + 1 } }],
  ] as const)("flags %s one byte over", (name, change) => {
    const rows = checkBudgets({ ...within, ...change });
    expect(rows.filter((row) => !row.ok).map((row) => row.name)).toEqual([
      expect.stringContaining(name),
    ]);
  });

  it("accepts exactly the limit", () => {
    const rows = checkBudgets({ ...within, js: { name: "app.js", bytes: BUDGETS.js } });
    expect(rows.every((row) => row.ok)).toBe(true);
  });

  it("flags an empty measurement as not ok", () => {
    expect(checkBudgets({ ...within, documents: [] }).some((row) => !row.ok)).toBe(true);
  });
});

describe("measurePayload (14.2, 14.3)", () => {
  let measurement: Measurement;
  beforeAll(async () => {
    measurement = await measurePayload();
  });

  it("measures every page, subpage and the not-in-service screen", () => {
    expect(measurement.documents.length).toBeGreaterThan(30);
    expect(measurement.documents.length).toBe(measurement.fragments.length);
    expect(measurement.documents.map((d) => d.name)).toContain("/123");
    expect(measurement.documents.map((d) => d.name)).toContain("/201?s=6");
    expect(measurement.firstLoad.map((i) => i.name)).toContain("/favicon.svg");
  });

  it("is inside every budget", () => {
    const rows = checkBudgets(measurement);
    expect(formatTable(rows)).not.toContain("OVER");
    for (const row of rows) expect(row.ok, `${row.name}: ${String(row.actual)} B`).toBe(true);
  });
});
