# server-and-viewer: tasks

Requirements: `requirements.md`. Design: `design.md`. A task is ticked only after its `Verify` command has run in the session and passed, with the command and its quoted result after the tick (`tech.md`, rule 5). Kiro suggests the commit message; the user stages and commits. Kiro starts no dev server or watcher; `npm run e2e` and `scripts/runtime-check.ts` start and stop their own server.

Preconditions: rule-compilers tasks for `compileAll`, `compile802` and `compile-arbitraries.ts` are done before tasks 8 and 11; ai-editor tasks 1 to 11 (`runEdition`, `createEditorClient`, `EditorFixture`) before task 11. Tasks 1 to 7, 9 and 13 need only code that exists today. If an export named in the design differs from the code, stop and ask; do not work around it. No task reads a `.env` or secrets file.

- [x] 1. Amendments, docs only. In `frontend.md`, lower the budgets to requirement 14.1 and change "4:3" to "5:4" in "Layout" (owner decision, Departure 2). In ai-editor, strike requirements 2.1 to 2.3 with a pointer to this spec, change 3.4, the `EditorConfig` type and task 4 to `anthropic | fixtures | off`. List for the owner the `tech.md` edits (variables, `typecheck`); Kiro edits `tech.md` only where the owner has said so (rule 2, `.env.example`). Also done with the owner's answers of 2026-11-11: the "Owner decisions" section of `requirements.md` (with 2.5, 6.6 to 6.9 and the new 16.3), the design and tasks adjusted, the moon disc divisor 7.5 to 8 in `moon-disc.ts` with its tests and the rule-compilers design line, and `tech.md` rule 2.
  - Requirements: Departures 2, 3, 5. Verify: grep tool finds `24 KiB` and `5:4` in `frontend.md`, `~~2.1` in ai-editor `requirements.md`, `/ 8;` in `src/compilers/moon-disc.ts`, and `npm test -- test/compilers` passes
  - Done: grep found `24 KiB` and `5:4` in `frontend.md` (lines 70, 80), `~~2.1` in ai-editor `requirements.md` (line 52) and `/ 8;` in `moon-disc.ts` (line 19); `npm test -- test/compilers` → `Test Files  38 passed (38)`, `Tests  236 passed (236)`. The one changed expectation is the inline snapshot of `test/compilers/p601.test.ts` (the disc is now round; owner decision 2).
  - Commit: `docs: server-and-viewer amendments to frontend and ai-editor`

- [x] 2. Toolchain, once the owner says go (npm network use only): the install in the design ("Toolchain"); the five script changes of 1.1; `public/tsconfig.json` with an empty `public/app.js`; `playwright.config.ts` in `tsconfig.json` `include`; `test/scaffold.test.ts` updated.
  - Requirements: 1.1, 1.2, 12.1. Verify: `npm ls --depth=0` lists `@playwright/test@1.65.0` with no `UNMET` or `invalid` line, then `npm test -- test/scaffold.test.ts && npm run typecheck`
  - Done: `npm ls --depth=0` lists `@playwright/test@1.65.0` and no `UNMET` or `invalid` line; `npm test -- test/scaffold.test.ts` → `Test Files  1 passed (1)`, `Tests  16 passed (16)`; `npm run typecheck` (`tsc --noEmit && tsc -p public/tsconfig.json`) exited 0. The owner still runs `npx playwright install chromium` before task 16.
  - Commit: `scaffold: Playwright, server scripts, checkJs for public/`

- [x] 3. Boundaries: extend `test/boundaries.test.ts` with 1.3 to 1.5. It passes with `src/server` holding only what exists.
  - Requirements: 1.3, 1.4, 1.5. Verify: `npm test -- test/boundaries.test.ts && npm run lint`
  - Done: `npm test -- test/boundaries.test.ts && npm run lint` → `Test Files  1 passed (1)`, `Tests  27 passed (27)`; lint exit 0 (`All matched files use Prettier code style!`).
  - Commit: `test: server and client boundaries`

- [x] 4. Config: `src/server/config.ts`, `test/server/config.test.ts`. If ai-editor task 4 already wrote the file, extend it rather than replace it.
  - Requirements: 2.1 to 2.5. Also changes `EditorSettings.editorClient` in `src/editor/editor-types.ts` to `anthropic | fixtures | off` and `createEditorClient` with its test (the code name is `EditorSettings`, not `EditorConfig`). Verify: `npm test -- test/server/config.test.ts test/editor`
  - Done: `npm test -- test/server/config.test.ts test/editor` → `Test Files  22 passed (22)`, `Tests  174 passed (174)`; typecheck and eslint on `src/server test/server` clean.
  - Commit: `server: configuration with zod`

