# ai-editor: tasks

Requirements: `requirements.md`. Design: `design.md`. A task is ticked only after its `Verify` command has run in the session and passed, with the command and its quoted result after the tick (`tech.md`, rule 5). Kiro suggests the commit message; the user stages and commits.

Preconditions: rule-compilers is implemented (seam functions, `NUMBER_WORDS`, `compile-arbitraries.ts`, `compileAll`); where its real names differ from this spec's first design, the code won and `design.md` says so. No task reads a `.env` or secrets file, no task runs the recording script, and no task uses the network except task 1 (npm only). Owner answers of 2026-11-11 are in `requirements.md`: task 4 is removed, task 7 adds the name check, task 14 stays the owner's.

- [x] 1. Install `@anthropic-ai/sdk` with the exact command in the design ("Toolchain"), once the owner says go (npm network use only). Update `test/scaffold.test.ts` to the new exact `dependencies` list.
  - Requirements: 1.1. Verify: `npm ls --depth=0` lists `@anthropic-ai/sdk@1.8.0` and `zod@4.6.7` with no `UNMET` or `invalid` line, and `npm test -- test/scaffold.test.ts` passes
  - Commit: `deps: @anthropic-ai/sdk 1.8.0`
  - Done: `npm install --save-exact @anthropic-ai/sdk@1.8.0`; `npm ls --depth=0` listed `@anthropic-ai/sdk@1.8.0` and `zod@4.6.7` and `npm ls --depth=0 | grep -ci "unmet\|invalid"` printed 0; `npm test -- test/scaffold.test.ts` gave "Test Files  1 passed (1) / Tests  15 passed (15)".

- [x] 2. Helper check, no code: read `node_modules/@anthropic-ai/sdk/helpers/zod.d.mts`, the declarations it imports, `ClientOptions` and the error classes. Record in this task's Done line the zod entry point, the presence of `logLevel`, `fetch`, `timeout`, `maxRetries` and `output_config.effort`, the class hierarchy of requirement 5.2, and the path chosen (A or B). If the error classes differ, stop and ask.
  - Requirements: 4.2, 4.4, 5.2. Verify: quote the `import` lines of `helpers/zod.d.mts` and the matching `ClientOptions` lines, found with the grep tool
  - Commit: none (the finding goes into task 10)
  - Done: `helpers/zod.d.mts` starts with `import * as z from 'zod/v4';` and `import { AutoParseableOutputFormat } from "../lib/parser.mjs";`; `zodOutputFormat<ZodInput extends z.ZodType>(zodObject: ZodInput)`. `ClientOptions` (`client.d.mts`) has `timeout?` (108), `fetch?: Fetch` (119), `maxRetries?` (137), `logLevel?` (183) and `logger?` (190); `OutputConfig` has `effort?: 'low' | 'medium' | 'high' | 'xhigh' | 'max' | null` (`messages.d.mts` 3918); `messages.parse` exists (221). `core/error.d.mts`: `APIError extends AnthropicError`; `APIConnectionError`, `AuthenticationError`, `PermissionDeniedError`, `RateLimitError` extend `APIError`; `APIConnectionTimeoutError extends APIConnectionError`; this matches requirement 5.2. **Path A**: a scratch file that called `client.messages.parse` with `format: zodOutputFormat(DraftReply)` for `DraftReply` built with `import { z } from "zod"` passed `npx tsc --noEmit` with no output (the scratch file was deleted). Note: the SDK declaration says an `apiKey` is sent as `Authorization: Bearer`; Property 6 checks the header the SDK really sets.

- [x] 3. Boundaries: extend `test/boundaries.test.ts` with 1.2 to 1.4. It passes with `src/editor` empty.
  - Requirements: 1.2, 1.3, 1.4. Verify: `npm test -- test/boundaries.test.ts && npm run lint`
  - Commit: `test: editor module boundaries`
  - Done: `npm test -- test/boundaries.test.ts && npm run lint` gave "Test Files  1 passed (1) / Tests  20 passed (20)" and "All matched files use Prettier code style!" (eslint printed no error).

- ~~4. Config: `src/server/config.ts`, `test/server/config.test.ts`.~~ Removed (owner answer 2): `src/editor` takes `EditorSettings` as an argument and the server spec reads the environment. `EditorSettings` is written in task 5 (requirement 2.4).

