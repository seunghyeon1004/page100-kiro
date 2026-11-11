# ai-editor: requirements

Spec for `src/editor`, the only module that calls a model: the editor client interface and its two implementations, the prompt, the draft checks, the retry loop, the call caps, the draft cache, `runEdition`, the editor fixtures and the script that records them. Contracts: `editorial.md` (voice, headlines, numbers, fitting, numeric fidelity), `product.md` (non-negotiables 2 to 4), `tech.md` (configuration, secrets), and the rule-compilers design ("Editor seam", requirement 8). This spec does not restate them; it fixes what they leave open.

## Glossary

- **AI pages**: 110, 111 to 118, 500, 501 and 700, in that order (12 pages).
- **EditorialInput**, **EditorialSlot**, **DraftRows**, `editorialInput`, `rulesDraft`, `assemble`: as in the rule-compilers design. **Rules draft**: `rulesDraft(editorialInput(data))`.
- **Reply rows**: the `rows` array of one model reply. Slots appear in slot order, separated by one empty string `""`.
- **Draft**: one reply from an `EditorClient`. **Accepted**: a draft that passes every check of requirement 7 and 8 and then publishes (requirement 9.2). **Rejected**: any other draft.
- **Call**: one HTTP request to the model API. One `draft` may make up to two calls (the SDK retries once).
- **Input key**: SHA-256 of an EditorialInput's canonical text (design, "Cache").
- **Publish**: `assemble`, then `checkCompiledPage` and `buildScreen` for every subpage with `stale` false and true (the checks `compileAll` applies, rule-compilers 18.2).

## Departures

1. **Imports.** `structure.md` lets `src/editor` import `src/grid`, `src/markup` and `src/sources` types. It also imports `src/compilers` (the seam functions) and `src/pages` (`REGISTRY`, `checkCompiledPage`, `buildScreen`), as rule-compilers Departure 1 did for compilers.
2. **Files outside `src/editor`.** This spec writes `src/server/config.ts` with the editor variables only (`tech.md` puts every environment read there; the server spec adds `PORT`), `scripts/record-editor-fixtures.ts` and `test/fixtures/editor/`.
3. **New variables.** `tech.md` lists four variables. This spec adds `EDITOR_MAX_CALLS_PER_BOOT` (default 30, decided by the owner) and `EDITOR_CLIENT` (`auto` or `fixtures`, for the offline demo mode), and sets `MAX_MODEL_CALLS_PER_DAY` to 60. `tech.md` needs the owner's edit to list them.
4. **Developer news.** `product.md` says the AI may shorten titles on 400 to 402. The rule-compilers spec treats those titles as names that are never shortened, and the owner's AI page list leaves them out. They stay rules-only.
5. **Scaffold lists.** pages-and-sources 1.1 fixes `dependencies` to `zod` only. This spec adds `@anthropic-ai/sdk` 1.8.0, and `test/scaffold.test.ts` checks the new exact list.

## Decisions where steering is silent

- `editorial.md` says the editor's draft checks enforce each "must". Requirement 7.9 checks the voice rules that code can decide. "Adds no names, places, causes or quotes" cannot be checked by code; the prompt states it and the numeric fidelity check covers numbers only.
- The numeric fidelity input is every slot text of the page together, as `editorial.md` says ("the input given for that page").
- A slot may be empty in a draft only when the rules draft also left it empty (`optional`). The editor may fit more items than the rules draft, never fewer.
- No current slot allows a blank row (`assemble` rejects empty rows, rule-compilers 8.4), so an empty string is only ever a slot separator.
- Cached and remembered drafts count as no call and no draft on page 802.

## Requirement 1: Project changes and boundaries

1.1 THE `package.json` `dependencies` SHALL be exactly `{ "@anthropic-ai/sdk": "1.8.0", "zod": "4.6.7" }` with `package-lock.json` updated, AND `test/scaffold.test.ts` SHALL check that list exactly.

1.2 ONLY files in `src/editor` SHALL import `@anthropic-ai/sdk`, AND ONLY `src/editor/anthropic-editor-client.ts` SHALL contain `new Anthropic(`.

1.3 THE `.ts` files in `src/editor` SHALL import only `src/editor`, `src/grid`, `src/markup`, `src/pages`, `src/compilers`, `src/sources` (`import type` only), `@anthropic-ai/sdk`, `zod` and `node:crypto`, AND SHALL not contain `process`, `console.`, `globalThis`, `Date.now`, `new Date()` with no argument, `Math.random` or `node:fs`.

