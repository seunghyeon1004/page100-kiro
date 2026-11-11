# Page 100 — product brief

This is the brief handed to Kiro before any code existed. Kiro turned it into the steering files in `.kiro/steering/` and then into specs. Where the brief and a later spec disagree, the spec wins and says why.

## What it is

Teletext, brought back. Teletext was the text service built into televisions from the 1970s until the 2010s: you typed a three-digit page number on the remote and got one screen of 40 columns by 24 rows, in eight colours, with chunky block graphics. No scrolling, no adverts, no accounts.

Page 100 serves today's world the same way. News, weather, exchange rates, developer news, earthquakes, the moon, on this day, a quiz. Every page is one screen. An editor (an AI model, with a rule-based fallback) has to make the content fit. If it does not fit the grid, it does not ship.

Why it is worth having today: a page is a few kilobytes, reads in ten seconds, works on a slow link, an e-ink reader, an old phone, a terminal and a screen reader, and never asks for anything. Open the URL, type three digits.

Category: "Resurrection: bring your favorite dead technology back to life" (Kiroween 2026).

## Non-negotiables

1. **The grid.** Every published screen is exactly 24 rows of 40 cells. A cell is either a text character from the allowed repertoire or a 2×3 block mosaic (64 patterns), with a foreground and background from the eight colours, and an optional "conceal" flag. One validator decides what is valid. Nothing that fails it can be stored, served or cached. It is property-tested.
2. **Numbers come from data, words from the editor.** Temperatures, rates, magnitudes, scores, dates and times are placed by code from source data. The AI editor may shorten and rephrase text it is given. It may not add facts, and every number in its output must appear in its input.
3. **Visitors never trigger a model call or a source fetch.** Pages are compiled on a schedule and served from memory. A hard daily cap limits model calls.
4. **It works with no API key.** A deterministic compiler builds every page from data alone. Tests use it and recorded fixtures, so they are reproducible offline.
5. **It works without JavaScript.** Every page is server-rendered HTML with links and a small form. JavaScript adds the remote-control feel. `curl` gets the page as text.
6. **A real text alternative.** Each page carries a structured, readable version (heading, paragraphs, lists, tables, links) for screen readers and for a visible "text view". The decorative grid is hidden from assistive technology.
7. **Small.** The first load and each further page have a byte budget, measured by a script and enforced by a test.
8. **Original.** Generic teletext conventions only: page numbers, a header row with page number, date and clock, four coloured quick links, mosaic graphics, a reveal key, rotating subpages with hold. No real broadcaster's or service's name, logo, layout, page numbering scheme or wording.

## The screen

- Row 0: header. Page number as typed, service name, date, clock.
- Row 1: section banner.
- Rows 2–21: content (20 rows).
- Row 22: source and status line. Says where the data came from and when. Turns into a "data delayed" notice when the data is stale.
- Row 23: four coloured quick links (red, green, yellow, blue).

Colours: black, red, green, yellow, blue, magenta, cyan, white. Text must be legible: the validator rejects a text cell whose foreground and background have a contrast ratio under 4.5:1 (so no blue text on black). Mosaic cells are exempt.

No flashing text and no double height.

## Page markup

Pages written by hand, by the rule-based compiler or by a Kiro agent use one small markup, one line per row:

- Plain characters are text cells.
- `{r} {g} {y} {b} {m} {c} {w} {k}` set the foreground; the upper-case letters set the background. Attributes reset to white on black at the start of every row.
- `{?}` starts concealed text, `{/?}` ends it.
- Mosaic cells are written with the Unicode block characters themselves: space, `▌`, `▐`, `█` and the sextants U+1FB00 to U+1FB3B. `{~}` switches to separated mosaics, `{/~}` back.
- `{{` is a literal brace.
- A row may be shorter than 40 cells (it is padded) but never longer.

Parsing then serialising a valid page gives the same grid back.

## Sections (page map)

