# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

PyChain — a node-based workflow builder that generates 12d Model `.chain` files (XML) from Excel-driven inputs. Python/FastAPI backend + Next.js/React Flow frontend.

## Commands

**Backend** (run from `backend/`; port 8001):
```bash
python -m venv venv && venv\Scripts\activate  # Windows
pip install -r requirements.txt
copy .env.example .env                         # then fill in SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
python main.py                                 # starts uvicorn on 0.0.0.0:8001
```
- API docs: `http://localhost:8001/docs`
- `CORS_ORIGINS` env var overrides allowed origins (default `http://localhost:3000,http://localhost:5173`).
- Sessions persist in Supabase (`pynode_workflow_sessions`). Without `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` the backend falls back to an in-memory store with a startup warning — fine for tests, **not** for real use.
- One-time setup: run `backend/migrations/001_init_workflow_sessions.sql` once via the Supabase SQL Editor.

**Frontend** (run from `frontend/`; port 3000):
```bash
npm install
npm run dev      # Next.js dev server
npm run build    # production build
npm run lint     # next lint
npm run test     # vitest (compile/validate tests)
```

**Testing:**
```bash
# Backend (from backend/)
python -m pytest tests/ -v --tb=short

# Frontend (from frontend/)
npm run test
```

**CI:** `.github/workflows/ci.yml` runs on every PR and push to `main`. Backend: pytest (Python 3.11 + 3.12). Frontend: lint → typecheck → vitest → build.

## Architecture

### Execution model

The backend does not execute 12d Model — it *generates* `.chain` XML files that 12d runs later. A workflow is a React Flow graph compiled client-side, POSTed as JSON alongside an Excel file, and iterated once per model name on the server.

Request path: `frontend/lib/workflow/run.ts` → `POST /api/workflow/run` (multipart: excel + workflow_graph.json + variables.json + selected_column_index) → `backend/main.py::run_workflow_job` background task → `services/workflow_runner.py::run_workflow` → one `.chain` per model → ZIP → polled via `/api/workflow/status/{session_id}` → downloaded via `/api/workflow/download/{session_id}`. Sessions are in-memory only (dict in `main.py`).

### Graph → XML compilation (`services/workflow_runner.py`)

1. **Column selection**: Excel read with `header=None`; first row skipped only if it matches a known header name (`filename`, `model`, etc.). `selectedColumnIndex` picks the column. `workflow_graph.selectedModelNames` can filter the set.
2. **Variable scopes**: `per-run` variables apply to the whole batch; `per-model` variables re-resolve for each model. `resolve_variable` supports both direct names *and* `{token}` template substitution, with recursion guarded by a `_visited` set. Built-ins: `model_name`, `modified_variable` (= `model_name.replace('-', ' ')`), `variable`.
3. **Edge types**: handles are prefixed. `flow:*` = control flow (execution order); `param:*` = parameter inputs; `value:*` = data outputs. `is_flow_edge()` filters; only flow edges determine execution order.
4. **Execution order**: prefers DFS from the `foreachModel` node to a `chainFileOutput` node along flow edges. Falls back to Kahn's topological sort over all flow edges if no such path exists. Control-flow node types (`foreachModel`, `chainFileOutput`, `excelModels`, `setVariable`) are skipped during XML emission — they shape the graph but don't generate commands. Nodes with `data.disabled` (PC-903) are also skipped during emission but remain in flow ordering, so they're a no-op the chain routes through.
5. **Scaffolding is automatic**: every chain file always emits `xml_header` + `meta_data_{tin|model}` + `chain_wrapper` + `chain_settings` at the top and `chain_closing` at the bottom. The `chainFileOutput` node's `modelType` (`'Model'` or `'TIN'`) selects which metadata variant.
6. **Project folder resolution**: `chainFileOutput.data.projectFolder` names a per-run variable whose value is embedded in chain metadata. Falls back to the literal name `project_folder` for legacy graphs.

### Adding a new node parameter

Five layers must stay in sync — see `docs/adding-node-params.md` for the full walkthrough (and `scripts/new-node.mjs` to scaffold a brand-new node). Summary:

