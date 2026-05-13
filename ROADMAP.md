# PyChain Roadmap

Jira-style backlog. IDs use the `PC-` prefix. Tasks are grouped by Epic; each task lists a one-line description, rationale, and the metadata below.

**Priority** — `P0` (breaking / must-fix), `P1` (high value), `P2` (nice to have).

**Size** (rough effort estimate):
- `XS` — under 1 hour
- `S` — 1–3 hours
- `M` — half a day to a full day
- `L` — 2–3 days
- `XL` — 1+ week

**Mode** — recommended Claude Code mode for executing the task:
- `regular` — direct prompting, well-scoped change, no special workflow needed
- `feature-dev` — `/feature-dev` skill, for cross-stack features that need codebase understanding and architectural framing
- `superpowers` — superpowers skills (brainstorming → plan → TDD), for high-stakes or design-heavy work where mistakes are expensive

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

- ✅ **PC-204** `[P2]` — Session TTL and garbage collection.
  *Rationale:* The startup-only sweep is now augmented by an asyncio task in `lifespan()` that runs every `CLEANUP_INTERVAL_SECONDS` (default = `max(60, CLEANUP_TTL_SECONDS // 4)`). Both halves (file glob + `session_store.delete_older_than`) are independently try/except'd so a flaky DB does not block the disk sweep. Tested in `backend/tests/test_lifespan_sweep.py`.

---

## EPIC-03 — Graph Execution Engine

The current compiler handles the happy path (one `foreach` → one `chainFileOutput`) but has rough edges.

- ✅ **PC-301** `[P1]` — Execute all branches reachable from foreach.
  *Rationale:* `build_command_chain` in `workflow_runner.py` previously used a first-path DFS that silently dropped parallel branches downstream of `foreachModel`. Replaced with forward-reachability BFS over flow edges from the foreach node, then deterministic Kahn's topological sort over the induced subgraph (id-sorted roots + adjacency for stable output across dict-iteration / edge insertion order). Cycles log a warning and emit the well-ordered prefix; disconnected subgraphs are correctly excluded; a foreach with no reachable `chainFileOutput` is now a supported shape. Two private helpers (`_collect_flow_reachable`, `_kahn_sort`) are reused by the no-foreach fallback path. Tested in `backend/tests/test_build_command_chain.py::TestParallelBranches` (parallel branches, diamond merge, branch-without-output, disconnected subgraph, cycle, determinism).

- ✅ **PC-302** `[P1]` — Per-model error isolation and partial results.
  *Rationale:* `run_workflow` previously raised out of the whole batch when a single model failed. The per-model loop in `services/workflow_runner.py` now wraps each `generate_chain_file` call in try/except and records a `{model, filename, output_path, project_folder, status, error, node_events}` row in `file_details`. Successful models still ZIP normally; failed models contribute an `error`-status row but do not abort the run. `run_workflow_job` in `backend/main.py` derives `succeeded_count` / `failed_count` from these rows and always writes a `_summary.txt` into the ZIP (via `_build_summary_text`) with separate SUCCEEDED / FAILED sections — even when every model failed, so users still get provenance. The pre-loop path (Excel parse, ZIP write) keeps its outer try/except and still surfaces as `status='error'`. The session's `results.summary` exposes the counts to the frontend, which the Save/Download `SuccessCelebration` modal renders as a per-model breakdown with a `FailedModel[]` list (modal state resets on close so a re-run starts clean). Tested in `backend/tests/test_run_workflow.py` (11 cases: all-succeed, one-fails, all-fail, traceback logged, pre-loop raise still propagates, empty after filtering, row shape, row order, progress callback) and `backend/tests/test_run_workflow_job.py` (10 cases: ZIP contents with mixed/all-fail, summary counts in session, pre-loop error status, summary text format with each section, intermediate progress writes, status endpoint behavior during processing).

