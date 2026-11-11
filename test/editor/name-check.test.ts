import { describe, expect, it } from "vitest";
import { checkNames } from "../../src/editor/name-check.js";

describe("checkNames (requirement 7.10)", () => {
  const input = ["Floods hit towns near Valencia, said Maria Lopez. The region is dry."];

  it("accepts names that are in the input, in another case too", () => {
    expect(checkNames(input, ["Rain near VALENCIA", "said maria Lopez"])).toEqual([]);
    expect(checkNames(input, ["Floods near valencia"])).toEqual([]);
  });

  it("does not check the first word of a row", () => {
    expect(checkNames(input, ["Hargreaves said floods hit"])).toEqual([]);
  });

  it("does not check the first word after a sentence end", () => {
    expect(checkNames(input, ["Floods hit. Hargreaves left! Zed? Quo said"])).toEqual([]);
  });

  it("reports a capitalised word mid-row that the input lacks, as written", () => {
    expect(checkNames(input, ["Floods near Hargreaves"])).toEqual([
      'name "Hargreaves" not in input',
    ]);
  });

  it("reports each name once, in order of first appearance, across rows", () => {
    expect(
      checkNames(input, ["Floods near Hargreaves and Zed", "Floods near Zed and Hargreaves"]),
    ).toEqual(['name "Hargreaves" not in input', 'name "Zed" not in input']);
  });

  it("leaves all-capitals words to the voice check, and passes months and weekdays", () => {
    expect(checkNames(input, ["Floods near GOVT on Mon 11 Nov"])).toEqual([]);
  });

  it("passes a word the input has in lower case, and reports a synonym it does not have", () => {
    expect(checkNames(["the prime minister spoke"], ["Floods hit Prime Minister"])).toEqual([]);
    expect(checkNames(["the prime minister spoke"], ["Floods hit Premier"])).toEqual([
      'name "Premier" not in input',
    ]);
  });

  it("splits at apostrophes and hyphens, so an input name with either still matches", () => {
    expect(checkNames(["O'Brien and Jean-Pierre"], ["Said O'Brien and Jean-Pierre"])).toEqual([]);
  });

  it("looks in every input text", () => {
    expect(checkNames(["Oslo", "Bergen"], ["Floods near Oslo and Bergen"])).toEqual([]);
  });
});
