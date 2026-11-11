import { describe, expect, it } from "vitest";
import { canvasToCells, createCanvas, setPixel } from "../../src/compilers/mosaic-canvas.js";
import { createContentBuilder, joinRows } from "../../src/compilers/content-builder.js";
import type { Column } from "../../src/compilers/content-builder.js";
import { noDataPage } from "../../src/compilers/no-data-page.js";
import { pickSpread } from "../../src/compilers/pick-spread.js";
import { serialiseContent } from "../../src/markup/serialise-content.js";

const YELLOW = { fg: "yellow", bg: "black" } as const;
const CYAN = { fg: "cyan", bg: "black" } as const;
const WHITE = { fg: "white", bg: "black" } as const;

function failure(build: ReturnType<ReturnType<typeof createContentBuilder>["build"]>) {
  if (build.ok) throw new Error("expected the build to fail");
  return build.problems;
}

describe("content builder: success", () => {
  it("builds a subpage from text, a heading and a paragraph", () => {
    const b = createContentBuilder();
    b.heading(0, 1, "Top stories", YELLOW);
    b.lines(2, 1, ["Floods hit the", "north coast"]);
    const built = b.build();
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(serialiseContent(built.subpage.content)).toBe(
      " {y}Top stories\n\n Floods hit the\n north coast\n",
    );
    expect(built.subpage.alt).toEqual([
      { kind: "heading", level: 2, text: "Top stories" },
      { kind: "paragraph", text: "Floods hit the north coast" },
    ]);
  });

  it("writes markup lines and mosaic cells", () => {
    const canvas = createCanvas(2, 1);
    setPixel(canvas, 0, 0);
    setPixel(canvas, 3, 2);
    const b = createContentBuilder();
    b.markup(1, " {y}Chart");
    b.cells(3, 4, canvasToCells(canvas, CYAN));
    b.alt({ kind: "paragraph", text: "Chart" });
    const built = b.build();
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(built.subpage.content[3]?.[4]).toMatchObject({ kind: "mosaic", bits: 1, fg: "cyan" });
    expect(built.subpage.content[3]?.[5]).toMatchObject({ kind: "mosaic", bits: 32 });
    expect(built.subpage.content[1]?.[1]).toMatchObject({ kind: "text", ch: "C", fg: "yellow" });
  });

  it("writes a link and a concealed value with their alternative blocks", () => {
    const b = createContentBuilder();
    b.link(
      0,
      1,
      [
        ["110", YELLOW],
        ["  World news", WHITE],
      ],
      { page: 110 },
    );
    b.concealed(2, 3, ["Year:", CYAN], ["1066", YELLOW], "Show answer");
    const built = b.build();
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(built.subpage.alt).toEqual([
      { kind: "link", text: "110 World news", target: { page: 110 } },
      { kind: "concealed", summary: "Show answer", text: "Year: 1066" },
    ]);
    expect(built.subpage.content[2]?.[9]).toMatchObject({ ch: "1", conceal: true });
    expect(built.subpage.content[2]?.[3]).toMatchObject({ ch: "Y", conceal: false });
  });
});

describe("content builder: problems (requirements 4.2 to 4.7)", () => {
  it("out-of-bounds: a write past row 19 or col 39, with nothing written", () => {
    const b = createContentBuilder();
    b.text(20, 0, "x");
    b.text(0, 38, "abc");
    b.text(0, -1, "a");
    b.alt({ kind: "paragraph", text: "x abc a" });
    const problems = failure(b.build());
    expect(problems.map((p) => [p.code, p.row, p.col])).toEqual([
      ["out-of-bounds", 22, 0],
      ["out-of-bounds", 2, 40],
      ["out-of-bounds", 2, -1],
    ]);
    expect(problems[0].message).toContain("do not fit");
  });

  it("overlap: a second write on a cell", () => {
    const b = createContentBuilder();
    b.text(3, 5, "abc");
    b.text(3, 7, "xyz");
    b.alt({ kind: "paragraph", text: "abc xyz" });
    const problems = failure(b.build());
    expect(problems.map((p) => [p.code, p.row, p.col])).toEqual([["overlap", 5, 7]]);
    expect(problems[0].message).toBe("cell at col 7 was already written");
  });

  it("not-repertoire: names the code point and its cell", () => {
    const b = createContentBuilder();
    b.text(0, 1, "a\u2603b");
    b.alt({ kind: "paragraph", text: "a b" });
    const problems = failure(b.build());
    expect(problems.map((p) => [p.code, p.row, p.col])).toEqual([["not-repertoire", 2, 2]]);
    expect(problems[0].message).toBe("code point U+2603 is not in the character repertoire");
  });

  it("markup: reports each parse error at the builder's row", () => {
    const b = createContentBuilder();
    b.markup(4, " {z}bad");
    b.markup(5, "a{/?}");
    b.alt({ kind: "paragraph", text: "bad a" });
    const problems = failure(b.build());
    expect(problems.map((p) => [p.code, p.row])).toEqual([
      ["markup", 6],
      ["markup", 7],
    ]);
    expect(problems[0].col).toBe(1);
  });

  it("grid: a contrast violation from the real validator", () => {
    const b = createContentBuilder();
    b.text(0, 0, "dim", { fg: "red", bg: "blue" });
    b.alt({ kind: "paragraph", text: "dim" });
    const problems = failure(b.build());
    expect(problems.map((p) => [p.code, p.row, p.col])).toContainEqual(["grid", 2, 0]);
  });

  it("alt-empty: no block at all", () => {
    const b = createContentBuilder();
    expect(failure(b.build()).map((p) => p.code)).toEqual(["alt-empty"]);
  });

  it("alt-missing: a grid word that the alternative lacks", () => {
    const b = createContentBuilder();
    b.text(0, 0, "alpha beta");
    b.alt({ kind: "paragraph", text: "alpha" });
    const problems = failure(b.build());
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatchObject({
      code: "alt-missing",
      message: 'word "beta" is on the grid but not in the text alternative',
    });
  });

  it("collects every problem at once and never throws", () => {
    const b = createContentBuilder();
    b.text(99, 99, "x");
    b.text(Number.NaN, 0, "x");
    b.cells(0, 0, [[{ kind: "text", ch: "ab", fg: "white", bg: "black", conceal: false }]]);
    expect(failure(b.build()).map((p) => p.code)).toEqual([
      "out-of-bounds",
      "out-of-bounds",
      "not-repertoire",
      "alt-empty",
    ]);
  });
});

