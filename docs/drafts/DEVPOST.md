# Devpost submission draft: Page 100

**Category:** Resurrection
**Live:** https://page100-kiro.onrender.com
**Repo:** https://github.com/seunghyeon1004/page100-kiro
**Tagline:** Teletext, brought back. Today's world in 40 columns, 24 rows and three digits.

Note for whoever tests it: the site is on free hosting, so the first request after a quiet spell can take up to a minute. Page 610 (rocket launches) may show "Data delayed" when its source rate-limits; that is the stale-data state working as designed.

---

## Inspiration

Teletext was the text service built into televisions from the 1970s. You typed a three-digit number on the remote and got one screen: 40 columns, 24 rows, eight colours, chunky block graphics. It was switched off in most countries in the 2010s.

What it had, and what I miss, is that a page was finished. It had no scroll, no advert, no account and nothing asking for one more minute. The news was a headline and six lines because six lines was all there was.

So the question for the Resurrection category was simple: what if today's world had to fit that screen again?

## What it does

Open the site and type three digits.

- **100** is the index. **110-118** are world news, one story per page. **120** is what Wikipedia is reading.
- **200** is the weather in 24 cities, with weather symbols drawn in blocks. **201** is a five-day outlook with a chart.
- **300** and **301** are exchange rates and a 30-day trend chart.
- **400-402** are developer news. **500, 501** are on this day. **550** is a quiz whose answers stay hidden until you press Reveal.
- **600** is earthquakes, **601** the moon tonight drawn in mosaics, **610** rocket launches, **700** the featured article in one screen.
- **800-802** are help, sources and licences, and a live status page. **899** is a test card.

Every page is exactly one screen. An AI editor (Claude) shortens news and history text to fit. A validator decides whether it did. A draft that is one cell too wide is sent back with the exact violation; if it still does not fit, a rule-based page is published instead. If it does not fit the grid, it does not ship.

Why this is useful now, not only nostalgic:

- **It is small.** The first visit downloads 11,515 bytes in total: HTML, CSS, script and font. Each further page is about 1 KB.
- **It works without JavaScript.** Every page is server-rendered with links and a small form.
- **It works in a terminal.** `curl https://page100-kiro.onrender.com/200` prints the page in colour.
- **It works with a screen reader.** The grid is hidden from assistive technology and every page has a real text version with headings, lists and tables. Press T to see it.
- **It is calm.** No adverts, no tracking, no cookies, no notifications.

Keys: digits to enter a page, arrows for next and previous page and subpage, H to hold a rotating page, R to reveal, T for text, I for the index, and Z X C V for the four coloured links. On a phone there is a number pad.

## How we built it

Node and TypeScript, with two runtime dependencies (zod and the Anthropic SDK) and no web framework.

- **The grid is the gate.** A screen is 24 rows of 40 cells; a cell is a character from a fixed set or one of 63 block mosaics, in eight colours. One function, `validateGrid`, is the only way to get a `ValidPage`, and the store and every renderer accept nothing else. Text must reach 4.5:1 contrast, so blue on black is rejected by the validator.
- **Numbers come from data, words from the editor.** Temperatures, rates and magnitudes are placed by code. The editor's drafts are checked for width, row count, characters, any number that is not in the source and any capitalised name that is not in the source.
- **Visitors never trigger a model call.** Pages are compiled at boot from a bundled snapshot, then refreshed per source on a schedule. Model calls are capped per day and per process.
- **Data** comes from public sources that need no key: Wikipedia's feed, Open-Meteo, ECB reference rates via Frankfurter, the Hacker News API, USGS and Launch Library 2. The moon is computed.
- **Font:** Bedstead Extended by Ben Harris (public domain), subset to 4,624 bytes.

Checks at the submitted commit: 1,211 unit and property tests (62 fast-check properties), 44 browser tests in headless Chromium, a script that validates all 30 pages and 43 screens, and a byte-budget test.

## How Kiro was used

Everything in `src/`, `test/`, `public/`, `tools/` and `scripts/` was written by Kiro CLI 3.2.0 in 21 recorded sessions. The transcripts are in `docs/kiro-evidence/`, and `.kiro/README.md` says what Kiro did, where it went wrong and what I did by hand.

**Steering.** Eight files, written by Kiro from a two-page brief before any code existed. Three are always included; three are included by file match (editorial rules only when Kiro touches compilers or the editor, front-end rules only for `public/` and the server, source rules only for fetchers and fixtures); one is manual. The file that mattered most is `grid-rules.md`, because it is written as a contract a test can check. While writing it, Kiro computed the full contrast matrix and found that white on red is 4.00:1, so the red quick link has black text. The second is a short list of rules in `tech.md`: never stage or commit, never read a secrets file, never weaken a test to get green, tick a task only after running its Verify command.

**Spec-driven development.** Five specs, built in dependency order: grid, pages and sources, compilers, AI editor, server and viewer. Together they hold 428 acceptance criteria in EARS form, 63 correctness properties and 118 tasks, all ticked. Each spec was written by Claude Opus 5.5 in Kiro, reviewed, and implemented in a separate session by a cheaper model. Every task names the requirements it covers and the command that proves it.

