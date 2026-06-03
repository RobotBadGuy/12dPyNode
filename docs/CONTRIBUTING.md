# Contributing to PyChain

PyChain is a node-based workflow builder that generates 12d Model `.chain` files (XML) from
Excel-driven inputs — a **Python/FastAPI** backend plus a **Next.js/React Flow** frontend. This guide is
the practical entry point for working in the codebase. For deeper architecture notes, read
[`../CLAUDE.md`](../CLAUDE.md); for end-user setup, read the [README](../README.md).

## Local development

Two processes — backend on **:8001**, frontend on **:3000**.

```bash
# Backend (from backend/)
python -m venv venv && venv\Scripts\activate      # Windows  (Linux/Mac: source venv/bin/activate)
pip install -r requirements.txt
python main.py                                     # uvicorn on 0.0.0.0:8001  (docs at /docs)

# Frontend (from frontend/)
npm install
npm run dev                                         # Next.js dev server on :3000
```

Supabase is optional for dev: without `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` the backend falls back
to an in-memory store (fine for local work; data is lost on restart). Prefer not to fuss with venv/Node at
all? Use Docker — see **[Docker](#docker-one-command-dev)** below.

## Repository layout

```
backend/                FastAPI app
  main.py               API endpoints + background run job + cleanup sweeper
  services/             workflow_runner.py (graph → XML), session/template stores, type_coercion
  commands/             XML command generators, grouped by category (models/, views/, tin/, …)
  migrations/           Postgres schema (pynode_* tables) — applied manually via Supabase SQL editor
  tests/                pytest
frontend/               Next.js app
  app/                  page.tsx (single-page workspace), layout.tsx, globals.css
  components/workflow/  TopBar, sidebars, modals, and nodes/ (one component per node type)
  lib/workflow/         types.ts, nodeSchemas.ts, compile.ts, run.ts, palette.ts, …
  e2e/                  Playwright golden-path + theme-toggle specs
docs/                   this guide, node-authoring guide, design specs/plans
scripts/                new-node.mjs node scaffolder
```

## Running the tests

```bash
# Backend (from backend/)
python -m pytest tests/ -v --tb=short

# Frontend (from frontend/)
npm run test          # vitest (unit/compile)
npm run lint          # next lint
npx tsc --noEmit      # typecheck
npm run build         # production build
npm run e2e           # Playwright (boots the whole stack on :3100, hermetic)
```

**CI** (`.github/workflows/ci.yml`) runs on every PR and push to `main`: backend pytest (Python 3.11 + 3.12),
frontend lint → typecheck → vitest → build, and the Playwright e2e job. Keep all of these green — they gate
merge.

## Adding a new node

Use the scaffolder, then wire the five shared files it prints snippets for:

```bash
node scripts/new-node.mjs                  # interactive
# or fully specified:
node scripts/new-node.mjs --type cleanModel --label "Clean Model" \
     --category models --backend-category models --yes
# (or, from frontend/:  npm run scaffold:node -- --type … --yes)
```

It generates the React component (`frontend/components/workflow/nodes/<Pascal>Node.tsx`) and the backend
command module (`backend/commands/<category>/<snake>.py`), then prints the exact copy-paste snippets +
locations for the five edits it deliberately leaves to you (auto-editing shared files is error-prone):

1. `frontend/lib/workflow/types.ts` — the `<Pascal>NodeData` interface + add it to the `WorkflowNodeData` union.
2. `frontend/lib/workflow/nodeSchemas.ts` — the schema entry (parameters/handles).
3. `frontend/lib/workflow/palette.ts` — the `PALETTE_ITEMS` entry (so it shows in the palette + search).
4. `frontend/components/workflow/WorkspaceCanvas.tsx` — import + register in `nodeTypes`.
5. Backend — re-export in `backend/commands/<category>/__init__.py` and add the `execute_node` branch in
   `backend/services/workflow_runner.py`.

The **key/field names must be identical camelCase** between `types.ts` and `nodeSchemas.ts`, or the
parameter silently breaks.

## Adding a parameter to an existing node

Five layers must stay in sync. The full walkthrough with worked diffs is in
[`adding-node-params.md`](adding-node-params.md). Summary: `types.ts` (interface field) →
`nodeSchemas.ts` (`ParameterDefinition`) → node component (only if it has custom UI) → `RightSidebar.tsx`
(only if it has a custom editor) → backend `execute_node` extraction + the command generator.

## Conventions

- **Postgres tables** are all prefixed `pynode_`; migrations live in `backend/migrations/` and are applied
  manually via the Supabase SQL editor (no auto-migrate).
- **XML generators** in `backend/commands/` are pure functions returning `List[str]`; they have golden-file
  tests — keep them deterministic.
- **Theming** (PC-705): dark is the default; light is opt-in via additive Tailwind `dark:` pairs on chrome.
  Never drop a `dark:` value or you regress the shipped dark look. Nodes stay dark in both themes. See
  `../CLAUDE.md` → Conventions.
- **Secrets**: `.env` / `.env.local` are gitignored — never commit Supabase keys (especially the service
  role key, which bypasses RLS). Copy `.env.example` to get started.

## Commits & pull requests

- Branch off `main`; keep commits focused. The repo uses a loose conventional-commit style with a ticket
  prefix, e.g. `feat(PC-705): …`, `fix(PC-302): …`, `docs(PC-603): …`, `test(PC-505): …`.
- Before opening a PR, run the full gate above (backend pytest + frontend lint/tsc/vitest/build, and e2e if
  you touched UI flows) and confirm it's green. CI re-runs it and blocks merge on failure.
- Roadmap work is tracked in [`../ROADMAP.md`](../ROADMAP.md) with `PC-` IDs; mark a ticket ✅ with a short
  rationale when it lands, matching the style of existing entries.