- ✅ **PC-303** `[P1]` — Surface per-node execution logs to the UI.
  *Rationale:* `build_command_chain` now wraps every `execute_node` call in `_execute_node_with_capture`, snapshotting `len(xml_content)` before each call so the per-node XML slice is captured on success. Each call also appends a `{model, node_id, node_type, node_label, status, error}` entry to a `node_events_out` list passed in by the caller; on exception the error event is appended before re-raising so PC-302's per-model isolation still kicks in. `run_workflow` exposes a `node_xml_callback` invoked once per model with `(model_name, {node_id: List[str]})`. `run_workflow_job` wires it to disk: `OUTPUT_DIR/<session_id>/_node_xml/<safe_model>/<safe_node_id>.xml`. New endpoint `GET /api/workflow/node-xml/{session_id}/{model_name}/{node_id}` reads the slice back; path segments go through `_safe_path_segment` on both sides so '/' / '..' can never escape OUTPUT_DIR. On the frontend, `lib/workflow/runStatus.ts` aggregates per-node events into `'idle' | 'running' | 'success' | 'error'`; `app/page.tsx` injects this into each node's `data.nodeState` (the existing BaseNode plumbing handles the visuals). New `NodeRunDetails` panel in the right sidebar shows per-model events for the selected node, with an inline "View XML" button that fetches the per-node slice on demand. Polling-based (no SSE/WebSocket needed at this scale) — events ride the existing PC-907 `/api/workflow/status` channel via `results.file_details[*].node_events`. Tested in `backend/tests/test_per_node_events.py` and `frontend/lib/workflow/__tests__/runStatus.test.ts`.

- **PC-304** `[P2]` `[Size: S]` `[Mode: regular]` — Chain XML preview before download.
  *Rationale:* Add `GET /api/workflow/preview/{session_id}/{model_name}` that returns the generated chain as text. Lets users verify output without opening 12d.

- ✅ **PC-305** `[P2]` — Edge type validation at compile time.
  *Rationale:* `WorkspaceCanvas.tsx` now passes `isValidConnection={validateConnection}` to React Flow. The validator (in `frontend/lib/workflow/edgeRules.ts`) only allows `flow→flow` and `value→param` connections; legacy unprefixed handles still pass for backward compatibility. Tested in `frontend/lib/workflow/__tests__/edgeRules.test.ts`.

> ~~PC-306 (richer If/Switch/While control-flow nodes)~~ — **dropped**. No concrete use case in the current workflow library, and the existing graph + per-model loop already covers the real-world cases. Revisit only if a workflow actually needs it.

---

## EPIC-04 — Variable System

`resolve_variable` already supports `{token}` templating and per-run / per-model scopes. Extend it rather than rewrite.

- **PC-401** `[P1]` `[Size: M]` `[Mode: superpowers]` — Typed variables (string / number / boolean / path / list).
  *Rationale:* Everything is coerced to `str` today. A boolean `continueOnFailure` typed as string "True" vs "true" has caused real issues in `clean_model_command`. Add a `type` field to `VariableBinding` and coerce at resolution. Worth doing TDD-first because a regression here corrupts every chain file silently.

> ~~PC-402 (expression evaluator / pipe transforms)~~ — **dropped**. The current `{token}` substitution + `modified_variable` covers the real cases; a mini-language is a maintenance liability for one user's edge case. Revisit if multiple users hit the same wall.

> ~~PC-403 (loop-local variable scope)~~ — **dropped**. Speculative — there's no second-foreach use case driving it. The existing per-run / per-model split is enough.

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

- **PC-505** `[P2]` `[Size: M]` `[Mode: regular]` — Playwright end-to-end test.
  *Rationale:* One golden-path test: upload Excel → drop nodes → run → download → assert ZIP contents. Catches the integration bugs unit tests miss.

---

## EPIC-06 — Developer Experience

- **PC-601** `[P2]` `[Size: S]` `[Mode: regular]` — Dockerfile + docker-compose for local dev.
  *Rationale:* Windows venv + Node setup is brittle (see README using wrong path `Python Scripts` instead of `Python Projects`). One `docker compose up` removes the onboarding friction.

- ✅ **PC-602** `[P2]` — Fix README paths and remove stale instructions.
  *Rationale:* Replaced "Python Scripts" with the correct "Python Projects" path, removed the Legacy API section (those endpoints were killed in PC-101), corrected the templates-storage description to match PC-202, and updated the cleanup-on-startup wording to match PC-204.

- **PC-603** `[P2]` `[Size: S]` `[Mode: regular]` — Contribution guide and node-authoring template.
  *Rationale:* `frontend/adding_node_params.md` is excellent but hidden. Move to `docs/`, link from README, and add a cookiecutter-style script that scaffolds the 5 files needed for a new node.

- ✅ **PC-604** `[P2]` — Consolidate `start.sh` and `start.bat`, or delete both.
  *Rationale:* Both scripts have been removed. The README and CLAUDE.md document the commands directly.

