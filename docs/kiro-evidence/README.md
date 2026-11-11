# Kiro evidence

Every `.txt` file here is the output of one real Kiro CLI 3.2.0 run in this repository, with the prompt that started it and the exit code. The only edit is that the home directory prefix is replaced with `~`. Tool calls show as `[tool]` lines; Kiro's own report is at the end of each file. `hook-fires.log` is written by the hooks themselves.

| File | Model | What happened |
| --- | --- | --- |
| `01-steering-session.txt` | opus 5.5 | The eight steering files from the product brief. Kiro computed the contrast matrix and the mosaic mapping. |
| `02-grid-core-spec.txt` | opus 5.5 | Spec for the grid: 118 criteria, 20 properties. Found two errors in its own steering file and asked four questions. |
| `03-grid-core-implementation.txt` | haiku 5.5 | All 13 tasks, 183 tests. Found an unsorted repertoire table through a property. |
| `04-pages-and-sources-spec.txt` | opus 5.5 | Spec for the registry, frame, text alternative and the seven sources. |
| `05-pages-and-sources-implementation.txt` | auto | Recorded the fixtures, then stopped on two points it would not decide alone (a missing field, a lint failure in an owner file). |
| `06-rule-compilers-spec.txt` | opus 5.5 | Spec for the compilers, written from the previous spec's design while that spec was still being implemented. |
| `07-pages-and-sources-implementation-2.txt` | auto | Finished the spec with the owner's three answers. 483 tests. |
| `08-rule-compilers-implementation.txt` | auto | Every page compiled from the snapshot. 733 tests, `grid:check`. |
| `09-ai-editor-spec.txt` | opus 5.5 | Spec for the editor, including a second cap so that the SDK's own retry cannot exceed the budget. |
| `10-server-and-viewer-spec.txt` | opus 5.5 | Spec for the server, viewer, budgets and deploy files. Pointed out that the daily cap is not hard on a host that restarts. |
| `11-ai-editor-implementation.txt` | auto | The editor, with scripted clients only. Never touched the key. 900 tests. |
| `12-server-implementation.txt` | auto | Tasks 1 to 12: store, scheduler, renderers, router. Added a no-cost reuse pass it found was needed. 1,110 tests. |
| `13-viewer-implementation.txt` | auto | Tasks 13 to 21: CSS, client script, budgets, 41 browser tests, screenshots, deploy files, runtime check. |
| `14-hooks-fire-test.txt`, `15-hooks-fire-test-2.txt` | haiku 5.5 | Which hooks fire in a headless run. The first run's log helper had a wrong path. The second shows all four triggers, the guard blocking a command, and the Stop hook catching a change Kiro had reported as reverted. |
| `16-mcp-and-agents-vibe.txt` | auto | Vibe session: the `page100` MCP server and three agents made by the `custom-agent-creator` sub-agent. |
| `17-page-author-agent.txt` | auto, V3 | The `page-author` agent writes four pages without previews, because the MCP server was not connected, and says so. |
| `18-page-author-agent-mcp.txt` | auto, V2 | The same agent with the MCP tools connected: validates, previews and improves each page. |
| `19-compiler-corrections.txt` | auto | Three corrections with spec amendments. Kiro shows the owner's diagnosis of one of them was wrong. |
| `20-task-auditor-agent.txt` | haiku 5.5 | The `task-auditor` agent re-runs every Verify command of two specs and reports stale counts honestly. |

The credit figures at the end of each file are the whole account's meter before and after the run. Other sessions were using the same account, so a difference is an upper bound for that run, not its cost.
