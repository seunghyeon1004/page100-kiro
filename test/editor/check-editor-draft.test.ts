import { describe, expect, it } from "vitest";
import { checkEditorDraft } from "../../src/editor/check-editor-draft.js";
import type { DraftRequest, RequestSlot } from "../../src/editor/editor-types.js";

// One minimal reply per violation sentence of the design table (requirement 7.1), checked with
// the exact text.

function slot(over: Partial<RequestSlot> = {}): RequestSlot {
  return {
    id: "lead",
    mode: "body",
    maxRows: 3,
    width: 38,
    optional: false,
    text: "Floods hit 12 towns in northern Spain on Monday.",
    ...over,
  };
}

function request(slots: RequestSlot[], totalRows = 10): DraftRequest {
  return { page: 111, totalRows, slots, inputKey: "0".repeat(64), attempt: 0, previous: null };
}

function violationsOf(req: DraftRequest, rows: unknown): readonly string[] {
  const result = checkEditorDraft(req, rows);
  if (result.ok) throw new Error(`expected violations, got rows ${JSON.stringify(result.rows)}`);
  return result.violations;
}

describe("checkEditorDraft: accepted drafts", () => {
  it("returns the rows per slot", () => {
    const req = request([slot(), slot({ id: "background", optional: true, text: "A river." })]);
    expect(checkEditorDraft(req, ["Floods hit 12 towns", "", "A river."])).toEqual({
      ok: true,
      rows: [["Floods hit 12 towns"], ["A river."]],
    });
  });

  it("lets an optional slot be empty, and gives it no rows", () => {
    const req = request([slot(), slot({ id: "background", optional: true })]);
    expect(checkEditorDraft(req, ["Floods hit 12 towns", ""])).toEqual({
      ok: true,
      rows: [["Floods hit 12 towns"], []],
    });
  });

  it("returns folded rows", () => {
    const req = request([slot({ text: "Spain\u2019s floods" })]);
    expect(checkEditorDraft(req, ["Spain\u2019s floods"])).toEqual({
      ok: true,
      rows: [["Spain's floods"]],
    });
  });
});

