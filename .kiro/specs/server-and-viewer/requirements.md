# server-and-viewer: requirements

Spec for `src/server` (configuration, boot, store, scheduler, renderers, router, headers, compression), `public/` (client script and stylesheet), the byte budgets, the Playwright tests and the deploy files. Contracts: `frontend.md` (no-JavaScript baseline, text alternative, keyboard map, keypad, focus, motion, budgets, CSP), `grid-rules.md` (rows, colours, mosaics), `sources.md` (schedule, staleness, logging), `tech.md` (configuration, scripts, secrets), `product.md` (non-negotiables 3 to 7), the pages-and-sources design ("Types", "Frame rows", "Schedule"), the rule-compilers design ("compileAll", `ServiceStatus`) and the ai-editor design ("Types", "Budget, cache and status", "Logging"). This spec does not restate them; it fixes what they leave open.

## Glossary

- **Published page**: an immutable `PublishedPage` held by the store (design, "Types"). **Screen**: one subpage as a `ValidPage`. **Format**: `html`, `frag`, `txt`, `ansi` or `json`.
- **Run**: a maximal sequence of cells in one row with equal `fg`, `bg` and `conceal`, split also at the fixed boundaries of 9.4.
- **Terminal agent**: a request whose `User-Agent` starts with `curl/` or `Wget/`.
- **Content key**: everything a format shows except the clock cells (row 0, cols 21 to 39); the page ETag is its hash (design, "Store and ETags").
- **Affected pages** of a source S: the registry pages whose `source` is S, plus 601 and 802.
- **Edition**: one `runEdition` call (ai-editor). **Snapshot time**: the latest `fetchedAt` in the boot snapshot.

## Departures

1. **Merged spec.** `kiro-workflow.md` plans `server`, `frontend` and `deploy` as three specs. The owner merged them; the renderers, the client and the budgets cannot be tested apart.
2. **Screen shape 5:4.** `frontend.md` ("Layout") and the brief say 4:3. Bedstead Extended advances 0.75em; with `line-height: 1` the 40 x 24 screen is 30em by 24em, 5:4 (`public/fonts/README.md`). Decided by the owner. The rule-compilers moon disc assumes 4:3 (open question 2).
3. **Budgets lowered.** `frontend.md` allows lowering freely. Requirement 14.1 sets the new values; task 1 writes them into `frontend.md`.
4. **Local clock.** `grid-rules.md` row 0 is a UTC clock. The server renders UTC; once the script runs it shows the viewer's local time in the same format (owner decision). Content times stay UTC.
5. **Configuration moves here.** ai-editor requirements 2.1 to 2.3 move to requirement 2 (struck there by task 1). `EDITOR_CLIENT` becomes `anthropic | fixtures | off`, default `anthropic`; `anthropic` without a key means no client, as ai-editor's `auto` did, so ai-editor 3.4 and `EditorConfig` change to match. New variables `REFRESH` and `PUBLIC_ORIGIN`; `tech.md`'s table needs the owner's edit.
6. **`typecheck` script.** `tech.md` gives `tsc --noEmit`. It becomes `tsc --noEmit && tsc -p public/tsconfig.json`, so `app.js` is checked too.
7. **Favicon.** `frontend.md` says "no images anywhere". `/favicon.svg` is one small SVG written in code (owner decision); without it Chromium requests `/favicon.ico` and logs a 404.
8. **Reveal selector.** `frontend.md` gives `#reveal:checked ~ .screen .conceal`. The checkbox sits outside the swapped region, so the rule is `#reveal:checked ~ .view .conceal`. Same mechanism, no script.
9. **User-Agent host.** `src/sources/user-agent.ts` holds a constant. `createHttpClient` gains an optional `userAgent`, built from `PUBLIC_ORIGIN` (`sources.md`, "HTTP client"). This amends pages-and-sources code without changing its default.
10. **Midnight jitter.** `sources.md` adds up to 10% jitter to each interval. For on this day that is 2.4 hours after midnight; here it is at most 300 s, and a failed day's fetch retries every 30 minutes (5.2).

## Decisions where steering is silent

