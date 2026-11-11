import type { z } from "zod";
import type { HttpFailure } from "./http.js";
import type { SourceId } from "./source-id.js";

/** An array with at least one element. `src/sources` cannot import grid-core's `NonEmpty`, so this is its own copy. */
export type NonEmpty<T> = readonly [T, ...T[]];

/** What `parseX` gives back: the normalised value, or the zod issue paths (never any part of the body). */
export type ParseOutcome<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly issuePaths: NonEmpty<string> };

export type SourceFailure =
  HttpFailure | { readonly kind: "schema"; readonly issuePaths: NonEmpty<string> };

/** What `fetchX` gives back (requirement 12.1). */
export type FetchOutcome<T> =
  | { readonly ok: true; readonly value: T; readonly fetchedAt: string }
  | {
      readonly ok: false;
      readonly source: SourceId;
      readonly url: string;
      readonly failure: SourceFailure;
    };

/** The distinct issue paths of a zod error, each joined with `.`; the root is `(root)`. */
export function issuePathsOf(error: z.ZodError): NonEmpty<string> {
  const paths: string[] = [];
  for (const issue of error.issues) {
    const path = issue.path.length === 0 ? "(root)" : issue.path.map(String).join(".");
    if (!paths.includes(path)) paths.push(path);
  }
  const [first, ...rest] = paths;
  return first === undefined ? ["(root)"] : [first, ...rest];
}

/** Runs `schema.safeParse` on a body and maps the result to a `ParseOutcome` (requirement 12.2). */
export function parseWith<T>(schema: z.ZodType<T>, body: unknown): ParseOutcome<T> {
  const result = schema.safeParse(body);
  return result.success
    ? { ok: true, value: result.data }
    : { ok: false, issuePaths: issuePathsOf(result.error) };
}