- [x] 5. Types (with `EditorSettings`) and numeric fidelity: `editor-types.ts`, `numeric-fidelity.ts`, `numeric-fidelity.test.ts`, `numeric-fidelity.property.test.ts` (Property 4), `test/editor/editor-arbitraries.ts`.
  - Requirements: 2.4, 2.5, 3.1, 3.2, 3.3, 8.1, 8.2, 8.3. Verify: `npm test -- test/editor/numeric-fidelity`, including `Property 4:`
  - Commit: `editor: types and numeric fidelity check`
  - Done: `npm test -- test/editor/numeric-fidelity` gave "Test Files  2 passed (2) / Tests  11 passed (11)", including `Property 4:`; `npm run typecheck` and `npm run lint` clean. `EditorDeps` moved to `edit-page.ts` (task 9) because it names `CallBudget` and `DraftCache`, which do not exist until task 8; `design.md` file table updated.

- [x] 6. Prompt: `system-prompt.ts`, `user-message.ts`, `system-prompt.test.ts`, `user-message.property.test.ts` (Property 7).
  - Requirements: 6.1, 6.2, 6.3, 6.4. Verify: `npm test -- test/editor/system-prompt test/editor/user-message`, including `Property 7:`
  - Commit: `editor: system prompt and delimited user message`
  - Done: `npm test -- test/editor/system-prompt test/editor/user-message` gave "Test Files  3 passed (3) / Tests  12 passed (12)", including `Property 7:`; typecheck and lint clean. The prompt gained one sentence, "Write a capitalised name only if it appears in the source text", for the name check; `userMessage` also escapes `<` and flattens whitespace in violation lines, so each tag occurs once in the whole message.

- [x] 7. Draft checks: `check-editor-draft.ts`, `name-check.ts`, `check-editor-draft.test.ts` (every sentence in the design table), `name-check.test.ts`, `check-editor-draft.property.test.ts` (Property 1).
  - Requirements: 7.1 to 7.10. Verify: `npm test -- test/editor/check-editor-draft test/editor/name-check`, including `Property 1:`
  - Commit: `editor: draft checks with exact violations`
  - Done: `npm test -- test/editor/check-editor-draft test/editor/name-check` gave "Test Files  3 passed (3) / Tests  29 passed (29)", including `Property 1:`; typecheck and lint clean. The test run showed my first draft of the design text was wrong about case: the name comparison is case-insensitive, so a lower-case source word lets the capitalised form pass; `design.md` now says so. `checkEditorDraft` takes `unknown` rows and reports `reply was not a list of rows` (one extra sentence, so it is total).

- [x] 8. Budget and cache: `call-budget.ts`, `draft-cache.ts`, `call-budget.test.ts`, `draft-cache.test.ts`.
  - Requirements: 10.1, 10.2, 10.3, 11.1, 11.4. Verify: `npm test -- test/editor/call-budget test/editor/draft-cache`
  - Commit: `editor: call budget and draft cache`
  - Done: `npm test -- test/editor/call-budget test/editor/draft-cache` gave "Test Files  2 passed (2) / Tests  17 passed (17)"; typecheck and lint clean. The cache API is by input, not by key: `get(input)`, `set(input, value)`, `drop(input)`, `endEdition()` (the cache records which keys the edition used); `design.md` updated.

- [x] 9. editPage: `ai-pages.ts`, `publish-page.ts`, `edit-page.ts`, `test/editor/scripted-client.ts`, `edit-page.test.ts`, `edit-page.property.test.ts` (Property 2).
  - Requirements: 9.1 to 9.10, 11.2, 11.3. Verify: `npm test -- test/editor/edit-page`, including `Property 2:`
  - Commit: `editor: editPage with retries and rules fallback`
  - Done: `npm test -- test/editor/edit-page` gave "Test Files  2 passed (2) / Tests  27 passed (27)", including `Property 2:`; typecheck and lint clean. Code differences recorded in `design.md`: `AI_PAGES` entries are `{ number, prepare(snapshot) }` returning `{ input, assemble(rows) }` (so the five data types need no union); `PageJob.publish(rows, editor)`; `editPage(job, deps, now, stopped = false)`; `EditOutcome` has `problems`; `compile-all.ts` now exports `problemsOf`. A refusal counts as one rejected draft; an accepted draft whose page is the no-data page reports editor `rules`.