- `/` renders page 100; it does not redirect. `?s=N` is 1-based (pages-and-sources). `.json` carries every subpage and ignores `s`.
- `REFRESH=off` compiles at the snapshot time, so tests, payload and screenshots are deterministic.
- The text alternative is visually hidden until the text view opens; it is always in the accessibility tree.
- Hold and Reveal reset on a page change; the text view stays open.
- Links inside the text alternative navigate normally, so the script never removes a focused control.
- `EDITOR_CLIENT=fixtures` reads `test/fixtures/editor/*.json` at boot; the Docker image has none, so it publishes rules pages.
- `.env.example` is printed by `scripts/env-example.ts` and written by the owner, because `tech.md` rule 2 and the planned guard hook stop Kiro from touching `.env*` paths.

## Requirement 1: Project changes and boundaries

**User story:** As a reviewer, I want request handling unable to reach a source or the model, so that non-negotiable 3 holds by construction.

1.1 THE `package.json` scripts SHALL be the rule-compilers list with `typecheck` as in Departure 6, plus `dev`, `start`, `payload` and `e2e` exactly as `tech.md` gives them, AND `test/scaffold.test.ts` SHALL check that list exactly.

1.2 THE `devDependencies` SHALL add exactly `"@playwright/test": "1.65.0"`, AND `dependencies` SHALL stay as ai-editor 1.1 sets them.

1.3 IN `src`, ONLY `src/server/config.ts` SHALL read `process.env`; ONLY `src/server/app-files.ts` SHALL import `node:fs`; ONLY `src/server/http-server.ts` SHALL import `node:http`; ONLY `src/server/compress.ts` SHALL import `node:zlib`.

1.4 THE files `router.ts`, `render-*.ts`, `views.ts`, `negotiate.ts`, `compress.ts` and `headers.ts` in `src/server` SHALL import from `src/sources`, `src/editor`, `src/compilers` and `scheduler.ts` with `import type` only, AND no file outside `src/server`, `scripts` and `test` SHALL import `src/server`.

1.5 THE file `public/app.js` SHALL import nothing, AND SHALL not contain `eval`, `new Function`, `localStorage`, `sessionStorage`, `document.cookie`, `.style` or `"style"`.

## Requirement 2: Configuration

**User story:** As the owner, I want every setting read and checked once, so that a bad deploy fails at boot.

2.1 THE function `loadConfig(env = process.env)` SHALL return `{ ok: true, config }` or `{ ok: false, problems }`, validated with zod, AND SHALL never throw.

2.2 THE config SHALL hold `port` (`PORT`, integer 1 to 65535, default 3000), `anthropicApiKey` (`null` when unset or empty), `editorModel` (default `claude-opus-5-5`), `maxModelCallsPerDay` (0 to 10,000, default 60), `editorMaxCallsPerBoot` (0 to 10,000, default 30), `editorClient` (`anthropic`, `fixtures` or `off`, default `anthropic`), `refresh` (`on` or `off`, default `on`) and `publicOrigin` (`null`, or an `https://` origin with no path, query or fragment), AND the module SHALL export `ENV_VARIABLES`, each variable's name and default in that order.

2.3 IF a variable is invalid, THEN THE result SHALL hold one problem per variable that names it and its rule (`PORT must be an integer from 1 to 65535`) and contains no variable's value.

2.4 NO log line, response body or response header of the server SHALL contain the value of `ANTHROPIC_API_KEY`.

## Requirement 3: Boot and shutdown

**User story:** As a visitor, I want every page ready at the first request, so that I never see an empty service.

3.1 AT boot, THE server SHALL read exactly these files, relative to the app root (the parent of `src/server` or `dist/server`): `src/sources/snapshot/snapshot.json`, `pages/666.page`, `pages/800.page`, `pages/801.page`, `pages/899.page`, `public/app.js`, `public/app.css`, `public/fonts/bedstead-extended-subset.woff2`, and WHERE `editorClient` is `fixtures`, `test/fixtures/editor/*.json`. It SHALL read no file after boot.

3.2 IF the config fails, a file is missing, or the snapshot fails `parseSnapshot`, THEN THE server SHALL log one line naming the variable, file or issue paths, exit with code 1, and not listen.

3.3 THE server SHALL run `compileAll` on the snapshot, publish every returned page, and only then listen on `port`, AND the boot compile time SHALL be the clock WHILE `refresh` is `on` and the snapshot time WHILE it is `off`.

