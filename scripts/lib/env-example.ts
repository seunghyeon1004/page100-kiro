import { ENV_VARIABLES } from "../../src/server/config.js";

// The text of `.env.example` (server-and-viewer requirement 16.3): one comment and one
// `NAME=default` line per variable of `ENV_VARIABLES`, in order. Names, comments and defaults
// only: the key is empty. A test fails unless the file equals this text.

const COMMENTS: Readonly<Record<string, string>> = {
  PORT: "HTTP port. A host such as Render may set it itself.",
  ANTHROPIC_API_KEY: "AI editor key. Empty: the rule-based compiler publishes every page.",
  EDITOR_MODEL: "Model id for the AI editor.",
  MAX_MODEL_CALLS_PER_DAY: "Hard cap on model calls per UTC day, per process (0 to 10000).",
  EDITOR_MAX_CALLS_PER_BOOT: "Hard cap on model calls per process start (0 to 10000).",
  EDITOR_BOOT_DELAY_MS:
    "Milliseconds the process must be up before the first edition may call the model.",
  EDITOR_MIN_INTERVAL_MS: "Minimum milliseconds between the starts of two editions.",
  EDITOR_CLIENT: "anthropic, fixtures or off. Without a key, anthropic means no AI editor.",
  REFRESH: "on fetches the sources on their schedule; off serves the boot snapshot only.",
  PUBLIC_ORIGIN: "Public https origin with no path, sent in the User-Agent. Empty: not sent.",
};

export function envExampleText(): string {
  return ENV_VARIABLES.map((variable) => {
    const comment = COMMENTS[variable.name];
    if (comment === undefined) throw new Error(`no comment for ${variable.name}`);
    return `# ${comment}\n${variable.name}=${variable.default}\n`;
  }).join("\n");
}
