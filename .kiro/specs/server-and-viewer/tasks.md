# server-and-viewer: tasks

Requirements: `requirements.md`. Design: `design.md`. A task is ticked only after its `Verify` command has run in the session and passed, with the command and its quoted result after the tick (`tech.md`, rule 5). Kiro suggests the commit message; the user stages and commits. Kiro starts no dev server or watcher; `npm run e2e` and `scripts/runtime-check.ts` start and stop their own server.

Preconditions: rule-compilers tasks for `compileAll`, `compile802` and `compile-arbitraries.ts` are done before tasks 8 and 11; ai-editor tasks 1 to 11 (`runEdition`, `createEditorClient`, `EditorFixture`) before task 11. Tasks 1 to 7, 9 and 13 need only code that exists today. If an export named in the design differs from the code, stop and ask; do not work around it. No task reads a `.env` or secrets file.

- [ ] 1. Amendments, docs only. In `frontend.md`, lower the budgets to requirement 14.1 and change "4:3" to "5:4" in "Layout" (owner decision, Departure 2). In ai-editor, strike requirements 2.1 to 2.3 with a pointer to this spec, change 3.4, the `EditorConfig` type and task 4 to `anthropic | fixtures | off`. List for the owner the `tech.md` edits (variables, `typecheck`); Kiro does not edit `tech.md`.
  - Requirements: Departures 2, 3, 5. Verify: grep tool finds `24 KiB` and `5:4` in `frontend.md` and `~~2.1` in ai-editor `requirements.md`
  - Commit: `docs: server-and-viewer amendments to frontend and ai-editor`

- [ ] 2. Toolchain, once the owner says go (npm network use only): the install in the design ("Toolchain"); the five script changes of 1.1; `public/tsconfig.json` with an empty `public/app.js`; `playwright.config.ts` in `tsconfig.json` `include`; `test/scaffold.test.ts` updated.
  - Requirements: 1.1, 1.2, 12.1. Verify: `npm ls --depth=0` lists `@playwright/test@1.65.0` with no `UNMET` or `invalid` line, then `npm test -- test/scaffold.test.ts && npm run typecheck`
  - Commit: `scaffold: Playwright, server scripts, checkJs for public/`

- [ ] 3. Boundaries: extend `test/boundaries.test.ts` with 1.3 to 1.5. It passes with `src/server` holding only what exists.
  - Requirements: 1.3, 1.4, 1.5. Verify: `npm test -- test/boundaries.test.ts && npm run lint`
  - Commit: `test: server and client boundaries`

- [ ] 4. Config: `src/server/config.ts`, `test/server/config.test.ts`. If ai-editor task 4 already wrote the file, extend it rather than replace it.
  - Requirements: 2.1 to 2.4. Verify: `npm test -- test/server/config.test.ts`
  - Commit: `server: configuration with zod`

- [ ] 5. Clock stamp and User-Agent: `src/pages/stamp-clock.ts` and its test; `userAgent(origin)` in `src/sources/user-agent.ts`, the optional `userAgent` in `http.ts`, `test/sources/user-agent.test.ts`. The existing header tests stay unchanged.
  - Requirements: 5.9, 9.5. Verify: `npm test -- test/pages test/sources/http test/sources/user-agent`
  - Commit: `pages, sources: request clock stamp and User-Agent origin`

- [ ] 6. Store: `etag.ts`, `store.ts`, `store.test.ts`, `store.property.test.ts` (Property 4), `test/server/server-arbitraries.ts`.
  - Requirements: 4.1 to 4.4. Verify: `npm test -- test/server/store`, including `Property 4:`
  - Commit: `server: store with framing gate and ETags`

- [ ] 7. Screen renderers: `escape-html.ts`, `render-screen.ts`, `render-screen.property.test.ts` (Property 2), `render-ansi.property.test.ts` (Property 7).
  - Requirements: 9.3, 9.4, 11.1, 11.2. Verify: `npm test -- test/server/render-screen test/server/render-ansi`, including `Property 2:` and `Property 7:`
  - Commit: `server: screen runs, text and ANSI`

- [ ] 8. Document renderers: `views.ts`, `render-alt.ts`, `render-html.ts`, `render-json.ts`, `render-plain.ts`, `render-html.test.ts`, `render-txt.property.test.ts` (Property 1), `render-html.property.test.ts` (Property 3), `etag.property.test.ts` (Property 6).
  - Requirements: 4.4, 9.1, 9.2, 9.5 to 9.7, 10.1, 10.2, 11.3, 11.4. Verify: `npm test -- test/server/render- test/server/etag`, including `Property 1:`, `Property 3:` and `Property 6:`
  - Commit: `server: HTML, fragment, JSON and not-found views`

