import { describe, expect, it } from "vitest";
import { compileAll } from "../../src/compilers/compile-all.js";
import { REGISTRY } from "../../src/pages/registry.js";
import { NOW, PAGE_FILES, SNAPSHOT, STATUS, cloneSnapshot } from "./boot-snapshot.js";

describe("compileAll on the boot snapshot (requirement 18)", () => {
  const result = compileAll(SNAPSHOT, STATUS, NOW, PAGE_FILES);

  it("gives one outcome per registry page, in registry order, none failed", () => {
    expect(result.outcomes.map((o) => o.number)).toEqual(REGISTRY.map((d) => d.number));
    expect(result.outcomes).toHaveLength(30);
    const failed = result.outcomes.filter((o) => o.outcome === "failed");
    expect(failed).toEqual([]);
  });

  it("returns the pages of the first two kinds in ascending order", () => {
    const numbers = result.pages.map((p) => p.number);
    expect(numbers).toEqual([...numbers].sort((a, b) => a - b));
    expect(numbers).toHaveLength(30);
  });

  it("compiles every page of the boot snapshot with data, except pages 116 to 118 which have no story", () => {
    const noData = result.outcomes.filter((o) => o.outcome === "no-data").map((o) => o.number);
    expect(noData).toEqual([116, 117, 118]);
  });
});

describe("compileAll: one failing page changes no other (requirement 18.3)", () => {
  it("reports a compiler that throws, and compiles the other 29", () => {
    const base = cloneSnapshot();
    // A getter on the weather list throws when page 200 or 201 reads it, so only those fail.
    const poisoned = {
      ...base,
      sources: {
        ...base.sources,
        "open-meteo": {
          fetchedAt: base.sources["open-meteo"].fetchedAt,
          get value(): never {
            throw new TypeError("boom");
          },
        },
      },
    } as unknown as typeof base;
    const result = compileAll(poisoned, STATUS, NOW, PAGE_FILES);
    const failed = result.outcomes.flatMap((o) => (o.outcome === "failed" ? [o] : []));
    expect(failed.map((o) => o.number)).toEqual([200, 201]);
    for (const o of failed) {
      expect(o.problems[0]).toEqual({
        code: "threw",
        subpage: null,
        row: null,
        col: null,
        message: "compiler threw TypeError",
      });
    }
    expect(result.outcomes).toHaveLength(30);
    expect(result.pages).toHaveLength(28);
    const clean = compileAll(SNAPSHOT, STATUS, NOW, PAGE_FILES);
    for (const o of result.outcomes) {
      if (o.outcome !== "failed")
        expect(o).toEqual(clean.outcomes.find((c) => c.number === o.number));
    }
  });

  it("reports a static page whose file is bad, with its markup problem, and leaves it out of pages", () => {
    const result = compileAll(SNAPSHOT, STATUS, NOW, { ...PAGE_FILES, 899: " {z}bad\n" });
    const failed = result.outcomes.find((o) => o.number === 899);
    expect(failed?.outcome).toBe("failed");
    expect(failed?.outcome === "failed" && failed.problems[0]).toMatchObject({
      code: "markup",
      row: 2,
      col: 1,
    });
    expect(result.pages.some((p) => p.number === 899)).toBe(false);
    expect(result.pages).toHaveLength(29);
  });

  it("reports frame problems when now is not a valid time", () => {
    const result = compileAll(SNAPSHOT, STATUS, new Date(Number.NaN), PAGE_FILES);
    expect(result.outcomes.every((o) => o.outcome === "failed")).toBe(true);
    const first = result.outcomes[0];
    expect(first?.outcome === "failed" && first.problems[0].code).toBe("frame");
  });

  it("does not throw for a snapshot that is not an object", () => {
    const result = compileAll(null as never, STATUS, NOW, PAGE_FILES);
    expect(result.outcomes).toHaveLength(30);
    expect(result.outcomes.filter((o) => o.outcome === "failed").length).toBeGreaterThan(0);
  });
});
