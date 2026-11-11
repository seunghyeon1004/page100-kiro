---
inclusion: fileMatch
fileMatchPattern: ["public/**", "src/server/**"]
---

# Page 100: front end and server output

Each rule here should be checked by a vitest test on the renderers or by a Playwright test in `test/e2e`.

## No-JavaScript baseline

- `/:page` returns complete server-rendered HTML. With JavaScript disabled, a visitor can:
  - go to any page with the form `<form action="/go" method="get">` and its input `name="p"` (`inputmode="numeric"`, `pattern="[0-9]{3}"`). `/go` answers with a 303 to `/:page`.
  - follow the four quick links, previous and next page, and previous and next subpage, all of which are plain `<a href>`s.
  - reveal concealed cells with a native checkbox and CSS (`#reveal:checked ~ .screen .conceal`), with no script.
  - open the text view at `/:page.txt`.
- Without JavaScript, subpages do not rotate. Each subpage has its own URL (the query parameter is fixed in the server spec).
- The client script in `public/` only adds behaviour: key handling, the keypad, fragment swaps from `/:page.frag`, rotation and the in-page text view. If the script fails, everything above still works.
- Requests whose User-Agent starts with `curl/` or `Wget/` get ANSI text from `/:page` (`text/plain; charset=utf-8`).

## Text alternative

- The grid is `<div class="screen" aria-hidden="true">`. Assistive technology never reads it.
- Every page has a text alternative in the DOM, built from the same compiled page data (not read back from the grid): one `<h1>` (page number and title), then paragraphs, `<ul>`/`<ol>` lists, `<table>`s with `<th scope>` for weather, rates, quakes and launches, and links.
- Concealed content (quiz answers) is inside `<details><summary>Show answer</summary>` in the text alternative.
- Row 22's source and staleness text appears in the alternative as a paragraph.
- `<title>` is `<number> <title> - Page 100`. `<html lang="en">`.
- The visible text view (key T) shows this same element. It is not a second copy.

## Keyboard map

Keys act only when focus is not in a text input and no Ctrl, Alt or Meta key is held.

| Key | Action |
|---|---|
| 0-9 | Enter a page number. After the third digit the page loads. Row 0 shows partial entry as `P1--`. |
| Backspace | Remove the last digit typed |
| Escape | Cancel the entry |
| Left / Right | Previous or next in-service page |
| Up / Down | Previous or next subpage |
| H | Hold: stop or restart subpage rotation |
| R | Reveal or hide concealed cells |
| T | Show or hide the text view |
| I | Index (page 100) |
| Z X C V | Red, green, yellow, blue quick links (decision: letters, so no clash with browser F-keys) |

Every key action is also a visible control, so nothing works only from the keyboard.

## Phone keypad

- A 3x4 number pad (1-9, then Hold, 0, Reveal) under the screen. Below it is one row with the four colour links, and another with previous page, next page, subpage up, subpage down, Text and Index.
- Each touch target is at least 44 x 44 CSS px, with at least 8 px between targets.
- The keypad has the `hidden` attribute in the HTML and the script removes it. Without JavaScript the form is the input method.
- Buttons are `<button type="button">` with text labels. A coloured link has its colour name in its accessible name ("Red: News").

## Focus and announcements

- Focus is always visible: a 3 px outline with at least 3:1 contrast against its surroundings. `outline: none` is never used without a replacement.
- A page change never moves focus. Focus stays on the control that caused the change, or where it already was.
- One `aria-live="polite"` region announces changes the user started: `Page 201, Five-day outlook, subpage 2 of 6`. Automatic rotation is not announced. Changes are never announced with `assertive`.

## Motion

- Subpages rotate no faster than one every 10 seconds. Hold stops rotation. While it is on, the client shows `HOLD` in row 1, cols 35-39, in place of `n/m`.
- Under `prefers-reduced-motion: reduce` there is no automatic rotation and no CSS transition or animation. Subpages change only when the user asks.
- Nothing flashes or blinks, in any mode.

## Layout

- The screen keeps a 4:3 aspect ratio and scales to the viewport without horizontal scrolling down to 320 CSS px wide.
- Text is real text in the Bedstead subset font. No images anywhere (the brief puts images out of scope).
- Colours come only from the eight values in `grid-rules.md`, through classes. HTML never contains `style` attributes, because the CSP forbids them.

## Byte budgets

`npm run payload` measures these against pages compiled from the boot snapshot, using the server's own brotli output. A test fails when any budget is over. These are starting budgets: they may be lowered freely, and raising one needs the user's approval.

| Item | Budget |
|---|---|
| First load: HTML, CSS, JS and font for `/100`, brotli | 64 KiB total |
| Any page's HTML document, brotli | 8 KiB |
| Any `/:page.frag`, brotli | 4 KiB |
| `public/` client script, uncompressed | 12 KiB |
| CSS, uncompressed | 8 KiB |
| Font subset (woff2) | 32 KiB |

Static assets get long-lived `Cache-Control` with content-hashed names. Pages get ETags and short caching.

## Security headers and CSP

Every HTML response sends exactly this policy:

```
Content-Security-Policy: default-src 'none'; script-src 'self'; style-src 'self'; font-src 'self'; img-src 'self'; connect-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'
```

Also sent: `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `Cross-Origin-Opener-Policy: same-origin`. There are no inline scripts, no inline styles, no inline event handlers and no `eval`.

## No third-party requests

- Every URL a page loads automatically (script, style, font, fetch, prefetch) is same-origin. A Playwright test records all requests and fails on any other origin.
- Outbound links (for example to the source article on Wikipedia) appear only in the text alternative and on page 801. They use `rel="noopener noreferrer"` and are never prefetched.
- No analytics, beacons, cookies or `localStorage` tracking. Hold, reveal and text view state live in memory or in the URL.
