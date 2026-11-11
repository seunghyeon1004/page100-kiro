import { describe, expect, it } from "vitest";
import { checkDraft, rulesDraft } from "../../src/compilers/editorial-input.js";
import type { EditorialInput } from "../../src/compilers/editorial-input.js";

const input: EditorialInput = {
  page: 110,
  totalRows: 4,
  slots: [
    {
      id: "story-1",
      mode: "headline",
      text: "The senate votes to end the strike.",
      maxRows: 2,
      width: 20,
    },
    { id: "story-2", mode: "headline", text: "x".repeat(41), maxRows: 2, width: 20 },
    {
      id: "story-3",
      mode: "body",
      text: "Talks resume today. Nothing was agreed.",
      maxRows: 2,
      width: 20,
    },
    { id: "story-4", mode: "body", text: "Third body text here.", maxRows: 2, width: 20 },
  ],
};

const at = (slot: number, row: number): number => 2 + slot * 3 + row;

describe("rulesDraft (requirement 8.3)", () => {
  it("fits each slot, gives a slot that fails no rows, and ends the list when the total is reached", () => {
    expect(rulesDraft(input)).toEqual([
      ["Senate votes to end", "the strike"],
      [],
      ["Talks resume today.", "Nothing was agreed."],
      [],
    ]);
  });

  it("gives zero rows to every slot after one that would pass the total", () => {
    const tight: EditorialInput = { ...input, totalRows: 3 };
    expect(rulesDraft(tight)).toEqual([["Senate votes to end", "the strike"], [], [], []]);
  });

  it("gives every slot zero rows when nothing fits", () => {
    expect(rulesDraft({ ...input, totalRows: 0 })).toEqual([[], [], [], []]);
  });
});

describe("checkDraft (requirement 8.4)", () => {
  const good = [["Senate votes"], [], ["Talks resume today."], []];

  it("accepts a draft within the limits", () => {
    expect(checkDraft(input, good, at)).toEqual([]);
    expect(checkDraft(input, rulesDraft(input), at)).toEqual([]);
  });

  it("slot-count: a different number of slots", () => {
    const problems = checkDraft(input, [["a"]], at);
    expect(problems.map((p) => p.code)).toEqual(["slot-count"]);
    expect(problems[0]?.message).toBe("draft has 1 slots, input has 4");
    expect(checkDraft(input, "nope", at).map((p) => p.code)).toEqual(["slot-count"]);
  });

  it("slot-rows: more rows than the slot allows, and a slot that is not a list of strings", () => {
    const problems = checkDraft(input, [["a", "b", "c"], [], [], []], at);
    expect(problems.map((p) => p.code)).toEqual(["slot-rows"]);
    expect(problems[0]).toMatchObject({ row: 2, message: "slot story-1 has 3 rows, limit 2" });
    expect(checkDraft(input, [[1], [], [], []], at).map((p) => p.code)).toEqual(["slot-rows"]);
  });

  it("row-width: a row over the width, with the page row in the message", () => {
    const problems = checkDraft(
      input,
      [["Senate votes"], [], ["Talks resume today.", "x".repeat(23)], []],
      at,
    );
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatchObject({
      code: "row-width",
      row: 9,
      message: "row 9 is 23 cells, limit 20",
    });
  });

  it("row-space: an empty row, a leading or trailing space, two spaces in a row", () => {
    for (const bad of ["", " a", "a ", "a  b"]) {
      const codes = checkDraft(input, [[bad], [], [], []], at).map((p) => p.code);
      expect(codes, JSON.stringify(bad)).toEqual(["row-space"]);
    }
  });

  it("not-repertoire: a character outside the repertoire, at its cell", () => {
    const problems = checkDraft(input, [["ab\u2603"], [], [], []], at);
    expect(problems.map((p) => [p.code, p.row, p.col])).toEqual([["not-repertoire", 2, 2]]);
    expect(checkDraft(input, [["a\ud800"], [], [], []], at).map((p) => p.code)).toEqual([
      "not-repertoire",
    ]);
  });

  it("total-rows: more rows in all than the input allows", () => {
    const problems = checkDraft({ ...input, totalRows: 2 }, [["a", "b"], [], ["c"], []], at);
    expect(problems.map((p) => p.code)).toEqual(["total-rows"]);
    expect(problems[0]?.message).toBe("draft has 3 rows, limit 2");
  });
});
