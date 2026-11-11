import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { buildSnapshot, snapshotText } from "../../scripts/lib/build-snapshot.js";
import { parseSnapshot } from "../../src/sources/snapshot.js";
import { SOURCE_IDS } from "../../src/sources/source-id.js";
import { FIXTURES_ROOT } from "./fixtures.js";

const FILE = resolve(
  import.meta.dirname,
  "..",
  "..",
  "src",
  "sources",
  "snapshot",
  "snapshot.json",
);

describe("boot snapshot (requirement 15.4)", () => {
  const text = readFileSync(FILE, "utf8");

  it("parses with parseSnapshot and holds all seven sources", () => {
    const result = parseSnapshot(JSON.parse(text));
    expect(result.ok).toBe(true);
    if (result.ok)
      expect(Object.keys(result.snapshot.sources).sort()).toEqual([...SOURCE_IDS].sort());
  });

  it("equals, byte for byte, the output of buildSnapshot on the committed fixtures", async () => {
    expect(snapshotText(await buildSnapshot(FIXTURES_ROOT))).toBe(text);
  });

  it("builds the same text twice", async () => {
    expect(snapshotText(await buildSnapshot(FIXTURES_ROOT))).toBe(
      snapshotText(await buildSnapshot(FIXTURES_ROOT)),
    );
  });

  it("has the fetch times of the recorded fixtures and the recorded news and quakes", () => {
    const result = parseSnapshot(JSON.parse(text));
    if (!result.ok) throw new Error("snapshot does not parse");
    const { sources } = result.snapshot;
    expect(sources.usgs.fetchedAt).toMatch(/^2026-11-11T/);
    expect(sources.usgs.value.quakes).toHaveLength(14);
    expect(sources["launch-library"].value.launches).toHaveLength(8);
    expect(sources["open-meteo"].value.cities).toHaveLength(24);
  });
});
