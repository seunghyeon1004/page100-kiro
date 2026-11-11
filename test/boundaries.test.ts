import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve, sep } from "node:path";
import { describe, expect, it } from "vitest";

// Scans the source and test trees for the module boundaries and bans of requirements 11, 18, 19 and
// 20. The patterns below are built so that this file does not match its own text.

const ROOT = resolve(import.meta.dirname, "..");

/** Every `.ts` file under a directory, as a path relative to the repository root with `/` separators. */
function tsFiles(dir: string): string[] {
  const absolute = join(ROOT, dir);
  if (!existsSync(absolute)) return [];
  return readdirSync(absolute, { recursive: true, encoding: "utf8" })
    .filter((name) => name.endsWith(".ts"))
    .map((name) => `${dir}/${name}`);
}

function read(relative: string): string {
  return readFileSync(join(ROOT, relative), "utf8");
}

/** Every module specifier a file imports or re-exports. */
function specifiers(source: string): string[] {
  const found: string[] = [];
  for (const match of source.matchAll(/\bfrom\s+["']([^"']+)["']/g)) {
    if (match[1] !== undefined) found.push(match[1]);
  }
  for (const match of source.matchAll(/^\s*import\s+["']([^"']+)["']/gm)) {
    if (match[1] !== undefined) found.push(match[1]);
  }
  return found;
}

/** Where an import resolves to, relative to the repository root. Package and built-in names stay as they are. */
function resolvedTarget(file: string, specifier: string): string {
  if (!specifier.startsWith(".")) return specifier;
  const target = join(dirname(join(ROOT, file)), specifier);
  return target.startsWith(ROOT + sep)
    ? target
        .slice(ROOT.length + 1)
        .split(sep)
        .join("/")
    : target;
}

function isInside(target: string, dir: string): boolean {
  return target === dir || target.startsWith(`${dir}/`);
}

describe("module boundaries (requirements 18.1 and 18.2)", () => {
  it("lets src/grid import only other src/grid modules", () => {
    for (const file of tsFiles("src/grid")) {
      for (const specifier of specifiers(read(file))) {
        expect(
          isInside(resolvedTarget(file, specifier), "src/grid"),
          `${file} imports ${specifier}`,
        ).toBe(true);
      }
    }
  });

  it("lets src/markup import only src/markup and src/grid modules", () => {
    for (const file of tsFiles("src/markup")) {
      for (const specifier of specifiers(read(file))) {
        const target = resolvedTarget(file, specifier);
        const allowed = isInside(target, "src/markup") || isInside(target, "src/grid");
        expect(allowed, `${file} imports ${specifier}`).toBe(true);
      }
    }
  });
});

describe("module boundaries (pages-and-sources 17.1)", () => {
  /** Each import or re-export statement of a file: its specifier and whether it is `import type` / `export type`. */
  function statements(source: string): { specifier: string; typeOnly: boolean }[] {
    const found: { specifier: string; typeOnly: boolean }[] = [];
    for (const match of source.matchAll(
      /\b(import|export)(\s+type)?\b[^;]*?\bfrom\s+["']([^"']+)["']/g,
    )) {
      if (match[3] !== undefined)
        found.push({ specifier: match[3], typeOnly: match[2] !== undefined });
    }
    return found;
  }

  it("lets src/pages import only src/pages, src/grid, src/markup and, type-only, src/sources/source-id", () => {
    for (const file of tsFiles("src/pages")) {
      const source = read(file);
      for (const { specifier, typeOnly } of statements(source)) {
        const target = resolvedTarget(file, specifier);
        const allowed =
          isInside(target, "src/pages") ||
          isInside(target, "src/grid") ||
          isInside(target, "src/markup") ||
          (typeOnly && target === "src/sources/source-id.js");
        expect(allowed, `${file} imports ${specifier}`).toBe(true);
      }
      expect(specifiers(source).length, `${file} has an import form the scan misses`).toBe(
        statements(source).length,
      );
    }
  });

  it("lets src/sources import only src/sources and zod", () => {
    for (const file of tsFiles("src/sources")) {
      for (const specifier of specifiers(read(file))) {
        const target = resolvedTarget(file, specifier);
        const allowed = target === "zod" || isInside(target, "src/sources");
        expect(allowed, `${file} imports ${specifier}`).toBe(true);
      }
    }
  });

  it("keeps scripts, tools and test out of every import in src", () => {
    for (const file of tsFiles("src")) {
      for (const specifier of specifiers(read(file))) {
        const target = resolvedTarget(file, specifier);
        for (const dir of ["scripts", "tools", "test"]) {
          expect(isInside(target, dir), `${file} imports ${specifier}`).toBe(false);
        }
      }
    }
  });
});

