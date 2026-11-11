---
inclusion: fileMatch
fileMatchPattern: ["src/compilers/**", "src/editor/**", "pages/**"]
---

# Page 100: editorial rules

These rules apply to the rule-based compilers, the AI editor's prompt and checks, and hand-written pages. Each "must" is checked by a test or by the draft checks in `src/editor`.

## Voice

- Plain wire-service English. Present tense for news ("Floods kill 12 in ..."), past tense for on-this-day events.
- Sentence case everywhere except row 1, whose banner text is upper case. Do not write upper case for emphasis.
- No exclamation marks, no emoji, no jokes or puns in news, no questions except on the quiz page (550).
- Do not use "breaking", "shock", "slams" or similar headline words. Calm and factual. Not spooky, and no characters.
- British spelling (`colour`, `programme`), matching the brief.

## Headlines in 40 columns

- A headline is one row: at most the width given (40, or less when a compiler sets a margin). Two rows only where the page layout gives two.
- Leave out leading articles ("A", "The") and the full stop at the end. Keep the verb.
- Shorten by rewording, never by cutting. A headline is never truncated and never ends in `...`.
- Use `-` with spaces for an aside. Use `'` for quotation in headlines, `"` in body text.

## Abbreviations

- Allowed without explanation: US, UK, UN, EU, NATO, WHO, IMF, km, km/h, mm, UTC, AI.
- Months: `Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec`. Weekdays: `Mon Tue Wed Thu Fri Sat Sun`. No full stops after abbreviations.
- Any other abbreviation must already appear in the source text. Do not invent shortenings ("govt", "intl", "pres").

## Numbers and units

All of these come from shared formatters in `src/compilers/format.ts`. Pages do not format numbers inline.

| Kind | Format | Example |
|---|---|---|
| Integers 1,000 and over | comma thousands separator | `12,400` |
| Temperature | integer, `°C`, no space, hyphen-minus for negatives | `14°C`, `-3°C` |
| Wind | integer `km/h` | `22 km/h` |
| Precipitation | one decimal, `mm` | `3.5 mm` |
| Exchange rate | value under 10: 4 decimals; 10 to 999: 2 decimals; 1,000 and over: 0 decimals | `0.9213`, `151.27`, `1,382` |
| Change on the day | signed percentage, 2 decimals, `+` or `-`, zero is `0.00%` | `+0.15%`, `-1.02%` |
| Earthquake magnitude | `M` plus one decimal | `M5.2` |
| Depth and distance | integer `km` | `10 km` |
| Moon illumination | integer `%` | `87%` |
| Time | 24-hour `HH:MM`, always UTC, with `UTC` shown at least once per page | `14:05 UTC` |
| Date | `Ddd DD Mon`, or `DD Mon YYYY` when the year matters | `Wed 11 Nov`, `11 Nov 1918` |
| Years (on this day) | digits, no comma; `BC` after BC years | `1066`, `44 BC` |

- Rounding happens only in the formatter, and only to the precision in this table.
- A value missing from the source is shown as `n/a`. It is never shown as `0` and never estimated.

## Fitting and truncation

- Wrap only at spaces. A word may break only after a hyphen it already has. Never insert a hyphen.
- Never cut mid-word. If one word is wider than the space, the item is dropped. It is not cut.
- To shorten body text, drop whole sentences from the end first. Only if the first sentence alone does not fit, cut it at a word boundary and add `...` (three full stops, three cells).
- **No dangling ellipsis on a number.** If the last word before `...` contains a digit, remove it, then do the same check again on the new last word. Also remove a unit word that would be left behind. `Rates rise 2...` and `Quake kills 40...` are both wrong.
- A list (news index, launches, quakes) shows whole items only. When space runs out, the list ends and is never cut through an item.
- Drop rows rather than overflow them. Drafts that overflow are rejected; they are not trimmed silently.

## Attribution (row 22)

- Every page whose content comes from a source shows that source's attribution line from `sources.md`, exactly as written there.
- When a page combines sources, the attribution goes to the source of the main content. Page 801 lists every source and licence in full.
- When data is stale the row shows `Data delayed: last good HH:MM UTC` instead. The page still shows the last good data. Nothing on the page claims to be current.

## Numbers from data, words from the editor

- Compilers place every number, date and time from parsed source fields through the formatters above. Neither the AI editor nor a compiler writes a number that did not come from data.
- The AI editor receives source text and returns plain text rows only. It never returns colour, mosaic or markup tags. The frame and layout are code.
- **Numeric fidelity check:** every number token in a draft (regex `\d+(?:[.,]\d+)*`, with thousands commas removed) must appear as a number token in the input given for that page. Spelled-out numbers (`one` to `twenty`, `dozen`, `hundred`, `thousand`, `million`, `billion`) count as numbers and must appear in the input as written.
- The editor may shorten, reorder and rephrase. It may not add names, places, causes, quotes or claims that are not in the input. It may not merge two items into one statement.
- A draft that fails the validator, the repertoire check or the numeric fidelity check goes back with the exact violations (`row 7 is 43 cells, limit 38`; `number "41" not in input`) at most twice. After that, the rule-based compiler's page is published.
- Hand-written pages (`pages/`) have no live numbers. Any example number on them (on page 800, for instance) must be clearly an example.