describe("checkEditorDraft: violation sentences", () => {
  it("stage 1: the group count is the only violation", () => {
    const req = request([slot(), slot({ id: "b" })]);
    expect(violationsOf(req, ["a", "", "b", "", "c"])).toEqual(["reply has 3 slots, expected 2"]);
    expect(violationsOf(req, ["a"])).toEqual(["reply has 1 slots, expected 2"]);
  });

  it("stage 1: a reply that is not a list of strings", () => {
    expect(violationsOf(request([slot()]), "rows")).toEqual(["reply was not a list of rows"]);
    expect(violationsOf(request([slot()]), [1])).toEqual(["reply was not a list of rows"]);
  });

  it("stage 2: too many rows, and an empty slot that is not optional", () => {
    const req = request([slot({ id: "story-3", maxRows: 3, text: "a b c d" })]);
    expect(violationsOf(req, ["a", "b", "c", "d"])).toEqual(["slot story-3 has 4 rows, limit 3"]);
    expect(violationsOf(request([slot()]), [])).toEqual(["slot lead is empty"]);
  });

  it("stage 3: a code point outside the character set, with its row number", () => {
    const req = request([slot({ text: "Floods hit Spain" })]);
    expect(violationsOf(req, ["Floods", "Spain \u{1f600}"])).toEqual([
      "slot lead row 2 has U+1F600, which is outside the character set",
    ]);
  });

  it("stage 4: width, blank, spaces and brace", () => {
    const long = "a".repeat(43);
    expect(violationsOf(request([slot({ text: long })]), ["ok", long])).toEqual([
      "slot lead row 2 is 43 cells, limit 38",
    ]);
    expect(violationsOf(request([slot()]), ["ok", "   "])).toEqual(["slot lead row 2 is blank"]);
    expect(violationsOf(request([slot({ text: "ok on" })]), ["ok", " on"])).toEqual([
      "slot lead row 2 starts or ends with a space",
    ]);
    expect(violationsOf(request([slot({ text: "ok on" })]), ["ok", "on "])).toEqual([
      "slot lead row 2 starts or ends with a space",
    ]);
    expect(violationsOf(request([slot({ text: "ok on" })]), ["ok", "ok  on"])).toEqual([
      "slot lead row 2 has two spaces in a row",
    ]);
    expect(violationsOf(request([slot({ text: "ok" })]), ["ok", "{y}ok"])).toEqual([
      'slot lead row 2 contains "{"',
    ]);
  });

  it("stage 4: a folded ellipsis counts as 3 cells", () => {
    const text = "x".repeat(35);
    const fits = request([slot({ text: `${text}\u2026` })]);
    expect(checkEditorDraft(fits, [`${text}\u2026`]).ok).toBe(true);
    expect(
      violationsOf(request([slot({ text: `${text}\u2026`, width: 37 })]), [`${text}\u2026`]),
    ).toEqual(["slot lead row 1 is 38 cells, limit 37"]);
  });

  it("stage 5: ! and ? only when the source has them", () => {
    expect(violationsOf(request([slot()]), ["ok", "Floods hit Spain!"])).toEqual([
      'slot lead row 2 has "!", which is not in its source',
    ]);
    expect(violationsOf(request([slot()]), ["Why Spain?"])).toEqual([
      'slot lead row 1 has "?", which is not in its source',
    ]);
    expect(
      checkEditorDraft(request([slot({ text: "Floods hit Spain!" })]), ["Floods hit Spain!"]).ok,
    ).toBe(true);
  });

  it("stage 5: headline words, any case, unless the source has them", () => {
    expect(violationsOf(request([slot()]), ["Breaking floods hit Spain"])).toEqual([
      'slot lead row 1 uses "breaking"',
    ]);
    expect(violationsOf(request([slot()]), ["Storm SLAMS Spain"])).toContain(
      'slot lead row 1 uses "slams"',
    );
    expect(
      checkEditorDraft(request([slot({ text: "A shock result" })]), ["A shock result"]).ok,
    ).toBe(true);
  });

  it("stage 5: an all-capitals word that is not in the source or allowed", () => {
    expect(violationsOf(request([slot()]), ["Floods hit GOVT towns"])).toEqual([
      'slot lead row 1 has "GOVT" in capitals',
    ]);
    expect(checkEditorDraft(request([slot({ text: "NASA says" })]), ["NASA says"]).ok).toBe(true);
  });

  it("stage 5: the allowed capitals pass", () => {
    const text = "US UK UN EU NATO WHO IMF UTC AI";
    expect(checkEditorDraft(request([slot({ text })]), [text]).ok).toBe(true);
    expect(
      checkEditorDraft(request([slot({ text: "words" })]), ["US UK UN EU NATO WHO IMF UTC AI"]).ok,
    ).toBe(true);
  });

  it("stage 5: the last row of a headline ends with neither . nor ...", () => {
    const head = (rows: string[]) =>
      violationsOf(request([slot({ id: "story-1", mode: "headline" })]), rows);
    expect(head(["Floods hit Spain."])).toEqual(['slot story-1 ends with "."']);
    expect(head(["Floods hit Spain..."])).toEqual(['slot story-1 ends with "..."']);
    expect(head(["Floods hit Spain\u2026"])).toEqual(['slot story-1 ends with "..."']);
    // A body slot may end in a full stop.
    expect(checkEditorDraft(request([slot()]), ["Floods hit Spain."]).ok).toBe(true);
  });

  it("stage 6: the total of rows across slots", () => {
    const req = request(
      [slot({ maxRows: 5, text: "Floods" }), slot({ id: "b", maxRows: 5, text: "Floods" })],
      8,
    );
    const four = ["Floods", "Floods", "Floods", "Floods"];
    expect(violationsOf(req, [...four, "", ...four, "Floods"])).toEqual([
      "draft has 9 rows, limit 8",
    ]);
    expect(checkEditorDraft(req, [...four, "", ...four]).ok).toBe(true);
  });

  it("stage 7: numbers and number words, each once", () => {
    expect(violationsOf(request([slot()]), ["Floods hit 41 towns, 41 dead"])).toEqual([
      'number "41" not in input',
    ]);
    expect(violationsOf(request([slot()]), ["twelve towns"])).toEqual([
      'number word "twelve" not in input',
    ]);
  });

  it("stage 8: a name that is not in the input", () => {
    expect(violationsOf(request([slot()]), ["Floods hit towns near Hargreaves"])).toEqual([
      'name "Hargreaves" not in input',
    ]);
  });

  it("reports violations in check order across stages", () => {
    const req = request([slot({ text: "Floods hit 12 towns" })]);
    expect(violationsOf(req, ["Floods hit 41 towns near Hargreaves!"])).toEqual([
      'slot lead row 1 has "!", which is not in its source',
      'number "41" not in input',
      'name "Hargreaves" not in input',
    ]);
  });

  it("skips the shape and voice checks of a row that does not fold, and still counts the others", () => {
    const req = request([slot({ text: "Floods hit Spain" })]);
    expect(violationsOf(req, ["Floods!\u{1f600}", "Spain  now"])).toEqual([
      "slot lead row 1 has U+1F600, which is outside the character set",
      "slot lead row 2 has two spaces in a row",
    ]);
  });
});
