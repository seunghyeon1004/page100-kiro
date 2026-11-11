import { describe, expect, it } from "vitest";
import { fitBody, fitHeadline, wrapWords } from "../../src/compilers/fit-text.js";

describe("fitBody: the examples of requirement 3.7", () => {
  it("drops a number and its noun before the ellipsis", () => {
    expect(fitBody("Quake kills 40 people in the north", 20, 1)).toEqual({
      ok: true,
      rows: ["Quake kills..."],
    });
    expect(fitBody("Rates rise 2 per cent on Monday", 15, 1)).toEqual({
      ok: true,
      rows: ["Rates rise..."],
    });
    expect(fitBody("Lava flows 3 km from the summit", 18, 1)).toEqual({
      ok: true,
      rows: ["Lava flows..."],
    });
  });

  it("keeps whole leading sentences before it cuts one", () => {
    expect(fitBody("Talks resume today. Nothing was agreed. More follows.", 20, 2)).toEqual({
      ok: true,
      rows: ["Talks resume today.", "Nothing was agreed."],
    });
  });

  it("treats U.S. and J. as part of a sentence", () => {
    expect(fitBody("U.S. troops leave. Talks resume", 18, 1)).toEqual({
      ok: true,
      rows: ["U.S. troops leave."],
    });
    expect(fitBody("J. Smith wins. Rest follows", 14, 1)).toEqual({
      ok: true,
      rows: ["J. Smith wins."],
    });
  });

  it("strips trailing punctuation from the last word before the ellipsis", () => {
    expect(fitBody("Talks resume, and then all stop here", 18, 1)).toEqual({
      ok: true,
      rows: ["Talks resume..."],
    });
    const cut = fitBody("Talks resume: further news follows later", 15, 1);
    expect(cut).toEqual({ ok: true, rows: ["Talks resume..."] });
  });

  it("returns too-long when only a number would be left, and empty for no words", () => {
    expect(fitBody("40 people die in a crash", 9, 1)).toEqual({ ok: false, reason: "too-long" });
    expect(fitBody("   ", 10, 1)).toEqual({ ok: false, reason: "empty" });
  });

  it("returns word-too-long when the first word is wider than the width", () => {
    expect(fitBody("a".repeat(41), 40, 3)).toEqual({ ok: false, reason: "word-too-long" });
  });
});

describe("wrapWords", () => {
  it("fills each row with as many words as fit", () => {
    expect(wrapWords("aa bb cc dd", 5, 2)).toEqual({ ok: true, rows: ["aa bb", "cc dd"] });
  });

  it("collapses runs of spaces and trims", () => {
    expect(wrapWords("  aa   bb  ", 10, 1)).toEqual({ ok: true, rows: ["aa bb"] });
  });

  it("splits well-known after its hyphen and never inserts one", () => {
    expect(wrapWords("a well-known fact", 8, 3)).toEqual({
      ok: true,
      rows: ["a well-", "known", "fact"],
    });
    const joined = wrapWords("well-known", 6, 2);
    expect(joined).toEqual({ ok: true, rows: ["well-", "known"] });
  });

  it("reports word-too-long for a 41-letter word and a part wider than the row", () => {
    expect(wrapWords("a".repeat(41), 40, 5)).toEqual({ ok: false, reason: "word-too-long" });
    expect(wrapWords("abcdefg-hi", 6, 5)).toEqual({ ok: false, reason: "word-too-long" });
  });

  it("reports too-long when the rows run out, and empty for no text", () => {
    expect(wrapWords("aa bb cc", 5, 1)).toEqual({ ok: false, reason: "too-long" });
    expect(wrapWords("", 5, 1)).toEqual({ ok: false, reason: "empty" });
  });
});

describe("fitHeadline", () => {
  it("removes a leading The, A or An and one final full stop", () => {
    expect(fitHeadline("The senate votes.", 40, 1)).toEqual({ ok: true, rows: ["Senate votes"] });
    expect(fitHeadline("A vehicle hits a wall.", 40, 1)).toEqual({
      ok: true,
      rows: ["Vehicle hits a wall"],
    });
    expect(fitHeadline("An outbreak spreads", 40, 1)).toEqual({
      ok: true,
      rows: ["Outbreak spreads"],
    });
    expect(fitHeadline("Theatre opens", 40, 1)).toEqual({ ok: true, rows: ["Theatre opens"] });
  });

  it("never shortens: a headline that does not fit fails without an ellipsis", () => {
    expect(fitHeadline("Talks resume in the capital today", 20, 1)).toEqual({
      ok: false,
      reason: "too-long",
    });
    expect(fitHeadline("The", 10, 1)).toEqual({ ok: false, reason: "empty" });
  });
});
