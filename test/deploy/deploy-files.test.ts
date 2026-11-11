import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { envExampleText } from "../../scripts/lib/env-example.js";
import { RUNTIME_COPIES, parseRuntimeCopies } from "../../scripts/lib/runtime-copies.js";
import { ENV_VARIABLES } from "../../src/server/config.js";

// server-and-viewer 16.1 to 16.4, from the text of the deploy files (no YAML library).

const ROOT = resolve(import.meta.dirname, "..", "..");
const read = (name: string): string => readFileSync(resolve(ROOT, name), "utf8");

describe("Dockerfile (16.1)", () => {
  const dockerfile = read("Dockerfile");

  it("has a build stage and a runtime stage on node:22-slim", () => {
    expect(dockerfile.match(/^FROM .*/gm)).toEqual([
      "FROM node:22-slim AS build",
      "FROM node:22-slim",
    ]);
  });

  it("has the health check on /api/health and the start command", () => {
    expect(dockerfile).toMatch(/^HEALTHCHECK .*\/api\/health/m);
    expect(dockerfile.trimEnd().split("\n").at(-1)).toBe('CMD ["node","dist/server/main.js"]');
    expect(dockerfile).toContain("USER node");
  });

  it("copies in the runtime stage exactly RUNTIME_COPIES, in order (16.4)", () => {
    expect(parseRuntimeCopies(dockerfile)).toEqual(RUNTIME_COPIES.map((copy) => [...copy]));
  });
});

describe(".dockerignore (16.2)", () => {
  it.each(["node_modules", "dist", ".git", ".env", ".env.*", "test", "docs", ".kiro"])(
    "excludes %s",
    (entry) => {
      expect(read(".dockerignore").split("\n")).toContain(entry);
    },
  );
});

describe("render.yaml (16.3)", () => {
  const yaml = read("render.yaml");

  it("defines one free docker web service with the health check", () => {
    expect(yaml.match(/^\s*- type:/gm)).toHaveLength(1);
    for (const line of [
      "type: web",
      "runtime: docker",
      "plan: free",
      "healthCheckPath: /api/health",
    ]) {
      expect(yaml).toContain(line);
    }
  });

  it("lists every variable in order; the key and the origin are not synced, the rest hold their default", () => {
    const keys = [...yaml.matchAll(/- key: (\w+)\n\s+(sync: false|value: .*)/g)];
    expect(keys.map((m) => m[1])).toEqual(ENV_VARIABLES.map((v) => v.name));
    for (const [, key, rest] of keys) {
      const variable = ENV_VARIABLES.find((v) => v.name === key);
      if (key === "ANTHROPIC_API_KEY" || key === "PUBLIC_ORIGIN") {
        expect(rest).toBe("sync: false");
      } else {
        expect(rest?.replaceAll('"', "")).toBe(`value: ${variable?.default ?? "?"}`);
      }
    }
  });
});

describe(".env.example (16.3)", () => {
  it("equals the text scripts/env-example.ts prints", () => {
    expect(read(".env.example")).toBe(envExampleText());
  });

  it("has one NAME=default line per variable, in order, and an empty key", () => {
    const lines = read(".env.example")
      .split("\n")
      .filter((line) => /^[A-Z_]+=/.test(line));
    expect(lines).toEqual(ENV_VARIABLES.map((v) => `${v.name}=${v.default}`));
    expect(lines).toContain("ANTHROPIC_API_KEY=");
  });
});
