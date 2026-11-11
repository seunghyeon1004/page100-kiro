# ai-editor: tasks

Requirements: `requirements.md`. Design: `design.md`. A task is ticked only after its `Verify` command has run in the session and passed, with the command and its quoted result after the tick (`tech.md`, rule 5). Kiro suggests the commit message; the user stages and commits.

Preconditions: rule-compilers tasks 3, 6, 7, 9.2, 9.7, 10 and 11 are done before task 5 here (the seam functions, `NUMBER_WORDS`, `compile-arbitraries.ts` and `compileAll`). If any seam export differs from the rule-compilers design, stop and ask; do not work around it. No task reads a `.env` or secrets file, and no task runs the recording script.

- [ ] 1. Install `@anthropic-ai/sdk` with the exact command in the design ("Toolchain"), once the owner says go (npm network use only). Update `test/scaffold.test.ts` to the new exact `dependencies` list.
  - Requirements: 1.1. Verify: `npm ls --depth=0` lists `@anthropic-ai/sdk@1.8.0` and `zod@4.6.7` with no `UNMET` or `invalid` line, and `npm test -- test/scaffold.test.ts` passes
  - Commit: `deps: @anthropic-ai/sdk 1.8.0`

- [ ] 2. Helper check, no code: read `node_modules/@anthropic-ai/sdk/helpers/zod.d.mts`, the declarations it imports, `ClientOptions` and the error classes. Record in this task's Done line the zod entry point, the presence of `logLevel`, `fetch`, `timeout`, `maxRetries` and `output_config.effort`, the class hierarchy of requirement 5.2, and the path chosen (A or B). If the error classes differ, stop and ask.
  - Requirements: 4.2, 4.4, 5.2. Verify: quote the `import` lines of `helpers/zod.d.mts` and the matching `ClientOptions` lines, found with the grep tool
  - Commit: none (the finding goes into task 10)

- [ ] 3. Boundaries: extend `test/boundaries.test.ts` with 1.2 to 1.4. It passes with `src/editor` empty.
  - Requirements: 1.2, 1.3, 1.4. Verify: `npm test -- test/boundaries.test.ts && npm run lint`
  - Commit: `test: editor module boundaries`

- [ ] 4. Config: `src/server/config.ts`, `test/server/config.test.ts`.
  - Requirements: 2.1, 2.2, 2.3. Verify: `npm test -- test/server/config.test.ts`
  - Commit: `server: editor configuration with zod`

- [ ] 5. Types and numeric fidelity: `editor-types.ts`, `numeric-fidelity.ts`, `numeric-fidelity.test.ts`, `numeric-fidelity.property.test.ts` (Property 4), `test/editor/editor-arbitraries.ts`.
  - Requirements: 3.1, 3.2, 3.3, 8.1, 8.2, 8.3. Verify: `npm test -- test/editor/numeric-fidelity`, including `Property 4:`
  - Commit: `editor: types and numeric fidelity check`

- [ ] 6. Prompt: `system-prompt.ts`, `user-message.ts`, `system-prompt.test.ts`, `user-message.property.test.ts` (Property 7).
  - Requirements: 6.1, 6.2, 6.3, 6.4. Verify: `npm test -- test/editor/system-prompt test/editor/user-message`, including `Property 7:`
  - Commit: `editor: system prompt and delimited user message`

- [ ] 7. Draft checks: `check-editor-draft.ts`, `check-editor-draft.test.ts` (every sentence in the design table), `check-editor-draft.property.test.ts` (Property 1).
  - Requirements: 7.1 to 7.9. Verify: `npm test -- test/editor/check-editor-draft`, including `Property 1:`
  - Commit: `editor: draft checks with exact violations`

- [ ] 8. Budget and cache: `call-budget.ts`, `draft-cache.ts`, `call-budget.test.ts`, `draft-cache.test.ts`.
  - Requirements: 10.1, 10.2, 10.3, 11.1, 11.4. Verify: `npm test -- test/editor/call-budget test/editor/draft-cache`
  - Commit: `editor: call budget and draft cache`

