import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// server-and-viewer 1.5 and 12.1, read from the text of public/app.js.

const ROOT = resolve(import.meta.dirname, "..", "..");
const js = readFileSync(resolve(ROOT, "public/app.js"), "utf8");

describe("public/app.js (1.5)", () => {
  it("imports nothing", () => {
    expect(js).not.toMatch(/^\s*import\b/m);
    expect(js).not.toMatch(/\bimport\s*\(/);
    expect(js).not.toMatch(/\brequire\s*\(/);
  });

  it.each([
    ["eval", /\beval\b/],
    ["new Function", /new\s+Function\b/],
    ["localStorage", /localStorage/],
    ["sessionStorage", /sessionStorage/],
    ["document.cookie", /document\.cookie/],
    [".style", /\.style\b/],
    ['"style"', /["'`]style["'`]/],
  ])("does not contain %s", (_name, pattern) => {
    expect(js).not.toMatch(pattern);
  });

  it("makes no request but same-origin fragment fetches", () => {
    expect(js.match(/\bfetch\(/g)).toHaveLength(1);
    expect(js).toContain("`/${String(n)}.frag");
    expect(js).not.toMatch(/https?:\/\//);
    expect(js).not.toMatch(/XMLHttpRequest|sendBeacon|WebSocket|EventSource/);
  });

  it("never moves focus", () => {
    expect(js).not.toMatch(/\.focus\(|\.blur\(|autofocus/);
  });
});

describe("public/tsconfig.json (12.1)", () => {
  it("checks app.js with checkJs and strict", () => {
    const text = readFileSync(resolve(ROOT, "public/tsconfig.json"), "utf8");
    const config: unknown = JSON.parse(text);
    expect(config).toMatchObject({
      compilerOptions: { allowJs: true, checkJs: true, strict: true, noEmit: true },
      include: ["app.js"],
    });
  });
});
