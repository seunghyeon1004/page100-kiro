import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { ATTRIBUTION } from "../../src/pages/attribution.js";
import { SOURCE_IDS } from "../../src/sources/source-id.js";

const ROOT = resolve(import.meta.dirname, "..", "..");

// Table label in sources.md to the id used in the registry.
const LABEL_TO_ID: Readonly<Record<string, keyof typeof ATTRIBUTION>> = {
  "Wikimedia featured feed": "wikimedia-feed",
  "Wikimedia on this day": "wikimedia-onthisday",
  "Open-Meteo": "open-meteo",
  "Frankfurter, latest": "frankfurter",
  "Frankfurter, series": "frankfurter",
  "Hacker News": "hacker-news",
  USGS: "usgs",
  "Launch Library 2": "launch-library",
  "Moon (no fetch)": "computed",
};

function tableAttributions(): Map<string, string[]> {
  const md = readFileSync(resolve(ROOT, ".kiro/steering/sources.md"), "utf8");
  const found = new Map<string, string[]>();
  for (const line of md.split("\n")) {
    if (!line.startsWith("| ")) continue;
    const cells = line.split("|").map((c) => c.trim());
    const label = cells[1];
    const last = cells[cells.length - 2];
    const id = label === undefined ? undefined : LABEL_TO_ID[label];
    const match = last === undefined ? null : /^`([^`]+)`$/.exec(last);
    if (id === undefined || match?.[1] === undefined) continue;
    found.set(id, [...(found.get(id) ?? []), match[1]]);
  }
  return found;
}

describe("ATTRIBUTION (requirement 7.4)", () => {
  const table = tableAttributions();

  it("finds a row 22 text for every source in the sources.md table", () => {
    for (const id of SOURCE_IDS) {
      expect(table.has(id), id).toBe(true);
    }
    expect(table.has("computed")).toBe(true);
  });

  it("equals the last column of the sources.md table, row by row", () => {
    for (const [id, texts] of table) {
      for (const text of texts) {
        expect(ATTRIBUTION[id as keyof typeof ATTRIBUTION], id).toBe(text);
      }
    }
  });

  it("has exactly the seven sources plus computed, each at most 30 characters", () => {
    expect(Object.keys(ATTRIBUTION).sort()).toEqual([...SOURCE_IDS, "computed"].sort());
    for (const text of Object.values(ATTRIBUTION)) {
      expect(text.length).toBeLessThanOrEqual(30);
    }
  });
});
