// The files the runtime stage of the Dockerfile copies (server-and-viewer requirement 16.4), as
// token arrays. `runtime-check.ts` copies exactly these, and a test fails unless the Dockerfile's
// runtime-stage COPY lines are exactly this list, in this order.

export const RUNTIME_COPIES: readonly (readonly string[])[] = [
  ["package.json", "package-lock.json", "./"],
  ["--from=build", "/app/dist", "./dist"],
  ["public", "./public"],
  ["pages", "./pages"],
  ["src/sources/snapshot", "./src/sources/snapshot"],
];

/** The tokens of each `COPY` line after the second `FROM` of a Dockerfile. */
export function parseRuntimeCopies(dockerfile: string): string[][] {
  const lines = dockerfile.split("\n");
  const froms = lines.flatMap((line, i) => (/^FROM\s/.test(line) ? [i] : []));
  const second = froms[1];
  if (second === undefined) return [];
  return lines
    .slice(second + 1)
    .filter((line) => /^COPY\s/.test(line))
    .map((line) => line.trim().split(/\s+/).slice(1));
}
