---
inclusion: always
---

# Page 100: structure

## Layout

```
src/grid/        Cell and grid types, colours, contrast table, mosaic bit/Unicode mapping, repertoire, the validator
src/markup/      Page markup parser and serialiser (grid <-> text), with violation messages that give row and column
src/pages/       Page registry (number, banner, source, editor, quick links, subpages) and the frame builder for rows 0, 1, 22, 23
src/sources/     One fetcher per data source, zod schemas, shared HTTP client (User-Agent, timeouts), refresh schedule, boot snapshot in src/sources/snapshot/
src/compilers/   Deterministic rule-based compilers, one per section, plus number/date formatters and text fitting (wrap, truncate)
src/editor/      AI editor: prompt building, SDK call, draft checks (validator, repertoire, numeric fidelity), retry with violations, daily call cap, accepted/rejected counts
src/server/      node:http server, routes, renderers (HTML, fragment, text, ANSI, JSON), in-memory page store, compile scheduler, headers, CSP, compression, config
public/          Static assets served as-is: CSS, the small client script, the Bedstead subset font
pages/           Hand-written page markup for static pages (800, 801, 899)
test/            Mirrors src/ (test/grid, test/markup, ...); test/fixtures/sources for recorded responses; test/e2e for Playwright
tools/mcp/       Dev-only MCP server so Kiro can validate markup and preview pages; never imported by src/
scripts/         Dev and CI scripts: grid-check, payload, fixture recording, snapshot refresh, font subsetting
docs/            Product brief, decisions, docs/kiro-evidence/ session transcripts
```

## Dependency direction

- `src/grid` imports nothing from the project.
- `src/markup` imports only `src/grid`.
- `src/compilers` and `src/editor` import `src/grid`, `src/markup` and `src/sources` types. They never import `src/server`.
- `src/server` may import any `src/` module. Nothing in `src/` imports `scripts/`, `tools/` or `test/`.
- Only `src/sources` makes outbound HTTP requests, and only `src/editor` calls the Anthropic SDK.

## Naming

- Files and directories: kebab-case, `.ts`. One main export per module; the file is named after it (`validate-grid.ts` exports `validateGrid`).
- Types and zod schemas: PascalCase. A schema and its inferred type share a name: `const HnItem = z.object(...)`, `type HnItem = z.infer<typeof HnItem>`.
- Section modules are named by page number and topic: `src/compilers/p200-weather-now.ts`, `src/compilers/p300-rates.ts`.
- Source modules are named by source: `src/sources/wikimedia-feed.ts`, `src/sources/open-meteo.ts`, `src/sources/frankfurter.ts`, `src/sources/hacker-news.ts`, `src/sources/usgs.ts`, `src/sources/launch-library.ts`.
- Hand-written pages: `pages/<number>.page` (for example `pages/899.page`). Each holds the content rows 2-21 only, at most 20 lines.
- Tests: `<module>.test.ts` for example tests, `<module>.property.test.ts` for fast-check properties, next to the mirrored path (`src/grid/validate-grid.ts` is tested by `test/grid/validate-grid.test.ts`).
- Fixtures: `test/fixtures/sources/<source>/<yyyy-mm-dd>-<what>.json`.
- Environment variables: UPPER_SNAKE_CASE, read only in `src/server/config.ts`.