3.4 WHEN the process receives `SIGTERM` or `SIGINT`, THE server SHALL clear every scheduler timer, stop accepting connections, log one line, and exit with code 0 once open requests finish, or with code 1 after 10 s.

## Requirement 4: Store

**User story:** As the server, I want one gate between compiled pages and visitors, so that nothing invalid is ever served (`grid-rules.md`, invariant 2).

4.1 THE store SHALL be the only holder of published pages, AND `publish(compiled, { now, stale })` SHALL return `{ ok: true, page }` or `{ ok: false, codes }`, where `page` is deeply frozen and shares no object with the input.

4.2 THE store SHALL accept a page only when `findPage(compiled.number)` is defined, `checkCompiledPage` returns no problem, and `buildScreen` succeeds for every subpage with `lastGoodAt` equal to `dataAt`.

4.3 IF a publish is rejected, THEN THE store SHALL keep the previous version (the same object) and add 1 to that number's failure count.

4.4 THE page ETag SHALL be a hash of the content key, so two versions have the same ETag exactly when their content keys are equal.

## Requirement 5: Scheduler

**User story:** As the owner, I want sources fetched on their schedule only, so that visitors never cause a fetch and providers are not overloaded.

5.1 WHILE `refresh` is `on`, THE scheduler SHALL fetch each source once just after listening starts, then each `intervalMs × (1 + JITTER_FRACTION × r)` after the last attempt, with r from the injected `random` in [0, 1).

5.2 THE source `wikimedia-onthisday` SHALL be fetched at the first 00:00 UTC after its last success plus up to 300 s of jitter, AND IF a fetch fails, THEN again 30 minutes later, until a success on the current UTC day.

5.3 THE scheduler SHALL keep `launch-library` requests at least 3,600,000 ms apart, failures included, AND WHEN a source answers 429, SHALL not fetch it again before the larger of its next interval and `retryAfterMs`.

5.4 WHEN a fetch succeeds, THE scheduler SHALL replace that source's snapshot entry, run `compileAll` at the current time, publish the affected pages, and log one line.

5.5 WHEN a fetch fails or throws, THE scheduler SHALL keep the entry and log one line with the source, URL, failure kind, status and issue paths, never a body.

5.6 THE scheduler SHALL publish each source page with `stale` equal to `isStale(source, fetchedAt, now)`, AND SHALL set a timer at `fetchedAt + staleAfterMs + 1` that republishes that source's pages when no newer success has come.

5.7 WHILE `refresh` is `off`, THE scheduler SHALL make no fetch and set no timer.

5.8 THE scheduler SHALL take its timers, clock, `random`, fetchers and edition runner as arguments, AND SHALL have at most one fetch in flight per source.

5.9 THE HTTP client SHALL send `userAgent(publicOrigin)`: `USER_AGENT` WHILE `publicOrigin` is `null`, else the same text with `+<publicOrigin>/801`.

## Requirement 6: Editor edition

**User story:** As a reader, I want the edited pages when a key is set, without slowing any request.

6.1 WHEN the boot pages are published, and after each successful `wikimedia-feed` or `wikimedia-onthisday` fetch, THE scheduler SHALL start an edition in the background WHERE an editor client exists.

6.2 THE scheduler SHALL run at most one edition at a time, AND a trigger during an edition SHALL cause exactly one more edition after it ends.

6.3 THE scheduler SHALL publish a page an edition returns only WHILE the `fetchedAt` of the source it was built from is unchanged since the edition started, AND SHALL recompile and publish page 802 after each edition and each successful fetch with the status mapped as the ai-editor design gives it.

6.4 THE app SHALL create one call budget (`maxModelCallsPerDay`, `editorMaxCallsPerBoot`) and one draft cache per process, AND SHALL pass the global `fetch` to `createEditorClient`.

6.5 THE scheduler SHALL log one line per edition and forward the editor's own lines unchanged.

## Requirement 7: Routes

**User story:** As a visitor, a screen reader user or a `curl` user, I want each page at a stable URL in the format I need.

7.1 THE router SHALL answer the routes of the design table "Routes" and nothing else, AND SHALL never touch the file system.

7.2 WHEN the path is `/` or matches `^/([0-9]{3})(\.(txt|ansi|json|frag))?$`, THE router SHALL classify the number with `lookupPage`: in service and published gives 200; in service and unpublished gives 503 with `Retry-After: 60`; not in service gives the not-in-service screen with 404; anything else gives the plain 404 page.