- [x] 5. Clock stamp and User-Agent: `src/pages/stamp-clock.ts` and its test; `userAgent(origin)` in `src/sources/user-agent.ts`, the optional `userAgent` in `http.ts`, `test/sources/user-agent.test.ts`. The existing header tests stay unchanged.
  - Requirements: 5.9, 9.5. Verify: `npm test -- test/pages test/sources/http test/sources/user-agent`
  - Done: `npm test -- test/pages test/sources/http test/sources/user-agent` → `Test Files  16 passed (16)`, `Tests  127 passed (127)`; typecheck and eslint on `src test` clean. The existing header tests in `test/sources/http*.test.ts` are unchanged.
  - Commit: `pages, sources: request clock stamp and User-Agent origin`

- [x] 6. Store: `etag.ts`, `store.ts`, `store.test.ts`, `store.property.test.ts` (Property 4), `test/server/server-arbitraries.ts`.
  - Requirements: 4.1 to 4.4. Verify: `npm test -- test/server/store`, including `Property 4:`
  - Done: `npm test -- test/server/store` → `Test Files  2 passed (2)`, `Tests  13 passed (13)`, including `Property 4: only valid pages are held, a rejected publish keeps the last accepted page, held pages are copies`; `npm run lint` and `npm run typecheck` exit 0.
  - Commit: `server: store with framing gate and ETags`

- [x] 7. Screen renderers: `escape-html.ts`, `render-screen.ts`, `render-screen.property.test.ts` (Property 2), `render-ansi.property.test.ts` (Property 7).
  - Requirements: 9.3, 9.4, 11.1, 11.2. Verify: `npm test -- test/server/render-screen test/server/render-ansi`, including `Property 2:` and `Property 7:`
  - Done: `npm test -- test/server/render-screen test/server/render-ansi` → `Test Files  3 passed (3)`, `Tests  11 passed (11)`, including `Property 2: the spans of each row, read back, equal the text line, and their classes equal the cells' attributes` and `Property 7: without its colour codes the ANSI output is the text output, and each line has one reset, at its end`; typecheck and eslint clean.
  - Commit: `server: screen runs, text and ANSI`

- [x] 8. Document renderers: `views.ts`, `render-alt.ts`, `render-html.ts`, `render-json.ts`, `render-plain.ts`, `render-html.test.ts`, `render-txt.property.test.ts` (Property 1), `render-html.property.test.ts` (Property 3), `etag.property.test.ts` (Property 6).
  - Requirements: 4.4, 9.1, 9.2, 9.5 to 9.7, 10.1, 10.2, 11.3, 11.4. Verify: `npm test -- test/server/render- test/server/etag`, including `Property 1:`, `Property 3:` and `Property 6:`
  - Done: `npm test -- test/server/render- test/server/etag` → `Test Files  7 passed (7)`, `Tests  40 passed (40)`, including `Property 1`, `Property 3` and `Property 6` (and 2 and 7 from task 7); the lint and typecheck are clean. Property 6 was checked to fail when `stale` or `editor` is dropped from the content key.
  - Commit: `server: HTML, fragment, JSON and not-found views`

- [x] 9. Negotiation and assets: `negotiate.ts`, `compress.ts`, `headers.ts`, `assets.ts` and their example tests (q-values, `W/` tags, the font URL rewrite, `FAVICON_SVG` under 300 bytes).
  - Requirements: 8.1, 8.5, 8.6. Verify: `npm test -- test/server/negotiate test/server/compress test/server/assets`
  - Done: `npm test -- test/server/negotiate test/server/compress test/server/assets` → `Test Files  3 passed (3)`, `Tests  46 passed (46)`. `test/boundaries.test.ts` now lets files under `test/server/` also import `node:zlib` and `node:http` (needed to decode bodies and to talk to the app on 127.0.0.1); every other test directory keeps the old list.
  - Commit: `server: encoding choice, compression cache, CSP headers, asset table`

- [x] 10. Router: `router.ts`, `router.test.ts`, `router.property.test.ts` (Property 5), `negotiate.property.test.ts` (Property 9).
  - Requirements: 7.1 to 7.9, 8.1 to 8.6. Verify: `npm test -- test/server/router test/server/negotiate`, including `Property 5:` and `Property 9:`
  - Done: `npm test -- test/server/router test/server/negotiate` → `Test Files  4 passed (4)`, `Tests  63 passed (63)`, including `Property 5` and `Property 9`; lint and typecheck clean.
  - Commit: `server: router with fixed routes and statuses`

