import { z } from "zod";
import type { EditorSettings } from "../editor/editor-types.js";
import type { NonEmpty } from "../grid/types.js";

// Configuration (server-and-viewer requirement 2): every variable is read here, once, and
// checked with zod. This is the only file in `src` that reads `process.env` (requirement 1.3).

/** The environment as `loadConfig` reads it. */
export type Env = Readonly<Record<string, string | undefined>>;

export interface Config extends EditorSettings {
  readonly port: number;
  readonly refresh: "on" | "off";
  /** An `https://` origin with no path, or `null`. */
  readonly publicOrigin: string | null;
  /** The first edition after boot waits until the process has been up this long (requirement 6.6). */
  readonly editorBootDelayMs: number;
  /** Editions that may call the model start at least this far apart (requirement 6.6). */
  readonly editorMinIntervalMs: number;
}

export type ConfigResult =
  | { readonly ok: true; readonly config: Config }
  | { readonly ok: false; readonly problems: NonEmpty<string> };

/** Each variable's name and default, in the order of requirements 2.2 and 2.5. */
export const ENV_VARIABLES: readonly { readonly name: string; readonly default: string }[] =
  Object.freeze(
    [
      { name: "PORT", default: "3000" },
      { name: "ANTHROPIC_API_KEY", default: "" },
      { name: "EDITOR_MODEL", default: "claude-opus-5-5" },
      { name: "MAX_MODEL_CALLS_PER_DAY", default: "60" },
      { name: "EDITOR_MAX_CALLS_PER_BOOT", default: "30" },
      { name: "EDITOR_BOOT_DELAY_MS", default: "600000" },
      { name: "EDITOR_MIN_INTERVAL_MS", default: "10800000" },
      { name: "EDITOR_CLIENT", default: "anthropic" },
      { name: "REFRESH", default: "on" },
      { name: "PUBLIC_ORIGIN", default: "" },
    ].map((variable) => Object.freeze(variable)),
  );

/** The problem sentence of each variable (requirement 2.3). No sentence holds a value. */
const RULE: Readonly<Record<string, string>> = Object.freeze({
  PORT: "PORT must be an integer from 1 to 65535",
  ANTHROPIC_API_KEY: "ANTHROPIC_API_KEY must be text",
  EDITOR_MODEL: "EDITOR_MODEL must be a model id of letters, digits and . _ : / - (up to 100)",
  MAX_MODEL_CALLS_PER_DAY: "MAX_MODEL_CALLS_PER_DAY must be an integer from 0 to 10000",
  EDITOR_MAX_CALLS_PER_BOOT: "EDITOR_MAX_CALLS_PER_BOOT must be an integer from 0 to 10000",
  EDITOR_BOOT_DELAY_MS: "EDITOR_BOOT_DELAY_MS must be an integer from 0 to 86400000",
  EDITOR_MIN_INTERVAL_MS: "EDITOR_MIN_INTERVAL_MS must be an integer from 0 to 604800000",
  EDITOR_CLIENT: "EDITOR_CLIENT must be anthropic, fixtures or off",
  REFRESH: "REFRESH must be on or off",
  PUBLIC_ORIGIN: "PUBLIC_ORIGIN must be an https origin with no path, query or fragment",
});

/** Whole decimal digits only, then a range check. */
function integer(min: number, max: number) {
  return z
    .string()
    .regex(/^[0-9]{1,12}$/)
    .transform(Number)
    .pipe(z.number().int().min(min).max(max));
}

function isHttpsOrigin(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.origin === value;
  } catch {
    return false;
  }
}

const EnvSchema = z.object({
  PORT: integer(1, 65535),
  ANTHROPIC_API_KEY: z.string(),
  EDITOR_MODEL: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,99}$/),
  MAX_MODEL_CALLS_PER_DAY: integer(0, 10_000),
  EDITOR_MAX_CALLS_PER_BOOT: integer(0, 10_000),
  EDITOR_BOOT_DELAY_MS: integer(0, 86_400_000),
  EDITOR_MIN_INTERVAL_MS: integer(0, 604_800_000),
  EDITOR_CLIENT: z.enum(["anthropic", "fixtures", "off"]),
  REFRESH: z.enum(["on", "off"]),
  PUBLIC_ORIGIN: z.string().refine((value) => value === "" || isHttpsOrigin(value)),
});

/** The text of a variable, or its default when it is unset or empty. */
function valueOf(env: Env, name: string, fallback: string): unknown {
  const value = env[name];
  return typeof value === "string" && value !== "" ? value : fallback;
}

/**
 * Reads and checks the environment (requirement 2.1). Returns the config, or one problem per
 * invalid variable in `ENV_VARIABLES` order. Never throws.
 */
export function loadConfig(env: Env = process.env): ConfigResult {
  try {
    const raw: Record<string, unknown> = {};
    for (const variable of ENV_VARIABLES) {
      raw[variable.name] = valueOf(env, variable.name, variable.default);
    }
    const parsed = EnvSchema.safeParse(raw);
    if (!parsed.success) {
      const bad = new Set(parsed.error.issues.map((issue) => String(issue.path[0])));
      const problems = ENV_VARIABLES.filter((v) => bad.has(v.name)).map(
        (v) => RULE[v.name] ?? `${v.name} is not valid`,
      );
      const [first, ...rest] = problems;
      return {
        ok: false,
        problems: [first ?? "the environment is not valid", ...rest],
      };
    }
    const e = parsed.data;
    return {
      ok: true,
      config: {
        port: e.PORT,
        anthropicApiKey: e.ANTHROPIC_API_KEY === "" ? null : e.ANTHROPIC_API_KEY,
        editorModel: e.EDITOR_MODEL,
        maxModelCallsPerDay: e.MAX_MODEL_CALLS_PER_DAY,
        editorMaxCallsPerBoot: e.EDITOR_MAX_CALLS_PER_BOOT,
        editorBootDelayMs: e.EDITOR_BOOT_DELAY_MS,
        editorMinIntervalMs: e.EDITOR_MIN_INTERVAL_MS,
        editorClient: e.EDITOR_CLIENT,
        refresh: e.REFRESH,
        publicOrigin: e.PUBLIC_ORIGIN === "" ? null : e.PUBLIC_ORIGIN,
      },
    };
  } catch {
    return { ok: false, problems: ["the environment could not be read"] };
  }
}
