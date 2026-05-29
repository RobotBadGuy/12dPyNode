# Flexible Model-Name Source — Design

- **Tickets:** PC-1001 (decouple the model-name source from Excel) + PC-1002 (manual "Model List" source node), combined into one increment.
- **Date:** 2026-05-29
- **Status:** Approved (design) — pending spec review.
- **Mode:** superpowers (brainstorm → spec → plan → TDD). This touches the compile/validate/runner seam where a regression silently corrupts or blocks every run.

## Problem

Today a run is fused to Excel in three places:

1. The backend `POST /api/workflow/run` takes `excel_file: UploadFile = File(...)` as **mandatory**, and `run_workflow` derives model names only via `pd.read_excel`.
2. `compileWorkflow` / `validateWorkflow` / `canRun` all require an `excelModels` node with a loaded file; `CompiledWorkflow.excelFile` is a required `File`.
3. `run.ts` always appends `excel_file` to the request and throws if it is not a real `File`.

We want a workflow to draw its model names from **either** an Excel column (existing `excelModels` node) **or** a hand-typed list (new `manualModels` node), with **no Excel required** — without disturbing everything downstream (per-model loop, PC-301 reachability, PC-302 isolation, PC-303 node logs, PC-907 progress).

## Goals

- Backend accepts a run with no Excel file, driven by an explicit model-name list.
- A new `manualModels` source node produces `modelNames: string[]` from a paste-friendly textarea and wires into `foreachModel` exactly like `excelModels`.
- The frontend compile/validate/run path is **source-agnostic**: it resolves "the model source" rather than hardcoding `excelModels`, so future sources plug into one seam.
- The existing Excel path stays byte-for-byte identical (server-side Excel read remains authoritative).
- TDD-first: every new branch is covered before it is written.

## Non-goals (deferred, unchanged by this work)

- PC-1003 inline ▶ play button on source nodes.
- PC-1004 single-model "Test run".
- PC-1005 re-run-failed-only.
- PC-1006 per-row variable grid for the Model List.

The toolbar "Run" will work with a manual source via the generalized `canRun`; PC-1003 only relocates the trigger later.

## Chosen approach

**Source abstraction + names-in-graph.** A small resolver (`getModelSource`) and a `SOURCE_NODE_TYPES` set generalize the frontend; manual names ride inside the existing `workflow_graph` JSON (sibling to `selectedModelNames`); `excel_file` becomes optional; the backend branches on file presence.

Alternatives rejected:

- **Special-case everywhere** (`|| n.type === 'manualModels'` at every call site): smallest diff but scatters source-type knowledge across ~6 sites and ages badly as sources grow.
- **Dedicated `model_names` multipart part:** more route churn and diverges from the `selectedModelNames`-in-graph idiom for no real gain — the graph already carries selection state.

## Detailed design

### A. Backend

**Route — `backend/main.py`**

```python
@app.post("/api/workflow/run")
async def run_workflow_endpoint(
    background_tasks: BackgroundTasks,
    workflow_graph: UploadFile = File(...),
    variables: UploadFile = File(...),
    excel_file: Optional[UploadFile] = File(None),   # was File(...)
    selected_column_index: str = Form("0"),
):
```

- Parse `workflow_json` first.
- If `excel_file` is provided: validate `.xlsx` extension (as today), save bytes to `UPLOAD_DIR/<session_id>_<filename>`, set `excel_path`.
- If `excel_file` is **not** provided: require `workflow_json.get("modelNames")` to be a non-empty list; otherwise `raise HTTPException(400, "No model source: upload an Excel file or provide a non-empty model list.")`. Set `excel_path = None`.
- Session row stores `"excel_file": str(excel_path) if excel_path else None`.
- `background_tasks.add_task(run_workflow_job, session_id, str(excel_path) if excel_path else None, workflow_json, variables_json, column_index)`.

**`run_workflow_job` — `backend/main.py`**

- Signature: `excel_file_path: Optional[str]` (was `str`).
- The backend output folder is `OUTPUT_DIR/<session_id>` (session-id based) — **no change needed there**. **Audit** `run_workflow_job` / `run_workflow` for any *other* use of the Excel path/filename beyond reading model names (e.g., ZIP name, `_summary.txt` label, any `Path(excel_file_path)` call). Guard each for the `None` case with a sensible default (`models`). This is the single most likely place a `None` Excel path raises.
- Threads `excel_file_path` (possibly `None`) into `run_workflow` unchanged otherwise.

**`run_workflow` — `backend/services/workflow_runner.py`**

- Signature: `excel_file_path: Optional[str]` (was `str`). All other params unchanged.
- Replace the Excel-read block (~lines 889–916) with a branch that produces `model_names`:

```python
if excel_file_path:
    # existing path: pd.read_excel(header=None) -> column by selected_column_index
    # -> clean (drop empty/'nan', skip header-looking first row). UNCHANGED.
    model_names = _read_model_names_from_excel(excel_file_path, selected_column_index)
else:
    raw = workflow_graph.get("modelNames") or []
    model_names = _clean_model_names(raw)   # trim, drop empties; no header/nan special-case needed
```

