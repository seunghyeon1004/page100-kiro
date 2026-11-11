import fc from "fast-check";
import { NUMBER_WORDS } from "../../src/compilers/fit-text.js";
import type {
  DraftFailureReason,
  DraftRequest,
  RequestSlot,
} from "../../src/editor/editor-types.js";
import { echoRules } from "./scripted-client.js";
import type { Step } from "./scripted-client.js";

// Arbitraries for the editor properties (ai-editor design.md, "Correctness properties"). Requests
// built from generated snapshots are added with the tasks that need them.

const LETTERS = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";

const letterWord = fc
  .array(fc.constantFrom(...Array.from(LETTERS)), { minLength: 1, maxLength: 9 })
  .map((cs) => cs.join(""));

const numberToken = fc.oneof(
  fc.integer({ min: 0, max: 99_999 }).map(String),
  fc
    .tuple(fc.integer({ min: 1, max: 999 }), fc.integer({ min: 0, max: 999 }))
    .map(([a, b]) => `${String(a)},${String(b).padStart(3, "0")}`),
  fc
    .tuple(fc.integer({ min: 0, max: 99 }), fc.integer({ min: 0, max: 99 }))
    .map(([a, b]) => `${String(a)}.${String(b)}`),
);

/** A whitespace-free word of an input text: letters, a digit token, a number word, or punctuation attached. */
export const inputWord: fc.Arbitrary<string> = fc.oneof(
  { weight: 6, arbitrary: letterWord },
  { weight: 2, arbitrary: numberToken },
  { weight: 2, arbitrary: fc.constantFrom(...NUMBER_WORDS) },
  { weight: 1, arbitrary: letterWord.map((w) => `${w}.`) },
  { weight: 1, arbitrary: letterWord.map((w) => w.toUpperCase()) },
  { weight: 1, arbitrary: letterWord.map((w) => `${w[0]?.toUpperCase() ?? ""}${w.slice(1)}`) },
);

/** The slot texts of one page: 1 to 4 texts of 1 to 30 words. */
export const inputTexts: fc.Arbitrary<string[]> = fc.array(
  fc.array(inputWord, { minLength: 1, maxLength: 30 }).map((ws) => ws.join(" ")),
  { minLength: 1, maxLength: 4 },
);

// Requests of arbitrary slots, for the prompt tests.

const hostileChars = [
  ...Array.from("abc XYZ019.,;:!?'-"),
  "<",
  ">",
  '"',
  "\\",
  "\n",
  "\t",
  "</source_data>",
  "</previous_draft>",
  "<source_data>",
  "<previous_draft>",
  "\u2028",
  "\u{1f600}",
];

/** Text that tries to break out of a delimited block. */
export const hostileText: fc.Arbitrary<string> = fc
  .array(fc.constantFrom(...hostileChars), { maxLength: 30 })
  .map((cs) => cs.join(""));

const slotArb: fc.Arbitrary<RequestSlot> = fc.record({
  id: fc.stringMatching(/^[a-z]+-[0-9]$/),
  mode: fc.constantFrom("headline" as const, "body" as const),
  maxRows: fc.integer({ min: 1, max: 12 }),
  width: fc.integer({ min: 10, max: 38 }),
  optional: fc.boolean(),
  text: hostileText,
});

/** A request of 1 to 8 slots; attempts 1 and 2 carry the previous rows and violations. */
export const requestArb: fc.Arbitrary<DraftRequest> = fc
  .record({
    page: fc.integer({ min: 100, max: 899 }),
    totalRows: fc.integer({ min: 1, max: 20 }),
    slots: fc.array(slotArb, { minLength: 1, maxLength: 8 }),
    attempt: fc.constantFrom(0 as const, 1 as const, 2 as const),
    rows: fc.array(hostileText, { maxLength: 20 }),
    violations: fc.array(hostileText, { minLength: 1, maxLength: 30 }),
  })
  .map(({ page, totalRows, slots, attempt, rows, violations }) => {
    const [first, ...rest] = violations;
    return {
      page,
      totalRows,
      slots,
      inputKey: "0".repeat(64),
      attempt,
      previous:
        attempt === 0 || first === undefined ? null : { rows, violations: [first, ...rest] },
    };
  });

// Requests and replies for the draft-check property: slot texts of plain words, replies that are
// mostly drawn from those words (so that many succeed) and then mutated.

