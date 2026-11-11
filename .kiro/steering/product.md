---
inclusion: always
---

# Page 100: product

Source: `docs/product-brief.md`. If a spec contradicts the brief, the spec wins and must say why.

## What it is

Teletext, brought back for Kiroween 2026 ("Resurrection" category). A visitor types a three-digit page number and gets one screen of 40 columns by 24 rows, in eight colours, with 2x3 block mosaics. Pages cover news, weather, exchange rates, developer news, earthquakes, the moon, on this day, rocket launches and a quiz. Each page is one screen and never scrolls. An editor (an AI model, with a rule-based fallback) makes the content fit. Content that does not fit the grid is not published.

## Who it is for

- People on slow links, e-ink readers, old phones and terminals (`curl`).
- Screen reader users, who get a structured text version of every page.
- Anyone who wants the day's facts in ten seconds with no accounts, adverts or tracking.

## The eight non-negotiables

1. **The grid.** Every published screen is exactly 24 rows of 40 cells, as defined in `grid-rules.md`. A single validator decides validity. Nothing that fails it is stored, served or cached. The validator is property-tested.
2. **Numbers from data, words from the editor.** Code places every temperature, rate, magnitude, score, date and time from source data. The AI editor may only shorten and rephrase text it is given. It adds no facts, and every number in its output must appear in its input.
3. **Visitors never trigger a model call or a source fetch.** Pages are compiled on a schedule and served from memory. `MAX_MODEL_CALLS_PER_DAY` is a hard daily cap.
4. **Works with no API key.** A deterministic compiler builds every page from data alone. Tests use it with recorded fixtures and run offline.
5. **Works without JavaScript.** Every page is server-rendered HTML with links and a small form. JavaScript only adds the remote-control feel. `curl` gets the page as text.
6. **Real text alternative.** Every page has a structured version (heading, paragraphs, lists, tables, links) for screen readers and for the visible text view. The grid is hidden from assistive technology.
7. **Small.** The first load and each later page have byte budgets. `npm run payload` measures them and a test enforces them.
8. **Original.** Use generic teletext conventions only: page numbers, a header row with page number, date and clock, four coloured quick links, mosaics, a reveal key, rotating subpages with hold. Do not use any real broadcaster's or service's name, logo, layout, page numbering scheme or wording.

Also fixed by the brief: no flashing text, no double height. The tone is calm and factual: not spooky, no characters, no mascots.

## Page map

| Pages | Section | Source | Editor |
|---|---|---|---|
| 100 | Index | none | rules |
| 110, 111-118 | World news: index, then one page per story | Wikipedia "In the news" plus linked article extracts | AI, rules fallback |
| 120 | Most read on Wikipedia | Wikimedia feed | rules |
| 200 | World weather now, subpages by region | Open-Meteo | rules |
| 201 | Five-day outlook, one subpage per city, mosaic temperature chart | Open-Meteo | rules |
| 300 | Exchange rates with change on the day | Frankfurter (ECB reference rates) | rules |
| 301 | 30-day trend, mosaic chart, one subpage per currency pair | Frankfurter | rules |
| 400, 401, 402 | Developer news: top, Show, Ask | Hacker News API | rules (AI may shorten titles) |
| 500, 501 | On this day: events; births and deaths | Wikipedia on this day | AI, rules fallback |
| 550 | Quiz of the day, answers concealed until Reveal | built from on-this-day events | rules |
| 600 | Earthquakes, magnitude 4.5+, last 24 hours | USGS | rules |
| 601 | The moon tonight: phase in mosaics, illumination, next full and new moon | computed | rules |
| 610 | Upcoming rocket launches | Launch Library 2 | rules |
| 700 | Featured article of the day on one screen | Wikipedia | AI, rules fallback |
| 800 | How to use Page 100 | hand-written markup | static |
| 801 | About, sources and licences | hand-written markup | static |
| 802 | Service status: compile time and editor per page, drafts accepted and rejected today, model calls used | live | rules |
| 899 | Engineering test page: all colours, all 64 mosaics, the character set | hand-written markup | static |

- Any other number returns HTTP 404 with a "page not in service" screen listing the nearest in-service page below and above it.
- One seasonal page for the hackathon is allowed if it is tasteful. Its number is chosen in a spec.

## Out of scope

Accounts, personalisation, comments, images, push notifications, analytics, adverts, server-side databases. Do not add any of these, or scaffolding for them, without a spec the user has approved.