- Extract the existing cleaning into a shared helper where it makes the branch clean; keep the Excel-specific header/`nan` skipping inside the Excel arm only.
- The `selectedModelNames` filter (lines 918–926) and the per-model loop (lines 981+) are **unchanged** and run for both arms.
- If `model_names` ends up empty after cleaning/filtering, behaviour matches today's empty-after-filtering case (already covered by an existing test).

### B. Frontend source abstraction

**New file — `frontend/lib/workflow/modelSources.ts`**

```ts
export const SOURCE_NODE_TYPES = new Set<string>(['excelModels', 'manualModels']);

export interface ResolvedModelSource {
  kind: 'excel' | 'manual';
  modelNames: string[];
  file?: File;                 // excel only
  selectedColumnIndex?: number; // excel only
}

// Returns the resolved source for a source node, or null if the node is not a
// source type. Readiness (file loaded? names present?) is judged by the caller.
export function getModelSource(node: WorkflowNode): ResolvedModelSource | null;

export function isSourceNode(node: WorkflowNode): boolean; // SOURCE_NODE_TYPES.has(node.type)
```

**`frontend/lib/workflow/compile.ts`**

- `compileWorkflow(nodes, edges, sourceNodeId?)`: find the source node generically (by id if given, else the first source node), resolve via `getModelSource`. Excel readiness error (no file / no column) and manual readiness error (empty list) are reported as `ActionableError`s. Build:
  - excel mode: `{ excelFile, modelNames, selectedColumnIndex, graph: { nodes, edges }, variables }`.
  - manual mode: `{ modelNames, graph: { nodes, edges, modelNames }, variables }` (no `excelFile`; `graph.modelNames` is the wire field the backend reads).
- `validateWorkflow(nodes, edges, sourceNodeId?)`: gate on "≥1 ready source" (excel-with-file-and-column **or** manual-with-≥1-name). When **no** source node exists: "Add a model source (Excel Models or Model List)". Disabled nodes remain treated as absent (PC-903).

**`frontend/lib/workflow/types.ts`**

```ts
export interface CompiledWorkflow {
  excelFile?: File;            // was: File (required)
  modelNames: string[];
  selectedColumnIndex?: number; // excel only
  graph: {
    nodes: WorkflowNode[];
    edges: WorkflowEdge[];
    selectedModelNames?: string[];
    modelNames?: string[];      // NEW: wire field for the manual source
  };
  variables: VariableBinding[];
}
```

**`frontend/app/page.tsx`**

- `canRun` memo: `(a ready source node) && foreachModel && chainFileOutput`, where "ready source" reuses the same readiness predicate as `validateWorkflow`.
- `handleRunChain` + the `selectedExcelNodeIds` state generalize to **source** nodes (excel-with-file or manual-with-names). One POST per selected source (unchanged batching model — each request is single-source, so there is no Excel-vs-manual precedence conflict within a request).
- The local display folder-name (currently from the Excel filename) gets a manual fallback (source label → sanitized → `models`).

### C. `manualModels` node (PC-1002)

- **`types.ts`:** `ManualModelsNodeData { rawText: string; modelNames: string[]; [key: string]: unknown }`. `rawText` is the textarea content; `modelNames` is the derived list (kept in data so compile reads it the same way it reads `excelModels.data.modelNames`).
- **`nodeSchemas.ts`:** `manualModels: { parameters: [], flowInputs: [], flowOutputs: [{ id: 'flow:models', label: 'models' }], valueOutputs: [] }` — identical flow-output contract to `excelModels`.
- **`palette.ts`:** `{ type: 'manualModels', label: 'Model List', category: 'core', keywords: ['manual', 'names', 'list', 'typed', 'no excel'] }`.
- **`nodeKinds.ts`:** add `'manualModels'` to `CONTROL_FLOW_NODE_TYPES` (it shapes the graph but emits no XML) and to `modelSources.ts`' `SOURCE_NODE_TYPES`.
- **Component — `frontend/components/workflow/nodes/ManualModelsNode.tsx`:** paste-friendly `<textarea>` (one name per line). On change, store `rawText` and set `modelNames = parseModelList(rawText)`. Render per-model `value:model:N` output handles for parity with `excelModels` (so any downstream value wiring behaves identically), plus the `flow:models` flow output via `BaseNode`. Forwards `data.warnings` to `BaseNode` (PC-703 consistency).
- **Pure helper — `parseModelList(text: string): string[]`** (in `modelSources.ts` or a sibling): split on newlines, `trim`, drop blanks. No dedupe (matches Excel, which does not dedupe). Unit-tested.

### D. `frontend/lib/workflow/run.ts`