7.3 THE query `s` SHALL select a subpage when it matches `^[1-9]$` and is at most the subpage count; an absent `s` means 1; IF any other value is given, THEN THE router SHALL answer 404 with the missing-subpage screen in the requested format.

7.4 WHEN the query has `reveal=1`, THE `txt` and `ansi` formats SHALL show concealed cells and the `html` format SHALL render the reveal checkbox `checked`.

7.5 WHEN a terminal agent requests `/` or `/:page`, THE router SHALL answer in `ansi`.

7.6 WHEN `/go` has `p` matching `^[0-9]{3}$`, THE router SHALL answer 303 with `Location: /<p>`; IF not, THEN 400 with the plain page and the form.

7.7 THE router SHALL accept only `GET` and `HEAD`, answer any other method with 405 and `Allow: GET, HEAD`, and answer `HEAD` with the `GET` headers and no body.

7.8 THE route `/api/health` SHALL answer 200 `ok` once the store holds a page, else 503, AND `/api/status` SHALL answer the JSON of the design.

7.9 THE router SHALL never throw, AND every status SHALL be one of 200, 303, 304, 400, 404, 405, 503, or 500 from a last-resort catch that no test reaches.

## Requirement 8: Headers, caching and compression

**User story:** As a visitor on a slow link, I want small, cacheable, safe responses.

8.1 EVERY response SHALL carry the `Content-Security-Policy` of `frontend.md` exactly, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `Cross-Origin-Opener-Policy: same-origin`, a `Content-Type` and a `Content-Length`, AND no `Set-Cookie`.

8.2 THE `Cache-Control` SHALL be `public, max-age=60` for every page format and not-found screen, `public, max-age=31536000, immutable` for `/assets/*`, `public, max-age=86400` for `/robots.txt` and `/favicon.svg`, and `no-store` otherwise.

8.3 THE responses for `/` and `/:page` SHALL carry `Vary: Accept-Encoding, User-Agent`, AND every other compressible response `Vary: Accept-Encoding`.

8.4 EACH page and asset response SHALL carry a strong ETag for its representation (design), AND WHEN `If-None-Match` matches it, THE router SHALL answer 304 with no body.

8.5 THE router SHALL encode with `br` when acceptable, else `gzip`, else identity (RFC 9110 q-values), AND SHALL never encode `woff2`.

8.6 THE router SHALL cache each compressed page body under its ETag and clock text, keep one entry per ETag and encoding, and drop the entries of a page version that has been replaced; assets SHALL be compressed once at boot.

## Requirement 9: HTML document

**User story:** As a visitor without JavaScript, I want a complete page with every control as a plain link or form.

9.1 THE document SHALL be `<!doctype html>`, `<html lang="en">`, a head with charset, viewport, `color-scheme`, `<title>` as `frontend.md` gives it, a meta description, one stylesheet, a font preload, `/favicon.svg` and one `<script type="module">` (deferred by default), AND SHALL contain no inline script, style element, `style` attribute or `on*` attribute.

9.2 THE body SHALL contain the reveal checkbox and its label, the view (the `frag` output byte for byte), the quick-link and movement navigation, the form of `frontend.md`, the keypad with `hidden`, and one `aria-live="polite"` region.

9.3 THE screen SHALL be `<div class="screen" aria-hidden="true">` with 24 row elements, each a sequence of runs as `<span>`s whose classes give `fg`, `bg` and `conceal`, and whose text is the cells' characters.

9.4 A mosaic cell SHALL be written as `mosaicCodePoint(bits)`, or U+1CE51 + bits - 1 when separated, AND runs SHALL also split at row 0 cols 3/4 and 20/21 and row 1 cols 34/35, so the page number, clock and subpage indicator are their own spans.

9.5 EVERY format SHALL show `formatHeaderClock(request time)` in row 0, cols 21 to 39, written by `stampClock` in `src/pages`, which re-validates the screen.

9.6 EVERY string from data SHALL be escaped (`&`, `<`, `>`, `"`, `'`) in text and attributes, AND an alt link to a URL SHALL be an `<a>` only when its scheme is `https:`, otherwise plain text.