- [ ] 9. Negotiation and assets: `negotiate.ts`, `compress.ts`, `headers.ts`, `assets.ts` and their example tests (q-values, `W/` tags, the font URL rewrite, `FAVICON_SVG` under 300 bytes).
  - Requirements: 8.1, 8.5, 8.6. Verify: `npm test -- test/server/negotiate test/server/compress test/server/assets`
  - Commit: `server: encoding choice, compression cache, CSP headers, asset table`

- [ ] 10. Router: `router.ts`, `router.test.ts`, `router.property.test.ts` (Property 5), `negotiate.property.test.ts` (Property 9).
  - Requirements: 7.1 to 7.9, 8.1 to 8.6. Verify: `npm test -- test/server/router test/server/negotiate`, including `Property 5:` and `Property 9:`
  - Commit: `server: router with fixed routes and statuses`

- [ ] 11. Scheduler: `timers.ts`, `scheduler.ts`, `scheduler.test.ts`, `scheduler.property.test.ts` (Property 8), with fake timers and scripted fetchers and edition runner.
  - Requirements: 5.1 to 5.8, 6.1 to 6.5. Verify: `npm test -- test/server/scheduler`, including `Property 8:`
  - Commit: `server: refresh schedule, staleness and background edition`

- [ ] 12. Wiring: `app-files.ts`, `app.ts`, `http-server.ts`, `main.ts`, `test/server/app.test.ts` (boot on `127.0.0.1`, health, shutdown, a missing file exits 1). Tell the owner `npm run dev` to try it.
  - Requirements: 3.1 to 3.4, 6.4, 2.4. Verify: `npm test -- test/server && npm run build`
  - Commit: `server: boot, HTTP server and graceful shutdown`

- [ ] 13. Stylesheet: `public/app.css`, `test/public/font-coverage.test.ts`, `test/public/app-css.test.ts` (13.1 colour values against `COLOUR_RGB`, no motion).
  - Requirements: 13.1 to 13.5. Verify: `npm test -- test/public && npm run lint`
  - Commit: `public: screen stylesheet and font coverage`

- [ ] 14. Client script: `public/app.js`, `test/public/app-source.test.ts` (1.5).
  - Requirements: 1.5, 12.1 to 12.10. Verify: `npm run typecheck && npm test -- test/public && npm run lint`
  - Commit: `public: client script`

- [ ] 15. Budgets: `scripts/lib/payload.ts`, `scripts/payload.ts`, `test/scripts/payload.test.ts`. A budget that fails is fixed in the code; raising one needs the owner.
  - Requirements: 14.1, 14.2, 14.3. Verify: `npm run payload` (quote the table) and `npm test -- test/scripts/payload`
  - Commit: `scripts: byte budgets`

- [ ] 16. Browser tests: `playwright.config.ts`, `test/e2e/guard.ts` and the seven spec files. Blocked until the owner has run `npx playwright install chromium`.
  - Requirements: 12.2 to 12.10, 13.2, 13.3, 15.1, 15.2. Verify: `npm run e2e` (quote the passed count)
  - Commit: `test: browser tests in Chromium`

- [ ] 17. Screenshots: `scripts/screenshots.ts`, then `npx tsx scripts/screenshots.ts`.
  - Requirements: 15.3. Verify: `ls docs/screens` lists 34 `.png` files
  - Commit: `docs: desktop and phone screenshots`

- [ ] 18. Deploy files: `Dockerfile`, `.dockerignore`, `render.yaml`, `scripts/lib/runtime-copies.ts`, `scripts/env-example.ts`, `test/deploy/deploy-files.test.ts`. The owner runs `npx tsx scripts/env-example.ts > .env.example`.
  - Requirements: 16.1 to 16.4. Verify: `npm test -- test/deploy`
  - Commit: `deploy: Dockerfile, render.yaml, env example`

- [ ] 19. Runtime layout without Docker: `scripts/runtime-check.ts`, run with the owner's go-ahead (its `npm ci` uses the npm network).
  - Requirements: 16.5, 3.4. Verify: `npx tsx scripts/runtime-check.ts` prints `runtime check passed` and exits 0
  - Commit: `scripts: prove the runtime image layout`

- [ ] 20. Full gate. Fix failures in the code or data, never by weakening a check, schema or test (`tech.md`, rule 3).
  - Requirements: 17.1, 17.2. Verify: `npm run typecheck && npm run lint && npm test && npm run build && npm run grid:check && npm run payload`, then `npm run e2e`; quote the `Test Files` and `Tests` lines
  - Commit: none unless a fix was needed

- [ ] 21. Counts: `npx vitest list | grep -cE "Property [0-9]+:"` prints 61 (52 before this spec, plus 9), and `grep -cE "^Property [0-9]+:" .kiro/specs/server-and-viewer/design.md` prints 9.
  - Requirements: 17.1. Verify: the two commands above and `npm test`
  - Commit: `docs: server-and-viewer test counts`
