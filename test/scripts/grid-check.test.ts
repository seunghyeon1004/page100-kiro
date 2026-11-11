import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { CHECK_STATUS } from "../../scripts/lib/check-status.js";
import { exitCodeOf, runGridCheck } from "../../scripts/lib/run-grid-check.js";
import type { PageFileInput } from "../../scripts/lib/run-grid-check.js";
import { REGISTRY } from "../../src/pages/registry.js";

const ROOT = resolve(import.meta.dirname, "..", "..");
const SNAPSHOT_TEXT = readFileSync(
  join(ROOT, "src", "sources", "snapshot", "snapshot.json"),
  "utf8",
);

function pageFile(name: string): PageFileInput {
  return { name, text: readFileSync(join(ROOT, "pages", name), "utf8") };
}
const GOOD = ["666.page", "800.page", "801.page", "899.page"].map(pageFile);

describe("runGridCheck on the boot snapshot and the real pages/ files (requirements 19.1, 19.2)", () => {
  const report = runGridCheck(SNAPSHOT_TEXT, GOOD);

  it("finds no problem and ends with the summary line", () => {
    expect(report.problems).toBe(0);
    expect(report.lines).toEqual([`30 pages, ${String(report.screens)} screens, 0 problems`]);
    expect(report.screens).toBe(43);
    expect(exitCodeOf(report)).toBe(0);
  });
});

describe("runGridCheck on broken input", () => {
  it("names the file, row and cell of a bad page file, and exits 1", () => {
    const bad = GOOD.map((f) =>
      f.name === "801.page" ? { name: f.name, text: " ok\n{z}\n a{/?}\n" } : f,
    );
    const report = runGridCheck(SNAPSHOT_TEXT, bad);
    expect(exitCodeOf(report)).toBe(1);
    expect(report.lines.slice(0, -1)).toHaveLength(report.problems);
    expect(report.lines[0]).toMatch(/^pages\/801\.page row 3 col 0: /);
    expect(report.lines[1]).toMatch(/^pages\/801\.page row 4 col 2: /);
    expect(report.lines.at(-1)).toBe(
      `30 pages, ${String(report.screens)} screens, ${String(report.problems)} problems`,
    );
    expect(report.screens).toBe(42);
  });

  it("rejects a file name that is not a static page", () => {
    const report = runGridCheck(SNAPSHOT_TEXT, [...GOOD, { name: "123.page", text: " x\n" }]);
    expect(report.lines[0]).toBe("pages/123.page: not the file of a static page");
    expect(exitCodeOf(report)).toBe(1);
    const other = runGridCheck(SNAPSHOT_TEXT, [...GOOD, { name: "100.page", text: " x\n" }]);
    expect(other.lines[0]).toBe("pages/100.page: not the file of a static page");
  });

  it("reports a missing static file once", () => {
    const report = runGridCheck(
      SNAPSHOT_TEXT,
      GOOD.filter((f) => f.name !== "899.page"),
    );
    expect(report.lines[0]).toBe("pages/899.page: file is missing");
    expect(report.problems).toBe(1);
    expect(exitCodeOf(report)).toBe(1);
  });

  it("reports a snapshot that does not parse and stops", () => {
    for (const text of ["not json", "{}", '{"version":1}']) {
      const report = runGridCheck(text, GOOD);
      expect(report.lines[0]?.startsWith("snapshot.json: does not parse")).toBe(true);
      expect(report.lines).toHaveLength(2);
      expect(exitCodeOf(report)).toBe(1);
    }
  });

  it("uses only the file system for input: the check has no network call in its source", () => {
    const source = [
      readFileSync(join(ROOT, "scripts", "grid-check.ts"), "utf8"),
      readFileSync(join(ROOT, "scripts", "lib", "run-grid-check.ts"), "utf8"),
    ].join("\n");
    expect(/\bfetch\s*\(|node:https?|node:net/.test(source)).toBe(false);
  });
});

describe("CHECK_STATUS", () => {
  it("has the widest counters and one entry per registry page at the given time", () => {
    const now = new Date("2026-11-11T14:05:09Z");
    const status = CHECK_STATUS(now);
    expect(status.aiEditor).toBe(true);
    expect(status.modelCalls).toEqual({ used: 99_999, cap: 99_999 });
    expect(status.drafts).toEqual({ accepted: 99_999, rejected: 99_999 });
    expect(status.pages.map((p) => p.number)).toEqual(REGISTRY.map((d) => d.number));
    expect(status.pages.every((p) => p.compiledAt === now)).toBe(true);
    expect(status.pages.map((p) => p.editor)).toEqual(REGISTRY.map((d) => d.editor));
  });
});