- [x] 10. Clients: `classify-error.ts`, `anthropic-editor-client.ts` (path from task 2), `editor-fixture.ts`, `fixture-editor-client.ts`, `create-editor-client.ts`, `test/editor/fake-fetch.ts` and their example tests. No cast, `any` or `@ts-expect-error` to fit the SDK types.
  - Requirements: 3.4, 4.1 to 4.5, 5.1 to 5.4, 13.1, 13.2. Verify: `npm test -- test/editor/anthropic-editor-client test/editor/fixture-editor-client test/editor/create-editor-client && npm run typecheck`
  - Commit: `editor: Anthropic and fixture clients`
  - Done: `npm test -- test/editor/anthropic-editor-client test/editor/fixture-editor-client test/editor/create-editor-client && npm run typecheck` gave "Test Files  3 passed (3) / Tests  33 passed (33)" and a clean `tsc --noEmit`; with `test/boundaries.test.ts` added, 4 files and 53 tests passed, and lint is clean. Path A, no cast, `any` or `@ts-expect-error`. Findings recorded in `design.md`: (1) SDK 1.8.0 sends the key as `authorization` (observed in the fake fetch), not `x-api-key`; (2) a cut-off reply with `max_tokens` is `malformed`, because `messages.parse` throws before the stop reason can be read (design.md already accepted this; a complete reply with `max_tokens` is `max-tokens`); (3) a 200 response whose body is not a message throws a `TypeError` in the SDK and is `unknown` by 5.2; (4) `baseURL` is fixed to `https://api.anthropic.com` so an `ANTHROPIC_BASE_URL` in the environment cannot redirect the key; (5) the constructor takes an optional `maxRetries` (production 1) so a test can show the third request is refused unsent. The boundaries test caught the word "process" in a comment in `call-budget.ts`; the comment was reworded, the test unchanged.

- [x] 11. runEdition: `run-edition.ts`, `run-edition.test.ts`, `run-edition.property.test.ts` (Property 8), `call-budget.property.test.ts` (Property 3), `draft-cache.property.test.ts` (Property 5).
  - Requirements: 10.1 to 10.3, 11.1 to 11.4, 12.1 to 12.5. Verify: `npm test -- test/editor/run-edition test/editor/call-budget test/editor/draft-cache`, including `Property 3:`, `Property 5:` and `Property 8:`
  - Commit: `editor: runEdition and page 802 counters`
  - Done: `npm test -- test/editor/run-edition test/editor/call-budget test/editor/draft-cache` gave "Test Files  6 passed (6) / Tests  33 passed (33)", including `Property 3:`, `Property 5:` and `Property 8:`; typecheck and lint clean. Findings: the SDK ignores `retry-after-ms: 0` (a falsy value) and backs off about 0.5 s, so the fake fetch sends `retry-after-ms: 1`; Property 3 takes about 11 s and has a 120 s timeout (a per-test timeout, no check weakened). A failed page cannot be produced by data (300 hostile snapshots all published the rules draft), so 12.3 is tested with a snapshot whose `sources` getter throws; the rules-does-not-publish path of `editPage` is tested in task 9 with a stub `publish`. `EditorStatus.fallbackPages` is the list of the last edition, while `accepted` and `rejected` accumulate within the UTC day.

- [x] 12. Secrets: `secrets.property.test.ts` (Property 6) over every failure path and the log.
  - Requirements: 5.3, 15.1, 15.2. Verify: `npm test -- test/editor/secrets`, including `Property 6:`
  - Commit: `test: the API key never reaches output`
  - Done: `npm test -- test/editor/secrets` gave "Test Files  1 passed (1) / Tests  2 passed (2)", including `Property 6:` (and a check that the capture itself sees console calls and stream writes); typecheck and lint clean. The key is placed in error bodies and headers, thrown error messages and causes, cut-off and non-JSON replies, refusals and timeouts; scripts with a thrown error or timeout use `maxRetries` 0 because the SDK pauses before retrying those.

