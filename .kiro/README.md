# How Page 100 was built with Kiro

Everything in `src/`, `test/`, `public/`, `tools/` and `scripts/` was written by Kiro CLI 3.2.0 from the specs in this directory, in 20 recorded sessions. The owner wrote the product brief, made the decisions, read every diff, re-ran every check, and did a short list of things by hand, which is at the end. Every session's transcript is in [`docs/kiro-evidence/`](../docs/kiro-evidence/README.md).

## The strategy

1. **Brief first, steering second, code last.** `docs/product-brief.md` is two pages of intent. Kiro turned it into eight steering files before any code existed.
2. **One spec per layer, built in dependency order.** grid → pages and sources → compilers → AI editor → server and viewer. Each spec was written by `claude-opus-5.5`, reviewed, then implemented in a separate session by a cheaper model (`auto`, and once `claude-haiku-5.5`) that was told to run each task's Verify command before ticking it.
3. **Make the rules executable.** Steering says what must be true. Specs turn it into numbered criteria and correctness properties. Properties become fast-check tests. Hooks run the checks while Kiro works. An MCP server lets an agent see a page it cannot look at.
4. **Trust the gate, not the summary.** After every session typecheck, lint, tests, `grid:check`, `payload` and the browser tests were re-run outside Kiro before anything was committed.

## Steering (`steering/`)

| File | Inclusion | What it pins down |
| --- | --- | --- |
| `product.md` | always | What Page 100 is, the eight non-negotiables, the page map |
| `tech.md` | always | Stack, the only two runtime dependencies, npm scripts, and eight rules for Kiro (never stage or commit, never read secrets, never weaken a test, tick only after the Verify command ran) |
| `structure.md` | always | Directory layout, dependency direction, naming |
| `grid-rules.md` | always | The grid contract: cell model, colours with computed contrast matrix, mosaic bit to Unicode mapping, repertoire, markup grammar, invariants and the required properties |
| `editorial.md` | fileMatch: `src/compilers/**`, `src/editor/**`, `pages/**` | Voice, number formats, fitting and truncation, "numbers from data, words from the editor" |
| `frontend.md` | fileMatch: `public/**`, `src/server/**` | No-JavaScript baseline, text alternative, keyboard map, byte budgets, CSP |
| `sources.md` | fileMatch: `src/sources/**`, `test/fixtures/**` | Each source's URL, licence, attribution line and refresh interval; fixture rules |
| `kiro-workflow.md` | manual | The spec format used here: EARS criteria, properties, tasks with Verify commands |

What made the biggest difference: `grid-rules.md` is written as a contract a test can check, with the numbers computed, not guessed. Kiro computed the 8 by 8 contrast matrix while writing it and found that white on red is 4.00:1, so the red quick link has black text. In the spec session it then found a wrong example in its own steering file (a sextant name that does not exist in Unicode) and a rule that would have stripped allowed accents (`café` to `cafe`), and asked before changing either.

The second was the rule list in `tech.md`. It came from the failures seen in an earlier project (weakened schemas, mocked subjects, ticks without runs). In this project Kiro repeatedly stopped and asked instead: a Launch Library field that was not in the recorded fixture, null values no fixture showed, a lint failure in a file the owner had added.

## Specs (`specs/`)

| Spec | Criteria | Properties | Tasks | What it built |
| --- | --- | --- | --- | --- |
| `grid-core` | 120 | 20 | 27 | Cell model, validator with branded `ValidPage`, markup parser and serialiser, text folding |
| `pages-and-sources` | 70 | 12 | 27 | Page registry, frame builder, text alternative model, seven sources with zod schemas and recorded fixtures, boot snapshot |
| `rule-compilers` | 76 | 14 | 28 | Formatters, text fitting, mosaic canvas (charts, weather symbols, moon, block lettering), one compiler per page, `grid:check` |
| `ai-editor` | 70 | 8 | 15 | Draft checks, call budget, draft cache, edition runner, Anthropic and fixture clients |
| `server-and-viewer` | 91 | 9 | 21 | Store, scheduler, five renderers, router, headers, client script, CSS, byte budgets, browser tests, deploy files |

427 acceptance criteria in EARS form, 63 correctness properties, 118 tasks, all ticked. 62 of the properties are fast-check tests named `Property N: ...`; the full suite is 1,211 tests.

How the spec-driven approach compared with vibe coding: the specs paid for themselves at the seams. The compilers spec was written while the pages spec was still being implemented, from its design document alone, and the editor spec from the compilers' design. When the implementations met, the differences were names, not behaviour. The properties also caught real bugs that examples would not have: a repertoire table that was not sorted, a date generator producing invalid dates, and a property test whose own assertion was unsound (see "by hand"). One piece was deliberately vibe-coded for contrast: the MCP server and the three agents (session 16). That was quicker and fine for a dev tool with five small functions, but it shipped with a permission mistake that the spec'd code never had (agents created with fully trusted shell and write tools, fixed in the same session) and without a registration step, which had to be done afterwards.

## Hooks (`hooks/`)

| Hook | Trigger | What it does |
| --- | --- | --- |
| `guard-shell.json` | `PreToolUse` on `execute_bash` | Refuses (exit 2) any command that stages, commits or pushes, or that touches a secrets file or a parent directory |
| `grid-check-on-save.json` | `PostFileSave` on `pages/*.page`, and `PostToolUse` on the write tools | Runs `grid:check`, so a page that does not fit 40 by 24 is reported with row and column at once |
| `tests-on-stop.json` | `Stop` | Typecheck and the full test suite when the agent finishes; the result line is appended to `docs/kiro-evidence/hook-fires.log` |
| `fit-check-prompt.json` | `UserPromptSubmit`, matcher `^/fit` | Asks the agent to review the working-tree diff against the grid and editorial rules |