9.7 THE previous and next page links SHALL use `previousInService` and `nextInService`, AND the subpage links SHALL wrap, or have no `href` and `aria-disabled="true"` WHEN the page has one subpage.

## Requirement 10: Text alternative

**User story:** As a screen reader user, I want the page as real structure, not 960 cells.

10.1 THE view SHALL contain `<section id="alt">` holding one `<h1>` (`<number> <title>`), then `Subpage n of m` as a paragraph when m > 1, then the subpage's alt blocks mapped as the design table "Alt blocks" gives.

10.2 THE section SHALL end with the row 22 paragraph of the design, built from `ATTRIBUTION`, `dataAt` and `stale`, not read from the grid, AND SHALL have none for `static` pages; THE document SHALL contain exactly one `<h1>`.

## Requirement 11: Text, ANSI, JSON and fragment formats

**User story:** As a terminal user or a script, I want each page in a plain format with the same content.

11.1 THE `txt` format SHALL be 24 lines of exactly 40 code points, each ending in LF: a text cell's `ch`, a mosaic's `mosaicCodePoint(bits)` (separated too), and a space for a concealed cell unless revealed.

11.2 THE `ansi` format SHALL prefix each run with `ESC[38;2;R;G;Bm` and `ESC[48;2;R;G;Bm` from `COLOUR_RGB` and end each line with `ESC[0m` and LF, with the characters of `txt`.

11.3 THE `json` format SHALL hold `number`, `title`, `editor`, `dataAt`, `stale` and `subpages`, each with `rows` (the 24 lines of `serialisePage`, without LF) and `alt`.

11.4 THE `frag` format SHALL be the `#view` element with the data attributes of the design, containing the screen and the text alternative, AND the not-in-service and missing-subpage screens SHALL go through the store's framing and the same renderers.

## Requirement 12: Client script

**User story:** As a visitor with JavaScript, I want the remote-control feel without losing anything from the baseline.

12.1 THE file `public/app.js` SHALL be an ES module in plain JavaScript with JSDoc types that `tsc -p public/tsconfig.json` checks with `checkJs` and `strict`.

12.2 WHEN the script starts, THE client SHALL add class `js` to `<html>`, remove `hidden` from the keypad and script-only controls, and hide the no-script reveal label and text link.

12.3 THE client SHALL implement the keyboard map of `frontend.md`, AND SHALL ignore keys while focus is in an `input`, `textarea`, `select` or editable element, or Ctrl, Alt or Meta is held.

12.4 WHILE digits are being typed, row 0 cols 0 to 3 SHALL show `P` plus the digits padded with `-`; WHEN the third digit is typed, THE client SHALL load that page.

12.5 WHEN the client loads a page or subpage, it SHALL fetch `/<n>.frag` (with `?s=`), AND WHEN the answer is 200 or 404 with a `#view` root, SHALL replace the view, update the navigation, title and history (`pushState` for pages, `replaceState` for subpages) and announce user-started changes in the live region; otherwise SHALL navigate normally.

12.6 WHEN `popstate` fires, THE client SHALL load the state's page without adding history.

12.7 THE client SHALL rotate subpages every 12 s WHILE the page has more than one subpage, Hold is off, `prefers-reduced-motion: reduce` does not match, the document is visible, the text view is closed and focus is outside the view; rotation SHALL not be announced, AND WHILE Hold is on, row 1 cols 35 to 39 SHALL read ` HOLD`.

12.8 THE client SHALL tick the clock every second in local time in the format of `formatHeaderClock`, AND SHALL reapply the clock, typed digits and Hold text after every swap.

12.9 THE text view (key T and its button with `aria-pressed`) SHALL show the same `#alt` element and hide the screen.

12.10 THE client SHALL never move focus, never intercept links inside `#alt`, and make no request except same-origin fragment fetches.

## Requirement 13: Stylesheet and font

**User story:** As a visitor on any device, I want the largest screen that fits, in the real teletext font.

13.1 THE file `public/app.css` SHALL define the eight colours of `grid-rules.md` exactly as custom properties and classes `f<letter>` and `b<letter>` (`COLOUR_LETTER`), give a `.conceal` run a transparent foreground over its background until `#reveal:checked`, AND SHALL contain no `transition`, `animation` or `@keyframes`.