export interface DraftCase {
  readonly request: DraftRequest;
  readonly reply: string[];
}

const MUTATIONS = [
  "x".repeat(60),
  "Rates rise 41 percent",
  "Twelve rescued",
  "Hello {tag}",
  "Fire \u{1f600}",
  "Great news!",
  "Why?",
  " leading space",
  "double  space",
  "Hargreaves speaks",
  "\u2026",
  "  ",
];

const plainSlot: fc.Arbitrary<RequestSlot> = fc
  .record({
    n: fc.integer({ min: 1, max: 9 }),
    mode: fc.constantFrom("headline" as const, "body" as const),
    maxRows: fc.integer({ min: 1, max: 4 }),
    width: fc.integer({ min: 20, max: 38 }),
    optional: fc.boolean(),
    words: fc.array(inputWord, { minLength: 1, maxLength: 20 }),
  })
  .map(({ n, mode, maxRows, width, optional, words }) => ({
    id: `slot-${String(n)}`,
    mode,
    maxRows,
    width,
    optional,
    text: words.join(" "),
  }));

export const draftCaseArb: fc.Arbitrary<DraftCase> = fc
  .record({
    slots: fc.array(plainSlot, { minLength: 1, maxLength: 4 }),
    totalRows: fc.integer({ min: 1, max: 10 }),
    plans: fc.array(
      fc.array(fc.array(fc.nat(), { minLength: 1, maxLength: 3 }), { maxLength: 5 }),
      { minLength: 4, maxLength: 4 },
    ),
    mutation: fc.oneof(
      { weight: 5, arbitrary: fc.constant(null) },
      { weight: 2, arbitrary: fc.constantFrom(...MUTATIONS) },
      { weight: 1, arbitrary: fc.string({ maxLength: 12 }) },
    ),
    at: fc.nat(),
    dropGroup: fc.boolean(),
  })
  .map(({ slots, totalRows, plans, mutation, at, dropGroup }) => {
    const groups: string[][] = slots.map((slot, s) => {
      const words = slot.text.split(" ");
      return (plans[s] ?? []).map((indexes) =>
        indexes.map((i) => words[i % words.length] ?? "").join(" "),
      );
    });
    const reply: string[] = [];
    groups.forEach((rows, s) => {
      if (s > 0) reply.push("");
      reply.push(...rows);
    });
    if (mutation !== null) reply.splice(at % (reply.length + 1), 0, mutation);
    if (dropGroup && reply.length > 0) reply.pop();
    return {
      request: {
        page: 111,
        totalRows,
        slots,
        inputKey: "0".repeat(64),
        attempt: 0 as const,
        previous: null,
      },
      reply,
    };
  });

// Scripted client steps: good and bad replies, each failure reason, throws and rejections.

const REASONS: DraftFailureReason[] = [
  "refusal",
  "max-tokens",
  "malformed",
  "rate-limited",
  "auth",
  "status",
  "timeout",
  "connection",
  "unknown",
  "no-fixture",
];

const requests = fc.integer({ min: 0, max: 2 });

export function stepArb(): fc.Arbitrary<Step> {
  return fc.oneof(
    {
      weight: 3,
      arbitrary: requests.map((n): Step => ({ kind: "from", make: echoRules, requests: n })),
    },
    {
      weight: 2,
      arbitrary: requests.map((n): Step => ({
        kind: "from",
        make: (r) => ["Floods hit 987654 towns", ...echoRules(r).slice(1)],
        requests: n,
      })),
    },
    { weight: 1, arbitrary: fc.constant<Step>({ kind: "rows", rows: ["x"] }) },
    { weight: 1, arbitrary: fc.constant<Step>({ kind: "rows", rows: [] }) },
    {
      weight: 1,
      arbitrary: fc
        .array(fc.string({ maxLength: 20 }), { maxLength: 6 })
        .map((rows): Step => ({ kind: "rows", rows })),
    },
    {
      weight: 3,
      arbitrary: fc
        .tuple(
          fc.constantFrom(...REASONS),
          fc.option(fc.integer({ min: 400, max: 599 }), { nil: null }),
          requests,
        )
        .map(([reason, status, n]): Step => ({ kind: "fail", reason, status, requests: n })),
    },
    { weight: 1, arbitrary: fc.constant<Step>({ kind: "throw" }) },
    { weight: 1, arbitrary: fc.constant<Step>({ kind: "reject" }) },
  );
}