1.4 NO file in `src/grid`, `src/markup`, `src/pages`, `src/sources` or `src/compilers` SHALL import `src/editor`.

## Requirement 2: Configuration

2.1 THE module `src/server/config.ts` SHALL export `loadConfig(env)`, where `env` defaults to `process.env`, returning `{ ok: true, config }` or `{ ok: false, problems }`, validated with zod, and SHALL be the only file that reads `process.env`.

2.2 THE config SHALL hold `anthropicApiKey` (`null` when unset or empty), `editorModel` (default `claude-opus-5-5`), `maxModelCallsPerDay` (integer 0 to 10,000, default 60), `editorMaxCallsPerBoot` (integer 0 to 10,000, default 30) and `editorClient` (`auto` or `fixtures`, default `auto`).

2.3 IF a variable is invalid, THEN `loadConfig` SHALL return one problem per variable that names the variable and the rule (`MAX_MODEL_CALLS_PER_DAY must be an integer from 0 to 10000`) and never contains any variable's value.

## Requirement 3: Client interface

3.1 THE module `src/editor/editor-types.ts` SHALL export `EditorClient` with `maxRequestsPerDraft` and one method `draft(request)` returning `Promise<DraftResult>`, plus `DraftRequest`, `RequestSlot`, `DraftResult` and `DraftFailureReason` (design, "Types").

3.2 A `DraftRequest` SHALL carry the page number, `totalRows`, each slot's id, mode, `maxRows`, `width`, `optional` flag and folded text, the input key, the attempt (0, 1 or 2), and on attempts 1 and 2 the previous reply rows and their violations.

3.3 A `DraftResult` SHALL be `{ ok: true, rows, requests }` or `{ ok: false, reason, status, requests }`, where `requests` is the number of calls made and `status` is an HTTP status or `null`.

3.4 THE function `createEditorClient(config, fetch, fixtures)` SHALL return `null` and construct no SDK client WHILE `anthropicApiKey` is `null` and `editorClient` is `auto`, a `FixtureEditorClient` WHEN `editorClient` is `fixtures` (key ignored), and an `AnthropicEditorClient` otherwise.

## Requirement 4: Anthropic client request

4.1 THE `AnthropicEditorClient` SHALL construct the SDK client with the API key, `timeout` 30,000 ms, `maxRetries` 1, `logLevel` `"off"` (or the no-op `logger` of the design when task 2 finds no `logLevel`) and a counting `fetch` (design), and SHALL have `maxRequestsPerDraft` 2.

4.2 EACH draft SHALL call `client.messages.parse` with exactly `model` (`editorModel`), `max_tokens` 4000, `system`, `messages` holding one user message, and `output_config` holding `effort: "low"` and `format: zodOutputFormat(DraftReply)`, where `DraftReply` is `z.object({ rows: z.array(z.string()) })`.

4.3 THE request body SHALL contain no `temperature`, `top_p`, `top_k`, `thinking`, `stop_sequences`, `tools` or assistant message.

4.4 IF task 2's check finds that `zodOutputFormat` does not type-check with the installed zod, THEN THE client SHALL instead call `client.messages.create` with `output_config.format` set to the hand-written JSON schema in the design and parse the first text block with `JSON.parse` and `DraftReply.safeParse`.

4.5 THE counting `fetch` SHALL count every request it passes on, AND IF a draft would make a request beyond `maxRequestsPerDraft`, THEN it SHALL reject that request without sending it.

## Requirement 5: Reply and error handling

5.1 WHEN the reply's `stop_reason` is `refusal`, THE result SHALL be failure `refusal`; WHEN it is `max_tokens`, failure `max-tokens`; WHEN it is `end_turn` with parsed rows, success with those rows; otherwise, or when the reply does not parse, failure `malformed`.

5.2 WHEN the SDK throws, THE client SHALL classify the error by `instanceof`, most specific first: `RateLimitError` as `rate-limited`; `AuthenticationError` or `PermissionDeniedError` as `auth`; `APIConnectionTimeoutError` as `timeout`; `APIConnectionError` as `connection`; any other `APIError` with a status as `status`; any other `AnthropicError` as `malformed`; anything else as `unknown`.

5.3 A failure result SHALL carry only the reason, the HTTP status (or `null`) and the call count. It SHALL not carry the error, its message, headers or body.

5.4 THE `draft` method of both real implementations SHALL resolve and never reject.