13.2 THE screen SHALL be 30em by 24em in the Bedstead subset at `line-height: 1`, with a font size from container query units so that it is the largest that fits beside the keypad on wide viewports and full width above it on narrow ones, AND no viewport from 320 CSS px wide SHALL scroll horizontally.

13.3 FOCUS SHALL be a 3 px outline with at least 3:1 contrast against the page background, AND touch targets SHALL be at least 44 x 44 CSS px with 8 px between them.

13.4 UNDER `forced-colors: active` the screen SHALL keep its colours and controls SHALL use system colours, AND print SHALL show only the text alternative.

13.5 THE file `public/fonts/bedstead-extended-subset.coverage.json` SHALL contain every code point of `REPERTOIRE`, `mosaicCodePoint(v)` for v from 1 to 63, and U+1CE51 to U+1CE8F.

## Requirement 14: Byte budgets

**User story:** As a visitor on a slow link, I want every byte budget enforced by a test.

14.1 THE budgets SHALL be: first load of `/100` (HTML, CSS, JS, font, favicon, brotli where served so) 24 KiB; any page's HTML document, brotli, 6 KiB; any `/:page.frag`, brotli, 4 KiB; `app.js` uncompressed 12 KiB; `app.css` uncompressed 6 KiB; font 6 KiB.

14.2 THE function `measurePayload()` SHALL start the app in-process with `refresh` and `editorClient` `off` on `127.0.0.1` and a free port, request with `node:http` and `Accept-Encoding: br` `/100`, every asset it references, and the HTML and fragment of every subpage of every in-service page and of `/123`, and return each item's bytes.

14.3 THE `payload` script SHALL print one table row per budget and exit 1 when any is over, AND a vitest test SHALL assert the same with the same function.

## Requirement 15: Browser tests

**User story:** As the owner, I want the no-script baseline and the client checked in a real browser.

15.1 THE file `playwright.config.ts` SHALL run Chromium only, headless, and start `node dist/server/main.js` after `tsc -p tsconfig.build.json` on a free port with `REFRESH=off` and `EDITOR_CLIENT=off`. The owner installs the browser with `npx playwright install chromium`.

15.2 THE `test/e2e` suite SHALL contain each scenario of the design table "Browser tests", AND every test SHALL fail on a request to another origin or a console error.

15.3 THE script `scripts/screenshots.ts` SHALL save desktop (1280 x 800) and phone (390 x 844) screenshots of the design's page list to `docs/screens/<page>-<desktop|phone>.png`.

## Requirement 16: Deploy

**User story:** As the owner, I want the image layout proved on a machine without Docker.

16.1 THE `Dockerfile` SHALL have a build stage and a runtime stage on `node:22-slim` as the design gives them, with a `HEALTHCHECK` on `/api/health` and `CMD ["node","dist/server/main.js"]`.

16.2 THE `.dockerignore` SHALL exclude at least `node_modules`, `dist`, `.git`, `.env`, `.env.*`, `test`, `docs` and `.kiro`.

16.3 THE `render.yaml` SHALL define one `web` service with `runtime: docker`, `plan: free`, `healthCheckPath: /api/health`, `ANTHROPIC_API_KEY` and `PUBLIC_ORIGIN` with `sync: false`, and every other variable of `ENV_VARIABLES` with its default, AND `scripts/env-example.ts` SHALL print one `NAME=default` line per variable, with an empty key.

16.4 THE module `scripts/lib/runtime-copies.ts` SHALL export `RUNTIME_COPIES`, AND a test SHALL fail unless the runtime stage's `COPY` lines are exactly that list in order.

16.5 THE script `scripts/runtime-check.ts` SHALL build, copy exactly `RUNTIME_COPIES` into a temporary directory, run `npm ci --omit=dev` there, start the server with `REFRESH=off`, get 200 from `/api/health`, `/100` and each asset, send `SIGTERM`, and pass only when the process exits 0 within 10 s.

## Requirement 17: Tests and gate

**User story:** As a reviewer, I want every rule here checked by a test that ran.

17.1 THE test suite SHALL contain one fast-check test per property in `design.md`, named `Property N:`, using the real store, frame builder, renderers, router and validators, AND SHALL make no request beyond `127.0.0.1`.

17.2 WHEN the feature is complete, `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`, `npm run grid:check` and `npm run payload` SHALL each exit 0, AND `npm run e2e` SHALL pass once the owner has installed Chromium.