1. `frontend/lib/workflow/types.ts` — add field to the node's `*NodeData` interface (must keep `[key: string]: unknown`).
2. `frontend/lib/workflow/nodeSchemas.ts` — add a `ParameterDefinition` with matching camelCase `key`. This auto-generates the `param:<key>` handle and the right-sidebar editor.
3. `frontend/components/workflow/nodes/<Node>.tsx` — only edit if the node uses custom UI rather than the schema-driven `NodePortSection`.
4. `frontend/components/workflow/RightSidebar.tsx` — only edit if the node has a custom editor block (most don't; the generic editor renders from the schema).
5. Backend: in `services/workflow_runner.py::execute_node`, extract with `resolve_variable(...)` for strings (to handle `{var}` templating) or `data.get(...)` for booleans/tuples; then update the corresponding generator under `backend/commands/<category>/`.

Key/field name mismatches between `types.ts` and `nodeSchemas.ts` silently break the parameter — both must be identical camelCase.

### Backend command modules (`backend/commands/`)

Organized by category: `metadata/`, `views/`, `models/`, `importers/` (IFC/DWG/DGN), `tin/`, `trimesh/`, `quantities/`, `strings/`, `conditionals/`, `run_options/`, `design/` (MTF + templates), `functions/`, `other/`, `templates/`. Each generator returns a `List[str]` of XML lines that gets `.extend`ed onto `xml_content`. Some nodes (`createMtfFile`, `createTemplateFile`) emit side-effect files into the session output folder instead of XML.

### Frontend structure

- `app/page.tsx` — single-page workspace; owns nodes/edges state, undo/redo history, clipboard.
- `components/workflow/WorkspaceCanvas.tsx` — React Flow canvas.
- `components/workflow/{Left,Right,Top}Sidebar.tsx` — palette, property editor, actions.
- `components/workflow/nodes/*.tsx` — one per node type; most are schema-driven via `BaseNode` + `NodePortSection`. Each node forwards `data.warnings` to `BaseNode` so the warning badge (PC-703) renders consistently.
- `lib/workflow/palette.ts` — single source of truth for the node palette (`PALETTE_ITEMS` + `filterPaletteItems`). Add new nodes here so they appear in both the sectioned view and the search results.
- `lib/workflow/compile.ts` — client-side validation. `validateWorkflow` is the global pre-run check; `validateNode` returns per-node warnings the canvas surfaces continuously.
- `lib/workflow/templates.ts` — save/load/import/export via browser `localStorage`.

## Conventions

- Generated `.chain` files and `backend/uploads/`, `backend/output/` are gitignored; the server performs TTL-based cleanup both at startup and every `CLEANUP_INTERVAL_SECONDS` (default = `min(3600, max(60, CLEANUP_TTL_SECONDS // 4))`) thereafter, deleting items older than `CLEANUP_TTL_SECONDS` (default 604800 = 7 days, bumped from 1 h in PC-906 so the run-history view can re-download) from disk and from `pynode_workflow_sessions`.
- Templates persist in Supabase via `services/template_store.py` (`pynode_templates`) and are exposed at `GET/POST/PUT/DELETE /api/templates`. Globally shared across users until PC-801 adds auth. Falls back to in-memory when Supabase env vars are absent.
- Sessions persist in Supabase via `services/session_store.py`. Files (Excel uploads, output ZIPs) stay on local disk; only their paths and metadata are stored in the DB row.
- All Postgres tables for this app are prefixed `pynode_`. Migrations live in `backend/migrations/` and are applied manually via the Supabase SQL Editor.
- `.env` and `.env.local` are gitignored — never commit Supabase keys (especially the service role key, which bypasses RLS).
- **Theming (PC-705):** dark is the default; light is opt-in via `next-themes` (`components/ThemeProvider.tsx`, `.dark` class on `<html>`, `storageKey="pychain-theme"`, `defaultTheme="dark"`). Chrome components use **additive** Tailwind `dark:` pairs — a light base class plus the original as the `dark:` variant (e.g. `text-gray-700 dark:text-gray-300`). **Never drop the `dark:` value** or you regress the shipped dark look. Accents (gradients/status colors) are theme-independent and left untouched; nodes (`nodes/*` + `BaseNode`) intentionally stay dark "chips" in both themes. The React Flow canvas themes via its `colorMode` prop; custom CSS classes have `html:not(.dark)` light variants in `app/globals.css`. The toggle is `components/ThemeToggle.tsx` in the TopBar.