---

## EPIC-07 — UX Polish

- ✅ **PC-701** `[P1]` — Searchable node palette.
  *Rationale:* `LeftSidebar.tsx` now sources every entry from `frontend/lib/workflow/palette.ts` (one `PALETTE_ITEMS` array of `{type, label, category, keywords?}`). A search input above "Add Nodes" filters via `filterPaletteItems` (case-insensitive substring on label + curated keywords). Empty query → existing collapsible-sections view. Non-empty query → flat list grouped by category with a "No matches" hint when empty. Tested in `frontend/lib/workflow/__tests__/palette.test.ts`.

- ✅ **PC-702** `[P2]` — Keyboard shortcut cheatsheet.
  *Rationale:* New `ShortcutsModal.tsx` listing every shortcut grouped by category (Editing / Canvas / Help). Opens via `?` keypress (input-focus guard reused from the existing handler in `app/page.tsx`) or the `HelpCircle` button added to `TopBar`. `Esc` closes. Mac vs Windows key labels (`⌘` vs `Ctrl`) chosen from `navigator.platform`.

- ✅ **PC-703** `[P2]` — Validation surface in the canvas.
  *Rationale:* New `validateNode(node, allNodes, allEdges)` in `frontend/lib/workflow/compile.ts` returns per-node warnings for excelModels-without-file, chainFileOutput-missing-fields, and any param-handle whose data field is empty AND has no incoming `param:` edge (generic check using `nodeSchemas`). `app/page.tsx` memoizes the warning map and injects `data.warnings` into each node before rendering. `BaseNode.tsx` shows an amber `AlertTriangle` badge in the top-left (so it doesn't collide with success/error in the top-right) with the warning list as a native tooltip. Tested in `frontend/lib/workflow/__tests__/validateNode.test.ts`.

- **PC-704** `[P1]` `[Size: M]` `[Mode: feature-dev]` — Excel column picker with preview.
  *Rationale:* `selectedColumnIndex` is hidden in the `excelModels` node data. Render the first N rows of the parsed sheet in a table and let the user click a column header. *Bumped to P1 — this is currently the most confusing step for new users.*

- **PC-705** `[P2]` `[Size: L]` `[Mode: feature-dev]` — Dark/light theme toggle.
  *Rationale:* Currently dark-only (hardcoded `text-gray-300` etc.). Tailwind already supports this via `dark:` prefix — refactor tokens. Touches every component, hence Large.

---

## EPIC-08 — Multi-User / Production Hardening

Move from "developer's laptop" to "team tool." Do this after EPIC-02 lands.

- **PC-801** `[P1]` `[Size: XL]` `[Mode: superpowers]` — Authentication via Supabase Auth.
  *Rationale:* No auth today. Use Supabase Auth (GitHub/Google providers) so sessions/templates can be scoped to user IDs by the same backing store. Once user IDs are attached to rows, enable RLS on every `pynode_*` table and switch the backend from the service role key to user-scoped JWTs forwarded from the frontend. Only do this if the app graduates from single-user.

- **PC-802** `[P1]` `[Size: S]` `[Mode: regular]` — File size and rate limits.
  *Rationale:* `/api/workflow/run` accepts arbitrarily large Excel uploads. Add FastAPI middleware for body-size limits and per-IP rate limiting.

> ~~PC-803 (RQ/Celery + Redis job queue)~~ — **dropped**. In-process `BackgroundTasks` is appropriate for the current scale (small team, short-running jobs). The persistence layer in PC-201 already protects against orphaned sessions on restart. Revisit only if scale demands it.

> ~~PC-804 (audit logging)~~ — **dropped**. Premature for current usage. The session table already records who ran what; revisit once PC-801 attaches real user IDs and there's a regulatory driver.

- ✅ **PC-805** `[P2]` — Tighten CORS + CSP headers.
  *Rationale:* Replaced wildcard `allow_methods` and `allow_headers` with explicit allowlists (`GET`/`POST`/`PUT`/`DELETE`/`OPTIONS` and `Content-Type`/`Accept`). `allow_origins` and `allow_credentials` were already correct. Will be revisited when PC-801 introduces the `Authorization` header.

---

## EPIC-09 — Canvas UX & Delight

These are the user-facing polish items that turn the tool from "works" into "enjoyable to use." Most are small, parallelisable wins.

- ✅ **PC-901** `[P1]` — Toast notification system (Sonner).
  *Rationale:* `frontend/lib/notify.ts` wraps Sonner with a `notify.{success,error,warning,info}` API; `<Toaster>` is mounted once in `app/layout.tsx` (dark theme, bottom-right, rich colors, close button). Migrated the lone `alert()` and two silent `console.warn` sites in `app/page.tsx` (template load with filtered edges, template import with filtered edges, template import parse error) plus four non-fatal `ErrorModal` template-error sites (refresh / mount fetch / save / delete failures) to `notify.error`/`notify.warning`. The Excel-error and fatal run-time `ErrorModal` cases (`:735`, `:922`, `:967`) intentionally remain modal — they are blocking and warrant full attention. `TemplateNotification` and `SuccessCelebration` are unchanged. Wrapper exposes an `action` slot on `error` for PC-911 to use. Tested in `frontend/lib/__tests__/notify.test.ts`.

- ✅ **PC-902** — Mini-map and auto-layout button.
  *Rationale:* The `<MiniMap>` was already present in `WorkspaceCanvas.tsx` with custom node colors per type. This ticket added the auto-layout half: new pure function `frontend/lib/workflow/autoLayout.ts` runs `dagre` (~40 KB, MIT) over all edges to compute a left-to-right DAG, respecting each node's measured dimensions and falling back to a 288×140 default. A `<Panel position="top-right">` in the canvas renders an "Auto-layout" button (hidden when the graph is empty); `handleAutoLayout` in `app/page.tsx` snapshots history (so `Ctrl+Z` reverts in one step), applies the new positions, then `fitView`s with a 300 ms tween and fires a `notify.success` toast. Self-loops and edges with missing endpoints are skipped defensively. Tested in `frontend/lib/workflow/__tests__/autoLayout.test.ts` (empty graph, single node, linear chain, diamond, disconnected components, field preservation, measured-vs-default dimensions, self-loop, dangling edge, TB direction).

- **PC-903** `[P1]` `[Size: S]` `[Mode: regular]` — Right-click context menu on nodes.
  *Rationale:* Industry-standard interaction. Items: Duplicate, Copy, Delete, Disable, "Show generated XML for this node" (ties into PC-304). React Flow's `onNodeContextMenu` callback makes this straightforward.

- **PC-904** `[P2]` `[Size: S]` `[Mode: regular]` — Drag-and-drop Excel drop zone.
  *Rationale:* Currently uploads via file picker. Add a styled drop zone (with hover state and file-type validation) over the canvas/sidebar. Uses native HTML5 drag-and-drop — no library needed.

- **PC-905** `[P1]` `[Size: M]` `[Mode: superpowers]` — Auto-save and draft recovery.
  *Rationale:* Browser crashes / accidental refreshes wipe in-progress work. Persist `{nodes, edges, variables}` to `localStorage` on a debounce; on load, if a draft exists newer than the last saved template, prompt to restore. State-management is subtle (don't clobber a deliberate "new workflow") so worth a brainstorm + tests.

- **PC-906** `[P1]` `[Size: L]` `[Mode: feature-dev]` — Workflow run history view.
  *Rationale:* Backend already persists sessions to `pynode_workflow_sessions` (PC-201). Add a "Runs" page or sidebar tab listing past runs with `{timestamp, template name, model count, status, duration}`, filterable, with a "Download ZIP again" action. Users currently have no way to recover a download they closed.

- ✅ **PC-907** `[P1]` — Per-model progress indicator during run.
  *Rationale:* `run_workflow` now accepts an optional `progress_callback` that fires once with every model in `status='queued'` after the Excel parse, then again after each per-model attempt with that row promoted to `'success'` / `'error'`. `run_workflow_job` wires this callback to `session_store.update`, and `/api/workflow/status` surfaces the in-flight `results.file_details` while `status='processing'` (previously empty until completion). On the frontend, `app/page.tsx` keeps a `runProgress` slice updated on every poll tick and renders a new `RunProgressPanel` (floating bottom-right card) that lists every model with a ✓ / ✗ / ⟳ / · icon, a progress bar, and a "completed / total" counter. Multi-Excel runs show "Bridge.xlsx (2/3)" in the header. Tested in `backend/tests/test_run_workflow.py::test_progress_callback_*` and `backend/tests/test_run_workflow_job.py::test_progress_callback_writes_intermediate_results`.

- **PC-908** `[P2]` `[Size: S]` `[Mode: regular]` — Sticky-note / annotation nodes.
  *Rationale:* Yellow note nodes that don't execute but document the workflow ("This branch only runs for high-detail models"). Big QoL for complex graphs. Implement as a non-flow node type that the compiler ignores.

- **PC-909** `[P2]` `[Size: M]` `[Mode: regular]` — Onboarding tour for first-time users.
  *Rationale:* Use `driver.js` or `shepherd.js` to walk new users through: upload Excel → drop a node → connect handles → run. Stored "tour completed" flag in localStorage. Removes the "what do I even do here" first impression.

- **PC-910** `[P2]` `[Size: XS]` `[Mode: regular]` — Export workflow canvas as PNG/SVG.
  *Rationale:* React Flow has an `toPng` helper via `html-to-image`. One-click export for documentation, screenshots, and Slack-shareable workflow diagrams.

- ✅ **PC-911** — Actionable error messages.
  *Rationale:* `frontend/lib/workflow/errors.ts` introduces the `ActionableError` vocabulary (`title` / `message` / `fix` / `focusNodeId`) and a `nodeLabel(node)` helper that resolves the user-facing name in priority order (`data.label` → `PALETTE_ITEMS` lookup → raw type). `validateWorkflow` and `compileWorkflow` in `compile.ts` now return that shape; every rewritten error names the offending node by label and suggests a concrete next step. `handleRunChain` pre-validates every selected Excel id before entering the run loop, so precondition failures fire a `notify.error` toast with a `Show me` action that scrolls the canvas to the relevant node via `focusNode.ts`. Genuine runtime failures (backend errors after a real run attempt) keep the existing `ErrorModal` but now use node labels and forward a `focusNodeId` so the modal's button is also wired to `focusNode` (the old `[data-node-type=...]` selector was dead code). Five template `notify.error` sites (load / mount-fetch / save / delete / import) gained retry actions or sharpened descriptions. Tested in `frontend/lib/workflow/__tests__/errors.test.ts`, `focusNode.test.ts`, and the rewritten `compile.test.ts`. Phase 2 (item #5) in the Suggested Order of Attack.

---

## Suggested Order of Attack

The plan: ship the in-flight EPIC-03 work, then front-load high-impact UX polish (the user-visible wins are cheap and compound), then push deeper engineering work once the surface is pleasant to use. Production hardening sits at the end behind a "do we go multi-user?" gate.

### Phase 1 — Finish the in-flight execution engine work
1. ✅ **PC-302** — Per-model error isolation. Already in progress; finish and merge.
2. ✅ **PC-907** — Per-model progress indicator. Natural follow-on once PC-302's status data exists.
3. ✅ **PC-303** — Per-node execution logs over SSE. Closes the "what just happened" loop with PC-907.

### Phase 2 — Cheap, high-impact UX wins (ship these in any order)
4. ✅ **PC-901** — Toast notification system. Foundation for everything below.
5. ✅ **PC-911** — Actionable error messages. Pairs with PC-901.
6. ✅ **PC-902** — Mini-map + auto-layout.
7. **PC-903** — Right-click context menu.
8. **PC-910** — Export canvas as PNG. Trivial; useful.
9. **PC-704** — Excel column picker with preview. Removes the single most confusing step in the current flow.
10. **PC-904** — Drag-and-drop Excel drop zone.

### Phase 3 — Bigger UX features that need a bit more care
11. **PC-905** — Auto-save / draft recovery.
12. **PC-906** — Workflow run history view.
13. **PC-908** — Sticky-note nodes.
14. **PC-304** — Chain XML preview before download. Synergises with PC-906 (re-preview an old run).
15. **PC-909** — Onboarding tour. Do this after the canvas itself is polished — don't tour an unfinished UI.

### Phase 4 — Engine quality and safety
16. **PC-401** — Typed variables. Closes the "True" vs "true" foot-gun class.
17. **PC-505** — Playwright golden-path E2E. Locks in everything above.
18. **PC-705** — Dark/light theme toggle. Save for last; touches everything.

### Phase 5 — Devex / docs (low urgency)
19. **PC-603** — Contribution guide + node scaffold script.
20. **PC-601** — Dockerfile + compose. Helpful for onboarding new contributors.

### Phase 6 — Production hardening (only if going multi-user)
21. **PC-802** — File size and rate limits.
22. **PC-801** — Supabase Auth + RLS. The big one — do not start until you've decided to make this a team tool.
