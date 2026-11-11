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

  it("imports only vitest, fast-check, node:fs, node:path, node:url and relative paths", () => {
    const allowed = new Set(["vitest", "fast-check", "node:fs", "node:path", "node:url"]);
    for (const file of tsFiles("test")) {
      for (const specifier of specifiers(read(file))) {
        const ok = specifier.startsWith(".") || allowed.has(specifier);
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
