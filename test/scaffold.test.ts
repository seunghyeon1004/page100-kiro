import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import vitestConfig from "../vitest.config.js";

// Checks the scaffold files of requirement 1 against the text on disk.

const ROOT = resolve(import.meta.dirname, "..");

type JsonObject = Readonly<Record<string, unknown>>;

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readText(relativePath: string): string {
  return readFileSync(resolve(ROOT, relativePath), "utf8");
}

function readJson(relativePath: string): JsonObject {
  const value: unknown = JSON.parse(readText(relativePath));
  if (!isJsonObject(value)) {
    throw new Error(`${relativePath} does not hold a JSON object`);
  }
  return value;
}

const EXACT_VERSION = /^\d+\.\d+\.\d+$/;

describe("package.json (requirement 1.1 to 1.5; pages-and-sources 1.1)", () => {
  const pkg = readJson("package.json");

  it("has the fixed fields and engines", () => {
    expect(pkg.name).toBe("page100");
    expect(pkg.version).toBe("0.1.0");
    expect(pkg.private).toBe(true);
    expect(pkg.type).toBe("module");
    expect(pkg.license).toBe("MIT");
    expect(pkg.engines).toEqual({ node: ">=20.19.0" });
  });

  it("defines exactly the scripts of server-and-viewer 1.1 (Departure 6 for typecheck)", () => {
    expect(pkg.scripts).toEqual({
      build: "tsc -p tsconfig.build.json",
      dev: "tsx watch src/server/main.ts",
      start: "node dist/server/main.js",
      test: "vitest run",
      typecheck: "tsc --noEmit && tsc -p public/tsconfig.json",
      lint: "eslint . && prettier --check .",
      format: "prettier --write .",
      e2e: "playwright test",
      "grid:check": "tsx scripts/grid-check.ts",
      payload: "tsx scripts/payload.ts",
    });
  });

  it("lists exactly the ten dev dependencies at the pinned versions (server-and-viewer 1.2)", () => {
    expect(pkg.devDependencies).toEqual({
      "@modelcontextprotocol/sdk": "1.32.2",
      "@playwright/test": "1.65.0",
      tsx: "4.23.15",
      typescript: "6.0.3",
      vitest: "4.1.12",
      "fast-check": "4.10.2",
      eslint: "10.14.0",
      "typescript-eslint": "8.72.2",
      prettier: "3.9.10",
      "@types/node": "20.19.43",
    });
  });

  it("lists exactly the SDK and zod as the runtime dependencies (ai-editor 1.1), and no optional or peer field", () => {
    expect(pkg.dependencies).toEqual({ "@anthropic-ai/sdk": "1.8.0", zod: "4.6.7" });
    expect(pkg.optionalDependencies).toBeUndefined();
    expect(pkg.peerDependencies).toBeUndefined();
  });

  it("writes every dependency version as an exact x.y.z", () => {
    const versions = [
      ...Object.values(pkg.devDependencies as JsonObject),
      ...Object.values(pkg.dependencies as JsonObject),
    ];
    expect(versions).toHaveLength(12);
    for (const version of versions) {
      expect(typeof version === "string" && EXACT_VERSION.test(version)).toBe(true);
    }
  });

  it("has a package-lock.json with lockfileVersion 3", () => {
    expect(readJson("package-lock.json").lockfileVersion).toBe(3);
  });
});

describe("tsconfig files (requirement 1.6 and 1.7)", () => {
  const tsconfig = readJson("tsconfig.json");
  const build = readJson("tsconfig.build.json");

  it("sets the strict options, module settings and target", () => {
    expect(tsconfig.compilerOptions).toMatchObject({
      strict: true,
      noUncheckedIndexedAccess: true,
      verbatimModuleSyntax: true,
      noEmit: true,
      module: "NodeNext",
      moduleResolution: "NodeNext",
      target: "ES2023",
      lib: ["ES2023"],
      types: ["node"],
    });
  });

  it("includes src, test, scripts, tools, vitest.config.ts and playwright.config.ts", () => {
    expect(tsconfig.include).toEqual([
      "src",
      "test",
      "scripts",
      "tools",
      "vitest.config.ts",
      "playwright.config.ts",
    ]);
  });

  it("builds only src into dist with rootDir src", () => {
    expect(build.extends).toBe("./tsconfig.json");
    expect(build.include).toEqual(["src"]);
    expect(build.compilerOptions).toMatchObject({
      noEmit: false,
      rootDir: "src",
      outDir: "dist",
    });
  });
});

describe("public/tsconfig.json (server-and-viewer 12.1, design 'Client script')", () => {
  it("checks app.js as strict plain JavaScript with the DOM library and no ambient types", () => {
    const config = readJson("public/tsconfig.json");
    expect(config.compilerOptions).toEqual({
      allowJs: true,
      checkJs: true,
      noEmit: true,
      strict: true,
      noUncheckedIndexedAccess: true,
      target: "ES2023",
      lib: ["ES2023", "DOM", "DOM.Iterable"],
      types: [],
    });
    expect(config.include).toEqual(["app.js"]);
  });
});

describe("vitest.config.ts (requirement 1.10)", () => {
  it("includes unit tests, excludes e2e, and runs in node", () => {
    expect(vitestConfig.test?.include).toEqual(["test/**/*.test.ts"]);
    expect(vitestConfig.test?.exclude).toEqual(["test/e2e/**", "node_modules/**"]);
    expect(vitestConfig.test?.environment).toBe("node");
  });
});

describe("prettier files (requirement 1.9)", () => {
  it("lists the generated, steering, spec and fixture paths in .prettierignore", () => {
    const entries = readText(".prettierignore")
      .split("\n")
      .filter((line) => line.length > 0);
    expect(entries).toEqual([
      "dist/",
      "coverage/",
      "package-lock.json",
      ".kiro/",
      "docs/",
      "test/fixtures/",
      "src/sources/snapshot/",
      "public/fonts/",
    ]);
  });

  it("sets only printWidth 100 in .prettierrc.json", () => {
    expect(readJson(".prettierrc.json")).toEqual({ printWidth: 100 });
  });
});

describe(".editorconfig (requirement 1.11)", () => {
  // Returns each section header mapped to its key/value lines, ignoring comments.
  function parseSections(text: string): Map<string, Map<string, string>> {
    const sections = new Map<string, Map<string, string>>();
    let current = new Map<string, string>();
    sections.set("", current);
    for (const raw of text.split("\n")) {
      const line = raw.trim();
      if (line === "" || line.startsWith("#")) continue;
      const header = /^\[(.+)\]$/.exec(line);
      if (header?.[1] !== undefined) {
        current = new Map<string, string>();
        sections.set(header[1], current);
        continue;
      }
      const eq = line.indexOf("=");
      current.set(line.slice(0, eq).trim(), line.slice(eq + 1).trim());
    }
    return sections;
  }

  const sections = parseSections(readText(".editorconfig"));

  it("sets root = true", () => {
    expect(sections.get("")?.get("root")).toBe("true");
  });

  it("sets the shared rules for all files", () => {
    const all = sections.get("*");
    expect(Object.fromEntries(all ?? [])).toEqual({
      charset: "utf-8",
      end_of_line: "lf",
      insert_final_newline: "true",
      indent_style: "space",
      indent_size: "2",
      trim_trailing_whitespace: "true",
    });
  });

  it("keeps trailing spaces for markdown and page files", () => {
    expect(sections.get("*.{md,page}")?.get("trim_trailing_whitespace")).toBe("false");
  });
});