- [x] 11. Scheduler: `timers.ts`, `scheduler.ts`, `scheduler.test.ts`, `scheduler.property.test.ts` (Property 8), with fake timers and scripted fetchers and edition runner.
  - Requirements: 5.1 to 5.8, 6.1 to 6.9. Includes the edition gates (boot delay, minimum interval, reuse pass, `free` and `gated` policies) in `scheduler.test.ts`. Verify: `npm test -- test/server/scheduler`, including `Property 8:`
  - Done: `npm test -- test/server/scheduler` → `Test Files  2 passed (2)`, `Tests  27 passed (27)`, including `Property 8` (15 runs of 3 simulated days each; see design note on run count); lint and typecheck clean.
  - Commit: `server: refresh schedule, staleness and background edition`

- [x] 12. Wiring: `app-files.ts`, `app.ts`, `http-server.ts`, `main.ts`, `test/server/app.test.ts` (boot on `127.0.0.1`, health, shutdown, a missing file exits 1). Tell the owner `npm run dev` to try it.
  - Requirements: 3.1 to 3.4, 6.4, 6.9, 2.4. Verify: `npm test -- test/server && npm run build`
  - Done: `npm test -- test/server && npm run build` → `Test Files  19 passed (19)`, `Tests  193 passed (193)`, build exit 0. Also tried `node dist/server/main.js` with `REFRESH=off EDITOR_CLIENT=off PORT=38123` for three seconds: log `boot: 30 pages published, 0 failed, listening on 38123`, `/api/health` 200, SIGTERM → `shutdown: SIGTERM` and exit 0; `PORT=0 node dist/server/main.js` logged `PORT must be an integer from 1 to 65535` and exited 1. To try it yourself: `npm run dev`.
  - Commit: `server: boot, HTTP server and graceful shutdown`

- [x] 13. Stylesheet: `public/app.css`, `test/public/font-coverage.test.ts`, `test/public/app-css.test.ts` (13.1 colour values against `COLOUR_RGB`, no motion).
  - Requirements: 13.1 to 13.5. Verify: `npm test -- test/public && npm run lint`
  - Done: `npm test -- test/public && npm run lint` → `Test Files  2 passed (2)`, `Tests  31 passed (31)`; lint exit 0. `app.css` is 6,025 bytes of the 6,144 budget. Owner's viewer notes applied: near-black page, dark keys, solid colour bars, keypad right of the screen from 62rem wide and 4:3, no CRT effects. Added a thin `<div class="foot">` (About 801, Source on GitHub) after the keypad in `render-html.ts` with one test; the GitHub link is an outbound link outside 801 and the text alternative, which `frontend.md` limits, so this is an owner-requested departure to note in the spec. The layout is checked visually in task 16/17, not by unit tests.
  - Commit: `public: screen stylesheet and font coverage`

- [x] 14. Client script: `public/app.js`, `test/public/app-source.test.ts` (1.5).
  - Requirements: 1.5, 12.1 to 12.10. Verify: `npm run typecheck && npm test -- test/public && npm run lint`
  - Done: `npm run typecheck` exit 0 (both `tsc` runs); `npm test -- test/public` → `Test Files  3 passed (3)`, `Tests  42 passed (42)`; `npm run lint` exit 0. `app.js` is 11,935 bytes of 12,288 (a first draft was 12,317 and was cut in the code, not the budget). Behaviour in a browser is proved by task 16.
  - Commit: `public: client script`

- [x] 15. Budgets: `scripts/lib/payload.ts`, `scripts/payload.ts`, `test/scripts/payload.test.ts`. A budget that fails is fixed in the code; raising one needs the owner.
  - Requirements: 14.1, 14.2, 14.3. Verify: `npm run payload` (quote the table) and `npm test -- test/scripts/payload`
  - Done: `npm run payload` exit 0, table: First load of /100 (br) 11552 of 24576 B; largest HTML (br) 1903 of 6144 B (`/300`); largest fragment (br) 1091 of 4096 B (`/300.frag`); app.js 11935 of 12288 B; app.css 6038 of 6144 B (served size, after the font URL rewrite); font 4624 of 6144 B; all `ok`. `npm test -- test/scripts/payload` → `Test Files  1 passed (1)`, `Tests  12 passed (12)` (includes a check that `BUDGETS` equals the table in `frontend.md`). The CSS has 106 bytes of room: the next CSS addition must come with a cut.
  - Commit: `scripts: byte budgets`

