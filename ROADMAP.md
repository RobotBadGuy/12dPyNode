# PyChain Roadmap

Jira-style backlog. IDs use the `PC-` prefix. Priorities: **P0** (breaking / must-fix), **P1** (high value), **P2** (nice to have).

Recommendations are grouped by Epic. Each task lists a one-line description and a short rationale.

---

## EPIC-01 — Critical Bug Fixes ✅

Known defects observed in the current codebase. Bundle these before taking on new work.

- ✅ **PC-101** `[P0]` — Fix undefined `processing_sessions` dict in `backend/main.py:134`.
  *Rationale:* `/api/upload` references a name that is never defined (only `workflow_sessions` exists). Any call to this endpoint raises `NameError`. Either remove the legacy endpoint or restore the dict.

- ✅ **PC-102** `[P0]` — Replace silent `except Exception: pass` blocks.
  *Rationale:* `main.py:46` (startup cleanup), `workflow_runner.py:514` (MTF generation), `workflow_runner.py:527` (template generation) swallow errors with no log output. User sees a "successful" ZIP that silently missing side-effect files. Log at minimum; surface to session status where appropriate.

- ✅ **PC-103** `[P0]` — Make startup cleanup session-scoped, not global.
  *Rationale:* `lifespan()` in `main.py` deletes every file in `uploads/` and `output/` on server start. In a multi-user or restart-during-processing scenario, this destroys another session's in-flight data. Scope deletion to orphaned session IDs or add a TTL sweeper.

- ✅ **PC-104** `[P1]` — Remove hardcoded dates/times from generated XML headers.
  *Rationale:* `workflow_runner.py:728` and `:731` emit `date="2024-01-16"` / `date="2023-10-13"` literals. Replace with `datetime.now()` or make the timestamp a node parameter.

- ✅ **PC-105** `[P1]` — Resolve TypeScript build errors.
  *Rationale:* `frontend/tsc_output.txt` records `TS2307: Cannot find module '@radix-ui/react-progress'`. The package *is* in `package.json` — suggests stale `node_modules` or a casing issue on Windows. Either way, `tsc --noEmit` should be green and gated by CI.

- ✅ **PC-106** `[P2]` — Clean up repository root.
  *Rationale:* `bench align.chain`, `road 01 align.chain`, `NWP-*.chain`, `models - Copy.xlsx`, `workflow-template (5).json`, and the loose `.12dattmf` files look like test fixtures living at the repo root. Move them to `samples/` or `.gitignore` them. `fastapi-venv/` and `venv/` under `backend/` should never be committed.

---

## EPIC-02 — Persistence Layer

Backed by Supabase (Postgres). All app tables share the `pynode_` prefix so we can coexist with other apps in the same Supabase project. The backend uses the service role key for now; once PC-801 (auth) lands we'll switch to user-scoped JWTs and turn RLS on.

- ✅ **PC-201** `[P1]` — Supabase-backed session store.
  *Rationale:* `workflow_sessions` dict in `main.py` was wiped on every restart and a background worker that crashed mid-run orphaned the output. Replaced by `pynode_workflow_sessions` (see `backend/migrations/001_init_workflow_sessions.sql`) accessed through the `SessionStore` Protocol in `backend/services/session_store.py`. Falls back to in-memory when env vars are absent so tests and offline dev still work.

- ✅ **PC-202** `[P1]` — Persist templates server-side in Supabase.
  *Rationale:* `lib/workflow/templates.ts` used to store in `localStorage`. Clearing browser data deleted templates and they couldn't be shared between users or machines. Replaced by `pynode_templates` (see `backend/migrations/002_init_templates.sql`) accessed through the `TemplateStore` Protocol in `backend/services/template_store.py`. Exposed at `GET/POST/PUT/DELETE /api/templates`. A one-shot `migrateLocalStorageToServer()` on the frontend uploads any pre-existing local templates on first load and marks itself done. Templates are globally shared until PC-801 adds auth.

- ✅ **PC-203** `[P2]` — Workflow versioning / history.
  *Rationale:* Every save (POST or PUT) snapshots the graph into `pynode_template_versions` (see `backend/migrations/003_add_template_versions.sql`) accessed through the `TemplateVersionStore` Protocol in `backend/services/template_version_store.py`. Existing templates are backfilled as v1. Exposed at `GET /api/templates/{id}/versions` (metadata) and `GET /api/templates/{id}/versions/{n}` (full snapshot). The Save modal grew a two-button flow ("Save Changes" PUTs a new version, "Save as New" POSTs a new template) and an optional commit-style note. The Load modal grew an inline expandable history with Restore. Diffing two versions is deferred. The `author` column is nullable until PC-801 attaches user IDs.

