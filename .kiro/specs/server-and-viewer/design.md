# server-and-viewer: design

Requirements: `requirements.md`. Contracts: `frontend.md`, `grid-rules.md`, `sources.md`, `tech.md`, and the pages-and-sources, rule-compilers and ai-editor designs. Existing code used: `validateGrid`, `serialisePage`, `parseContent`, `validateContentRows`, `mosaicCodePoint`, `REPERTOIRE`, `COLOUR_RGB`, `COLOUR_LETTER`, `REGISTRY`, `findPage`, `lookupPage`, `previousInService`, `nextInService`, `buildScreen`, `checkCompiledPage`, `notInServicePage`, `formatHeaderClock`, `formatUtcTime`, `ATTRIBUTION`, `SCHEDULE`, `JITTER_FRACTION`, `isStale`, `FETCHERS`, `createHttpClient`, `realDelay`, `USER_AGENT`, `parseSnapshot`, `SOURCE_IDS`. From specs being implemented, used as their designs give them: `compileAll`, `compile802`, `ServiceStatus`, `PageFiles` (rule-compilers); `runEdition`, `emptyEditorStatus`, `EditorStatus`, `createEditorClient`, `createCallBudget`, `createDraftCache`, `EditorFixture`, `EditorSettings` (ai-editor).

## Names in the code

ai-editor and rule-compilers are implemented, and where their real names differ from the first draft of this design the code wins. Differences found while implementing tasks 1 to 12, and the choices made where the draft left a gap:

- ai-editor's settings type is `EditorSettings` (`src/editor/editor-types.ts`), not `EditorConfig`; its `editorClient` is now `"anthropic" | "fixtures" | "off"` and `createEditorClient(settings, fetch, fixtures)` returns `null` for `off`. `Config extends EditorSettings`.
- `EditorDeps` is `{ client, budget, cache, log }`. The scheduler's runner is `(snapshot, status, now, mode) => Promise<EditionResult>` with `mode` `"spend"` or `"reuse"` (see "Scheduler"); `createApp` builds it over `runEdition`.
- `ENV_VARIABLES` is an array of `{ name, default }`. `realTimers()` is a function returning `Timers`. `nextDelay` returns the time of the next attempt in milliseconds since the epoch. `SchedulerDeps` also holds `editor: { run, policy } | null`, `modelCallCap` (shown on 802 before the first edition) and an optional `compile` (default `compileAll`; Property 8 uses a stand-in so that three simulated days stay cheap).
- `createStore({ aiEditor })` takes the one fact that cannot be read from the store. `framePage(def, compiled, frame)` returns a `PublishOutcome`; not-found views are `{ ...page, etag: "" }`. `contentKey` and `pageEtag` take a `KeyParts` object.
- `missingSubpageView(page, now)` takes the published page (it needs the subpage count), not `(def, now)`. `renderHtml(view, urls)` and `renderPlain(kind, terminal, urls)` take the `AssetUrls`, which `render-html.ts` defines and `assets.ts` re-exports. `screenOf(view)` (the stamped screen of a view) is exported by `render-html.ts`. `renderScreenHtml`, `renderTxt` and `renderAnsi` take a screen that is already stamped; the router stamps.
- The router creates its own body cache and drops the entries of a replaced page version when it next serves that page, so `RouterDeps` stays `{ store, assets, clock }`. `createRouter` returns a `Router` function type.
- Starting is split so tests can run it: `run.ts` exports `startServer(options)` (config, files, `createApp`, listen, `scheduler.start()`, log line) returning `{ ok: false, problems }` or `{ ok: true, port, app, shutdown() }`; `main.ts` only turns that into an exit code and signal handlers. `app-files.ts` exports `appRoot()`, `readAppFiles(root, withFixtures)` and `parseSnapshotText`. `createApp` returns `{ router, scheduler, store, assets, boot }` and itself calls `scheduler.boot()`. `startHttpServer(router, port, host)` returns `{ port, close() }`.
- For a `HEAD` response `Content-Length` is that of the `GET` body and the body is empty; for a `304` it is `0` (Property 5 below says the same).
- `public/app.css` is a one-line placeholder until task 13, because boot reads it (3.1); `public/app.js` is empty until task 14.
- `test/boundaries.test.ts` lets files under `test/server/` also import `node:zlib` and `node:http`; the other test directories keep the old list.
- Property 8 runs 15 times, not 100: each run simulates three days (about 1,300 fetches) on the real store.

## Overview

```
main.ts ─> loadConfig ─> readAppFiles (boot only) ─> createApp
                                                      │
 snapshot ─> compileAll ─> store.publish ──────────┐  │  scheduler (timers, clock, random injected)
 FETCHERS ─(schedule)─> snapshot entry ─> compileAll ─> store.publish (affected pages, then 802)
 runEdition (background, one at a time) ───────────┘  │
                                                      v
 http-server.ts ─> RouterRequest ─> router(store, assets, clock) ─> view ─> render-* ─> negotiate/compress ─> RouterResponse
                                         (no fetcher, no editor, no file system)
 browser ─> /NNN (html) ─> app.js ─> /NNN.frag ─> swap #view
```

## Toolchain