The specs paid for themselves at the seams. The compilers spec was written from the previous spec's design document while that spec was still being implemented, and the editor spec from the compilers' design. When the code met, the differences were names. The properties also found bugs examples would not have: a character table that was not sorted, and a date generator that produced invalid dates.

**Vibe coding, for contrast.** The MCP server and the three agents were built in one conversational session. It was quicker and fine for five small functions. It also shipped with a permission mistake the spec'd code never had: the agents were created with fully trusted shell and write tools. Kiro caught and fixed that itself before the session ended.

**Hooks.** Four, and I checked which ones really fire in a headless CLI run instead of assuming:

- a `PreToolUse` guard that refuses any shell command that stages, commits or pushes, or touches a secrets file. It blocked a `git clean -n` I asked Kiro to try, and Kiro quoted the refusal.
- `grid:check` after every write to a page file, so a row that is 41 cells wide is reported at once with row and column.
- typecheck and the full test suite when the agent stops. In one run Kiro reported a file as unchanged after an edit-and-revert. The Stop hook's test run failed: Kiro had left a blank line in the file.
- a `/fit` prompt hook that reviews the diff against the grid rules. In the CLI its matcher is not applied, so it ran on every prompt. I left it on.

**MCP.** Kiro cannot look at a teletext page. So it built `page100`, a small MCP server with five tools: validate markup, preview a page as framed text plus a second rendering where every cell is its colour letter, render a compiled page, list pages, and check a colour pair's contrast. The difference it made is visible in two transcripts. In the first, the server was not connected and the page-author agent wrote four pages blind, counting cells, and said so. In the second, with the tools connected, the same agent previewed each page, checked the colours and fixed the layouts. The test card on 899 and page 666 came out of that.

**Agents.** Three custom agents, created by Kiro's own agent-creator sub-agent, each with a real job: `page-author` wrote the four hand-written pages; `task-auditor` re-ran the Verify command of every ticked task in two specs and reported 16 stale result lines honestly; `grid-reviewer` reviewed the three changes I had made by hand and found three real faults in one of them, which I then fixed.

## Challenges

- **Fitting.** A language model is bad at counting characters. The answer was not a better prompt but a loop: check, send back the exact violation, at most twice, then fall back. In the last recording 1 draft of 10 was sent back, for two rows that were each one cell too wide.
- **Trusting summaries.** Kiro's end-of-session report is not evidence. A hook that runs the tests when the agent stops is.
- **Seeing.** Neither Kiro nor I could tell from markup whether a mosaic gravestone looked like a gravestone. The MCP preview tool, and then screenshots in headless Chromium, were the fix.
- **A bug the tests missed.** The hidden text alternative contained a table that Chromium treated as a scroll container and therefore as a Tab stop, so the first Tab scrolled the screen away. Kiro's 41 browser tests did not catch it; driving the page by hand did. There are 44 browser tests now.
- **A bug only the real key found.** The first run with a real model dropped all 12 edited pages because a data refresh landed while the edition was running. Pages dropped that way are now republished from the draft cache when the text is unchanged.
- **Cost on free hosting.** A free instance sleeps and restarts, which resets an in-memory daily cap. So there is also a per-boot cap, no model call in the first ten minutes of uptime, and at most one edition every three hours.

## What we learned

A hard constraint is a feature when a machine enforces it. The 40 by 24 grid made the product, the tests and the way of working with Kiro all simpler: there was always one question to ask of any change, and a program that could answer it.

## What's next

- Local pages: weather and news for the visitor's own city, chosen by page number, not by tracking.
- A real teletext export, so a page can be shown on old hardware.
- More sections people actually used: sport results, TV listings, travel.
- Subtitles on 888, as a nod to what teletext was best at.

## Built with

Kiro, TypeScript, Node.js, Claude (Anthropic API), zod, fast-check, vitest, Playwright, Render, Bedstead font

## Gallery

| Screenshot | File | Caption |
| --- | --- | --- |
| 1 | `docs/screens/100-desktop.png` | Page 100, the index. Type three digits. |
| 2 | `docs/screens/200-desktop.png` | World weather now, with weather symbols drawn in block mosaics. |
| 3 | `docs/screens/201-desktop.png` | Five-day outlook with a mosaic temperature chart. |
| 4 | `docs/screens/301-desktop.png` | Thirty-day exchange rate trend, plotted two pixels by three per cell. |
| 5 | `docs/screens/110-desktop.png` | World news, shortened by the AI editor to fit 40 columns. |
| 6 | `docs/screens/601-desktop.png` | The moon tonight: lit part in yellow, dark side in separated blue mosaics. |
| 7 | `docs/screens/550-desktop.png` | Quiz of the day. The years stay hidden until you press Reveal. |
| 8 | `docs/screens/899-desktop.png` | Engineering test page: eight colours, 63 mosaics, the character set. |
| 9 | `docs/screens/200-phone.png` | On a phone, with the number pad. |