- **PC-204** `[P2]` — Session TTL and garbage collection. (Claude Code)
  *Rationale:* `delete_older_than` already exists on the store and runs at startup. Promote it to a scheduled task (e.g. APScheduler) so long-running servers don't accumulate stale rows + orphaned files between restarts.

---

## EPIC-03 — Graph Execution Engine

The current compiler handles the happy path (one `foreach` → one `chainFileOutput`) but has rough edges.

- **PC-301** `[P1]` — Execute all branches reachable from foreach, not just the first DFS hit.
  *Rationale:* `build_command_chain` in `workflow_runner.py` uses DFS that returns the first path to a `chainFileOutput`. A graph with parallel branches silently drops everything not on that path. Walk *all* reachable flow nodes in topological order instead.

- **PC-302** `[P1]` — Per-model error isolation and partial results.
  *Rationale:* `run_workflow` iterates models in a bare loop. One bad model raises out of the whole batch. Wrap each model in try/except, collect `{model, status, error}` rows, and return partial ZIPs with a summary report.

- **PC-303** `[P1]` — Surface per-node execution logs to the UI.
  *Rationale:* Right now users see "processing" → "completed" or "error". No way to tell which node failed or see the XML that was generated. Stream per-node events via SSE/WebSocket and render them in the canvas (node border colour + log panel).

- **PC-304** `[P2]` — Chain XML preview before download.
  *Rationale:* Add `GET /api/workflow/preview/{session_id}/{model_name}` that returns the generated chain as text. Lets users verify output without opening 12d.

- **PC-305** `[P2]` — Edge type validation at compile time.
  *Rationale:* The handle prefix system (`flow:` / `param:` / `value:`) exists but is not enforced. A `value:` output can be wired to a `flow:` input and the runner silently ignores it. Reject invalid connections in `WorkspaceCanvas.tsx::onConnect`.

- **PC-306** `[P2]` — Richer control-flow nodes.
  *Rationale:* Currently only `ifFunctionExists`. Add generic `If`, `Switch`, and `While` nodes so users can branch on variable values without writing a new command module.

---

## EPIC-04 — Variable System

`resolve_variable` already supports `{token}` templating and per-run / per-model scopes. Extend it rather than rewrite.

- **PC-401** `[P1]` — Typed variables (string / number / boolean / path / list).
  *Rationale:* Everything is coerced to `str` today. A boolean `continueOnFailure` typed as string "True" vs "true" has caused real issues in `clean_model_command`. Add a `type` field to `VariableBinding` and coerce at resolution.

- **PC-402** `[P2]` — Expression evaluator for computed variables.
  *Rationale:* `modified_variable = model_name.replace('-', ' ')` is hardcoded. Let users define transforms like `{model_name | upper | replace('-', '_')}` via a minimal expression language (avoid full `eval`).

- **PC-403** `[P2]` — Variable scope per-foreach (loop-local).
  *Rationale:* Only `per-run` and `per-model` exist. If the user adds a second `foreachModel` with different semantics, scopes collide. Add loop-local scope keyed on the foreach node ID.

---

## EPIC-05 — Testing & CI/CD

The project has zero tests (backend and frontend) and no CI. Every change ships on vibes.

- ✅ **PC-501** `[P1]` — Pytest harness for `workflow_runner` and all command generators.
  *Rationale:* The XML generators are pure functions — ideal for snapshot tests. A single regression (e.g. whitespace change) corrupts every chain file silently. Ship golden-file tests for each node type.

- ✅ **PC-502** `[P1]` — Graph compiler unit tests.
  *Rationale:* Cover topological sort, cycle detection, flow-edge filtering, missing-node edges, foreach-less graphs. All bug-prone paths in `build_command_chain`.

- ✅ **PC-503** `[P2]` — Frontend component tests (Vitest + Testing Library).
  *Rationale:* `compile.ts`, `templates.ts`, and sidebar editors have no coverage. Start with `compileWorkflow`/`validateWorkflow`.

- ✅ **PC-504** `[P1]` — GitHub Actions pipeline.
  *Rationale:* Run `pytest`, `npm run lint`, `tsc --noEmit`, and `npm run build` on PR. Block merge on failure. Today PC-105's build error would have been caught months ago.