describe("determinism (pages-and-sources 17.2)", () => {
  it("keeps the clock, randomness, process, globalThis and global fetch out of src/pages and src/sources", () => {
    const banned = [
      /\bDate\.now\b/,
      /\bnew Date\(\s*\)/,
      /\bMath\.random\b/,
      /\bprocess\b/,
      /\bglobalThis\b/,
      /(?<![.\w])fetch\s*\(/,
    ];
    for (const file of [...tsFiles("src/pages"), ...tsFiles("src/sources")]) {
      const source = read(file);
      for (const pattern of banned) {
        expect(pattern.test(source), `${file} matches ${String(pattern)}`).toBe(false);
      }
    }
  });
});

describe("determinism (requirement 18.3)", () => {
  it("keeps the clock, randomness, process and global objects out of src/grid and src/markup", () => {
    const banned = [/\bDate\b/, /\bMath\.random\b/, /\bprocess\b/, /\bglobalThis\b/];
    for (const file of [...tsFiles("src/grid"), ...tsFiles("src/markup")]) {
      const source = read(file);
      for (const pattern of banned) {
        expect(pattern.test(source), `${file} matches ${String(pattern)}`).toBe(false);
      }
    }
  });
});

describe("brand casts (requirement 11.1)", () => {
  it("casts to ValidPage only in validate-grid.ts and to ValidContent only in validate-content-rows.ts", () => {
    const allowed: Record<string, string> = {
      "as ValidPage": "src/grid/validate-grid.ts",
      "as ValidContent": "src/grid/validate-content-rows.ts",
    };
    const files = tsFiles("src");
    for (const [phrase, owner] of Object.entries(allowed)) {
      const pattern = new RegExp(`\\b${phrase}\\b`);
      const users = files.filter((file) => pattern.test(read(file)));
      expect(users, `files casting with "${phrase}"`).toEqual([owner]);
    }
  });
});

describe("test helpers (requirements 19.3 and 19.4)", () => {
  it("does not use module mocks or spies", () => {
    const mocks = new RegExp(String.raw`\bvi\.(?:mock|spyOn|doMock)\b`);
    for (const file of tsFiles("test")) {
      expect(mocks.test(read(file)), file).toBe(false);
    }
  });

  it("imports only vitest, fast-check, node:fs, node:path, node:url and relative paths, and in test/server also node:zlib and node:http, and in test/e2e also @playwright/test (server-and-viewer 17.1)", () => {
    const allowed = new Set(["vitest", "fast-check", "node:fs", "node:path", "node:url"]);
    // The server tests decode compressed bodies and talk to the app on 127.0.0.1 (design.md, "Test plan").
    const serverOnly = new Set(["node:zlib", "node:http"]);
    for (const file of tsFiles("test")) {
      for (const specifier of specifiers(read(file))) {
        const ok =
          specifier.startsWith(".") ||
          allowed.has(specifier) ||
          (file.startsWith("test/server/") && serverOnly.has(specifier)) ||
          // Playwright is for test/e2e only (tech.md).
          (file.startsWith("test/e2e/") && specifier === "@playwright/test");
        expect(ok, `${file} imports ${specifier}`).toBe(true);
      }
    }
  });
});

describe("type and lint escapes (requirement 20.2, amended by pages-and-sources Departure 3)", () => {
  const ignoreText = "@ts-" + "ignore";
  const eslintText = "eslint-" + "disable";
  const expectError = "@ts-" + "expect-error";
  const anyType = /:\s*any\b|<any[>,]|\bas any\b|\bany\[\]/;

  it("has no ts-ignore or lint-suppression comment, and no any type, in src or test", () => {
    for (const file of [...tsFiles("src"), ...tsFiles("test")]) {
      const source = read(file);
      expect(source.includes(ignoreText), `${file} has a ts-ignore`).toBe(false);
      expect(source.includes(eslintText), `${file} has a lint suppression`).toBe(false);
      expect(anyType.test(source), `${file} uses any`).toBe(false);
    }
  });

  it("names grid-core or pages-and-sources on every expect-error line in src or test", () => {
    for (const file of [...tsFiles("src"), ...tsFiles("test")]) {
      for (const line of read(file).split("\n")) {
        if (line.includes(expectError)) {
          const named = line.includes("grid-core") || line.includes("pages-and-sources");
          expect(named, `${file}: ${line.trim()}`).toBe(true);
        }
      }
    }
  });
});

describe("compiler boundaries (rule-compilers 1.2 to 1.4)", () => {
  /** Each import or re-export statement of a file: its specifier and whether it is `import type` / `export type`. */
  function importStatements(source: string): { specifier: string; typeOnly: boolean }[] {
    const found: { specifier: string; typeOnly: boolean }[] = [];
    for (const match of source.matchAll(
      /\b(import|export)(\s+type)?\b[^;]*?\bfrom\s+["']([^"']+)["']/g,
    )) {
      if (match[3] !== undefined)
        found.push({ specifier: match[3], typeOnly: match[2] !== undefined });
    }
    return found;
  }

  const compilerFiles = tsFiles("src/compilers");

  it("lets src/compilers import only src/compilers, src/grid, src/markup, src/pages and, type-only, src/sources (1.2)", () => {
    for (const file of compilerFiles) {
      const source = read(file);
      for (const { specifier, typeOnly } of importStatements(source)) {
        const target = resolvedTarget(file, specifier);
        const allowed =
          isInside(target, "src/compilers") ||
          isInside(target, "src/grid") ||
          isInside(target, "src/markup") ||
          isInside(target, "src/pages") ||
          (typeOnly && isInside(target, "src/sources"));
        expect(allowed, `${file} imports ${specifier}`).toBe(true);
      }
      expect(specifiers(source).length, `${file} has an import form the scan misses`).toBe(
        importStatements(source).length,
      );
    }
  });

  it("keeps the clock, randomness, globals, fetch and the model SDK out of src/compilers (1.3)", () => {
    const banned = [
      /\bDate\.now\b/,
      /\bnew Date\(\s*\)/,
      /\bMath\.random\b/,
      /\bprocess\b/,
      /\bglobalThis\b/,
      /(?<![.\w])fetch\s*\(/,
      new RegExp("@anthropic-ai" + "/sdk"),
    ];
    for (const file of compilerFiles) {
      const source = read(file);
      for (const pattern of banned) {
        expect(pattern.test(source), `${file} matches ${String(pattern)}`).toBe(false);
      }
    }
  });

  it("keeps number formatting calls and Intl in format.ts alone (1.4)", () => {
    const banned = [
      new RegExp("toFixed" + "\\("),
      new RegExp("toPrecision" + "\\("),
      new RegExp("toLocaleString" + "\\("),
      new RegExp("\\bIntl" + "\\."),
    ];
    for (const file of compilerFiles.filter((f) => f !== "src/compilers/format.ts")) {
      const source = read(file);
      for (const pattern of banned) {
        expect(pattern.test(source), `${file} matches ${String(pattern)}`).toBe(false);
      }
    }
  });

  it("lets no file in src/grid, src/markup, src/pages or src/sources import src/compilers (1.4)", () => {
    for (const dir of ["src/grid", "src/markup", "src/pages", "src/sources"]) {
      for (const file of tsFiles(dir)) {
        for (const specifier of specifiers(read(file))) {
          const target = resolvedTarget(file, specifier);
          expect(isInside(target, "src/compilers"), `${file} imports ${specifier}`).toBe(false);
        }
      }
    }
  });
});

describe("editor boundaries (ai-editor 1.2 to 1.4)", () => {
  /** Each import or re-export statement of a file: its specifier and whether it is `import type` / `export type`. */
  function importStatements(source: string): { specifier: string; typeOnly: boolean }[] {
    const found: { specifier: string; typeOnly: boolean }[] = [];
    for (const match of source.matchAll(
      /\b(import|export)(\s+type)?\b[^;]*?\bfrom\s+["']([^"']+)["']/g,
    )) {
      if (match[3] !== undefined)
        found.push({ specifier: match[3], typeOnly: match[2] !== undefined });
    }
    return found;
  }

  const sdk = "@anthropic-ai" + "/sdk";
  const editorFiles = tsFiles("src/editor");

  it("lets only files in src/editor import the model SDK, and only the client file construct it (1.2)", () => {
    const constructorText = "new " + "Anthropic(";
    for (const file of tsFiles("src")) {
      const source = read(file);
      const importsSdk = specifiers(source).some((s) => s === sdk || s.startsWith(`${sdk}/`));
      if (!isInside(file, "src/editor")) {
        expect(importsSdk, `${file} imports the SDK`).toBe(false);
      }
      if (file !== "src/editor/anthropic-editor-client.ts") {
        expect(source.includes(constructorText), `${file} constructs the SDK client`).toBe(false);
      }
    }
  });

  it("lets src/editor import only src/editor, src/grid, src/markup, src/pages, src/compilers, type-only src/sources, the SDK, zod and node:crypto (1.3)", () => {
    for (const file of editorFiles) {
      const source = read(file);
      for (const { specifier, typeOnly } of importStatements(source)) {
        const target = resolvedTarget(file, specifier);
        const allowed =
          isInside(target, "src/editor") ||
          isInside(target, "src/grid") ||
          isInside(target, "src/markup") ||
          isInside(target, "src/pages") ||
          isInside(target, "src/compilers") ||
          (typeOnly && isInside(target, "src/sources")) ||
          target === sdk ||
          target.startsWith(`${sdk}/`) ||
          target === "zod" ||
          target === "node:crypto";
        expect(allowed, `${file} imports ${specifier}`).toBe(true);
      }
      expect(specifiers(source).length, `${file} has an import form the scan misses`).toBe(
        importStatements(source).length,
      );
    }
  });

  it("keeps the process, console, globals, the clock, randomness and files out of src/editor (1.3)", () => {
    const banned = [
      /\bprocess\b/,
      /\bconsole\./,
      /\bglobalThis\b/,
      /\bDate\.now\b/,
      /\bnew Date\(\s*\)/,
      /\bMath\.random\b/,
      /node:fs/,
    ];
    for (const file of editorFiles) {
      const source = read(file);
      for (const pattern of banned) {
        expect(pattern.test(source), `${file} matches ${String(pattern)}`).toBe(false);
      }
    }
  });

  it("lets no file in src/grid, src/markup, src/pages, src/sources or src/compilers import src/editor (1.4)", () => {
    for (const dir of ["src/grid", "src/markup", "src/pages", "src/sources", "src/compilers"]) {
      for (const file of tsFiles(dir)) {
        for (const specifier of specifiers(read(file))) {
          const target = resolvedTarget(file, specifier);
          expect(isInside(target, "src/editor"), `${file} imports ${specifier}`).toBe(false);
        }
      }
    }
  });
});

describe("server and client boundaries (server-and-viewer 1.3 to 1.5)", () => {
  /** Each import or re-export statement of a file: its specifier and whether it is `import type` / `export type`. */
  function importStatements(source: string): { specifier: string; typeOnly: boolean }[] {
    const found: { specifier: string; typeOnly: boolean }[] = [];
    for (const match of source.matchAll(
      /\b(import|export)(\s+type)?\b[^;]*?\bfrom\s+["']([^"']+)["']/g,
    )) {
      if (match[3] !== undefined)
        found.push({ specifier: match[3], typeOnly: match[2] !== undefined });
    }
    return found;
  }

  const srcFiles = tsFiles("src");
  const serverFiles = tsFiles("src/server");

  /** The files of `src` that import a module, by any specifier that `matches`. */
  function importers(matches: (specifier: string) => boolean): string[] {
    return srcFiles.filter((file) => specifiers(read(file)).some(matches));
  }

  it("lets only src/server/config.ts read process.env (1.3)", () => {
    const envText = "process" + "\\.env\\b";
    const pattern = new RegExp(envText);
    const users = srcFiles.filter((file) => pattern.test(read(file)));
    expect(users.filter((file) => file !== "src/server/config.ts")).toEqual([]);
  });

  it("lets only src/server/app-files.ts import node:fs (1.3)", () => {
    const users = importers((s) => /^(node:)?fs(\/|$)/.test(s));
    expect(users.filter((file) => file !== "src/server/app-files.ts")).toEqual([]);
  });

  it("lets only src/server/http-server.ts import node:http (1.3)", () => {
    const users = importers((s) => /^(node:)?http2?$/.test(s));
    expect(users.filter((file) => file !== "src/server/http-server.ts")).toEqual([]);
  });

  it("lets only src/server/compress.ts import node:zlib (1.3)", () => {
    const users = importers((s) => /^(node:)?zlib$/.test(s));
    expect(users.filter((file) => file !== "src/server/compress.ts")).toEqual([]);
  });

  it("lets the request-handling files import sources, editor, compilers and the scheduler as types only (1.4)", () => {
    const handling = serverFiles.filter((file) => {
      const name = file.slice("src/server/".length);
      return (
        name === "router.ts" ||
        name === "views.ts" ||
        name === "negotiate.ts" ||
        name === "compress.ts" ||
        name === "headers.ts" ||
        /^render-[^/]+\.ts$/.test(name)
      );
    });
    for (const file of handling) {
      const source = read(file);
      for (const { specifier, typeOnly } of importStatements(source)) {
        const target = resolvedTarget(file, specifier);
        const restricted =
          isInside(target, "src/sources") ||
          isInside(target, "src/editor") ||
          isInside(target, "src/compilers") ||
          target === "src/server/scheduler.js";
        if (restricted) expect(typeOnly, `${file} imports ${specifier} as a value`).toBe(true);
      }
      expect(specifiers(source).length, `${file} has an import form the scan misses`).toBe(
        importStatements(source).length,
      );
    }
  });

  it("lets no file outside src/server import src/server (1.4)", () => {
    for (const file of srcFiles.filter((f) => !isInside(f, "src/server"))) {
      for (const specifier of specifiers(read(file))) {
        const target = resolvedTarget(file, specifier);
        expect(isInside(target, "src/server"), `${file} imports ${specifier}`).toBe(false);
      }
    }
  });

  it("keeps public/app.js free of imports, eval, storage, cookies and style writes (1.5)", () => {
    const source = readFileSync(join(ROOT, "public/app.js"), "utf8");
    expect(specifiers(source), "public/app.js imports").toEqual([]);
    expect(/(^|\n)\s*import\b/.test(source), "public/app.js has an import form").toBe(false);
    const banned: readonly RegExp[] = [
      new RegExp("\\bev" + "al\\b"),
      new RegExp("new\\s+Func" + "tion\\b"),
      new RegExp("local" + "Storage"),
      new RegExp("session" + "Storage"),
      new RegExp("document\\.coo" + "kie"),
      new RegExp("\\.sty" + "le\\b"),
      new RegExp("[\"'`]sty" + "le[\"'`]"),
    ];
    for (const pattern of banned) {
      expect(pattern.test(source), `public/app.js matches ${String(pattern)}`).toBe(false);
    }
  });
});
