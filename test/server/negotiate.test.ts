import { describe, expect, it } from "vitest";
import { chooseEncoding, ifNoneMatch, isTerminalAgent } from "../../src/server/negotiate.js";

// server-and-viewer 8.4 and 8.5, 7.5.

describe("chooseEncoding", () => {
  const cases: readonly [string | undefined, string][] = [
    [undefined, "identity"],
    ["", "identity"],
    ["br", "br"],
    ["gzip", "gzip"],
    ["gzip, br", "br"],
    ["br, gzip", "br"],
    ["identity", "identity"],
    ["deflate", "identity"],
    ["*", "br"],
    ["*;q=0", "identity"],
    ["br;q=0", "identity"],
    ["br;q=0, gzip", "gzip"],
    ["gzip;q=0, br;q=0", "identity"],
    ["br;q=0, *", "gzip"],
    ["br;q=0, gzip;q=0, *", "identity"],
    ["br;q=0.001", "br"],
    ["br;q=0.000", "identity"],
    ["br;q=0.5, gzip;q=1", "br"],
    ["BR", "br"],
    ["Gzip ; Q = 1", "gzip"],
    ["br;q=abc, gzip", "gzip"],
    ["br;q=1.5, gzip", "gzip"],
    ["br;q=0.0001, gzip", "gzip"],
    ["br;q=-1, gzip", "gzip"],
    ["br;level=5, gzip", "gzip"],
    [", ,", "identity"],
    ["x-gzip", "identity"],
  ];
  for (const [header, expected] of cases) {
    it(`${JSON.stringify(header)} gives ${expected}`, () => {
      expect(chooseEncoding(header)).toBe(expected);
    });
  }
});

describe("ifNoneMatch", () => {
  it("matches a listed tag, strong or weak", () => {
    expect(ifNoneMatch('"a"', '"a"')).toBe(true);
    expect(ifNoneMatch('W/"a"', '"a"')).toBe(true);
    expect(ifNoneMatch('"b", W/"a" , "c"', '"a"')).toBe(true);
  });

  it("matches *", () => {
    expect(ifNoneMatch("*", '"a"')).toBe(true);
  });

  it("does not match another tag, a prefix, a missing header or garbage", () => {
    expect(ifNoneMatch('"b"', '"a"')).toBe(false);
    expect(ifNoneMatch('"a-1"', '"a"')).toBe(false);
    expect(ifNoneMatch(undefined, '"a"')).toBe(false);
    expect(ifNoneMatch("", '"a"')).toBe(false);
    expect(ifNoneMatch("a", '"a"')).toBe(false);
  });
});

describe("isTerminalAgent", () => {
  it("is true for curl/ and Wget/ only", () => {
    expect(isTerminalAgent("curl/8.4.0")).toBe(true);
    expect(isTerminalAgent("Wget/1.21")).toBe(true);
    expect(isTerminalAgent("Mozilla/5.0 curl/8")).toBe(false);
    expect(isTerminalAgent("curl")).toBe(false);
    expect(isTerminalAgent("wget/1.21")).toBe(false);
    expect(isTerminalAgent(undefined)).toBe(false);
  });
});