- [x] 16. Browser tests: `playwright.config.ts`, `test/e2e/guard.ts` and the seven spec files. Blocked until the owner has run `npx playwright install chromium`.
  - Requirements: 12.2 to 12.10, 13.2, 13.3, 15.1, 15.2. Verify: `npm run e2e` (quote the passed count)
  - Done: `npm run e2e` → `41 passed (4.0s)` (headless Chromium against `dist/server/main.js`; the seven specs keys, rotation, reveal-text, phone, no-js, not-in-service, a11y). `npm test` → `Test Files  142 passed (142)`, `Tests  1165 passed (1165)`. Changes the tests forced, all in the code or the guard: the footer links got a 44 px minimum width and an 8 px row gap; `.js .reveal` is hidden (an invisible checkbox in the tab order); `.alt:focus-within` shows the text alternative so a link inside it is never focused unseen; `test/boundaries.test.ts` now lets `test/e2e/` import `@playwright/test` (tech.md: Playwright is for e2e only). The guard has two documented exceptions, not weakenings: a Chromium 404 console line for `/NNN` and `/NNN.frag` (the designed not-in-service answer, 7.2 and 12.5) and the `style` attribute Chromium adds to its own plain-text viewer on `/550.txt`.
  - Commit: `test: browser tests in Chromium`

- [x] 17. Screenshots: `scripts/screenshots.ts`, then `npx tsx scripts/screenshots.ts`.
  - Requirements: 15.3. Verify: `ls docs/screens` lists 34 `.png` files
  - Done: `npx tsx scripts/screenshots.ts` → `34 screenshots in docs/screens`; `ls docs/screens/*.png | wc -l` → `34`. Looking at the desktop and phone shots found the four colour keys drawn dark (the generic key background beat the colour class); fixed by moving the `.b*` rules after the controls in `app.css`, and a computed-style check then gave red, green, yellow and blue bars with black, black, black and white text.
  - Commit: `docs: desktop and phone screenshots`

- [x] 18. Deploy files: `Dockerfile`, `.dockerignore`, `render.yaml`, `scripts/lib/runtime-copies.ts`, `scripts/env-example.ts`, `.env.example` (written by Kiro directly, `tech.md` rule 2), `test/deploy/deploy-files.test.ts` (which also fails unless `.env.example` equals what `scripts/env-example.ts` prints).
  - Requirements: 16.1 to 16.4. Verify: `npm test -- test/deploy`
  - Done: `npm test -- test/deploy` → `Test Files  1 passed (1)`, `Tests  15 passed (15)`; lint and typecheck clean. `render.yaml` includes `PORT: "3000"` (16.3 says every other variable) although the design notes Render sets `PORT` itself; Render honours a set `PORT`, and it matches `EXPOSE 3000`. Docker itself is not run here (task 19 proves the layout).
  - Commit: `deploy: Dockerfile, render.yaml, env example`

- [x] 19. Runtime layout without Docker: `scripts/runtime-check.ts`, run with the owner's go-ahead (its `npm ci` uses the npm network).
  - Requirements: 16.5, 3.4. Verify: `npx tsx scripts/runtime-check.ts` prints `runtime check passed` and exits 0
  - Done: `npx tsx scripts/runtime-check.ts` → `added 9 packages`, `boot: 30 pages published, 0 failed, listening on 62929`, `shutdown: SIGTERM`, `runtime check passed`, exit 0. The temporary directory (under the OS temp dir, as the design says, so a missing runtime dependency cannot be masked by the repository's `node_modules`) was removed and no server process was left.
  - Commit: `scripts: prove the runtime image layout`

- [x] 20. Full gate. Fix failures in the code or data, never by weakening a check, schema or test (`tech.md`, rule 3).
  - Requirements: 17.1, 17.2. Verify: `npm run typecheck && npm run lint && npm test && npm run build && npm run grid:check && npm run payload`, then `npm run e2e`; quote the `Test Files` and `Tests` lines
  - Done: `npm run typecheck && npm run lint && npm test && npm run grid:check && npm run payload && npm run e2e` exit 0 (`npm run build` exit 0 earlier in the session; the e2e web server builds again): `Test Files  143 passed (143)`, `Tests  1180 passed (1180)`, `30 pages, 43 screens, 0 problems`, payload all `ok`, `41 passed (3.9s)`.
  - Commit: none unless a fix was needed

- [x] 21. Counts: `npx vitest list | grep -cE "Property [0-9]+:"` prints 61 (52 before this spec, plus 9), and `grep -cE "^Property [0-9]+:" .kiro/specs/server-and-viewer/design.md` prints 9.
  - Requirements: 17.1. Verify: the two commands above and `npm test`
  - Done: `npx vitest list | grep -cE "Property [0-9]+:"` → `61`; `grep -cE "^Property [0-9]+:" .kiro/specs/server-and-viewer/design.md` → `9`; `npm test` → `Test Files  143 passed (143)`, `Tests  1180 passed (1180)`.
  - Commit: `docs: server-and-viewer test counts`
