import { describe, expect, it } from "vitest";
import type { EditorialInput } from "../../src/compilers/editorial-input.js";
import { canonicalInput, createDraftCache, inputKey } from "../../src/editor/draft-cache.js";

function input(text: string, page = 111): EditorialInput {
  return {
    page,
    totalRows: 17,
    slots: [{ id: "lead", mode: "body", text, maxRows: 5, width: 38 }],
  };
}

describe("canonicalInput and inputKey (requirements 11.1, 11.4)", () => {
  it("writes the page, the total rows and each slot's fields as JSON", () => {
    expect(canonicalInput(input("Floods"))).toBe('[111,17,[["lead","body",5,38,"Floods"]]]');
  });

  it("gives 64 lower-case hex digits, equal exactly when the canonical texts are", () => {
    expect(inputKey(input("a"))).toMatch(/^[0-9a-f]{64}$/);
    expect(inputKey(input("a"))).toBe(inputKey(input("a")));
    expect(inputKey(input("a"))).not.toBe(inputKey(input("b")));
    expect(inputKey(input("a", 111))).not.toBe(inputKey(input("a", 112)));
  });
});

describe("createDraftCache (requirements 11.1, 11.4)", () => {
  const accepted = { kind: "accepted", rows: [["Floods"]] } as const;

  it("returns what was stored for an equal input, and nothing for another", () => {
    const cache = createDraftCache();
    cache.set(input("a"), accepted);
    expect(cache.get(input("a"))).toEqual(accepted);
    expect(cache.get(input("b"))).toBeUndefined();
  });

  it("stores a rejection", () => {
    const cache = createDraftCache();
    cache.set(input("a"), { kind: "rejected" });
    expect(cache.get(input("a"))).toEqual({ kind: "rejected" });
  });

  it("compares the canonical text, not only the key", () => {
    const cache = createDraftCache(() => "same key for every input");
    cache.set(input("a"), accepted);
    expect(cache.get(input("a"))).toEqual(accepted);
    expect(cache.get(input("b"))).toBeUndefined();
    cache.drop(input("b"));
    expect(cache.get(input("a"))).toEqual(accepted);
  });

  it("drops an entry", () => {
    const cache = createDraftCache();
    cache.set(input("a"), accepted);
    cache.drop(input("a"));
    expect(cache.get(input("a"))).toBeUndefined();
  });

  it("keeps after an edition only the entries that edition read or wrote", () => {
    const cache = createDraftCache();
    cache.set(input("a"), accepted);
    cache.set(input("b"), accepted);
    cache.endEdition(); // both were written in this edition
    expect(cache.get(input("a"))).toEqual(accepted);
    cache.endEdition(); // only "a" was read
    expect(cache.get(input("a"))).toEqual(accepted);
    expect(cache.get(input("b"))).toBeUndefined();
  });

  it("holds no entry after an edition that touched nothing", () => {
    const cache = createDraftCache();
    cache.set(input("a"), accepted);
    cache.endEdition();
    cache.endEdition();
    expect(cache.get(input("a"))).toBeUndefined();
  });
});
