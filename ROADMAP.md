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

- ✅ **PC-304** — Chain XML preview before download (whole-file + per-node).
  *Rationale:* New `GET /api/workflow/preview/{session_id}/{model_name}` returns the full generated `.chain` as text (read from the session's `file_details[*].output_path`; 404 on missing/expired; the resolved path is validated to stay under `OUTPUT_DIR`). A reusable `ChainPreviewModal` (Copy / Download / loading-error, owns its fetch via a stable `fetcher` prop, focus + filename-sanitisation hardened) renders the text. **Whole-file preview** is surfaced on the **Runs page** (PC-906): each completed run row now expands to fetch its `file_details` (via the existing status endpoint) and list models with a **Preview** button. **Per-node** "Show generated XML" was wired into the right-click `NodeContextMenu` (the action PC-903 deferred), gated on the node actually having run events and picking a model where it ran — reusing PC-303's `GET /api/workflow/node-xml/...` capture; the PC-303 sidebar viewer stays. `run.ts` gained `getChainPreview`. Tested in `backend/tests/test_preview_endpoint.py` (5: success + 404 session/model/file-missing/path-escape). Adversarial 3-lens review → 3 fixes (filename sanitisation, clipboard-unavailable feedback, modal focus management). Verified by vitest 186/186, backend pytest 241/241, tsc, lint, build; the preview UIs weren't browser-clicked (no browser automation here).

- ✅ **PC-305** `[P2]` — Edge type validation at compile time.
  *Rationale:* `WorkspaceCanvas.tsx` now passes `isValidConnection={validateConnection}` to React Flow. The validator (in `frontend/lib/workflow/edgeRules.ts`) only allows `flow→flow` and `value→param` connections; legacy unprefixed handles still pass for backward compatibility. Tested in `frontend/lib/workflow/__tests__/edgeRules.test.ts`.

> ~~PC-306 (richer If/Switch/While control-flow nodes)~~ — **dropped**. No concrete use case in the current workflow library, and the existing graph + per-model loop already covers the real-world cases. Revisit only if a workflow actually needs it.

---

## EPIC-04 — Variable System

`resolve_variable` already supports `{token}` templating and per-run / per-model scopes. Extend it rather than rewrite.

- ✅ **PC-401** — Typed variables (string / number / boolean).
  *Rationale:* Everything was coerced to `str`, so a boolean `continueOnFailure` arriving as the string `"false"` evaluated truthy and emitted `<Continue_on_failure>true</...>` — the documented `clean_model_command` foot-gun. **Shipped** (brainstorm → spec → plan → TDD; see `docs/superpowers/specs/2026-05-30-pc401-typed-variables-design.md`): a new **pure** `backend/services/type_coercion.py::coerce_value(raw, declared_type, *, var_name="")` (+ `VariableCoercionError`) coerces once with a lenient, well-defined accept-list (bool: `true/false/1/0/yes/no/on/off`; number: int/float incl. `"13.0"`→`13`, scientific, partial decimals; rejects `nan`/`inf`/hex/binary/octal/non-numeric/bool). **Seam decision (low blast radius):** `resolve_variable` is unchanged and still returns `str` — the ~80 XML f-string sites are untouched — and a thin `resolve_typed()` wrapper does resolve-then-coerce. In `execute_node` all 23 `continueOnFailure` extractions now coerce to a real `bool` (the fix) and 6 numeric params (`zOffset`/`depth`/`finalCutSlope`/`finalFillSlope`/`finalSearchDistance`) coerce to number (dropping spurious `.0`). An uncoercible value raises `VariableCoercionError`, caught by PC-302's per-model isolation → that model gets an `error` row in `_summary.txt` while siblings still generate (no silent corruption, no whole-batch abort). **Path/list deferred (YAGNI** — no consumer). Frontend: `VariableBinding.type?` (optional → `'string'`, no migration), a pure `lib/workflow/coerce.ts` mirror (`coerceCheck`/`coerceErrorMessage`) parity-locked to the backend via a shared reject/accept table, a `validateNode` pre-run warning (PC-703 amber badge), and a per-variable **Type** dropdown + adaptive value input (boolean→select, number→number input) in the SetVariable editor. Adversarial 4-lens review (correctness / parity / regression / tests) → 3 confirmed findings fixed (JS `Number()` vs Python `float()` hex/binary/octal parity; the isolation test now proves one-model-fails-while-sibling-succeeds). Verified: backend pytest **295**, frontend vitest **228**, tsc, lint, build all green; the editor UI wasn't browser-clicked (no browser automation here). Tested in `backend/tests/test_type_coercion.py`, `test_resolve_variable.py::TestResolveTyped`, `test_run_workflow.py::{TestTypedBooleanCoercion,TestTypedNumberCoercion}`, `frontend/lib/workflow/__tests__/{coerce,validateNode}.test.ts`.

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

- ✅ **PC-505** `[P2]` — Playwright end-to-end test.
  *Rationale:* One golden-path test that exercises the integration seams unit tests can't: a real Chromium uploads an `.xlsx`, builds an Excel → Foreach → Chain Output graph by clicking the real palette and dragging real React Flow handles, runs it against the real FastAPI backend, and asserts the ZIP the browser downloads. **Shipped:** `frontend/playwright.config.ts` owns the whole stack via two `webServer`s — it boots the backend (`python main.py`, in-memory store, **no Supabase env needed**; `CORS_ORIGINS` is set to include the test port) and the frontend on a **dedicated port 3100** (never the default 3000, with `reuseExistingServer:false`, so the suite is hermetic even on a dev box that already has another app squatting on :3000), locally via `next dev` and in CI via a prod `next build && next start`. The spec (`frontend/e2e/golden-path.spec.ts`) drives the real UI end-to-end: Landing → "Get Started" → upload via the hidden `#excel-upload` input → add Foreach + Chain Output from the palette **search box** (sections are collapsed by default) → wire `flow:models→flow:input` and `flow:output→flow:input` → Run → capture the auto-triggered download → assert the ZIP with `jszip` (one `.chain` per model, `_summary.txt` reading `2 total · 2 succeeded · 0 failed`, and no stray `Model.chain` — proving the PC-704 header-skip parity holds end-to-end). **Two automation gotchas solved:** (1) React Flow *node-body* dragging doesn't engage via Playwright's synthetic mouse (only handle-connection drags do), so rather than reposition the stacked palette nodes the test clicks the **PC-902 Auto-layout** button (dagre) to un-stack them before the second connect; (2) the **PC-909** first-visit onboarding tour is suppressed by seeding `localStorage['pychain_tour_completed']='1'` so its spotlight overlay can't intercept clicks. Deterministic fixture `frontend/e2e/fixtures/e2e-models.xlsx` (header `Model` + `E2E-Alpha`/`E2E-Bravo`), regenerated by the committed `make_models_xlsx.py`. New **`e2e` CI job** runs Node 20 + Python 3.12 on one runner, installs `chromium --with-deps`, runs `npm run e2e`, and uploads the HTML report artifact. `@playwright/test` added as a dev dep; `e2e`/`e2e:headed`/`e2e:report` scripts; `playwright-report/` + `test-results/` gitignored. Verified locally green via **both** the `next dev` path and the CI `next build && next start` path (`CI=1`), plus frontend tsc / lint / vitest **228** / build and backend pytest **295** all green. Closes the long-standing "UI verification gap" (in-canvas features were previously tsc + unit-verified but never browser-driven).

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

- ✅ **PC-704** — Excel column picker with preview.
  *Rationale:* `selectedColumnIndex` was hidden in `excelModels` node data. New `frontend/lib/workflow/excelPreview.ts` holds the shared, unit-tested parsing core (`classifyModelRows` → `extractModelNames`, `columnHeaders`, `isHeaderRowSkipped`, `columnLabel`, `trimTrailingEmptyColumns`, plus the impure `parseExcelToRows`), mirroring the backend `_read_model_names_from_excel` byte-for-byte (header=None read, trim, drop blank/`nan`, skip physical row 0 only when it matches `['filename','name','model','model_name','model name']`). `app/page.tsx::parseExcelFile` now delegates to it, so the node's model list = what the server runs. New `ExcelColumnPickerModal` (opened from a "Pick column" button on the node **and** a new right-sidebar editor block — the panel was previously blank for Excel nodes) reads the file on open and renders a scrollable preview table: click a column header to select it, the skipped header row is greyed + tagged, and a live "→ N models from '<col>'" count is shown. Wired via `WorkflowRunContext.onPickColumn` + a `columnPicker` modal state in `page.tsx`.
  **Backend-parity ripple (fixes latent bugs):** because the parser now drops the header row, `modelNames` is header-free, so `firstModelForTestRun`'s skip was removed (it would double-skip) and `compile.ts`'s test-run target is simply `modelNames[0]`. `availableColumns` became all-columns-by-position (was non-blank-only), fixing a latent index misalignment in the `DataMappingModal` column `<select>`. **Numeric-column fix (review, HIGH):** pandas stringifies a float column as `'13.0'` while SheetJS yields `'13'`, so the PC-1004/1005 `selectedModelNames` subset filter (exact-equality) would silently produce zero files; the backend filter now normalizes both sides via `_normalize_model_key`. Tested in `frontend/lib/workflow/__tests__/excelPreview.test.ts` (25 cases incl. backend-parity, trailing-empty-column trim, header-specific skip) and `backend/tests/test_run_workflow.py` (numeric-subset + `_normalize_model_key`). Adversarial 4-lens review → 4 fixes applied. Verified by vitest 162/162, backend pytest 227/227, tsc, lint, build; the modal was not browser-clicked (no browser automation in the dev env).

- ✅ **PC-705** — Dark/light theme toggle.
  *Rationale:* The app was dark-only via hardcoded grayscale classes (`bg-gray-900`/`text-gray-300`) with `<html>` carrying no `dark` class. **Shipped** (brainstorm → spec → plan; see `docs/superpowers/specs/2026-06-03-pc705-theme-toggle-design.md` + plan). Dark stays the **default** and is preserved byte-for-byte; light is **additive** via Tailwind `dark:` pairs — the existing hardcoded class becomes the `dark:` variant and a light counterpart is added as the base. Plumbing via **`next-themes`** (`ThemeProvider`: `attribute="class"`, `defaultTheme="dark"`, `enableSystem={false}`, `storageKey="pychain-theme"`; pre-hydration script → no FOUC; `suppressHydrationWarning` on `<html>`). A Sun/Moon **`ThemeToggle`** sits in the always-visible TopBar cluster (works on all four pages); the Sonner Toaster (`ThemedToaster`) and the driver.js tour now follow the toggle. The **React Flow canvas** uses its native `colorMode` prop (Controls/MiniMap/edges/handles) plus theme-aware Background grid and `workspace-grid`/`gradient-bg`/`floating-card`/tour light variants in `globals.css`. **Scope decision:** nodes stay dark "chips" in both themes (n8n/draw.io style), removing ~33 node files + `BaseNode` from churn — only **chrome** flips. The ~196-edit chrome conversion across 20 files ran as a **workflow fan-out** (one agent/file applying a fixed parity table + an adversarial reviewer for dropped-dark-token regressions and light contrast), backed by a deterministic diff check proving **0 grayscale tokens dropped** from the dark look. New pure `lib/theme.ts` (`nextTheme`/`toggleLabel`). Verified: tsc, lint, vitest **235**, build, and **both Playwright e2e** (golden-path intact + new `theme-toggle` toggle/persistence in real Chromium); light mode visually smoke-tested via screenshots across landing/editor/runs/profile/modal. Tested in `frontend/lib/__tests__/theme.test.ts` and `frontend/e2e/theme-toggle.spec.ts`. System-preference / 3-way toggle deferred (a trivial `enableSystem` flip).

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

- ✅ **PC-903** — Right-click context menu on nodes.
  *Rationale:* `frontend/components/workflow/NodeContextMenu.tsx` renders a cursor-positioned menu (clamped on-screen, dismissed on outside-click / Escape / scroll) wired through React Flow's `onNodeContextMenu` (with `preventDefault` to suppress the native menu). Items: **Duplicate** (clone +40/+40, selected, one-step undo), **Copy** (into the existing paste clipboard), **Delete** (node + its edges), and **Disable/Enable**. Action logic lives in the pure `frontend/lib/workflow/nodeOps.ts` (`duplicateNode` / `removeNode` / `setNodeDisabled`) so it's unit-tested without RTL. "Disable" is end-to-end: a `data.disabled` flag dims the node via a `.pynode-disabled` class attached at the single `nodesWithWarnings` memo chokepoint (no per-node-file churn), suppresses its warnings, is treated as absent by `validateNode`/`validateWorkflow`, and is skipped by the backend in `_execute_node_with_capture` (covering both execution-order loops) so it becomes a no-op while flow still routes through it. Disable is hidden for control-flow node types (`excelModels`, `foreachModel`, `chainFileOutput`, `setVariable`) via `frontend/lib/workflow/nodeKinds.ts`. "Show generated XML" was deferred to PC-304. Tested in `nodeKinds.test.ts`, `nodeOps.test.ts`, the disabled cases in `compile.test.ts`, and `backend/tests/test_per_node_events.py`.

- ✅ **PC-904** — Drag-and-drop Excel drop zone.
  *Rationale:* The `LeftSidebar` already had styled drop zones (hover + file-type validation); the gap was the **canvas**. `WorkspaceCanvas` now shows a full-canvas overlay while files are dragged over it and, on drop, creates an Excel Models node **at the drop point** via `useReactFlow().screenToFlowPosition` (native HTML5 DnD, no library). A `dragHasFiles` guard (`dataTransfer.types` includes `'Files'`) keeps it clear of React Flow's mouse-based node dragging; a `dragDepth` enter/leave counter prevents overlay flicker over nested nodes; and a window-level `drop`/`dragend`/`dragleave`(relatedTarget===null) safety net force-clears the overlay when a drag is abandoned outside the wrapper (ESC / drop-elsewhere / leave-window). `app/page.tsx::handleFileUpload` gained an optional drop `position` and a `recordHistory` flag so a canvas drop is undoable (parity with palette add) while the sidebar upload keeps its prior behavior; `handleCanvasFilesDropped` filters `.xlsx` (rejects others with a toast pointing to the File Tray) and a `.catch` now surfaces a toast on a corrupt/unreadable workbook (previously a silent failure). Also aligned `LeftSidebar`'s Excel filter to be case-insensitive. Adversarial 3-lens review → 4 fixes applied. Verified by tsc + vitest 162/162 + lint + build; the drag/drop interaction was not exercised in a real browser (no browser automation in the dev env).

- ✅ **PC-905** — Auto-save and draft recovery.
  *Rationale:* Browser crashes / refreshes wiped in-progress work (the graph lives only in React state). Brainstormed design in `docs/superpowers/specs/2026-05-30-pc905-auto-save-draft-recovery-design.md` — a **"last working session"** model (no fragile dirty-diffing). New `lib/workflow/draftStorage.ts` holds the pure, unit-tested core: `serializeDraft` (nulls every node's `data.file` so an Excel `File` can't JSON-serialize to a truthy `{}`, then deep-clones), `shouldOfferRestore` (offers only a non-empty draft onto an **empty** canvas — never clobbers), `formatDraftAge`, and guarded `load/save/clearDraft` (SSR/quota/corrupt/version-mismatch → silent null). Variables aren't persisted separately (they live in `setVariable` nodes). `app/page.tsx`: a debounced (~1s) auto-save effect writes the working graph to `localStorage` (key `pychain_workflow_draft`) and clears it when the canvas is emptied; a mount effect offers restore via `RestoreDraftModal` (Restore re-applies via the existing `applySnapshot` and re-links `loadedTemplate` via the stored `basedOnTemplate`; Discard deletes; Esc/backdrop keeps for later). An `autosaveArmedRef` keeps the load-time effect from clobbering the offered draft; the draft is cleared on a successful template save (work safely in Supabase). Accepted tradeoff: loading a template then refreshing still offers restore (harmless re-apply) — dirty-awareness was intentionally deferred. The restore prompt surfaces when the editor opens (where the canvas is), not on the landing page. Tested in `lib/workflow/__tests__/draftStorage.test.ts` (16 cases). Adversarial 3-lens review → 0 fixes (clean). Verified by vitest 178/178, tsc, lint, build; the modal/restore interaction not browser-clicked (no browser automation here).

- ✅ **PC-906** — Workflow run history view.
  *Rationale:* A new **"Runs"** page (4th `currentPage`, mirrors the existing profile page; TopBar "Runs" button) lists recent runs from `pynode_workflow_sessions` with status badge, template/source name, model counts (✓/✗), relative time + duration, and a **Download** button that re-downloads the ZIP (with an "expired" toast once the cleanup TTL sweeps it). Filterable by status + a text search (client-side over the fetched list). Backend: added `list_recent(limit)` to the `SessionStore` Protocol + both impls, and `GET /api/workflow/runs` returning a **slim DTO** (`_run_summary` extracts the template name from `workflow_graph`, strips the `<id>_` upload prefix for `sourceName`, pulls counts from `results.summary`, and drops the heavy graph/variables blobs). **Retention (design fork → "recent + longer TTL"):** bumped `CLEANUP_TTL_SECONDS` default 3600 → 604800 (7 days, env-overridable) so both the record and the re-downloadable ZIP survive a useful window, and capped the sweep interval at 1 h so the longer TTL doesn't stretch it to ~42 h. Template name is now recorded on each run by carrying `loadedTemplate?.name` into the compiled `graph.templateName` (JSONB absorbs it — no migration). New `runsApi.ts` (`listRuns` + `downloadRunZip`) and `runFormat.ts` (`formatDuration`/`formatRelativeTime`, 7 tests). Adversarial 3-lens review → 1 confirmed fix (aria-labels) + cheap note cleanups (object-URL try/finally, duration gated to finished runs, dead `WorkflowRunRequest` type removed). Deferred (notes, tied to PC-801): cross-user run visibility + raw-error display are the documented pre-auth posture. Tested in `backend/tests/test_runs_endpoint.py` (8) + `frontend/lib/workflow/__tests__/runFormat.test.ts` (7). Verified by vitest 185/185, backend pytest 235/235, tsc, lint, build; the Runs page wasn't browser-clicked (no browser automation here).

- ✅ **PC-907** `[P1]` — Per-model progress indicator during run.
  *Rationale:* `run_workflow` now accepts an optional `progress_callback` that fires once with every model in `status='queued'` after the Excel parse, then again after each per-model attempt with that row promoted to `'success'` / `'error'`. `run_workflow_job` wires this callback to `session_store.update`, and `/api/workflow/status` surfaces the in-flight `results.file_details` while `status='processing'` (previously empty until completion). On the frontend, `app/page.tsx` keeps a `runProgress` slice updated on every poll tick and renders a new `RunProgressPanel` (floating bottom-right card) that lists every model with a ✓ / ✗ / ⟳ / · icon, a progress bar, and a "completed / total" counter. Multi-Excel runs show "Bridge.xlsx (2/3)" in the header. Tested in `backend/tests/test_run_workflow.py::test_progress_callback_*` and `backend/tests/test_run_workflow_job.py::test_progress_callback_writes_intermediate_results`.

- ✅ **PC-908** — Sticky-note / annotation nodes.
  *Rationale:* A new `stickyNote` node — a yellow, inline-editable annotation with **no handles** that the compiler ignores. Registered across the usual layers: `types.ts` (`StickyNoteNodeData { text }`), `nodeSchemas.ts` (empty params/handles), `palette.ts` (Core), `nodeKinds.ts` (added to `CONTROL_FLOW_NODE_TYPES` so "Disable" is hidden and it mirrors the backend skip), a `StickyNoteNode` component, and `WorkspaceCanvas` (nodeTypes + amber minimap). Because React Flow is controlled, the note can't own its own state — edits round-trip through the page via a new `WorkflowRunContext.onUpdateNodeData(id, data)` (backed by an extracted `handleUpdateNodeData` the RightSidebar editor now shares too). The `nodrag` textarea + `onKeyDown` stopPropagation keep typing from dragging/deleting the node. The compiler ignores it on two fronts: it has no flow handles (so edge rules forbid any connection and the flow-reachability order never includes it), and `stickyNote` was added to **both** `control_flow_types` sets in `build_command_chain` as belt-and-suspenders. Tested in `nodeKinds.test.ts` (sticky = control-flow) and `backend/tests/test_build_command_chain.py` (a note in a foreach→note→output path emits nothing). Adversarial 3-lens review → 0 findings. Verified by vitest 186/186, backend pytest, tsc, lint, build; not browser-clicked (no browser automation here).

- ✅ **PC-909** — Onboarding tour for first-time users.
  *Rationale:* A `driver.js` (v1.4, ~5 KB, zero-dep, MIT — matches the repo's lightweight-dep ethos) spotlight tour that walks a new user through the core loop: **add a model source → build with the palette → connect the steps on the canvas → run the chain**, bookended by a welcome and a closing step. Steps anchor to stable `data-tour-id` hooks added to the real UI chrome (`excel-drop-zone` in `LeftSidebar`, `node-palette` in `LeftSidebar`, `workflow-canvas` in `WorkspaceCanvas`, `run-chain-btn` in `TopBar`) rather than to transient graph nodes, so the tour is robust on an empty canvas and never mutates the user's work. The step list lives as pure data in `lib/workflow/tour.ts` (`tourSteps`) with a thin impure `startTour()` wrapper; completion is persisted via a guarded-localStorage flag in `lib/workflow/tourStorage.ts` (`pychain_tour_completed`, mirroring `draftStorage`'s SSR/try-catch pattern). `startTour` defines `onDestroyStarted` so it marks completed on **both** finish and early-dismiss, distinguishing the two via `hasNextStep()` for the success toast. `app/page.tsx` wires a **first-visit auto-launch** (a mount-guarded effect that fires once the editor opens, the tour hasn't been seen, and the PC-905 draft-restore prompt isn't pending — deferred 600 ms so the editor DOM is mounted before driver.js queries anchors) plus a **"Take a tour"** GraduationCap button in `TopBar` to replay anytime. `?` was left bound to the existing ShortcutsModal (no new global hotkey). driver.js's popover is restyled to the dark UI via a scoped `.pychain-tour` `popoverClass` in `globals.css` (purple→pink Next button matching Run Chain). The CSS import lives in `app/layout.tsx`. Tested in `lib/workflow/__tests__/tourStorage.test.ts` (flag round-trip) and `tour.test.ts` (step anchors/order, driver config, completed-vs-dismissed callback, driver.js mocked). Adversarial 4-lens review (correctness / react-hooks / integration / ux-a11y-css, each finding adversarially verified) → 0 confirmed findings; every CSS selector and config key verified against the real driver.js v1.4 source. Verified by vitest 196/196, tsc, lint, build; the overlay itself wasn't browser-clicked (no browser automation in the dev env).

- ✅ **PC-910** — Export workflow canvas as PNG/SVG.
  *Rationale:* New `frontend/lib/workflow/exportImage.ts` captures the React Flow `.react-flow__viewport` element via the zero-dependency `html-to-image` library (v12 ships no image helper). Three pure, unit-tested helpers do the geometry: `computeNodesBounds` (union of measured/explicit/default node sizes), `computeExportViewport` (native-scale render with a uniform margin, scaling down only when the graph exceeds a 4096px cap), and `buildExportFileName` (sanitises a base name, defaults to `pychain-workflow`). The impure `exportCanvasImage` orchestrator routes PNG→`toPng` / SVG→`toSvg`, paints a solid gray-800 background, and triggers the download; it throws user-facing errors (no nodes / canvas not ready) surfaced as `notify` toasts. UI is a self-dismissing `ExportMenu` dropdown (PNG image / SVG vector) in the canvas top-right `<Panel>` beside Auto-layout (dismissal mirrors `NodeContextMenu`). Exports are named after the loaded template when one is open (`exportFileName` prop threads `loadedTemplate.name`), else the default. Tested in `frontend/lib/workflow/__tests__/exportImage.test.ts` (18 cases: bounds fallbacks, landscape + height-driven fit-to-cap-with-margin, filename sanitisation, and orchestrator format-routing / filename / download-trigger / error paths under jsdom with a mocked `html-to-image`). Verified by vitest + tsc + lint + build; the rendered bitmap itself was not browser-verified (no browser automation in the dev env).

- ✅ **PC-911** — Actionable error messages.
  *Rationale:* `frontend/lib/workflow/errors.ts` introduces the `ActionableError` vocabulary (`title` / `message` / `fix` / `focusNodeId`) and a `nodeLabel(node)` helper that resolves the user-facing name in priority order (`data.label` → `PALETTE_ITEMS` lookup → raw type). `validateWorkflow` and `compileWorkflow` in `compile.ts` now return that shape; every rewritten error names the offending node by label and suggests a concrete next step. `handleRunChain` pre-validates every selected Excel id before entering the run loop, so precondition failures fire a `notify.error` toast with a `Show me` action that scrolls the canvas to the relevant node via `focusNode.ts`. Genuine runtime failures (backend errors after a real run attempt) keep the existing `ErrorModal` but now use node labels and forward a `focusNodeId` so the modal's button is also wired to `focusNode` (the old `[data-node-type=...]` selector was dead code). Five template `notify.error` sites (load / mount-fetch / save / delete / import) gained retry actions or sharpened descriptions. Tested in `frontend/lib/workflow/__tests__/errors.test.ts`, `focusNode.test.ts`, and the rewritten `compile.test.ts`. Phase 2 (item #5) in the Suggested Order of Attack.

---

## EPIC-10 — Flexible Run Entry & Fast Iteration

Today a run is fused to "Excel + the toolbar" in three places: the trigger lives in `TopBar.tsx` (`handleRunChain` hunts for `excelModels` nodes that have a file), the `canRun` / `validateWorkflow` / `compileWorkflow` gates all require an `excelModels` node with a loaded file, and the backend's `POST /api/workflow/run` takes `excel_file: UploadFile = File(...)` as mandatory while `run_workflow` reads model names only via `pd.read_excel`. This epic decouples **how you trigger a run** from **where the model names come from** — so you can launch from a node on the canvas and drive a batch from a hand-typed list with no Excel at all.

- ✅ **PC-1001** `[P1]` `[Size: L]` `[Mode: superpowers]` — Decouple the model-name source from Excel.
  *Rationale:* The enabling layer for the rest of this epic. Backend: make `excel_file` optional on `/api/workflow/run` and accept an explicit `model_names` list (a new multipart part, or carried inside `workflow_graph`); `run_workflow` branches — read names from the selected Excel column when a file is present, otherwise use the supplied list. Everything downstream (the per-model loop, PC-301 reachability, PC-302 isolation, PC-907 progress) is unchanged. Frontend: `compileWorkflow` / `validateWorkflow` / `canRun` accept either an `excelModels` **or** a manual source, and `CompiledWorkflow.excelFile` becomes optional. superpowers because this touches the compile/validate/runner seam where a regression silently corrupts or blocks every run — worth a brainstorm + TDD-first. **Shipped:** backend `run_workflow` branches on `excel_file_path` (Excel column read vs `workflow_graph.modelNames`), `excel_file` optional on `POST /api/workflow/run`; frontend `lib/workflow/modelSources.ts` resolver makes `compileWorkflow`/`validateWorkflow`/`canRun` source-agnostic, `CompiledWorkflow.excelFile` optional, `run.ts` `buildRunFormData` sends Excel only when present. Tests: `backend/tests/test_run_workflow.py`, `test_run_workflow_job.py`, `frontend/lib/workflow/__tests__/modelSources.test.ts`, `compile.test.ts`, `run.test.ts`.

- ✅ **PC-1002** `[P1]` `[Size: M]` `[Mode: feature-dev]` — Manual "Model List" source node.
  *Rationale:* A new `manualModels` source node, sibling to `excelModels`, that produces `modelNames: string[]` from a hand-edited, paste-friendly list (one name per line / chip editor) instead of an Excel column. Same flow-output contract as `excelModels` so it wires into `foreachModel` identically and emits one `.chain` per name. Names-only — per-model variable values are deferred to PC-1006. Register it across the usual layers: `palette.ts`, `nodeKinds.ts` (it's control-flow), `types.ts`, `nodeSchemas.ts`, and a node component. Depends on PC-1001. **Shipped:** new `manualModels` node (paste-friendly textarea in `RightSidebar`, names parsed via `parseModelList`), registered in `nodeSchemas`, `palette.ts`, `nodeKinds.ts`, and `WorkspaceCanvas`; mirrors `excelModels`' `flow:models` + `value:model:N` contract. Per-row variable values deferred to PC-1006.

- ✅ **PC-1003** — Inline "play" run button on source nodes.
  *Rationale:* A ▶ button in the title bar of `excelModels`/`manualModels` runs the chain from that source via `handleRunChain(explicitSourceId)` (guarded with `typeof === 'string'` against the `MouseEvent` the toolbar's `onClick={onRunChain}` passes). The in-node button reaches the page-level handler through `frontend/components/workflow/WorkflowRunContext.tsx` — a `useSourceRunButton` hook shared by both source nodes that centralizes readiness/disabled/tooltip and keeps callbacks out of `node.data` (memo-safe, no leak into template snapshots). `BaseNode` gained optional `onRun`/`runDisabled`/`runTooltip` props (`nodrag` + `stopPropagation` so the click doesn't drag/select the node). The ▶ is always visible, disabled with an explanatory tooltip when the source isn't ready or the graph lacks a Foreach/Chain Output (`canRun`). A `Ctrl/Cmd+Enter` shortcut mirrors the toolbar Run (separate keydown effect to avoid a TDZ on `handleRunChain`/`canRun`) and is listed in `ShortcutsModal`. TopBar's "Run Chain" stays as the run-selected/first trigger. The "Start" trigger node remains deferred. Verified by `tsc`/build + a 3-way code review; UI behaviour not yet covered by an automated (RTL/Playwright) test.

- ✅ **PC-1004** — Single-model "Test run".
  *Rationale:* A second per-source button (a `FlaskConical` icon next to the PC-1003 ▶) generates the chain for just the first model, validating the whole graph in seconds. Reuses the existing `selectedModelNames` filter (PC-301) — no backend change: `compileWorkflow` gained `options.testRun` that sets `graph.selectedModelNames` to a one-element subset. The first model is chosen header-aware for Excel (`firstModelForTestRun` mirrors `run_workflow`'s header-row skip so it matches the model the backend runs first) and verbatim for a manual list (no header). Wired via `onTestRunFromSource` on the PC-1003 `WorkflowRunContext` → `handleRunChain(id, { testRun: true })`; the test button shares the play button's disabled gate. A user-picked (rather than first) model was deferred. Tested in `compile.test.ts` and `modelSources.test.ts` (`firstModelForTestRun`).

- ✅ **PC-1005** — Re-run failed models only.
  *Rationale:* When a single-source run has failures, the `SuccessCelebration` modal shows a "Re-run failed (N)" button that resubmits just the failed models — no Excel re-pick, succeeded models aren't re-run. Reuses the existing `selectedModelNames` filter (PC-301/PC-1004): `handleRunChain` gained an `options.modelSubset` that `compileWorkflow` maps to `graph.selectedModelNames` (precedence over PC-1004's `testRun`). `page.tsx` tracks `lastRunSourceId` for the last single-source run; multi-source runs set it `null` (their failed names are folder-prefixed, so re-run-by-name isn't supported) and the modal hides the button. No backend change. Verified live (the `selectedModelNames` filter re-runs exactly the named subset); tested in `compile.test.ts`.

- **PC-1006** `[P2]` `[Size: M]` `[Mode: feature-dev]` — Model List variable grid (extends PC-1002).
  *Rationale:* Let each row in the Model List carry per-model variable values (a mini-spreadsheet with user-defined columns), so the manual source can fully replace a multi-column Excel sheet rather than just the name column. Each row maps to the existing per-model variable scope in `run_workflow`. Deferred until the names-only list (PC-1002) proves useful in practice — YAGNI until then.

---

## Suggested Order of Attack

The plan: finish the in-flight EPIC-03 work, then ship the EPIC-10 run-entry rework (the current focus — run the chain from a node on the canvas and from a hand-typed model list, no Excel required), then front-load the remaining high-impact UX polish (the user-visible wins are cheap and compound), then push deeper engineering work once the surface is pleasant to use. Production hardening sits at the end behind a "do we go multi-user?" gate.

### Phase 1 — Finish the in-flight execution engine work
1. ✅ **PC-302** — Per-model error isolation. Already in progress; finish and merge.
2. ✅ **PC-907** — Per-model progress indicator. Natural follow-on once PC-302's status data exists.
3. ✅ **PC-303** — Per-node execution logs over SSE. Closes the "what just happened" loop with PC-907.

### Phase 2 — Flexible run entry (EPIC-10, current priority)
4. ✅ **PC-1001** — Decouple the model-name source from Excel. Enabling layer; do first.
5. ✅ **PC-1002** — Manual "Model List" source node. Run from a hand-typed list, no Excel.
6. ✅ **PC-1003** — Inline ▶ play button on source nodes. Run the whole chain from the canvas.
7. ✅ **PC-1004** — Single-model "Test run". Fast graph validation while authoring.
   *(PC-1005 re-run-failed and PC-1006 Model List variable grid follow on once the above lands.)*

### Phase 3 — Cheap, high-impact UX wins (ship these in any order)
8. ✅ **PC-901** — Toast notification system. Foundation for everything below.
9. ✅ **PC-911** — Actionable error messages. Pairs with PC-901.
10. ✅ **PC-902** — Mini-map + auto-layout.
11. ✅ **PC-903** — Right-click context menu.
12. ✅ **PC-910** — Export canvas as PNG/SVG.
13. ✅ **PC-704** — Excel column picker with preview. Removes the single most confusing step in the current flow.
14. ✅ **PC-904** — Drag-and-drop Excel drop zone.

### Phase 4 — Bigger UX features that need a bit more care
15. ✅ **PC-905** — Auto-save / draft recovery.
16. ✅ **PC-906** — Workflow run history view.
17. ✅ **PC-908** — Sticky-note nodes.
18. ✅ **PC-304** — Chain XML preview before download (whole-file + per-node). Synergises with PC-906 (re-preview an old run) and PC-1004 (inspect a test run).
19. ✅ **PC-909** — Onboarding tour. Do this after the canvas itself is polished — don't tour an unfinished UI.

### Phase 5 — Engine quality and safety
20. ✅ **PC-401** — Typed variables. Closes the "True" vs "true" foot-gun class.
21. ✅ **PC-505** — Playwright golden-path E2E. Locks in everything above.
22. ✅ **PC-705** — Dark/light theme toggle. Save for last; touches everything.

### Phase 6 — Devex / docs (low urgency)
23. **PC-603** — Contribution guide + node scaffold script.
24. **PC-601** — Dockerfile + compose. Helpful for onboarding new contributors.

### Phase 7 — Production hardening (only if going multi-user)
25. **PC-802** — File size and rate limits.
26. **PC-801** — Supabase Auth + RLS. The big one — do not start until you've decided to make this a team tool.