Checked, not assumed (sessions 14 and 15, `hook-fires.log`): in a headless V3 run `PreToolUse`, `PostFileSave`, `PostToolUse` and `Stop` all fired. The guard blocked a `git clean -n` that the owner asked Kiro to try, and Kiro quoted the refusal. In the same run Kiro reported a file as "unchanged" after an edit-and-revert, and the `Stop` hook's test run showed two failures: one was the stray blank line Kiro had left in `pages/899.page`, the other a flaky property test nobody had seen fail before. The `UserPromptSubmit` matcher is not applied in the CLI: the fit check ran on every prompt, not only on `/fit`. It was left on, because the extra review was cheap and twice useful.

## MCP (`settings/mcp.json`, `tools/mcp/`)

`page100` is a dev-only stdio MCP server that Kiro built so an agent can check and see a teletext page, which it cannot do by eye. Tools: `validate_markup`, `preview_markup` (the framed 24 by 40 screen as text, a second rendering with each cell's colour letter, and the derived text alternative), `render_page`, `list_pages`, `contrast`. It was registered with `kiro-cli mcp add --scope workspace`, because Kiro's own write to `.kiro/settings/` is denied by a built-in permission rule.

What it enabled: the hand-written pages. In session 17 the `page-author` agent wrote pages 800, 801, 899 and 666 blind, by counting cells, because the V3 engine did not connect the workspace MCP server in a headless run. In session 18, on the V2 engine with the server connected, the same agent previewed each page through `preview_markup`, checked the colour-letter rendering, and fixed the layouts. The test card and the gravestone on page 666 are the result.

## Agents (`agents/`)

Created by Kiro's `custom-agent-creator` sub-agent, validated with `kiro-cli agent validate`.

| Agent | Job | Real use |
| --- | --- | --- |
| `page-author` | Writes `pages/*.page`; may write only under `pages/`; validates through MCP | Sessions 17 and 18: the four hand-written pages |
| `task-auditor` | Re-runs the Verify command of every ticked task and reports which ticks still hold | Session 20: audited `grid-core` and `ai-editor` |
| `grid-reviewer` | Read-only review of a diff against the grid and editorial rules | Not yet run on its own; the `/fit` hook does the same review in every session |

The auditor's report is worth reading as it is (`20-task-auditor-agent.txt`). Every property matched its design. It marked 16 Verify results "not proven", for three reasons: test counts quoted in ticks had grown as later specs added tests; lint failed on a README the owner had just added and not yet formatted; and it would not run `npm run build` because it was told to change no file. No task was found ticked without working code.

## Where Kiro went wrong, and what was done about it

- **Summary said "unchanged", file was changed** (session 15). Caught by the `Stop` hook. Reverted by hand.
- **Agents created with fully trusted shell and write tools** (session 16). Kiro caught and narrowed this itself before finishing.
- **Blind page layout** (session 17): Kiro said plainly that it could not preview and had not verified the look. Fixed in session 18 with MCP.
- **"The first four in feed order"** (session 19): the owner's diagnosis of page 501 was wrong, and Kiro said so with the code path, changed nothing there, and pointed at the real cause in the normaliser.
- **Timeouts under parallel load**: a grid-core test timed out when the whole suite ran in parallel; Kiro raised the test timeout and changed no assertion.
- **Not seen**: in this project Kiro did not weaken a schema, mock a test's subject, or tick a task without running its command. The steering rules and Verify lines were written to prevent exactly that.

## Done by hand

- The product brief, every owner decision recorded in the specs' "Owner answers", and this file.
- The font: downloading Bedstead Extended, subsetting it with fonttools (`scripts/subset-font.sh`), and `public/fonts/README.md`.
- Running `scripts/record-editor-fixtures.ts` with a real API key (Kiro is not allowed near the key). Two recordings: 11 calls and 10 calls.
- `kiro-cli mcp add` for the workspace MCP registration, and the hook JSON files and their two shell scripts.
- One fix to a Kiro-written property test (`test/server/render-html.property.test.ts`): its "raw text must not appear" assertion was unsound when one generated string was the escaped form of another. The assertion now excludes exactly that case.
- The on-this-day normaliser's choice of which 40 entries to keep (`12.7a` in the pages-and-sources spec), its two tests, and re-recording three inline snapshots after looking at the new pages.
- Replacing the placeholder test for `pages/` with content tests once the real pages existed.
- `README.md`, `LICENSE`, `.gitignore`, commits and pushes.

## Not verified

- The Docker image has not been built (no Docker on the build machine). `scripts/runtime-check.ts` copies exactly what the Dockerfile copies into a temp directory, runs `npm ci --omit=dev` and boots the server there, and a test keeps the two lists in step.
- The deployed service on Render, and the AI editor running on a schedule in production. The editor was exercised with real model calls only through the recording script.
- The daily model-call cap is per process: a restart resets it. The per-boot cap, the ten-minute boot delay and the three-hour minimum interval bound the cost on a host that restarts.
- A real screen reader has not been used on it. The structure is tested (one `h1`, grid hidden, live region, named buttons, visible focus), not the listening experience.
- `PostFileSave` fired for Kiro's own writes in the CLI; the IDE was not used.

## Credits

The Kiro account was shared with other sessions running at the same time, so the meter cannot be read per project. Estimated from the meter before and after each run: about 900 to 950 credits for this project, most of it the five spec sessions and the steering session on `claude-opus-5.5`.
