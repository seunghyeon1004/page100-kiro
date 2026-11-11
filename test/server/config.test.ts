import { describe, expect, it } from "vitest";
import { ENV_VARIABLES, loadConfig } from "../../src/server/config.js";

// server-and-viewer requirement 2: defaults, each invalid variable, no value in a problem.

function problemsOf(env: Record<string, string | undefined>): readonly string[] {
  const result = loadConfig(env);
  if (result.ok) throw new Error("expected problems");
  return result.problems;
}

describe("loadConfig (requirements 2.1, 2.2, 2.5)", () => {
  it("gives the defaults for an empty environment", () => {
    expect(loadConfig({})).toEqual({
      ok: true,
      config: {
        port: 3000,
        anthropicApiKey: null,
        editorModel: "claude-opus-5-5",
        maxModelCallsPerDay: 60,
        editorMaxCallsPerBoot: 30,
        editorBootDelayMs: 600_000,
        editorMinIntervalMs: 10_800_000,
        editorClient: "anthropic",
        refresh: "on",
        publicOrigin: null,
      },
    });
  });

  it("counts an empty string as unset", () => {
    const empty = Object.fromEntries(ENV_VARIABLES.map((v) => [v.name, ""]));
    expect(loadConfig(empty)).toEqual(loadConfig({}));
  });

  it("reads every variable", () => {
    const result = loadConfig({
      PORT: "8080",
      ANTHROPIC_API_KEY: "sk-test-not-a-key",
      EDITOR_MODEL: "some-model_1.5:x/y",
      MAX_MODEL_CALLS_PER_DAY: "0",
      EDITOR_MAX_CALLS_PER_BOOT: "10000",
      EDITOR_BOOT_DELAY_MS: "0",
      EDITOR_MIN_INTERVAL_MS: "604800000",
      EDITOR_CLIENT: "fixtures",
      REFRESH: "off",
      PUBLIC_ORIGIN: "https://page100.example.org",
    });
    expect(result).toEqual({
      ok: true,
      config: {
        port: 8080,
        anthropicApiKey: "sk-test-not-a-key",
        editorModel: "some-model_1.5:x/y",
        maxModelCallsPerDay: 0,
        editorMaxCallsPerBoot: 10_000,
        editorBootDelayMs: 0,
        editorMinIntervalMs: 604_800_000,
        editorClient: "fixtures",
        refresh: "off",
        publicOrigin: "https://page100.example.org",
      },
    });
  });

  it("lists the ten variables in the order of requirements 2.2 and 2.5, with their defaults", () => {
    expect(ENV_VARIABLES.map((v) => `${v.name}=${v.default}`)).toEqual([
      "PORT=3000",
      "ANTHROPIC_API_KEY=",
      "EDITOR_MODEL=claude-opus-5-5",
      "MAX_MODEL_CALLS_PER_DAY=60",
      "EDITOR_MAX_CALLS_PER_BOOT=30",
      "EDITOR_BOOT_DELAY_MS=600000",
      "EDITOR_MIN_INTERVAL_MS=10800000",
      "EDITOR_CLIENT=anthropic",
      "REFRESH=on",
      "PUBLIC_ORIGIN=",
    ]);
  });

  it("does not read process.env when an environment is given", () => {
    expect(loadConfig({ PORT: "4000" })).toMatchObject({ ok: true, config: { port: 4000 } });
  });
});

describe("loadConfig problems (requirement 2.3)", () => {
  const cases: readonly [string, string, string][] = [
    ["PORT", "0", "PORT must be an integer from 1 to 65535"],
    ["PORT", "65536", "PORT must be an integer from 1 to 65535"],
    ["PORT", "80a", "PORT must be an integer from 1 to 65535"],
    ["PORT", "-1", "PORT must be an integer from 1 to 65535"],
    ["PORT", "3000.5", "PORT must be an integer from 1 to 65535"],
    [
      "MAX_MODEL_CALLS_PER_DAY",
      "10001",
      "MAX_MODEL_CALLS_PER_DAY must be an integer from 0 to 10000",
    ],
    [
      "EDITOR_MAX_CALLS_PER_BOOT",
      "x",
      "EDITOR_MAX_CALLS_PER_BOOT must be an integer from 0 to 10000",
    ],
    [
      "EDITOR_BOOT_DELAY_MS",
      "86400001",
      "EDITOR_BOOT_DELAY_MS must be an integer from 0 to 86400000",
    ],
    [
      "EDITOR_MIN_INTERVAL_MS",
      "604800001",
      "EDITOR_MIN_INTERVAL_MS must be an integer from 0 to 604800000",
    ],
    ["EDITOR_CLIENT", "auto", "EDITOR_CLIENT must be anthropic, fixtures or off"],
    ["REFRESH", "yes", "REFRESH must be on or off"],
    [
      "PUBLIC_ORIGIN",
      "http://page100.example.org",
      "PUBLIC_ORIGIN must be an https origin with no path, query or fragment",
    ],
    [
      "PUBLIC_ORIGIN",
      "https://page100.example.org/801",
      "PUBLIC_ORIGIN must be an https origin with no path, query or fragment",
    ],
    [
      "PUBLIC_ORIGIN",
      "https://page100.example.org/",
      "PUBLIC_ORIGIN must be an https origin with no path, query or fragment",
    ],
    [
      "PUBLIC_ORIGIN",
      "not a url",
      "PUBLIC_ORIGIN must be an https origin with no path, query or fragment",
    ],
    [
      "EDITOR_MODEL",
      "bad model!",
      "EDITOR_MODEL must be a model id of letters, digits and . _ : / - (up to 100)",
    ],
  ];

  for (const [name, value, sentence] of cases) {
    it(`rejects ${name}=${value}`, () => {
      expect(problemsOf({ [name]: value })).toEqual([sentence]);
    });
  }

  it("gives one problem per invalid variable, in variable order, and no value", () => {
    const problems = problemsOf({
      REFRESH: "secret-refresh",
      PORT: "secret-port",
      EDITOR_CLIENT: "secret-client",
    });
    expect(problems).toEqual([
      "PORT must be an integer from 1 to 65535",
      "EDITOR_CLIENT must be anthropic, fixtures or off",
      "REFRESH must be on or off",
    ]);
    for (const problem of problems) expect(problem).not.toContain("secret");
  });

  it("never puts the API key in a problem", () => {
    const problems = problemsOf({ ANTHROPIC_API_KEY: "sk-test-not-a-key", PORT: "0" });
    for (const problem of problems) expect(problem).not.toContain("sk-test-not-a-key");
  });
});
