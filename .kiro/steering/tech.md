---
inclusion: always
---

# Page 100: tech

## Stack

- Node 20.19 or later. TypeScript with `"strict": true` and `"noUncheckedIndexedAccess": true`. ES modules only (`"type": "module"`, `"module": "NodeNext"`). No CommonJS and no `require`.
- The HTTP server is `node:http`, with `node:zlib` for brotli and gzip. No web framework.
- Deployed from a `Dockerfile` to Render's free plan.
- Font: Bedstead Extended (public domain dedication by its author, Ben Harris), subset to the repertoire in `grid-rules.md`, committed as a file under `public/`.

## Dependencies

- Runtime: `zod` and `@anthropic-ai/sdk`. Nothing else. Adding any runtime dependency is a product change and needs the user's explicit approval.
- Dev: `typescript`, `tsx`, `vitest`, `fast-check`, `eslint` (flat config, `eslint.config.js`) with `typescript-eslint`, `prettier`, `@playwright/test`, `@types/node`. Ask before adding anything else.
- Playwright is for `test/e2e/` only. Unit and property tests use vitest, with fast-check for properties.

## Configuration (environment variables)

| Variable | Use | Default |
|---|---|---|
| `ANTHROPIC_API_KEY` | AI editor. If unset, the rule-based compiler publishes every page. | unset |
| `EDITOR_MODEL` | Model id for the AI editor | `claude-opus-5-5` |
| `MAX_MODEL_CALLS_PER_DAY` | Hard cap on model calls per UTC day | set in the editor spec |
| `PORT` | HTTP port | `3000` |

The API key is never logged, never included in an error message, never sent to the browser and never committed. Config is read once, in `src/server/config.ts`, and validated with zod.

## npm scripts

| Script | Does |
|---|---|
| `build` | `tsc -p tsconfig.build.json`, output to `dist/` |
| `dev` | `tsx watch src/server/main.ts`. The user runs it; Kiro does not start it. |
| `start` | `node dist/server/main.js` |
| `test` | `vitest run` (unit and property tests, offline, fixtures only) |
| `typecheck` | `tsc --noEmit` |
| `lint` | `eslint . && prettier --check .` |
| `format` | `prettier --write .` |
| `e2e` | `playwright test` |
| `grid:check` | `tsx scripts/grid-check.ts`: validates every file in `pages/` and every page compiled from the boot snapshot. Exits non-zero on any violation. |
| `payload` | `tsx scripts/payload.ts`: measures the byte budgets in `frontend.md`. Exits non-zero if any budget is over. |

Tests never make network calls. A test that needs the network is a bug.

## Rules for Kiro and for reviewers

1. Keep commits small: one task or one fix each. Suggest a commit message, but **never run `git add`, `git commit`, `git push`** or any other command that stages, commits or pushes. The user does that.
2. **Never read or print any file outside this repository.** That includes the parent directories (`../`, `~/hackathons-2026/`, home) and any `.env`, `.env.*`, key, token or secrets file, inside or outside the repository. Do not `cat`, `ls`, grep or glob them. If a task seems to need one, stop and ask. One exception, by name: `.env.example` is a template that holds variable names, comments and defaults, never a key, and Kiro may read and write it directly.
3. **Never weaken a validator, schema or test to make something pass.** Fix the code or the data. If a rule itself is wrong, say so and get the user's agreement before changing it.
4. **Never mock the thing a test is meant to prove.** A validator test calls the real validator. A parser round-trip test uses the real parser and serialiser. Source parsing tests use recorded fixtures, not hand-made objects that skip the zod schema.
5. **Tick a task only after running the command that proves it**, and quote that command and its result in the task update (for example `npm test -- test/grid` with "38 passed").
6. **Report only test runs that really happened in this session.** Do not summarise a run you did not see, and do not round "most pass" up to "pass".
7. No `any`, no `@ts-ignore`, no `eslint-disable` without a comment saying why and naming the spec that allows it.
8. Do not start long-running processes (`dev`, watchers). Tell the user the command instead.
