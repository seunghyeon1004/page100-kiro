import { describe, expect, it } from "vitest";
import { checkNumericFidelity, numberTokensOf } from "../../src/editor/numeric-fidelity.js";

describe("numberTokensOf (requirement 8.1)", () => {
  it("takes digit runs with decimal points and thousands commas, and removes the commas", () => {
    expect(numberTokensOf("In 1,066 and 3.5 and 12, then 7.")).toEqual(["1066", "3.5", "12", "7"]);
  });

  it("finds nothing in text without digits", () => {
    expect(numberTokensOf("no numbers here")).toEqual([]);
  });
});

describe("checkNumericFidelity (requirements 8.1 to 8.3)", () => {
  it("accepts a draft whose numbers are all in the input, with commas ignored", () => {
    expect(
      checkNumericFidelity(["Quake of 5.2 hit 1,200 homes"], ["Quake 5.2 hits 1200 homes"]),
    ).toEqual([]);
  });

  it("reports a number that is not in the input, in the exact sentence", () => {
    expect(checkNumericFidelity(["Quake of 5.2"], ["Quake of 41"])).toEqual([
      'number "41" not in input',
    ]);
  });

  it("reports each distinct token once, in order of first appearance", () => {
    expect(
      checkNumericFidelity(["nothing"], ["9 then 8", "7 and 9 and eight twelve", "twelve"]),
    ).toEqual([
      'number "9" not in input',
      'number "8" not in input',
      'number "7" not in input',
      'number word "eight" not in input',
      'number word "twelve" not in input',
    ]);
  });

  it("reports a number word that is not in the input, in any case", () => {
    expect(checkNumericFidelity(["a handful died"], ["Twelve died"])).toEqual([
      'number word "twelve" not in input',
    ]);
  });

  it("accepts a number word that the input has as a whole word, in another case", () => {
    expect(checkNumericFidelity(["Twelve died"], ["twelve died"])).toEqual([]);
  });

  it("does not match a number word inside a longer word", () => {
    expect(checkNumericFidelity(["someone"], ["someone"])).toEqual([]);
    expect(checkNumericFidelity(["someone"], ["one"])).toEqual(['number word "one" not in input']);
  });

  it("looks in every input text, not only the first", () => {
    expect(checkNumericFidelity(["first 4", "second 5"], ["4 and 5"])).toEqual([]);
  });

  it("does not take a spelled number for its digits", () => {
    expect(checkNumericFidelity(["12 died"], ["twelve died"])).toEqual([
      'number word "twelve" not in input',
    ]);
  });
});