describe("content builder: tables and lines", () => {
  const columns: [Column, ...Column[]] = [
    { header: "City", col: 1, width: 10, align: "left", style: WHITE },
    { header: "Temp", col: 12, width: 6, align: "right", style: WHITE },
  ];

  it("writes a table with a header row and a two-row record", () => {
    const b = createContentBuilder();
    const used = b.table(
      0,
      columns,
      [
        [["New", "York"], "3°C"],
        ["Rome", "14°C"],
      ],
      true,
    );
    expect(used).toBe(4);
    const built = b.build();
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(serialiseContent(built.subpage.content)).toBe(
      " {c}City{w}         {c}Temp\n New           3°C\n York\n Rome         14°C\n",
    );
    expect(built.subpage.alt).toEqual([
      {
        kind: "table",
        headers: ["City", "Temp"],
        rows: [
          ["New York", "3°C"],
          ["Rome", "14°C"],
        ],
      },
    ]);
  });

  it("returns the rows used without a header row", () => {
    const b = createContentBuilder();
    expect(
      b.table(
        5,
        columns,
        [
          ["a", "1"],
          ["b", "2"],
        ],
        false,
      ),
    ).toBe(2);
  });

  it("reports text wider than its column instead of cutting it", () => {
    const b = createContentBuilder();
    b.table(0, columns, [["Johannesburg", "1"]], false);
    const problems = failure(b.build());
    expect(problems[0]).toMatchObject({ code: "out-of-bounds", row: 2, col: 1 });
    expect(problems[0].message).toContain('"Johannesburg" is 12 cells, column "City" is 10');
  });

  it("joins lines with a space, and with nothing after a hyphen split", () => {
    expect(joinRows(["a well-", "known fact"])).toBe("a well-known fact");
    expect(joinRows(["foo -", "bar"])).toBe("foo - bar");
    expect(joinRows(["-", "x"])).toBe("- x");
    expect(joinRows(["one", "two", "three"])).toBe("one two three");
  });
});

describe("pickSpread and the no-data page", () => {
  it("spreads indices over the items", () => {
    expect(pickSpread(10, 6)).toEqual([0, 2, 4, 5, 7, 9]);
    expect(pickSpread(3, 6)).toEqual([0, 1, 2]);
    expect(pickSpread(5, 1)).toEqual([0]);
    expect(pickSpread(0, 4)).toEqual([]);
    expect(pickSpread(7, 0)).toEqual([]);
    expect(pickSpread(2, 4)).toEqual([0, 1]);
  });

  it("builds the no-data and no-story pages with outcome no-data", () => {
    const empty = noDataPage(200, "no-data");
    expect(empty.ok && empty.outcome).toBe("no-data");
    if (!empty.ok) return;
    expect(empty.page.dataAt).toBeNull();
    expect(empty.page.editor).toBe("rules");
    expect(serialiseContent(empty.page.subpages[0].content)).toBe(
      "\n {y}No data yet.\n\n This page fills in after the next good\n update from its source.\n\n {y}100{w}  Index\n",
    );
    const story = noDataPage(115, "no-story");
    expect(story.ok && story.page.editor).toBe("rules");
    expect(story.ok && serialiseContent(story.page.subpages[0].content)).toBe(
      "\n {y}No story on this page today.\n\n {y}110{w}  World news index\n",
    );
    expect(noDataPage(123, "no-data").ok).toBe(false);
  });
});
