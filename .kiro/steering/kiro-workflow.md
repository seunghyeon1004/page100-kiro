---
inclusion: manual
---

# Page 100: working with Kiro

## Specs

One spec per feature, in `.kiro/specs/<name>/` (kebab-case). Each spec has three files, written and approved in this order.

### requirements.md

- Requirements are numbered `1`, `2`, ... and acceptance criteria `1.1`, `1.2`, ... Numbers never change once approved; a removed criterion is struck through, not renumbered.
- Every acceptance criterion uses EARS:
  - Ubiquitous: `THE <system> SHALL <response>`
  - Event: `WHEN <trigger>, THE <system> SHALL <response>`
  - State: `WHILE <state>, THE <system> SHALL <response>`
  - Unwanted: `IF <condition>, THEN THE <system> SHALL <response>`
  - Optional: `WHERE <feature>, THE <system> SHALL <response>`
- Each criterion must be testable as written: name the value, limit, route or row. "Fast", "clean" and "user-friendly" are not criteria.
- Where a spec departs from `docs/product-brief.md` or a steering file, it says so in a "Departures" section and gives the reason.

### design.md

- Modules and their files (following `structure.md`), types, data flow, error handling and the test plan.
- A **Correctness properties** section. Each property is a universally quantified statement in the form `Property N: for all <inputs>, <statement>. Validates: 1.2, 3.1`. Each property becomes one fast-check test in a `*.property.test.ts` file, and the test's name starts with `Property N`.
- Edge cases that a property does not cover are listed as example tests.

### tasks.md

- Checkbox tasks: `- [ ] 3. Implement the markup serialiser`. Sub-tasks use `3.1`, `3.2`.
- Every task cites the requirement numbers it covers (`Requirements: 2.1, 2.4`) and the command that verifies it (`Verify: npm test -- test/markup`).
- A task is ticked `- [x]` only after that command has been run in the session and passed. The tick is followed by the command and its result summary, quoted from the real output (see `tech.md`).
- Tasks are small enough for one commit each. Kiro proposes the commit message and the user commits.

### Planned specs, in build order

1. `grid-core`: cell model, colours, contrast, mosaics, repertoire, validator
2. `page-markup`: parser and serialiser
3. `page-frame`: registry, rows 0/1/22/23, the not-in-service page
4. `sources`: HTTP client, schemas, fixtures, schedule, snapshot
5. `rule-compilers`: one compiler per section
6. `ai-editor`: prompt, checks, retries, call cap, counts for page 802
7. `server`: routes, renderers, store, headers, CSP, compression
8. `frontend`: client script, keypad, text view, accessibility, byte budgets
9. `static-pages`: 800, 801, 899
10. `deploy`: Dockerfile and Render

## Custom agents (planned)

| Agent | Purpose | Limits |
|---|---|---|
| `page-author` | Writes and fixes hand-written markup in `pages/` | Writes only under `pages/`. Validates through the MCP `validate_markup` tool before finishing. |
| `grid-reviewer` | Reviews a diff against `grid-rules.md` and `editorial.md` and lists violations with file and line | Read-only. No shell. |
| `task-auditor` | Checks every ticked task in a `tasks.md` cites requirements and a verify command, and re-runs that command | Read-only except running npm scripts. Reports; does not edit. |

Every agent config lists `file://.kiro/steering/**/*.md` in its resources, because custom agents do not load steering automatically.

## Hooks (planned)

| Hook | Trigger | Action |
|---|---|---|
| Block git writes | PreToolUse on shell commands | Exit 2 if the command contains `git add`, `git commit`, `git push`, `git reset --hard` or `git clean` |
| Guard secrets and parent dirs | PreToolUse on read, search and shell tools | Exit 2 on any path containing `.env`, or resolving outside the repository |
| Grid check on save | PostFileSave, matcher `^pages/.*\.page$` | `npm run grid:check` |
| Typecheck on save | PostFileSave, matcher `^src/.*\.ts$` | `npm run typecheck` |
| Task gate | PostTaskExec | `npm run typecheck && npm test && npm run lint` |

Hooks are created with Kiro's hook tool, never written by hand. A hook is never disabled to get past a failure.

## MCP server (`tools/mcp/`, planned)

A dev-only stdio server that imports `src/grid`, `src/markup` and `src/pages`. Its tools are `validate_markup` (returns violations with row and column), `render_page` (text or ANSI preview of a page compiled from the snapshot), `list_pages`, and `contrast` (ratio for a fg/bg pair). It makes no network calls and does not read files outside the repository.

## Evidence

- Save every substantial Kiro session transcript to `docs/kiro-evidence/NN-<topic>.txt`. `NN` is the next two-digit number (`01-steering-session.txt` exists).
- Remove any secret, token or path outside the repository from a transcript before it is saved.
- Transcripts are saved as they happen and never edited to change what was said or which tests ran.