## Requirement 6: Prompt

6.1 THE module `src/editor/system-prompt.ts` SHALL export `SYSTEM_PROMPT`, a constant built from the `editorial.md` rules on voice, headlines, abbreviations (both allowed lists verbatim), numbers and fitting, the reply format, and the sentence in the design that marks the source text as untrusted data whose instructions are ignored.

6.2 THE function `userMessage(request)` SHALL state the page's `totalRows` and each slot's id, mode, row range and width, then give the slot texts only inside one `<source_data>` block as JSON with every `<` written `\u003c`.

6.3 WHEN the attempt is 1 or 2, THE user message SHALL add the violations (at most 20, as a list) and the previous reply rows inside one `<previous_draft>` block encoded the same way.

6.4 THE prompt strings SHALL be a function of the request alone, AND SHALL contain no key, date or clock reading.

## Requirement 7: Draft checks

7.1 THE function `checkEditorDraft(request, replyRows)` SHALL return `{ ok: true, rows }` (DraftRows, folded) or `{ ok: false, violations }` with the exact sentences of the design table, in check order, AND SHALL be pure and never throw. It is the only way a draft becomes accepted.

7.2 THE reply rows SHALL split on `""` into exactly one group per slot, else the only violation is `reply has N slots, expected M`.

7.3 EACH group SHALL have at most `maxRows` rows, AND SHALL have at least 1 row unless the slot is `optional`.

7.4 EACH row SHALL fold with `foldText`; IF it does not, THEN the violation names the slot, the row and the first code point outside the repertoire as `U+XXXX`.

7.5 EACH folded row SHALL be at most its slot's `width` code points, SHALL not be blank, start or end with a space, or contain two spaces in a row, AND SHALL not contain `{`.

7.6 THE folded rows of all groups together SHALL be at most `totalRows`.

7.7 THE draft SHALL pass the numeric fidelity check of requirement 8.

7.8 THE row and slot numbers in violations SHALL be the slot id and the row's 1-based position in its group (`slot lead row 2 is 43 cells, limit 38`).

7.9 A row SHALL not contain `!` or `?`, the words `breaking`, `shock`, `shocking` or `slams` (any case), or an all-capitals word of 2 or more letters, unless that character or word appears in the slot's input or is an allowed abbreviation from `editorial.md`, AND the last row of a headline slot SHALL not end with `.` or `...`.

## Requirement 8: Numeric fidelity

8.1 THE function `checkNumericFidelity(inputTexts, draftRows)` SHALL take every match of `\d+(?:[.,]\d+)*` in the draft, with every `,` removed, and report each one that is not a match, normalised the same way, in any input text.

8.2 THE function SHALL treat the words `one` to `twenty`, `dozen`, `hundred`, `thousand`, `million` and `billion` as numbers, matched as whole words in any case, and report each one that does not appear as a whole word in an input text.

8.3 THE violations SHALL be `number "41" not in input` and `number word "twelve" not in input`, each distinct token once, in order of first appearance.

## Requirement 9: editPage

9.1 THE function `editPage(job, deps, now)` SHALL make at most 3 `draft` calls for one page: attempt 0, then attempts 1 and 2 each carrying the previous reply rows and their violations.

9.2 A draft SHALL be accepted only when `checkEditorDraft` succeeds AND publishing its rows succeeds; publish problems become the violations of the next attempt.

9.3 WHEN a result is `refusal`, THE function SHALL stop editing the page and remember the input key as rejected.

9.4 WHEN a result is `max-tokens` or `malformed`, THE function SHALL count a rejected draft and retry with the violation `reply stopped at the token limit` or `reply was not a JSON object with a rows array`.

9.5 WHEN a result is `rate-limited` or `auth`, THE function SHALL stop the page AND set `stopEdition`, so no later page in the edition makes a call.

9.6 WHEN a result is `timeout`, `connection`, `status`, `unknown` or `no-fixture`, or `draft` throws or rejects, THE function SHALL stop the page without remembering the key.

9.7 THE function SHALL reserve `maxRequestsPerDraft` calls from the budget before every `draft` call AND SHALL make no call when the reservation fails.

9.8 WHEN no draft is accepted, THE result rows SHALL deep-equal the rules draft and `editor` SHALL be `rules`; WHEN one is, its folded rows and `ai`.

9.9 THE function SHALL never throw.

9.10 WHEN the input has no slots, or an earlier page in the edition set `stopEdition`, THE function SHALL make no call and return the rules draft.