| Pages | Section | Source | Editor |
|---|---|---|---|
| 100 | Index | — | rules |
| 110, 111–118 | World news: index and one page per story | Wikipedia "In the news" and linked article extracts (CC BY-SA 4.0) | AI, rules fallback |
| 120 | Most read on Wikipedia | Wikimedia feed | rules |
| 200 | World weather now, subpages by region | Open-Meteo (CC BY 4.0) | rules |
| 201 | Five-day outlook, one subpage per city, with a mosaic temperature chart | Open-Meteo | rules |
| 300 | Exchange rates, with change on the day | Frankfurter (ECB reference rates) | rules |
| 301 | 30-day trend, mosaic chart, one subpage per currency pair | Frankfurter | rules |
| 400, 401, 402 | Developer news: top, Show, Ask | Hacker News API | rules (AI may shorten titles) |
| 500, 501 | On this day: events; births and deaths | Wikipedia on-this-day (CC BY-SA 4.0) | AI, rules fallback |
| 550 | Quiz of the day, answers concealed until Reveal | built from on-this-day events | rules |
| 600 | Earthquakes, magnitude 4.5+, last 24 hours | USGS (public domain) | rules |
| 601 | The moon tonight: phase drawn in mosaics, illumination, next full and new moon | computed | rules |
| 610 | Rocket launches coming up | Launch Library 2 | rules |
| 700 | Featured article of the day in one screen | Wikipedia (CC BY-SA 4.0) | AI, rules fallback |
| 800 | How to use Page 100 | hand-written markup | static |
| 801 | About, sources and licences | hand-written markup | static |
| 802 | Service status: when each page was compiled, by which editor, drafts accepted and rejected today, model calls used | live | rules |
| 899 | Engineering test page: all colours, all 64 mosaics, the character set | hand-written markup | static |

Any other number shows a "page not in service" screen with the nearest pages, and HTTP 404. One seasonal extra page for the hackathon is allowed if it is tasteful.

## The AI editor

- Anthropic API, model `claude-opus-5-5` by default (`EDITOR_MODEL` overrides), official SDK, structured output.
- Input: the source text for one page. Output: rows of plain text, each at most the width it is given, at most the row count it is given.
- Every draft goes through the same validator, a repertoire check and the numeric-fidelity check. A rejected draft is sent back once or twice with the exact violations ("row 7 is 43 cells, limit 38"). If it still fails, the rule-based compiler's page is published instead.
- Calls happen only when the source content hash has changed, and never above `MAX_MODEL_CALLS_PER_DAY`.
- Accepted and rejected draft counts are shown on page 802.
- The key is read from `ANTHROPIC_API_KEY`. It is never logged, never sent to the browser, never committed.

## Server

- Node 20+, TypeScript strict, ES modules. Runtime dependencies: `zod` and `@anthropic-ai/sdk`, nothing else. The HTTP server is `node:http`.
- Routes: `/` and `/:page` (HTML), `/:page.txt`, `/:page.ansi`, `/:page.json`, `/:page.frag` (the fragment the client swaps in), `/go?p=123` (form target, redirects), `/api/health`, `/api/status`, static assets. `curl` and `wget` user agents get ANSI text from `/:page`.
- Boot: compile every page from a bundled snapshot of source data so the site is complete in the first second, then refresh each source on its own interval. A failed source keeps its last good data and the page says so.
- Compression (brotli, gzip), ETags, a strict Content-Security-Policy.
- Deploys on Render's free plan from a Dockerfile.

## Front end

- The screen keeps a 4:3 shape and scales to the viewport. Text is real text in an openly licensed teletext-style font (Bedstead, CC0), subset to the repertoire.
- Keyboard: digits enter a page number, left and right for previous and next page, up and down for subpages, H hold, R reveal, T text view, I index, and the four colour keys.
- Phone: a number pad under the screen with the same functions. Touch targets at least 44 px.
- Subpages rotate on a timer. Hold stops them. Reduced-motion users get no automatic rotation.
- Focus is always visible. Page changes are announced politely to screen readers.

## Voice

Plain wire-service English. Present tense, sentence case, no exclamation marks, no emoji, no jokes in news. Upper case only for banners. This project is calm and factual; it is not spooky and has no characters.

## Out of scope

Accounts, personalisation, comments, images, push notifications, analytics, adverts, server-side databases.