`npm view @playwright/test version engines dependencies` on 2026-11-11 (nothing installed): 1.65.0 is latest, `engines` `node >=20`, depends only on `playwright` 1.65.0. Install (task 2, after the owner's go-ahead; npm network use only): `npm install --save-dev --save-exact @playwright/test@1.65.0`. The owner then runs `npx playwright install chromium`. No runtime dependency is added.

## Files

| File | Exports |
|---|---|
| `src/server/config.ts` | `loadConfig`, `Config`, `ENV_VARIABLES` |
| `src/server/app-files.ts` | `readAppFiles(root, withFixtures)`, `appRoot`, `parseSnapshotText`, `AppFiles` (the boot reads of 3.1) |
| `src/server/assets.ts` | `buildAssets`, `AssetTable`, `Asset`, `AssetUrls`, `FAVICON_SVG`, `ROBOTS_TXT` |
| `src/server/store.ts`, `etag.ts` | `createStore`, `Store`, `StoreReader`, `PublishedPage`, `PublishOutcome`, `framePage`; `contentKey`, `pageEtag` |
| `src/server/scheduler.ts`, `timers.ts` | `createScheduler`, `Scheduler`, `SchedulerDeps`, `nextDelay`; `Timers`, `realTimers` |
| `src/server/views.ts` | `pageView`, `notInServiceView`, `missingSubpageView`, `View`, `Format` |
| `src/server/render-screen.ts` | `screenRuns`, `renderScreenHtml`, `renderTxt`, `renderAnsi`, `htmlCodePoint` |
| `src/server/render-html.ts`, `render-alt.ts`, `render-json.ts`, `render-plain.ts`, `escape-html.ts` | `renderHtml`, `renderFrag`; `renderAlt`, `row22Text`; `renderJson`, `renderStatusJson`; `renderPlain` (404 and 400 pages); `escapeHtml` |
| `src/server/negotiate.ts`, `compress.ts`, `headers.ts` | `chooseEncoding`, `ifNoneMatch`, `isTerminalAgent`; `compress`, `createBodyCache`; `baseHeaders`, `CSP` |
| `src/server/router.ts` | `createRouter`, `RouterRequest`, `RouterResponse`, `RouterDeps` |
| `src/server/http-server.ts`, `app.ts`, `run.ts`, `main.ts` | `startHttpServer`; `createApp`, `App`; `startServer`; entry point |
| `src/pages/stamp-clock.ts`, `src/sources/user-agent.ts` (amended), `src/sources/http.ts` (amended) | `stampClock`; `userAgent(origin)`; `HttpClientDeps.userAgent?` |
| `public/app.js`, `public/app.css`, `public/tsconfig.json` | client; stylesheet; `checkJs` config |
| `scripts/lib/payload.ts`, `scripts/payload.ts` | `measurePayload`, `BUDGETS`, `checkBudgets`; entry point |
| `scripts/screenshots.ts`, `scripts/env-example.ts`, `scripts/runtime-check.ts`, `scripts/lib/runtime-copies.ts` | entry points; `RUNTIME_COPIES`, `parseRuntimeCopies` |
| `playwright.config.ts`, `test/e2e/*.spec.ts`, `test/e2e/guard.ts` | browser tests; the request and console guard fixture |
| `Dockerfile`, `.dockerignore`, `render.yaml` | deploy |

`tsconfig.json` adds `playwright.config.ts` to `include` so the type-aware lint finds it.

## Types

```ts
interface Config extends EditorSettings {                   // EditorSettings.editorClient becomes "anthropic" | "fixtures" | "off"
  readonly port: number; readonly refresh: "on" | "off"; readonly publicOrigin: string | null;
  readonly editorBootDelayMs: number; readonly editorMinIntervalMs: number;
}
interface PublishedPage {
  readonly number: number; readonly def: PageDef; readonly screens: NonEmpty<ValidPage>;
  readonly alts: NonEmpty<NonEmpty<AltBlock>>; readonly etag: string; readonly compiledAt: Date;
  readonly dataAt: Date | null; readonly stale: boolean; readonly editor: EditorKind;
}
type PublishOutcome = { readonly ok: true; readonly page: PublishedPage } | { readonly ok: false; readonly codes: NonEmpty<string> };
interface StoreReader {
  get(n: number): PublishedPage | undefined; list(): readonly PublishedPage[];  // ascending
  failures(n: number): number; editorStatus(): EditorStatus | null; aiEditor(): boolean;
}
interface Store extends StoreReader {
  publish(compiled: CompiledPage, frame: { readonly now: Date; readonly stale: boolean }): PublishOutcome;
  setEditorStatus(status: EditorStatus): void;
}
type Format = "html" | "frag" | "txt" | "ansi" | "json";
interface View {                                            // what every renderer takes
  readonly page: PublishedPage; readonly subpage: number;   // 0-based
  readonly now: Date; readonly reveal: boolean; readonly status: 200 | 404;
}
interface Timers { set(ms: number, fn: () => void): number; clear(id: number): void }
interface RouterRequest { readonly method: string; readonly url: string; readonly headers: Readonly<Record<string, string | undefined>> }
interface RouterResponse { readonly status: number; readonly headers: Readonly<Record<string, string>>; readonly body: Uint8Array }
interface RouterDeps { readonly store: StoreReader; readonly assets: AssetTable; readonly clock: () => Date }
```

Not-found views carry a `PublishedPage` made by `framePage`, the store's own framing function, with `etag` `""`; they are never stored.

## Configuration

zod schema over the ten variables of 2.2 and 2.5; empty strings count as unset. `PUBLIC_ORIGIN` must satisfy `new URL(v).origin === v` with protocol `https:`. `ENV_VARIABLES`: `PORT=3000`, `ANTHROPIC_API_KEY=`, `EDITOR_MODEL=claude-opus-5-5`, `MAX_MODEL_CALLS_PER_DAY=60`, `EDITOR_MAX_CALLS_PER_BOOT=30`, `EDITOR_BOOT_DELAY_MS=600000`, `EDITOR_MIN_INTERVAL_MS=10800000`, `EDITOR_CLIENT=anthropic`, `REFRESH=on`, `PUBLIC_ORIGIN=`. Problem sentences come from issue paths, never issue messages (ai-editor "Error handling"). `Config` extends `EditorSettings`, so it goes to `createEditorClient` as it is; that returns `null` for `off`, and for `anthropic` without a key.

## Boot

`createApp({ config, files, clock, timers, random, fetch, log })` builds assets, the store, the editor client (`fixtures`: every parsed `EditorFixture`; a file that fails the schema is logged and skipped), the budget, the cache, the HTTP client (`{ fetch, delay: realDelay, userAgent: userAgent(config.publicOrigin) }`) and the scheduler, then calls `scheduler.boot()`. It runs `compileAll` at the boot time of 3.3, publishes every page, publishes 802 again so it lists those compile times, and asks the scheduler for the first edition, which the gates of "Scheduler" hold back. `main.ts` then calls `startHttpServer(router, port)` and `scheduler.start()`. `payload`, `screenshots` and the router tests call `createApp` with an env object, so they run the same code as production.

Shutdown: `scheduler.stop()` clears every timer; `server.close()`; `server.closeIdleConnections()`; a 10 s timer calls `process.exit(1)` (unref'd); close completion calls `process.exit(0)`.

## Store and ETags

`framePage(def, compiled, frame)`: `checkCompiledPage`, then `buildScreen(def, compiled, i, { now, stale, lastGoodAt: compiled.dataAt })` per subpage; any problem gives `{ ok: false, codes }` (`unknown-page`, the `CompiledProblem` codes, the `ScreenResult` errors). On success it deep-copies the alts, deep-freezes everything and computes the ETag. `publish` adds `findPage` and the failure count (4.3).

`contentKey(page)` is `JSON.stringify([number, editor, dataAt ISO or null, stale, alts, screens])` where each cell is written as `[kind, ch or bits, fg, bg, conceal, separated or null]` and row 0 cells 21 to 39 as `null`. `pageEtag` is the first 20 hex digits of its SHA-256 (`node:crypto`). Every format's output is a function of the key, the clock, the format, the subpage and reveal, and `json` shows every key field, so equal keys give equal bodies and unequal keys give some unequal body (Property 6).

Representation ETag: `"<etag>-<s>-<format>"`, plus `-r` when revealed and `-br` or `-gz` when encoded. Assets: `"<hash>"` plus the encoding suffix. `ifNoneMatch(header, tag)` splits on commas, strips `W/`, and matches `*`.

## Scheduler

Per source state: `entry` (the current snapshot entry), `lastAttemptAt`, `inFlight`, `timer`, `staleTimer`, `notBefore` (429). `nextDelay(source, attemptAt, outcome, r)` is pure:

| Case | Next attempt |
|---|---|
| most sources | `attemptAt + intervalMs × (1 + 0.1 r)` |
| 429 with `retryAfterMs` | the larger of the above and `attemptAt + retryAfterMs` |
| `wikimedia-onthisday` success | next 00:00 UTC after `attemptAt` + `300,000 r` ms |
| `wikimedia-onthisday` failure | `attemptAt + 1,800,000` (requirement 5.2) |
| `launch-library` | as most sources; never less than `attemptAt + 3,600,000` |

On success: replace the entry; `compileAll(snapshot, status, now, pageFiles)`; for a Wikipedia source with an editor client, the reuse pass below; publish each returned page whose def is affected, with `stale = isStale(source, fetchedAt, now)` (static and computed pages: `false`); reset `staleTimer` to `fetchedAt + staleAfterMs + 1 - now`; publish 802 from `compile802(serviceStatus(), now)`; trigger the edition for the two Wikipedia sources. `serviceStatus()` maps the store and the editor status as the ai-editor design gives it, with `aiEditor` true exactly when a client exists. A `staleTimer` firing republishes the source's affected pages from the last `compileAll` result with `stale: true`.

`scheduler.boot()` compiles and publishes everything at the boot time of 3.3, publishes 802, and triggers the edition once. `scheduler.start()` sets the source timers (only while `refresh` is `on`).

Edition (requirements 6.1 to 6.9, Owner decisions 1). The runner is `(snapshot, status, now, mode) => Promise<EditionResult>` with `mode` `"spend"` or `"reuse"`. `createApp` builds it over one `EditorDeps`: `spend` passes the real budget; `reuse` passes the same client and cache, a budget whose `tryReserve` always returns `false` (its `usage` is the real one), and a `log` that drops lines. The policy is `"gated"` for client `anthropic`, `"free"` for `fixtures` and `"none"` for no client.

- **Reuse pass.** After a Wikipedia success the scheduler awaits `runner(snapshot, status, now, "reuse")` before publishing. `editPage` reads the draft cache before the budget, so a page whose input is unchanged comes back `ai` from the cache at no cost, and every other AI page comes back as the rules draft. The scheduler takes from the result only pages with editor `ai` and puts them in place of the `compileAll` pages of the same number, so a half-hourly feed refresh does not turn edited pages back into rules pages for up to three hours. The status of this pass is discarded.
- **Spend edition.** State: `bootAt`, `lastStartAt` (`null` before the first), `running`, `dirty` (a trigger has come since the last start), `gateTimer`. `trigger()` sets `dirty` and calls `tryStart()`. `tryStart()` returns when `dirty` is false or `running` is true (a trigger during an edition leaves `dirty` set, which is the `pending` flag: exactly one more edition follows). `none` returns at once. `free` starts. `gated` returns when `refresh` is `off`; otherwise `earliest = max(bootAt + editorBootDelayMs, lastStartAt + editorMinIntervalMs)`, and it starts when `now >= earliest`, else sets one `gateTimer` for `earliest - now` that calls `tryStart()`. A short wake that sleeps again never reaches `bootAt + editorBootDelayMs`, so it spends nothing.
- **Start.** `dirty = false`, `lastStartAt = now`, `running = true`, record the two Wikipedia `fetchedAt` values. On completion: `store.setEditorStatus`, publish each returned page whose source `fetchedAt` is unchanged (others counted as dropped), publish 802, `running = false`, `tryStart()`. A rejection is logged as `edition: failed`, clears `running`, and does not reset `lastStartAt`.
- **Why both gates.** The delay protects a host that restarts; the interval bounds a host that stays up; the draft cache makes an unchanged page cost nothing; the two count caps are the last stop. **The daily cap is per process.** `MAX_MODEL_CALLS_PER_DAY` counts calls since this process started on that UTC day, and a restart empties the count (`createCallBudget` is in memory). On a free host that restarts, the daily bound that really holds is `EDITOR_MAX_CALLS_PER_BOOT` times the number of boots in the day; the boot delay is what keeps a boot that does not last from spending anything. A durable daily count would need storage, which the brief rules out.

Every callback catches and logs. `scheduler.idle()` resolves when nothing is in flight, for tests.

## Routes

| Path | Formats | Notes |
|---|---|---|
| `/` | html, or ansi for a terminal agent | page 100 |
| `/NNN` | html, or ansi for a terminal agent | `Vary: Accept-Encoding, User-Agent` |
| `/NNN.txt`, `.ansi`, `.json`, `.frag` | that format | `?s=`, `?reveal=1` |
| `/go?p=NNN` | 303 `Location: /NNN` | else 400 plain page |
| `/api/health` | `ok` (text) | 503 `starting` while the store is empty |
| `/api/status` | JSON | `no-store` |
| `/assets/<name>` | exact key of the asset table | anything else 404 plain |
| `/robots.txt`, `/favicon.svg` | constants | |
| anything else, or a path over 1,024 characters | plain 404 page (text for terminal agents) | |

Parsing: the raw `url` is split at the first `?`; the path is matched against the regexes as given, never decoded or normalised; the query goes to `URLSearchParams`. `ROBOTS_TXT`: `User-agent: *`, `Disallow: /api/`, `Disallow: /go`, `Disallow: /*.frag`. `FAVICON_SVG`: a 16 x 12 `viewBox` with four 4 x 12 rectangles in red, green, yellow and blue, under 300 bytes.

`/api/status`: `{ "aiEditor": bool, "editor": EditorStatus | null, "pages": [{ "number", "compiledAt", "editor", "stale", "publishFailures" }] }` in registry order.

## Negotiation and compression

`chooseEncoding(header)`: parse `token;q=value` items (q from 0 to 1, up to 3 decimals; a bad item is ignored); `br` when its q (or `*`'s) is above 0, else `gzip` likewise, else identity. Text bodies are encoded; `woff2` never. Pages: brotli quality 5 and `BROTLI_MODE_TEXT`, gzip level 6. Assets: brotli quality 11, gzip level 9, once at boot. `createBodyCache()` maps `representation ETag` to `{ clock, body }`; a hit needs the same clock text (same second), and a publish evicts every entry of the replaced page ETag. The cache holds at most one entry per representation of the current versions.

`baseHeaders(contentType)`: the CSP line of `frontend.md` verbatim, the three other headers of 8.1, `Content-Type`; the router adds `Content-Length`, `Cache-Control`, `Vary`, `ETag` and `Content-Encoding`.

## Screen rendering

`screenRuns(row, r)` walks the 40 cells and starts a run when `fg`, `bg` or `conceal` changes, and at the fixed splits (row 0 at cols 4 and 21, row 1 at col 35). `htmlCodePoint(cell)`: `ch`; `mosaicCodePoint(bits)`; or `0x1CE51 + bits - 1` when separated.

- `renderScreenHtml(screen)`: `<div class="screen" aria-hidden="true">`, then per row `<div class="r">`, then per run `<span class="…">text</span>`. Classes: `f<letter>` unless white, `b<letter>` unless black (`.screen` sets white on black), `conceal`, and `pn`, `ck` or `si` on the three fixed runs. Text goes through `escapeHtml`.
- `renderTxt(screen, reveal)`: per row the 40 characters (`mosaicCodePoint` for every mosaic; space for a concealed cell unless `reveal`), then LF.
- `renderAnsi(screen, reveal)`: per run `\x1b[38;2;R;G;Bm\x1b[48;2;R;G;Bm` and the run's `txt` characters; each line ends `\x1b[0m\n`. No repertoire code point is a control character, so data cannot inject escapes.

Each renderer first calls `stampClock(screen, view.now)`: it copies the rows, writes `formatHeaderClock(now)` yellow on black into row 0 cols 21 to 39 as `frameRows` does, and returns `validateGrid`'s page, or the unstamped screen when `now` is invalid.

## HTML document

```html
<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="dark">
<title>201 Five-day outlook - Page 100</title>
<meta name="description" content="Page 201, Five-day outlook: one 40 by 24 character screen with a text version.">
<link rel="stylesheet" href="/assets/app.<h>.css">
<link rel="preload" href="/assets/bedstead-extended-subset.<h>.woff2" as="font" type="font/woff2" crossorigin>
<link rel="icon" href="/favicon.svg" type="image/svg+xml"><script type="module" src="/assets/app.<h>.js"></script>
</head><body><main class="tv">
<input type="checkbox" id="reveal" class="reveal"><label for="reveal" class="nojs">Reveal</label>
<div id="view" class="view" data-…>(screen, then <section id="alt" class="alt vh" aria-labelledby="alt-h">)</div>
<nav class="nav" aria-label="Page links">(4 quick links; previous page, next page, subpage up, subpage down, Text, Index)</nav>
<form class="go" action="/go" method="get">(label "Page number", input id="p" name="p" inputmode="numeric" pattern="[0-9]{3}" maxlength="3" required autocomplete="off", submit "Go")</form>
<div id="keypad" class="keypad" hidden>(1 to 9, Hold, 0, Reveal: <button type="button" data-key="…">)</div>
</main><div id="live" class="vh" aria-live="polite"></div></body></html>
```

- Quick link k: `<a id="q<k>" class="q b<letter>" href="/<target>"><span class="vh"><Colour>: </span><label></a>`. Movement links: `id` `prev`, `next`, `sup`, `sdown`, `txt` (`/NNN.txt`, class `nojs`), `idx`; plus `<button id="tv" type="button" aria-pressed="false" class="js-only" hidden>Text</button>`. Hold and Reveal buttons carry `aria-pressed`.
- `#view` data attributes: `data-page`, `data-title`, `data-s` (1-based), `data-m`, `data-prev`, `data-next`, `data-links` (`110 News|200 Weather|300 Rates|800 Help`). `renderFrag(view)` returns exactly this element; `renderHtml` embeds the same string.

## Alt blocks

| Block | HTML |
|---|---|
| `heading` | `<h2>` or `<h3>` |
| `paragraph` | `<p>` |
| `list` | `<ul>` or `<ol>` of `<li>` |
| `table` | `<table><thead><tr>` of `<th scope="col">`; `<tbody>` rows with the first cell `<th scope="row">`, the rest `<td>`, short rows padded with empty `<td>` |
| `link` to a page | `<p><a href="/NNN">text</a></p>` |
| `link` to a URL | `<p><a href="URL" rel="noopener noreferrer">text</a></p>` when `new URL(url).protocol === "https:"`, else `<p>text</p>` |
| `concealed` | `<details><summary>summary</summary><p>text</p></details>` |

`row22Text(page)`: fresh `Source: <ATTRIBUTION>. Updated <formatUtcTime(dataAt)>.` (without the second sentence when `dataAt` is null); stale `Data delayed: last good <HH:MM UTC>.` or `Data delayed.`; `null` for `static`.

## Other formats and not-found screens

- `renderJson(view)`: `{ number, title, editor, dataAt, stale, subpages: [{ rows, alt }] }`, every subpage stamped with `now`; `rows` are `serialisePage(stamped).split("\n").slice(0, 24)`.
- `notInServiceView(n, now)`: `notInServicePage(n)` through `framePage`.
- `missingSubpageView(def, now)`: content lines `""`, ` Page 201 has 6 subpages.`, `""`, ` {y}201{w}  Five-day outlook`, `""`, ` Type a page number, or use the`, ` coloured links below.` through `parseContent` and `validateContentRows`; alt: the first paragraph, a link to the page, the last paragraph; framed with `{ ...def, source: "static", editor: "static" }`. The requested `s` is never echoed.
- `renderPlain(kind, terminal)`: `Not found` or `Enter a page number`, one sentence (`Page numbers have three digits, from 100 to 899.`), a link to `/100` and the form; text for terminal agents.

## Client script

One module, sections in this order: `state` (`page`, `s`, `m`, `digits`, `hold`, `textView`, `rotateTimer`), `readView()` (from `#view` data attributes), `paintHeader()` (row 0 `.pn` text: `P` + digits padded with `-`, or the page; `.ck` text; row 1 `.si` ` HOLD` while Hold), `load(n, s, how)` (`how`: `push`, `replace`, `pop`, `rotate`), `swap(html)`, `announce()`, `onKey(event)`, `onClick(event)` (delegated: `[data-key]` buttons and nav links), `rotate()`, `tick()`.

- `load` fetches `/<n>.frag?s=<s>` with `{ headers: { Accept: "text/html" } }`. A 200 or 404 whose body parses with `DOMParser` to a `#view` root is swapped with `replaceWith`; anything else or a rejection sets `location.href` to `/<n>?s=<s>`. Hold and Reveal reset when `n` changes.
- Announce text: `Page 201, Five-day outlook, subpage 2 of 6` (no subpage part when m is 1), written to `#live`; skipped for `rotate` and `pop`.
- Rotation: `setTimeout(12_000)` after each swap and after Hold turns off; on fire, if the 12.7 conditions hold, `load(page, s % m + 1, "rotate")`, else wait another 12 s.
- Clock: `setTimeout` to the next whole second, then `paintHeader`; local time with the `formatHeaderClock` weekday and month names.
- Keys use `event.key`; Z X C V and H R T I match either case. Default actions are prevented only for keys that act.

`public/tsconfig.json`: `allowJs`, `checkJs`, `noEmit`, `strict`, `noUncheckedIndexedAccess`, `target` `ES2023`, `lib` `["ES2023", "DOM", "DOM.Iterable"]`, `types` `[]`, `include` `["app.js"]`.

## Stylesheet

Tokens: `--k`, `--r`, `--g`, `--y`, `--b`, `--m`, `--c`, `--w` with the `grid-rules.md` hex values; `--page: #0a0a0a`; `--ink: #d0d0d0`; `--focus: #ffff00` (18.4:1 on `--page`). `@font-face` `Bedstead`, `font-display: block`. Each `.f<letter>` sets `--fg` and `color: var(--fg)`; `.b<letter>` sets `background`. `.conceal { color: transparent }`; `#reveal:checked ~ .view .conceal { color: var(--fg, var(--w)) }`.

Sizing: `.tv` is `container-type: size` with `height: 100dvh`. Wide (`@container (min-aspect-ratio: 1)`): grid of screen and an 18rem control column; `--fs: min((100cqw - 20rem) / 30, (100cqh - 2rem) / 24)`. Narrow: one column; `--fs: (100cqw - 1rem) / 30`, and `.tv` switches to `container-type: inline-size` with auto height so the keypad scrolls below. The screen font size is `round(down, var(--fs), 1px)`, and `round(down, var(--fs), 4px)` at 480 px wide and over, so cells fall on whole pixels. `.screen` is `width: 30em; line-height: 1; white-space: pre; font-family: Bedstead`.

`:focus-visible { outline: 3px solid var(--focus); outline-offset: 2px }`. Keypad and nav targets: `min-width` and `min-height` 44px, `gap: 8px`. `forced-colors: active`: `.screen { forced-color-adjust: none }`, controls use `ButtonText` and `Highlight`. `print`: everything but `.alt` is `display: none`; `.alt` loses `.vh`. `.vh` is the usual clip pattern; `.text .screen { display: none }` and `.text .alt` is static.

## Byte budgets

| Item | Estimate from this design | Budget (was) |
|---|---|---|
| HTML document, brotli | ~120 runs x 28 B + alt 1.5 KB + head and controls 2.5 KB ≈ 7.5 KB raw, ~2.5 KiB | 6 KiB (8) |
| Fragment, brotli | ~5 KB raw, ~2 KiB | 4 KiB (4) |
| `app.js`, raw | ~8 KB code plus JSDoc | 12 KiB (12) |
| `app.css`, raw | ~4 KB | 6 KiB (8) |
| Font | 4,624 B | 6 KiB (32) |
| First load | 2.5 + 1.5 + 4 + 4.5 + 0.3 ≈ 13 KiB | 24 KiB (64) |

`BUDGETS` holds the bytes; `measurePayload` sums `/100`, the stylesheet, script, font and favicon for the first load, using the encoded length as sent.

## Browser tests

`test/e2e/guard.ts` extends `test` with a fixture that records every request URL and every `console` error and `pageerror`, and fails the test in teardown on a foreign origin or any error.

| File | Scenarios |
|---|---|
| `keys.spec.ts` | type 2 0 0: `.pn` shows `P2--`, `P20-`, URL `/200`, h1 `200 World weather now`; Backspace, Escape; Left/Right; Up/Down on 201; Z X C V; I; Back and Forward |
| `rotation.spec.ts` | `page.clock.install()`; 201 shows `2/6` after 12 s; H shows ` HOLD` and stops it for 36 s; H resumes; reduced motion: no change in 36 s; live region unchanged by rotation |
| `reveal-text.spec.ts` | 550: concealed spans transparent, R reveals; T shows `#alt` (same node as before) and hides the screen |
| `phone.spec.ts` | 390 x 844 with touch: keypad visible, targets at least 44 x 44 and 8 px apart, tapping 6 0 0 opens `/600` and focus stays on the `0` button; 320 x 640: `scrollWidth` at most 320 |
| `no-js.spec.ts` | JavaScript off: form to `/go` lands on `/300`; quick links; subpage links on 201; the checkbox reveals on 550; the Text link opens `/550.txt`; keypad hidden |
| `not-in-service.spec.ts` | type 1 2 3: URL `/123`, the screen lists 120 and 200, focus unchanged |
| `a11y.spec.ts` | one `h1`; `.screen[aria-hidden="true"]`; one `[aria-live="polite"]`, no `assertive`; every button has a non-empty accessible name; Tab through every control: `outline-style` solid, width at least 3px; no `style` attribute in the DOM after each scenario |

`playwright.config.ts` reads `E2E_PORT`, or finds a free port with `node:net` and stores it in `process.env.E2E_PORT` so workers agree; `webServer.command` is `tsc -p tsconfig.build.json && node dist/server/main.js` with `PORT`, `REFRESH=off`, `EDITOR_CLIENT=off`; `url` `/api/health`; one project `chromium`; `forbidOnly`; `retries` 0. `scripts/screenshots.ts` uses `chromium` from `@playwright/test` against `createApp` and saves 100, 110, 120, 200, 201, 300, 301, 400, 500, 550, 600, 601, 610, 700, 802, 899 and 123.

## Deploy

```dockerfile
FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN npx tsc -p tsconfig.build.json

FROM node:22-slim
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
COPY public ./public
COPY pages ./pages
COPY src/sources/snapshot ./src/sources/snapshot
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s CMD ["node","-e","fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"]
CMD ["node","dist/server/main.js"]
```

The slim image has no `curl`, so the health check uses Node's `fetch`. `RUNTIME_COPIES` is the five `COPY` lines after the second `FROM`, as token arrays (`["--from=build", "/app/dist", "./dist"]`, ...). `parseRuntimeCopies(text)` tokenises those lines on whitespace. `runtime-check.ts` runs `npx tsc -p tsconfig.build.json`, makes `mkdtemp(os.tmpdir())`, copies each entry (`--from=build /app/dist` from the repository's `dist`), runs `npm ci --omit=dev` there (npm network use), starts `node dist/server/main.js` with `PORT` free, `REFRESH=off`, `EDITOR_CLIENT=off`, polls `/api/health` for up to 20 s, requests `/100` and its assets, sends `SIGTERM`, checks exit code 0 within 10 s, and removes the directory.

`render.yaml`: `services:` one entry, `type: web`, `name: page100`, `runtime: docker`, `plan: free`, `dockerfilePath: ./Dockerfile`, `healthCheckPath: /api/health`, `envVars` with `ANTHROPIC_API_KEY` and `PUBLIC_ORIGIN` as `sync: false` and the others from `ENV_VARIABLES` with `value`. Render sets `PORT` itself. A free instance spins down after 15 minutes without traffic and boots again on the next request ([Render free instances](https://render.com/docs/free)); each boot starts from the snapshot (open question 1).

## Logging

One line per event, `<ISO time> <event>`: `boot: 30 pages published, 0 failed, listening on 3000`; `refresh usgs: ok, 3 pages published, 0 failed`; `refresh usgs: failed, timeout, https://…` (plus `, status 503` or `, issues a.b,c`); `edition: 12 pages published, 0 dropped, 0 failed`; `edition: failed`; `shutdown: SIGTERM`. Editor lines pass through unchanged. No body, header, key or error message is logged.

## Error handling

No exported function in `src/server` throws on purpose. The router's handler is wrapped in one `try`/`catch` returning 500 plain text; Property 5 shows it is unreachable. `http-server.ts` answers a socket `clientError` with 400 and closes it. Boot failures exit 1 with one line (3.2).

## Correctness properties

Each is one fast-check test named `Property N: ...` in the file shown. Arbitraries: `validGrid` and `validContent` (grid-core), the page arbitraries (pages-and-sources), snapshots from `test/compilers/compile-arbitraries.ts` (rule-compilers); new ones in `test/server/server-arbitraries.ts`: hostile repertoire strings (`<`, `>`, `&`, `"`, `'`, `{`, `</section>`, `&amp;`), URLs (`javascript:`, `data:`, `https://x/"><b>`), request methods, paths, queries and headers.

Property 1: for all generated snapshots and `now`, every subpage of every page that `compileAll` returns and the store accepts renders in `txt` (both `reveal` values) to 24 LF-ended lines of 40 code points, and reading line r code point c back gives `ch` for a text cell (a space when concealed and not revealed) and a code point whose `mosaicBitsOf` is `bits` for a mosaic cell. Validates: 4.2, 11.1. (`test/server/render-txt.property.test.ts`)

Property 2: for all valid grids, the text of the spans of row r of `renderScreenHtml`, unescaped, with each U+1CE51 + b - 1 read as `mosaicCodePoint(b)`, equals line r of `renderTxt(grid, true)`, and each span's classes equal the attributes of every cell in it. Validates: 9.3, 9.4. (`test/server/render-screen.property.test.ts`)

Property 3: for all published pages with hostile alt texts, URLs and grid text, every `<` in `renderHtml` output starts a tag of the template's fixed list, every `&` starts one of the five entities, every attribute value is double-quoted with no raw `"`, `<` or `&`, each hostile string appears only as `escapeHtml(s)`, and no `href` starts with a scheme other than `https:`. Validates: 9.1, 9.6, 10.1. (`test/server/render-html.property.test.ts`)

Property 4: for all sequences of 1 to 40 publish calls mixing valid compiled pages and invalid ones (unknown number, a cell cast through `unknown` to bits 0, a bad colour or an illegible pair, an alt missing a word, 10 subpages, invalid `now`), after each call every held page's screens pass `validateGrid`, `get(n)` is the same object as after the last accepted publish of n, `failures(n)` counts the rejected ones, and mutating an input afterwards changes nothing held. Validates: 4.1, 4.2, 4.3. (`test/server/store.property.test.ts`)

Property 5: for all methods, raw URLs (any characters, `%`, `..`, `//`, NUL, 0 to 3,000 characters) and headers, a router over a booted store does not throw, answers a status in {200, 303, 304, 400, 404, 405, 503}, sets `Content-Length` to the body length, sends the CSP and the three headers of 8.1, sends `Content-Length` equal to the body length (to the `GET` body's length for `HEAD`, which has no body, and `0` for a 304), and gives 405 with `Allow` for any method but `GET` and `HEAD`. Validates: 7.1 to 7.9, 8.1. (`test/server/router.property.test.ts`)

Property 6: for all pairs of published versions p, q of one page (q is p republished at another `now`, or p with one change: a cell, `stale`, `editor`, `dataAt` or one alt word), `p.etag === q.etag` exactly when every format, subpage and `reveal` value renders to equal bodies with the same request clock. Validates: 4.4, 8.4. (`test/server/etag.property.test.ts`)

Property 7: for all valid grids and both `reveal` values, `renderAnsi` with every match of `/\x1b\[[0-9;]*m/g` removed equals `renderTxt`, and each line has exactly one reset, at its end. Validates: 11.2. (`test/server/render-ansi.property.test.ts`)

Property 8: for all fake fetch outcome scripts (ok, each failure kind, 429 with `retryAfterMs`, throws, delays) over 3 simulated days with fake timers and `random`, the gaps between attempts of each source match `nextDelay`, `launch-library` attempts are at least 3,600,000 ms apart, no source has two attempts in flight, every published source page has `stale` equal to `isStale` at its publish time, and with `refresh` `off` no fetch and no timer happen. Validates: 5.1 to 5.8, 6.2. (`test/server/scheduler.property.test.ts`)

Property 9: for all `Accept-Encoding` values and routes, the response's encoding has q above 0 in the header (or is identity), decoding the body gives the identity body byte for byte, and a `woff2` asset is never encoded. Validates: 8.5, 8.6. (`test/server/negotiate.property.test.ts`)

## Example tests

- `test/server/config.test.ts` (moved from ai-editor): defaults, each invalid variable, `PUBLIC_ORIGIN` with a path, `EDITOR_CLIENT=auto` rejected.
- `router.test.ts`: every row of "Routes"; `/123.txt` is 404 with the not-in-service text; `/201?s=7` and `?s=0` are 404; `/go?p=12` is 400; curl and Wget user agents get ANSI; 304 for a matching and a `W/` tag; `RouterDeps` has exactly `store`, `assets`, `clock`.
- `render-html.test.ts`: exact head; one `h1`; each alt block kind; the row 22 paragraph in each state; prev and next at 100 and 899; disabled subpage links.
- `scheduler.test.ts`: boot order (publish before listen), on this day at midnight and after a failure, 429, stale timer, edition coalescing and the dropped stale edition, a handler test that fails if any fetcher or the editor runs during 1,000 requests.
- `test/public/font-coverage.test.ts` (13.5); `test/public/app-source.test.ts` (1.5); `test/scripts/payload.test.ts` (14.3); `test/deploy/deploy-files.test.ts` (16.1 to 16.4, `render.yaml` read as text, no YAML library); `test/sources/user-agent.test.ts` (5.9).

## Test plan

| Command | Covers |
|---|---|
| `npm test -- test/server/config test/server/store test/server/etag` | Requirements 2, 4; Properties 4, 6 |
| `npm test -- test/server/render-` | Requirements 9 to 11; Properties 1, 2, 3, 7 |
| `npm test -- test/server/router test/server/negotiate test/server/scheduler` | Requirements 3, 5 to 8; Properties 5, 8, 9 |
| `npm test -- test/public test/scripts/payload test/deploy` | Requirements 13.5, 14, 16 |
| `npm run e2e` (after the owner installs Chromium) | Requirements 12, 13, 15 |
| `npm run typecheck && npm run lint && npm test && npm run build && npm run grid:check && npm run payload` | Requirements 1, 17 |

Property tests use fast-check's default 100 runs and a random seed.