- **PC-505** `[P2]` — Playwright end-to-end test.
  *Rationale:* One golden-path test: upload Excel → drop nodes → run → download → assert ZIP contents. Catches the integration bugs unit tests miss.

---

## EPIC-06 — Developer Experience

- **PC-601** `[P2]` — Dockerfile + docker-compose for local dev.
  *Rationale:* Windows venv + Node setup is brittle (see README using wrong path `Python Scripts` instead of `Python Projects`). One `docker compose up` removes the onboarding friction.

- **PC-602** `[P2]` — Fix README paths and remove stale instructions.
  *Rationale:* README references `G:\WebDev\Python Scripts\12dPynode` — the folder is actually `Python Projects`. Legacy `/api/upload` docs describe a broken endpoint.

- **PC-603** `[P2]` — Contribution guide and node-authoring template.
  *Rationale:* `frontend/adding_node_params.md` is excellent but hidden. Move to `docs/`, link from README, and add a cookiecutter-style script that scaffolds the 5 files needed for a new node.

- **PC-604** `[P2]` — Consolidate `start.sh` and `start.bat`, or delete both.
  *Rationale:* `start.sh` just runs `python main.py` with some echoes. `start.bat` presumably the same. The README already documents the command. Reduce surface area.

---

## EPIC-07 — UX Polish

- **PC-701** `[P1]` — Searchable node palette.
  *Rationale:* `LeftSidebar` lists ~30 node types flat. Users scroll to find `triangulateManualOption`. Add a filter input + category collapsibles.

- **PC-702** `[P2]` — Keyboard shortcut cheatsheet.
  *Rationale:* Undo/redo/copy/paste/delete are implemented in `app/page.tsx` but undocumented. `?` modal listing them.

- **PC-703** `[P2]` — Validation surface in the canvas.
  *Rationale:* `validateWorkflow` returns errors but they only appear at run time. Show warning badges on nodes with missing required params *before* the user hits Run.

- **PC-704** `[P2]` — Excel column picker with preview.
  *Rationale:* `selectedColumnIndex` is hidden in the `excelModels` node data. Render the first N rows of the parsed sheet in a table and let the user click a column header.

- **PC-705** `[P2]` — Dark/light theme toggle.
  *Rationale:* Currently dark-only (hardcoded `text-gray-300` etc.). Tailwind already supports this via `dark:` prefix — refactor tokens.

---

## EPIC-08 — Multi-User / Production Hardening

Move from "developer's laptop" to "team tool." Do this after EPIC-02 lands.

- **PC-801** `[P1]` — Authentication via Supabase Auth.
  *Rationale:* No auth today. Use Supabase Auth (GitHub/Google providers) so sessions/templates can be scoped to user IDs by the same backing store. Once user IDs are attached to rows, enable RLS on every `pynode_*` table and switch the backend from the service role key to user-scoped JWTs forwarded from the frontend.

- **PC-802** `[P1]` — File size and rate limits.
  *Rationale:* `/api/workflow/run` accepts arbitrarily large Excel uploads. Add FastAPI middleware for body-size limits and per-IP rate limiting.

- **PC-803** `[P2]` — Replace BackgroundTasks with a real job queue.
  *Rationale:* `fastapi.BackgroundTasks` runs in-process; a crashed worker loses the job. Move to RQ or Celery with Redis so retries and observability are first-class.

- **PC-804** `[P2]` — Audit logging.
  *Rationale:* Track who ran what workflow, how many models, which templates. Non-negotiable in a regulated engineering shop.

- **PC-805** `[P2]` — Tighten CORS + CSP headers.
  *Rationale:* `allow_origins` driven by env var is fine, but `allow_methods=["*"]` and `allow_headers=["*"]` with `allow_credentials=True` is permissive. Lock down once the API surface is stable.

---

## Suggested Order of Attack

1. **EPIC-01** (bug fixes) — cheap, unblocks everything else.
2. **PC-504** (CI) — so every subsequent PR is protected.
3. **EPIC-05** (tests) — paid for by the CI investment.
4. **EPIC-02** (persistence) — the biggest unlock for users.
5. **EPIC-03** (execution engine) — once tests exist, refactoring is safe.
6. **EPIC-04 / 07** (variables, UX) — quality-of-life improvements.
7. **EPIC-08** (multi-user) — only if the product graduates from single-user.