- [ ] 9. editPage: `ai-pages.ts`, `publish-page.ts`, `edit-page.ts`, `test/editor/scripted-client.ts`, `edit-page.test.ts`, `edit-page.property.test.ts` (Property 2).
  - Requirements: 9.1 to 9.10, 11.2, 11.3. Verify: `npm test -- test/editor/edit-page`, including `Property 2:`
  - Commit: `editor: editPage with retries and rules fallback`

- [ ] 10. Clients: `classify-error.ts`, `anthropic-editor-client.ts` (path from task 2), `editor-fixture.ts`, `fixture-editor-client.ts`, `create-editor-client.ts`, `test/editor/fake-fetch.ts` and their example tests. No cast, `any` or `@ts-expect-error` to fit the SDK types.
  - Requirements: 3.4, 4.1 to 4.5, 5.1 to 5.4, 13.1, 13.2. Verify: `npm test -- test/editor/anthropic-editor-client test/editor/fixture-editor-client test/editor/create-editor-client && npm run typecheck`
  - Commit: `editor: Anthropic and fixture clients`

- [ ] 11. runEdition: `run-edition.ts`, `run-edition.test.ts`, `run-edition.property.test.ts` (Property 8), `call-budget.property.test.ts` (Property 3), `draft-cache.property.test.ts` (Property 5).
  - Requirements: 10.1 to 10.3, 11.1 to 11.4, 12.1 to 12.5. Verify: `npm test -- test/editor/run-edition test/editor/call-budget test/editor/draft-cache`, including `Property 3:`, `Property 5:` and `Property 8:`
  - Commit: `editor: runEdition and page 802 counters`

- [ ] 12. Secrets: `secrets.property.test.ts` (Property 6) over every failure path, `loadConfig` and the log.
  - Requirements: 2.3, 5.3, 15.1, 15.2. Verify: `npm test -- test/editor/secrets`, including `Property 6:`
  - Commit: `test: the API key never reaches output`

- [ ] 13. Recording script: `scripts/lib/recording-client.ts`, `scripts/lib/record-editor.ts`, `scripts/record-editor-fixtures.ts`, `test/scripts/record-editor.test.ts` (`containsSecret` on texts with and without a generated key; `recordEditor({}, fetch)` returns 1 with the 14.1 message and the fake fetch sees no request). Kiro writes the script and does not run it.
  - Requirements: 14.1, 14.2, 14.3, 14.4. Verify: `npm test -- test/scripts/record-editor.test.ts && npm run typecheck`
  - Commit: `scripts: record editor fixtures`

- [ ] 14. Owner step, then test. The owner runs `npx tsx scripts/record-editor-fixtures.ts` with a real key and commits `test/fixtures/editor/`. Kiro then writes `recorded-fixtures.test.ts`. Blocked until the directory has files; never replaced by hand-written fixtures.
  - Requirements: 13.1, 13.2, 14.2. Verify: `npm test -- test/editor/recorded-fixtures`
  - Commit: `test: replay recorded editor drafts`

- [ ] 15. Full gate. Fix failures in the code or data, never by weakening a check, schema or test (`tech.md`, rule 3).
  - Requirements: 16.1, 16.2. Verify: `npm run typecheck && npm run lint && npm test && npm run build && npm run grid:check`; quote the `Test Files` and `Tests` lines
  - Commit: none unless a fix was needed

- [ ] 16. Counts: test files, tests, property tests. `npx vitest list | grep -cE "Property [0-9]+:"` must print 52 (grid-core 20, pages-and-sources 12, rule-compilers 12, this spec 8), and `grep -cE "^Property [0-9]+:" .kiro/specs/ai-editor/design.md` must print 8.
  - Requirements: 16.1. Verify: the two commands above and `npm test`
  - Commit: `docs: ai-editor test counts`