- Append `excel_file` + `selected_column_index` **only when** `compiled.excelFile` is a real `File`.
- Always append `workflow_graph` (which carries `graph.modelNames` in manual mode) and `variables`.
- Replace the hard "Excel file missing/invalid" throw with: require **either** a real `excelFile` **or** a non-empty `compiled.graph.modelNames`; otherwise throw a clear error.

### E. Validation / UX (PC-911 `ActionableError`)

- No source node anywhere: `{ title: 'Add a model source', message: 'No Excel Models or Model List node is on the canvas yet.', fix: "Drag 'Excel Models' or 'Model List' from the left palette." }`.
- Manual source empty: `{ title: 'Model List is empty', message: "'<label>' has no model names yet.", fix: 'Type one model name per line in the node.', focusNodeId }`.
- Existing Excel messages unchanged.

## End-to-end data flow

- **Excel mode (unchanged):** `excelModels` node holds `file` → `compileWorkflow` → `runWorkflow` appends `excel_file` + graph (no `modelNames`) → backend reads names from the Excel column → per-model loop.
- **Manual mode (new):** `manualModels` node holds `modelNames` → `compileWorkflow` → `runWorkflow` appends graph **with** `modelNames`, **no** `excel_file` → backend takes `model_names` from `workflow_graph['modelNames']` → identical per-model loop.

In both modes `selectedModelNames` (if present) narrows the resolved list, so PC-1004's test-run subset works uniformly later.

## Testing plan (TDD-first)

**Backend — `backend/tests/test_run_workflow.py`** (extend; reuse `_minimal_graph`, `monkeypatch generate_chain_file`):
- `run_workflow(None, graph_with_modelNames=['A','B','C'], [], out)` → one chain per name, three success rows in order.
- empty `modelNames` → empty generated list (matches existing empty-after-filtering behaviour).
- manual names + `selectedModelNames` subset → filtered result.
- whitespace / blank-line cleaning of manual names.
- **regression:** existing Excel-path tests still pass unchanged.

**Backend — `backend/tests/test_run_workflow_job.py`** (extend): `run_workflow_job` with `excel_file_path=None` produces a ZIP + `_summary.txt` without raising (guards the no-Excel-filename audit above).

**Backend — endpoint test:** `POST /api/workflow/run` with no `excel_file` and `workflow_graph.modelNames` set → 200/accepted; with neither → 400. (Match the house style of any existing endpoint tests; otherwise add a focused one.)

**Frontend — `frontend/lib/workflow/__tests__/modelSources.test.ts`** (new): `getModelSource` for excel/manual/non-source; `parseModelList` (multiline, trailing blanks, whitespace, empty); `isSourceNode`.

**Frontend — `frontend/lib/workflow/__tests__/compile.test.ts`** (extend, reuse `makeNode`/`makeEdge`/`fakeFile`): manual source compiles (no `excelFile`, `graph.modelNames` set); mixed graph (both sources) resolves the targeted source; neither source → validate error; disabled source treated as absent; `canRun` true with a ready manual source.

## File-by-file touch list

- `backend/main.py` — route signature, optional excel handling, `run_workflow_job` signature + folder fallback.
- `backend/services/workflow_runner.py` — `run_workflow` signature + source branch + shared cleaner helper.
- `frontend/lib/workflow/modelSources.ts` — **new** (`SOURCE_NODE_TYPES`, `getModelSource`, `isSourceNode`, `parseModelList`).
- `frontend/lib/workflow/compile.ts` — source-agnostic compile/validate.
- `frontend/lib/workflow/types.ts` — `CompiledWorkflow` (optional `excelFile`, `graph.modelNames`) + `ManualModelsNodeData`.
- `frontend/lib/workflow/nodeSchemas.ts` — `manualModels` schema.
- `frontend/lib/workflow/palette.ts` — `manualModels` palette item.
- `frontend/lib/workflow/nodeKinds.ts` — `manualModels` in control-flow set.
- `frontend/components/workflow/nodes/ManualModelsNode.tsx` — **new** component.
- `frontend/components/workflow/nodes/` registry / `WorkspaceCanvas.tsx` `nodeTypes` — register `manualModels`.
- `frontend/lib/workflow/run.ts` — conditional excel append; either-source guard.
- `frontend/app/page.tsx` — `canRun`, `handleRunChain`, `selectedExcelNodeIds` → source generalization, folder fallback.
- Tests as enumerated above.

## Risks & mitigations

- **Silent corruption at the compile/validate/runner seam.** → TDD-first; explicit Excel-path regression tests; backend Excel arm left byte-identical.
- **Node registration drift** (the 5-layer sync the CLAUDE.md calls out). → File-by-file checklist above; lint/typecheck + vitest + pytest gate.
- **`canRun` / readiness predicate duplicated** between `validateWorkflow` and `page.tsx`. → Export a single readiness predicate from `compile.ts`/`modelSources.ts` and reuse it in both.

## Open questions

None outstanding. (Transport, scope, and the textarea-vs-chips MVP were resolved during brainstorming: names-in-graph, combined PC-1001+PC-1002, textarea.)