- [x] 13. Recording script: `scripts/lib/recording-client.ts`, `scripts/lib/record-editor.ts`, `scripts/record-editor-fixtures.ts`, `test/scripts/record-editor.test.ts` (`containsSecret` on texts with and without a generated key; `recordEditor({}, fetch)` returns 1 with the 14.1 message and the fake fetch sees no request; an invalid cap variable gives the 14.5 message without its value). Kiro writes the script and does not run it.
  - Requirements: 14.1, 14.2, 14.3, 14.4, 14.5. Verify: `npm test -- test/scripts/record-editor.test.ts && npm run typecheck`
  - Commit: `scripts: record editor fixtures`
  - Done: `npm test -- test/scripts/record-editor.test.ts && npm run typecheck` gave "Test Files  1 passed (1) / Tests  13 passed (13)" and a clean `tsc --noEmit`. The script was not run. Beyond the listed tests, `recordEditor` is also exercised over a scripted transport and a fake host (a fake key, no network, no file outside the repository) to prove 14.2 and 14.3, and its fixtures replay through `test/editor/replay.ts`; requirement 14.4 ("no test runs it") is read as: no test runs the entry point or uses a real key. `test/editor/recorded-fixtures.test.ts` was written here (owner answer 4) and skips while `test/fixtures/editor/` has no `.json`; I checked it once against synthetic fixtures written to that directory by a throwaway script and then deleted them (3 tests passed), so it is known to work when the owner's recordings arrive. `scripts/record-editor-fixtures.ts` reads `process.env` (Departure 6).

- [ ] 14. Owner step, then test. The owner runs `npx tsx scripts/record-editor-fixtures.ts` with a real key and commits `test/fixtures/editor/`. Kiro wrote `test/editor/recorded-fixtures.test.ts` in task 13 (owner answer 4); it is skipped with a stated reason while the directory has no fixture file and runs once the owner has recorded. **Not ticked by Kiro.** Never replaced by hand-written fixtures.
  - Requirements: 13.1, 13.2, 14.2, 16.3. Verify: `npm test -- test/editor/recorded-fixtures` passes with the files present (not skipped)
  - Commit: `test: replay recorded editor drafts`

- [x] 15. Full gate. Fix failures in the code or data, never by weakening a check, schema or test (`tech.md`, rule 3).
  - Requirements: 16.1, 16.2. Verify: `npm run typecheck && npm run lint && npm test && npm run build && npm run grid:check`; quote the `Test Files` and `Tests` lines
  - Commit: none unless a fix was needed
  - Done: `npm run typecheck && npm run lint && npm test && npm run build && npm run grid:check` passed; `npm test` gave "Test Files  116 passed | 1 skipped (117) / Tests  897 passed | 3 skipped (900)" (the skipped file is `recorded-fixtures.test.ts`, waiting for the owner's recordings) and `grid:check` "30 pages, 43 screens, 0 problems". The first run failed once in `test/compilers/format.property.test.ts` (Property 10, a rule-compilers test): its ISO-string generator used `fc.date` without `noInvalidDate`, so an Invalid Date reached `toISOString` on some seeds. This is the same generator flaw task 6 of rule-compilers had fixed in one place and missed in another; I set `noInvalidDate: true` on that one generator and changed no assertion. The file then passed five runs in a row and the full gate passed.

- [x] 16. Counts: test files, tests, property tests. `npx vitest list | grep -cE "Property [0-9]+:"` must print 52 (grid-core 20, pages-and-sources 12, rule-compilers 12, this spec 8), and `grep -cE "^Property [0-9]+:" .kiro/specs/ai-editor/design.md` must print 8.
  - Requirements: 16.1. Verify: the two commands above and `npm test`
  - Commit: `docs: ai-editor test counts`
  - Done: `npx vitest list | grep -cE "Property [0-9]+:"` printed 52 and `grep -cE "^Property [0-9]+:" .kiro/specs/ai-editor/design.md` printed 8; `npm test` as in task 15. The suite went from 95 files and 733 tests (before this spec) to 117 files and 900 tests: 22 new test files (21 in `test/editor`, 1 in `test/scripts`) plus the boundaries and scaffold additions; no new Property number was added for the name check (Property 1 covers it).