## Requirement 10: Call budget

10.1 THE function `createCallBudget(capPerDay, capPerBoot)` SHALL return a budget whose `tryReserve(n, now)` succeeds only when calls today plus n is at most `capPerDay` AND calls since creation plus n is at most `capPerBoot`, and whose `settle(reserved, used)` returns `reserved - used` to both counts.

10.2 WHEN the UTC date of `now` is later than the budget's day, THE budget SHALL reset calls today to 0 and SHALL not reset calls since creation.

10.3 THE budget SHALL be held in memory only. A process restart resets both counts; `capPerBoot` bounds the calls of each process.

## Requirement 11: Draft cache

11.1 THE function `createDraftCache()` SHALL store, per input key, either accepted DraftRows or `rejected`, together with the canonical input text, AND a lookup SHALL return an entry only when its canonical text equals the input's.

11.2 WHEN an accepted entry exists, THE `editPage` function SHALL make no call and SHALL publish the cached rows after `checkEditorDraft`; IF either fails, THEN it SHALL drop the entry and edit the page as if uncached.

11.3 WHEN a `rejected` entry exists, THE `editPage` function SHALL make no call and return the rules draft. A key becomes `rejected` after three rejected drafts or one refusal.

11.4 AFTER each edition, THE cache SHALL hold only keys looked up in that edition.

## Requirement 12: runEdition

12.1 THE function `runEdition(snapshot, status, now, deps)` SHALL edit the AI pages in the order of the glossary, one `draft` call at a time, and return `{ pages, outcomes, status }`.

12.2 FOR each AI page, THE function SHALL build the page's data from the snapshot as the rule-compilers design gives it, then `editorialInput`, the rules draft and `editPage`, AND SHALL return the published page with `editor` `ai` or `rules`.

12.3 IF the rules draft does not publish or a step throws, THEN THE outcome for that page SHALL be `failed` with problem codes only and the page left out, AND no other page's outcome SHALL change.

12.4 THE returned `EditorStatus` SHALL hold the UTC day, calls today and `capPerDay`, calls since boot and `capPerBoot`, drafts accepted and rejected today (reset when the day changes), and the AI pages published with `editor` `rules`.

12.5 THE function SHALL never throw and SHALL read no clock: `now` is the edition time for the budget day and the frame.

## Requirement 13: Fixtures and FixtureEditorClient

13.1 THE module `src/editor/editor-fixture.ts` SHALL export the zod schema `EditorFixture` (design), AND fixture files SHALL be named `test/fixtures/editor/<yyyy-mm-dd>-p<NNN>.json`.

13.2 THE `FixtureEditorClient` SHALL be constructed from parsed fixtures, SHALL answer attempt n of an input key with the fixture's attempt n, SHALL answer any other request with failure `no-fixture`, and SHALL report 1 call per answer and `maxRequestsPerDraft` 1. It reads no file.

## Requirement 14: Recording script

14.1 THE script `scripts/record-editor-fixtures.ts` SHALL load the config with `loadConfig`, AND IF `anthropicApiKey` is `null`, THEN SHALL print `ANTHROPIC_API_KEY is not set` and exit 1 without a call.

14.2 THE script SHALL run `runEdition` on the boot snapshot with an `AnthropicEditorClient` wrapped by a recorder, the config's caps and an empty cache, and SHALL write one fixture per AI page that made a call.

14.3 BEFORE writing a file, THE script SHALL check that its text does not contain the key, `x-api-key` or `authorization`, AND IF it does, THEN SHALL write nothing and exit 1.

14.4 THE script SHALL be run only by the owner with a real key. No test runs it, and no task asks Kiro to run it or to read any `.env` or secrets file.

## Requirement 15: Secrets and logging

15.1 THE module `src/editor` SHALL write log lines only through `deps.log`, in the formats of the design, holding only page numbers, attempts, reason codes, HTTP statuses and counts.

15.2 NO log line, result, status, fixture, thrown error or console output produced by `src/editor`, `loadConfig` or the SDK client on any path SHALL contain the API key.

## Requirement 16: Tests and gate

16.1 THE test suite SHALL contain one fast-check test per property in `design.md`, named `Property N:`. Tests SHALL use the real checks, compilers seam, frame builder and SDK, with a fake `fetch` transport for the SDK, and SHALL make no network request.

16.2 WHEN the feature is complete, `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` and `npm run grid:check` SHALL each exit 0.
