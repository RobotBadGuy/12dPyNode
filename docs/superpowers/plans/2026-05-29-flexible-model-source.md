# Flexible Model-Name Source Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a workflow draw its model names from either an Excel column (existing `excelModels` node) or a hand-typed list (new `manualModels` node), with no Excel file required.

**Architecture:** The backend `run_workflow` branches on whether an Excel file path was given — Excel column read (unchanged) vs. names taken from `workflow_graph.modelNames`. The frontend compile/validate/run path is generalized off `excelModels` onto a small `modelSources` resolver, so both source types (and future ones) flow through one seam. A new `manualModels` source node mirrors `excelModels`' `flow:models` contract; its names are edited via a textarea in the RightSidebar (matching how every other node is edited).

**Tech Stack:** Python/FastAPI + pytest (backend); Next.js/React + React Flow + Vitest (frontend).

**Spec:** `docs/superpowers/specs/2026-05-29-flexible-model-source-design.md`

**Conventions:** Backend tests run from `backend/`; frontend commands from `frontend/`. Commit after every task. End commit messages with the trailer `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.

---

## Task 1: Backend — `run_workflow` manual model-name branch

**Files:**
- Modify: `backend/services/workflow_runner.py` (add two helpers above `run_workflow` ~line 845; change signature line 848; replace the Excel-read block lines 889–916)
- Test: `backend/tests/test_run_workflow.py` (append new tests; reuse existing `_minimal_graph`, `output_dir`, `monkeypatch`)

- [ ] **Step 1: Write the failing tests**

Append to `backend/tests/test_run_workflow.py`:

```python
def test_manual_model_names_no_excel(monkeypatch, output_dir):
    """PC-1001: with no Excel file, model names come from workflow_graph.modelNames."""
    def fake_generate(model_name, *args, **kwargs):
        path = str(output_dir / f"{model_name}.chain")
        Path(path).write_text("<xml/>", encoding="utf-8")
        return path

    monkeypatch.setattr(workflow_runner, "generate_chain_file", fake_generate)

    graph = {**_minimal_graph(), "modelNames": ["A", "B", "C"]}
    generated, _project, details = run_workflow(None, graph, [], str(output_dir))

    assert len(generated) == 3
    assert [r["model"] for r in details] == ["A", "B", "C"]
    assert all(r["status"] == "success" for r in details)


def test_manual_model_names_whitespace_and_blanks(monkeypatch, output_dir):
    """PC-1001: manual names are trimmed; blank/'nan' entries are dropped."""
    def fake_generate(model_name, *args, **kwargs):
        path = str(output_dir / f"{model_name}.chain")
        Path(path).write_text("<xml/>", encoding="utf-8")
        return path

    monkeypatch.setattr(workflow_runner, "generate_chain_file", fake_generate)

    graph = {**_minimal_graph(), "modelNames": ["  A ", "", "   ", "B", "nan"]}
    generated, _project, details = run_workflow(None, graph, [], str(output_dir))

    assert [r["model"] for r in details] == ["A", "B"]


def test_manual_model_names_empty_list(monkeypatch, output_dir):
    """PC-1001: an empty manual list yields no generated files and no rows."""
    def boom(*a, **k):
        raise AssertionError("generate_chain_file should not be called for an empty list")

    monkeypatch.setattr(workflow_runner, "generate_chain_file", boom)

    graph = {**_minimal_graph(), "modelNames": []}
    generated, _project, details = run_workflow(None, graph, [], str(output_dir))

    assert generated == []
    assert details == []


def test_manual_model_names_respect_selected_subset(monkeypatch, output_dir):
    """PC-1001: selectedModelNames still narrows a manual list (powers PC-1004 test-run)."""
    def fake_generate(model_name, *args, **kwargs):
        path = str(output_dir / f"{model_name}.chain")
        Path(path).write_text("<xml/>", encoding="utf-8")
        return path

    monkeypatch.setattr(workflow_runner, "generate_chain_file", fake_generate)

    graph = {**_minimal_graph(), "modelNames": ["A", "B", "C"], "selectedModelNames": ["B"]}
    generated, _project, details = run_workflow(None, graph, [], str(output_dir))

    assert [r["model"] for r in details] == ["B"]
```

- [ ] **Step 2: Run the tests to verify they fail**

Run (from `backend/`): `python -m pytest tests/test_run_workflow.py -k manual -v`
Expected: FAIL — `run_workflow(None, ...)` raises inside `pd.read_excel(None, ...)` (the Excel read is not yet guarded).

- [ ] **Step 3: Add the two helper functions**

In `backend/services/workflow_runner.py`, immediately **above** `def run_workflow(` (~line 845), add:

```python
def _read_model_names_from_excel(excel_file_path: str, selected_column_index: int) -> List[str]:
    """PC-1001 — extracted verbatim from run_workflow. Read the selected column
    from the Excel file (no header), then clean it: drop empty/'nan' values and
    skip a header-looking first row."""
    try:
        df_raw = pd.read_excel(excel_file_path, engine='openpyxl', header=None)
        col_index = min(selected_column_index, max(0, len(df_raw.columns) - 1))
        model_names_raw = df_raw.iloc[:, col_index].astype(str).tolist()
    except Exception:
        naming_data = load_naming_data(excel_file_path)
        if naming_data is None:
            raise ValueError("Error loading naming data from Excel file")
        model_names_raw = naming_data.iloc[:, 0].astype(str).tolist()

    common_headers = ['filename', 'name', 'model', 'model_name', 'model name']
    model_names: List[str] = []
    for i, m in enumerate(model_names_raw):
        m_clean = m.strip() if m else ''
        if not m_clean or m_clean.lower() == 'nan':
            continue
        if i == 0 and m_clean.lower() in common_headers:
            continue
        model_names.append(m_clean)
    return model_names


def _clean_manual_model_names(raw_names: List[Any]) -> List[str]:
    """PC-1001 — clean a hand-supplied model-name list: stringify, trim, drop
    blanks and 'nan'. No header-row skipping — a typed list has no header."""
    cleaned: List[str] = []
    for name in raw_names:
        s = str(name).strip() if name is not None else ''
        if not s or s.lower() == 'nan':
            continue
        cleaned.append(s)
    return cleaned
```

(`List` and `Any` are already imported at the top of this file.)

- [ ] **Step 4: Change the signature and replace the read block**

Change the `run_workflow` signature line (848) from:

```python
    excel_file_path: str,
```

to:

```python
    excel_file_path: Optional[str],
```

Then replace lines 889–916 (the `# Parse Excel to get model names` block through the `model_names.append(m_clean)` loop) with:

```python
    # PC-1001: resolve model names from the active source — an Excel column when
    # a file was uploaded, otherwise the explicit list carried in the graph.
    if excel_file_path:
        model_names = _read_model_names_from_excel(excel_file_path, selected_column_index)
    else:
        model_names = _clean_manual_model_names(workflow_graph.get('modelNames') or [])
```

Leave everything from `# Extract nodes and edges from graph` (the `selectedModelNames` filter and the per-model loop) untouched.

- [ ] **Step 5: Run the tests to verify they pass**

Run (from `backend/`): `python -m pytest tests/test_run_workflow.py -v`
Expected: PASS — the new `manual` tests pass AND every pre-existing test (Excel path) still passes.

- [ ] **Step 6: Commit**

```bash
git add backend/services/workflow_runner.py backend/tests/test_run_workflow.py
git commit -m "feat(PC-1001): run_workflow resolves model names from manual list when no Excel" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Backend — optional `excel_file` on the run endpoint

**Files:**
- Modify: `backend/main.py` (typing import; `run_workflow_endpoint` lines 250–308; `run_workflow_job` signature line 359)
- Test: `backend/tests/test_run_workflow_job.py` (append one test; reuse `_isolate_dirs`, `_write_chain_files`, `_success_row`, `_patch_run_workflow`, `_seed_session`)

- [ ] **Step 1: Write the failing test**

Append to `backend/tests/test_run_workflow_job.py`:

```python
def test_run_workflow_job_no_excel_path(monkeypatch, _isolate_dirs):
    """PC-1001: run_workflow_job tolerates excel_file_path=None (manual source)."""
    _, output_dir = _isolate_dirs
    paths = _write_chain_files(output_dir, ["A.chain"])
    file_details = [_success_row("A", paths[0])]
    _patch_run_workflow(monkeypatch, ([paths[0]], "/proj", file_details))

    session_id = _seed_session()
    backend_main.run_workflow_job(session_id, None, {"modelNames": ["A"]}, [])

    session = backend_main.session_store.get(session_id)
    zip_path = session["results"]["zip_path"]
    with zipfile.ZipFile(zip_path) as zf:
        assert "A.chain" in set(zf.namelist())
```

- [ ] **Step 2: Run the test to verify it fails**

Run (from `backend/`): `python -m pytest tests/test_run_workflow_job.py::test_run_workflow_job_no_excel_path -v`
Expected: FAIL — `run_workflow_job`'s annotation is `excel_file_path: str`; passing `None` is the scenario under test (it will fail only if any code path dereferences the path; this test locks in that it does not).

- [ ] **Step 3: Relax `run_workflow_job`'s signature**

In `backend/main.py`, change line 359 from:

```python
    excel_file_path: str,
```

to:

```python
    excel_file_path: Optional[str],
```

Ensure `Optional` is imported — find the `from typing import ...` line near the top of `backend/main.py` and add `Optional` if it is not already listed.

- [ ] **Step 4: Run the test to verify it passes**

Run (from `backend/`): `python -m pytest tests/test_run_workflow_job.py -v`
Expected: PASS (all job tests, including the new one).

- [ ] **Step 5: Make `excel_file` optional on the HTTP endpoint**

Replace `run_workflow_endpoint` (lines 250–308) with:

```python
@app.post("/api/workflow/run")
async def run_workflow_endpoint(
    background_tasks: BackgroundTasks,
    workflow_graph: UploadFile = File(...),
    variables: UploadFile = File(...),
    excel_file: Optional[UploadFile] = File(None),
    selected_column_index: str = Form("0"),
):
    """
    Run a workflow graph.

    PC-1001: excel_file is optional. When omitted, model names are taken from
    workflow_graph.modelNames (the manual Model List source) instead of an
    Excel column.
    """
    try:
        # Read and parse workflow graph and variables
        workflow_content = await workflow_graph.read()
        variables_content = await variables.read()
        workflow_json = json.loads(workflow_content.decode('utf-8'))
        variables_json = json.loads(variables_content.decode('utf-8'))
        column_index = int(selected_column_index)

        # Generate unique session ID
        session_id = str(uuid.uuid4())

        # Save the uploaded Excel file when present; otherwise require a manual list.
        excel_path = None
        if excel_file is not None and excel_file.filename:
            if not excel_file.filename.endswith('.xlsx'):
                raise HTTPException(status_code=400, detail="Excel file must be .xlsx format")
            excel_path = UPLOAD_DIR / f"{session_id}_{excel_file.filename}"
            content = await excel_file.read()
            excel_path.write_bytes(content)
        elif not (workflow_json.get('modelNames') or []):
            raise HTTPException(
                status_code=400,
                detail="No model source: upload an Excel file or provide a non-empty model list.",
            )

        # Initialize session
        session_store.create(session_id, {
            "status": "processing",
            "excel_file": str(excel_path) if excel_path else None,
            "workflow_graph": workflow_json,
            "variables": variables_json,
            "results": None,
            "error": None,
        })

        # Kick off background job
        background_tasks.add_task(
            run_workflow_job,
            session_id,
            str(excel_path) if excel_path else None,
            workflow_json,
            variables_json,
            column_index,
        )

        return {
            "session_id": session_id,
            "status": "processing",
            "message": "Workflow started",
        }

    except HTTPException:
        # Pre-existing bug: the broad `except Exception` below would otherwise
        # re-wrap our 400s as 500s. Let HTTPExceptions through unchanged.
        raise
    except Exception as e:
        logger.error(f"Error in workflow run: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
```

- [ ] **Step 6: Verify the existing backend suite still passes**

Run (from `backend/`): `python -m pytest tests/ -q`
Expected: PASS (no regressions). Note: the endpoint's `400`-when-no-source guard has no HTTP-level test because this repo has no `TestClient` harness (not the house style); it is verified by the frontend run path (Task 5) and the full-stack check in Task 8.

- [ ] **Step 7: Commit**

```bash
git add backend/main.py backend/tests/test_run_workflow_job.py
git commit -m "feat(PC-1001): make excel_file optional on /api/workflow/run" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Frontend — `modelSources.ts` resolver module + types

**Files:**
- Create: `frontend/lib/workflow/modelSources.ts`
- Modify: `frontend/lib/workflow/types.ts` (add `ManualModelsNodeData`; add to `WorkflowNodeData` union; add `'manualModels'` to `NodeType`)
- Test: `frontend/lib/workflow/__tests__/modelSources.test.ts` (create)

- [ ] **Step 1: Add the types**

In `frontend/lib/workflow/types.ts`, add this interface right after `ExcelModelsNodeData` (after line 22):

```ts
export interface ManualModelsNodeData {
  rawText: string;
  modelNames: string[];
  [key: string]: unknown;
}
```

Add `ManualModelsNodeData` to the `WorkflowNodeData` union (after `ExcelModelsNodeData` on line 308):

```ts
  | ExcelModelsNodeData
  | ManualModelsNodeData
```

Add `'manualModels'` to the `NodeType` union (after `'excelModels'` on line 343):

```ts
  | 'excelModels'
  | 'manualModels'
```

- [ ] **Step 2: Write the failing tests**

Create `frontend/lib/workflow/__tests__/modelSources.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  SOURCE_NODE_TYPES,
  isSourceNode,
  getModelSource,
  isReadySource,
  hasReadyModelSource,
  parseModelList,
} from '../modelSources';
import type { WorkflowNode } from '../types';

function node(id: string, type: string, data: Record<string, unknown> = {}): WorkflowNode {
  return { id, type: type as WorkflowNode['type'], data: data as WorkflowNode['data'], position: { x: 0, y: 0 } } as WorkflowNode;
}

const file = new File(['x'], 'm.xlsx');

describe('parseModelList', () => {
  it('splits on newlines, trims, and drops blanks', () => {
    expect(parseModelList('A\n  B \n\n\r\nC')).toEqual(['A', 'B', 'C']);
  });
  it('returns [] for empty/whitespace input', () => {
    expect(parseModelList('   \n  ')).toEqual([]);
  });
});

describe('isSourceNode', () => {
  it('is true for source types and false otherwise', () => {
    expect(SOURCE_NODE_TYPES.has('excelModels')).toBe(true);
    expect(isSourceNode(node('1', 'excelModels'))).toBe(true);
    expect(isSourceNode(node('2', 'manualModels'))).toBe(true);
    expect(isSourceNode(node('3', 'foreachModel'))).toBe(false);
  });
});

describe('getModelSource', () => {
  it('resolves an excel source', () => {
    const s = getModelSource(node('1', 'excelModels', { file, modelNames: ['A'], selectedColumnIndex: 2 }));
    expect(s).toEqual({ kind: 'excel', modelNames: ['A'], file, selectedColumnIndex: 2 });
  });
  it('resolves a manual source', () => {
    const s = getModelSource(node('1', 'manualModels', { modelNames: ['A', 'B'] }));
    expect(s).toEqual({ kind: 'manual', modelNames: ['A', 'B'] });
  });
  it('returns null for a non-source node', () => {
    expect(getModelSource(node('1', 'foreachModel'))).toBeNull();
  });
});

describe('isReadySource / hasReadyModelSource', () => {
  it('excel is ready only with a file', () => {
    expect(isReadySource(node('1', 'excelModels', { file, modelNames: [] }))).toBe(true);
    expect(isReadySource(node('1', 'excelModels', { file: null, modelNames: ['A'] }))).toBe(false);
  });
  it('manual is ready only with at least one name', () => {
    expect(isReadySource(node('1', 'manualModels', { modelNames: ['A'] }))).toBe(true);
    expect(isReadySource(node('1', 'manualModels', { modelNames: [] }))).toBe(false);
  });
  it('hasReadyModelSource scans the graph and can target an id', () => {
    const nodes = [node('1', 'manualModels', { modelNames: [] }), node('2', 'manualModels', { modelNames: ['A'] })];
    expect(hasReadyModelSource(nodes)).toBe(true);
    expect(hasReadyModelSource(nodes, '1')).toBe(false);
    expect(hasReadyModelSource(nodes, '2')).toBe(true);
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run (from `frontend/`): `npx vitest run lib/workflow/__tests__/modelSources.test.ts`
Expected: FAIL — `Cannot find module '../modelSources'`.

- [ ] **Step 4: Implement the module**

Create `frontend/lib/workflow/modelSources.ts`:

```ts
import { WorkflowNode } from './types';

// PC-1001/PC-1002: node types that PRODUCE the model-name list a run iterates
// over. A run needs exactly one of these as its entry point. Mirrors the
// backend branch in run_workflow (Excel file vs workflow_graph.modelNames).
export const SOURCE_NODE_TYPES = new Set<string>(['excelModels', 'manualModels']);

export function isSourceNode(node: Pick<WorkflowNode, 'type'>): boolean {
  return !!node.type && SOURCE_NODE_TYPES.has(node.type);
}

export interface ResolvedModelSource {
  kind: 'excel' | 'manual';
  modelNames: string[];
  file?: File;
  selectedColumnIndex?: number;
}

// Resolve a source node's contribution to a run. Returns null for non-source
// nodes. Readiness (does it actually have a file / names?) is the caller's call
// via isReadySource — getModelSource just reports what's there.
export function getModelSource(node: WorkflowNode): ResolvedModelSource | null {
  const data = (node.data ?? {}) as Record<string, unknown>;
  if (node.type === 'excelModels') {
    return {
      kind: 'excel',
      modelNames: (data.modelNames as string[]) ?? [],
      file: (data.file as File) ?? undefined,
      selectedColumnIndex: (data.selectedColumnIndex as number) ?? 0,
    };
  }
  if (node.type === 'manualModels') {
    return {
      kind: 'manual',
      modelNames: (data.modelNames as string[]) ?? [],
    };
  }
  return null;
}

// A source is "ready" to drive a run when it can produce a request: an Excel
// source needs a loaded file (the backend re-parses it); a manual source needs
// at least one name. (Matches the pre-PC-1001 canRun gate for Excel.)
export function isReadySource(node: WorkflowNode): boolean {
  const source = getModelSource(node);
  if (!source) return false;
  if (source.kind === 'excel') return !!source.file;
  return source.modelNames.length > 0;
}

// Does the graph contain at least one ready source? Optionally constrained to a
// specific node id. Used by canRun and validateWorkflow so they agree.
export function hasReadyModelSource(nodes: WorkflowNode[], sourceNodeId?: string): boolean {
  const candidates = sourceNodeId ? nodes.filter((n) => n.id === sourceNodeId) : nodes;
  return candidates.some((n) => isReadySource(n));
}

// Split a paste-friendly textarea value into clean model names: one per line,
// trimmed, blanks dropped. No dedupe (Excel doesn't dedupe either).
export function parseModelList(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run (from `frontend/`): `npx vitest run lib/workflow/__tests__/modelSources.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add frontend/lib/workflow/modelSources.ts frontend/lib/workflow/__tests__/modelSources.test.ts frontend/lib/workflow/types.ts
git commit -m "feat(PC-1001): add modelSources resolver + manualModels types" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Frontend — source-agnostic `compile.ts` + `CompiledWorkflow`

**Files:**
- Modify: `frontend/lib/workflow/types.ts` (`CompiledWorkflow`)
- Modify: `frontend/lib/workflow/compile.ts` (`compileWorkflow`, `validateWorkflow`, `validateNode`)
- Test: `frontend/lib/workflow/__tests__/compile.test.ts` (update two existing cases; add three)

- [ ] **Step 1: Update the `CompiledWorkflow` type**

In `frontend/lib/workflow/types.ts`, replace the `CompiledWorkflow` interface (lines 423–433) with:

```ts
// Graph compilation result. PC-1001: excelFile/selectedColumnIndex are optional
// because a manual Model List source produces names without an Excel file;
// graph.modelNames is the wire field the backend reads in that case.
export interface CompiledWorkflow {
  excelFile?: File;
  modelNames: string[];
  selectedColumnIndex?: number;
  graph: {
    nodes: WorkflowNode[];
    edges: WorkflowEdge[];
    selectedModelNames?: string[];
    modelNames?: string[];
  };
  variables: VariableBinding[];
}
```

- [ ] **Step 2: Update + add the failing tests**

In `frontend/lib/workflow/__tests__/compile.test.ts`:

(a) Replace the test at lines 53–65 (`'returns "Load an Excel file" when no excel node has a file'`) with:

```ts
  it('returns "Add a model source" when no source node exists', () => {
    const nodes: WorkflowNode[] = [
      makeNode('2', 'foreachModel'),
      makeNode('3', 'chainFileOutput'),
    ];
    const result = compileWorkflow(nodes, []);
    expect('error' in result).toBe(true);
    if ('error' in result) {
      expect(result.error.title).toBe('Add a model source');
      expect(result.error.focusNodeId).toBeUndefined();
    }
  });
```

(b) Replace the test at lines 175–185 (`'returns "Add an Excel Models node" for missing excel node'`) with:

```ts
  it('returns "Add a model source" for a missing source node', () => {
    const nodes: WorkflowNode[] = [
      makeNode('2', 'foreachModel'),
      makeNode('3', 'chainFileOutput'),
    ];
    const result = validateWorkflow(nodes, []);
    expect(result.valid).toBe(false);
    expect(result.errors.map((e) => e.title)).toContain('Add a model source');
  });
```

(c) Add these three cases inside the `describe('compileWorkflow', ...)` block, just before its closing `});` (line 157):

```ts
  it('compiles a manual Model List source (no excel file)', () => {
    const nodes: WorkflowNode[] = [
      makeNode('1', 'manualModels', { rawText: 'A\nB', modelNames: ['A', 'B'] }),
      makeNode('2', 'foreachModel'),
      makeNode('3', 'chainFileOutput'),
    ];
    const edges: WorkflowEdge[] = [makeEdge('1', '2'), makeEdge('2', '3')];
    const result = compileWorkflow(nodes, edges);
    expect('error' in result).toBe(false);
    if (!('error' in result)) {
      expect(result.excelFile).toBeUndefined();
      expect(result.modelNames).toEqual(['A', 'B']);
      expect(result.graph.modelNames).toEqual(['A', 'B']);
    }
  });

  it('returns "Model List is empty" when a manual source has no names', () => {
    const nodes: WorkflowNode[] = [
      makeNode('1', 'manualModels', { rawText: '', modelNames: [] }),
      makeNode('2', 'foreachModel'),
      makeNode('3', 'chainFileOutput'),
    ];
    const result = compileWorkflow(nodes, []);
    expect('error' in result).toBe(true);
    if ('error' in result) {
      expect(result.error.title).toBe('Model List is empty');
      expect(result.error.focusNodeId).toBe('1');
    }
  });

  it('targets the source node identified by id in a mixed graph', () => {
    const nodes: WorkflowNode[] = [
      makeNode('1', 'excelModels', { file: fakeFile, modelNames: ['X'], selectedColumnIndex: 0 }),
      makeNode('m', 'manualModels', { rawText: 'A\nB', modelNames: ['A', 'B'] }),
      makeNode('2', 'foreachModel'),
      makeNode('3', 'chainFileOutput'),
    ];
    const edges: WorkflowEdge[] = [makeEdge('m', '2'), makeEdge('2', '3')];
    const result = compileWorkflow(nodes, edges, 'm');
    expect('error' in result).toBe(false);
    if (!('error' in result)) {
      expect(result.modelNames).toEqual(['A', 'B']);
      expect(result.excelFile).toBeUndefined();
    }
  });
```

- [ ] **Step 3: Run the tests to verify they fail**

Run (from `frontend/`): `npx vitest run lib/workflow/__tests__/compile.test.ts`
Expected: FAIL — the manual cases fail (compileWorkflow only knows `excelModels`) and the two updated cases fail on the old titles.

- [ ] **Step 4: Rewrite `compileWorkflow` and `validateWorkflow`**

In `frontend/lib/workflow/compile.ts`, replace the imports on lines 1–4 with:

```ts
import { WorkflowNode, WorkflowEdge, CompiledWorkflow, VariableBinding } from './types';
import { nodeSchemas, getParamHandleId } from './nodeSchemas';
import { ActionableError, nodeLabel } from './errors';
import { SOURCE_NODE_TYPES, getModelSource } from './modelSources';
```

Replace the entire `compileWorkflow` function (lines 6–84) with:

```ts
export function compileWorkflow(
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
  sourceNodeId?: string,
): CompiledWorkflow | { error: ActionableError } {
  const sourceNodes = nodes.filter((n) => SOURCE_NODE_TYPES.has(n.type));
  const sourceNode = sourceNodeId
    ? sourceNodes.find((n) => n.id === sourceNodeId)
    : sourceNodes[0];

  if (!sourceNode) {
    return {
      error: {
        title: 'Add a model source',
        message: 'No Excel Models or Model List node is on the canvas yet.',
        fix: "Drag 'Excel Models' or 'Model List' from the left palette onto the canvas.",
      },
    };
  }

  const source = getModelSource(sourceNode)!; // sourceNode is a source type

  if (source.kind === 'excel' && !source.file) {
    return {
      error: {
        title: 'Load an Excel file',
        message: `'${nodeLabel(sourceNode)}' doesn't have an Excel file loaded yet.`,
        fix: 'Click the upload area inside the Excel Models node, or drag a .xlsx file onto it.',
        focusNodeId: sourceNode.id,
      },
    };
  }

  if (!source.modelNames || source.modelNames.length === 0) {
    return {
      error:
        source.kind === 'excel'
          ? {
              title: 'Excel file has no model column',
              message: `'${nodeLabel(sourceNode)}' loaded a file but no model column was selected.`,
              fix: 'Open this node and pick the column that contains model names. (PC-704 will improve this.)',
              focusNodeId: sourceNode.id,
            }
          : {
              title: 'Model List is empty',
              message: `'${nodeLabel(sourceNode)}' has no model names yet.`,
              fix: 'Select the node and type one model name per line in the Properties panel.',
              focusNodeId: sourceNode.id,
            },
    };
  }

  const foreachNode = nodes.find((n) => n.type === 'foreachModel');
  if (!foreachNode) {
    return {
      error: {
        title: 'Add a Foreach Model node',
        message: 'No Foreach Model node is on the canvas yet.',
        fix: "Drag 'Foreach Model' from the left palette and connect the source node's right handle to its left handle.",
      },
    };
  }

  const chainOutputNodes = nodes.filter((n) => n.type === 'chainFileOutput');
  if (chainOutputNodes.length === 0) {
    return {
      error: {
        title: 'Add a Chain File Output node',
        message: 'No Chain File Output node is on the canvas yet.',
        fix: "Drag 'Chain Output' from the left palette and connect a Foreach output to it.",
      },
    };
  }

  const variables: VariableBinding[] = [];
  nodes
    .filter((n) => n.type === 'setVariable')
    .forEach((node) => {
      const data = node.data as { variables: VariableBinding[] };
      if (data.variables) {
        variables.push(...data.variables);
      }
    });

  if (source.kind === 'excel') {
    return {
      excelFile: source.file,
      modelNames: source.modelNames,
      selectedColumnIndex: source.selectedColumnIndex ?? 0,
      graph: { nodes, edges },
      variables,
    };
  }

  return {
    modelNames: source.modelNames,
    graph: { nodes, edges, modelNames: source.modelNames },
    variables,
  };
}
```

Replace the `validateWorkflow` function (lines 86–142) with:

```ts
export function validateWorkflow(
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
  sourceNodeId?: string,
): { valid: boolean; errors: ActionableError[] } {
  // PC-903: disabled nodes are treated as absent — so e.g. disabling the only
  // Chain File Output still correctly raises "Add a Chain File Output node".
  nodes = nodes.filter((n) => !n.data?.disabled);

  const errors: ActionableError[] = [];

  const sourceNodes = nodes.filter((n) => SOURCE_NODE_TYPES.has(n.type));
  const sourceNode = sourceNodeId
    ? sourceNodes.find((n) => n.id === sourceNodeId)
    : sourceNodes[0];
  if (!sourceNode) {
    errors.push({
      title: 'Add a model source',
      message: 'No Excel Models or Model List node is on the canvas yet.',
      fix: "Drag 'Excel Models' or 'Model List' from the left palette onto the canvas.",
    });
  }

  const foreachNode = nodes.find((n) => n.type === 'foreachModel');
  if (!foreachNode) {
    errors.push({
      title: 'Add a Foreach Model node',
      message: 'No Foreach Model node is on the canvas yet.',
      fix: "Drag 'Foreach Model' from the left palette and connect the source node's right handle to its left handle.",
    });
  }

  const chainOutputNodes = nodes.filter((n) => n.type === 'chainFileOutput');
  if (chainOutputNodes.length === 0) {
    errors.push({
      title: 'Add a Chain File Output node',
      message: 'No Chain File Output node is on the canvas yet.',
      fix: "Drag 'Chain Output' from the left palette and connect a Foreach output to it.",
    });
  }

  if (sourceNode && foreachNode) {
    const sourceToForeach = edges.find(
      (e) => e.source === sourceNode.id && e.target === foreachNode.id,
    );
    if (!sourceToForeach) {
      errors.push({
        title: "Source isn't wired to Foreach",
        message: `'${nodeLabel(sourceNode)}' isn't connected to '${nodeLabel(foreachNode)}'.`,
        fix: "Drag an edge from the source node's right handle to the Foreach node's left handle.",
        focusNodeId: foreachNode.id,
      });
    }
  }

  return { valid: errors.length === 0, errors };
}
```

Then add a manual-source warning to `validateNode` — after the `excelModels` block (after line 167, the `'No Excel file loaded'` push), insert:

```ts
  if (
    node.type === 'manualModels' &&
    (!Array.isArray(data.modelNames) || (data.modelNames as string[]).length === 0)
  ) {
    warnings.push('No model names');
  }
```

- [ ] **Step 5: Run the tests to verify they pass**

Run (from `frontend/`): `npx vitest run lib/workflow/__tests__/compile.test.ts`
Expected: PASS — all updated + new cases pass, and the unchanged wiring/label cases still pass (the wiring error message still contains "Excel Models" for an excelModels source).

- [ ] **Step 6: Commit**

```bash
git add frontend/lib/workflow/compile.ts frontend/lib/workflow/types.ts frontend/lib/workflow/__tests__/compile.test.ts
git commit -m "feat(PC-1001): make compile/validate source-agnostic (excel or manual)" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Frontend — `run.ts` sends Excel only when present

**Files:**
- Modify: `frontend/lib/workflow/run.ts` (extract `buildRunFormData`; use it in `runWorkflow`)
- Test: `frontend/lib/workflow/__tests__/run.test.ts` (create)

- [ ] **Step 1: Write the failing tests**

Create `frontend/lib/workflow/__tests__/run.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { buildRunFormData } from '../run';
import type { CompiledWorkflow } from '../types';

const baseGraph = { nodes: [], edges: [] };

describe('buildRunFormData', () => {
  it('includes excel_file + selected_column_index in excel mode', () => {
    const compiled: CompiledWorkflow = {
      excelFile: new File(['x'], 'm.xlsx'),
      modelNames: ['A'],
      selectedColumnIndex: 2,
      graph: baseGraph,
      variables: [],
    };
    const fd = buildRunFormData(compiled);
    expect(fd.has('excel_file')).toBe(true);
    expect(fd.get('selected_column_index')).toBe('2');
    expect(fd.has('workflow_graph')).toBe(true);
    expect(fd.has('variables')).toBe(true);
  });

  it('omits excel_file in manual mode and carries modelNames in the graph', () => {
    const compiled: CompiledWorkflow = {
      modelNames: ['A', 'B'],
      graph: { ...baseGraph, modelNames: ['A', 'B'] },
      variables: [],
    };
    const fd = buildRunFormData(compiled);
    expect(fd.has('excel_file')).toBe(false);
    expect(fd.has('selected_column_index')).toBe(false);
    expect(fd.has('workflow_graph')).toBe(true);
  });

  it('throws when there is neither an excel file nor manual names', () => {
    const compiled: CompiledWorkflow = {
      modelNames: [],
      graph: baseGraph,
      variables: [],
    };
    expect(() => buildRunFormData(compiled)).toThrow(/model source/i);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run (from `frontend/`): `npx vitest run lib/workflow/__tests__/run.test.ts`
Expected: FAIL — `buildRunFormData` is not exported from `run.ts`.

- [ ] **Step 3: Extract `buildRunFormData` and use it**

In `frontend/lib/workflow/run.ts`, replace the body of `runWorkflow` (lines 80–126) with the export below plus a thin caller:

```ts
// PC-1001: build the multipart body for a run. excel_file is appended only when
// a real File is present; in manual mode the names ride inside workflow_graph.
export function buildRunFormData(compiled: CompiledWorkflow): FormData {
  const hasExcel =
    typeof File !== 'undefined' ? compiled.excelFile instanceof File : !!compiled.excelFile;
  const hasManualNames = (compiled.graph.modelNames?.length ?? 0) > 0;
  if (!hasExcel && !hasManualNames) {
    throw new Error(
      'No model source: load an Excel file or add a non-empty Model List before running.',
    );
  }

  const formData = new FormData();
  if (hasExcel) {
    formData.append('excel_file', compiled.excelFile as File);
    formData.append('selected_column_index', String(compiled.selectedColumnIndex ?? 0));
  }

  // Send JSON parts as actual Files so FastAPI can reliably parse them as UploadFile.
  const workflowFile = new File([JSON.stringify(compiled.graph)], 'workflow_graph.json', {
    type: 'application/json',
  });
  const variablesFile = new File([JSON.stringify(compiled.variables)], 'variables.json', {
    type: 'application/json',
  });
  formData.append('workflow_graph', workflowFile);
  formData.append('variables', variablesFile);

  return formData;
}

export async function runWorkflow(
  compiled: CompiledWorkflow
): Promise<WorkflowRunResponse> {
  const formData = buildRunFormData(compiled);

  try {
    const response = await api.post<WorkflowRunResponse>(
      '/workflow/run',
      formData,
      {
        // IMPORTANT: don't set Content-Type manually; Axios will add the required boundary
      }
    );
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const detail = (error.response?.data as any)?.detail;
      const message =
        typeof detail === 'string'
          ? detail
          : Array.isArray(detail)
            ? JSON.stringify(detail)
            : error.message;
      throw new Error(message);
    }
    throw error;
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run (from `frontend/`): `npx vitest run lib/workflow/__tests__/run.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/lib/workflow/run.ts frontend/lib/workflow/__tests__/run.test.ts
git commit -m "feat(PC-1001): send excel_file only when present; carry manual names in graph" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Frontend — register and build the `manualModels` node

**Files:**
- Modify: `frontend/lib/workflow/nodeSchemas.ts` (add `manualModels` entry)
- Modify: `frontend/lib/workflow/palette.ts` (add Core palette item)
- Modify: `frontend/lib/workflow/nodeKinds.ts` (add to `CONTROL_FLOW_NODE_TYPES`)
- Modify: `frontend/lib/workflow/__tests__/nodeKinds.test.ts` (add one case)
- Create: `frontend/components/workflow/nodes/ManualModelsNode.tsx`
- Modify: `frontend/components/workflow/WorkspaceCanvas.tsx` (import + register in `nodeTypes`)
- Modify: `frontend/components/workflow/RightSidebar.tsx` (add a `manualModels` editor block)

- [ ] **Step 1: Write the failing nodeKinds test**

Add this `it` inside the existing top-level `describe` (or alongside the existing cases) in `frontend/lib/workflow/__tests__/nodeKinds.test.ts`:

```ts
  it('classifies manualModels as a control-flow node', () => {
    expect(CONTROL_FLOW_NODE_TYPES.has('manualModels')).toBe(true);
    expect(isControlFlowNode('manualModels')).toBe(true);
  });
```

(If `CONTROL_FLOW_NODE_TYPES` / `isControlFlowNode` are not already imported at the top of that test file, add: `import { CONTROL_FLOW_NODE_TYPES, isControlFlowNode } from '../nodeKinds';`)

- [ ] **Step 2: Run it to verify it fails**

Run (from `frontend/`): `npx vitest run lib/workflow/__tests__/nodeKinds.test.ts`
Expected: FAIL — `manualModels` is not in the set yet.

- [ ] **Step 3: Register `manualModels` across the data layers**

In `frontend/lib/workflow/nodeKinds.ts`, add `'manualModels'` to the set:

```ts
export const CONTROL_FLOW_NODE_TYPES = new Set<string>([
  'excelModels',
  'manualModels',
  'foreachModel',
  'chainFileOutput',
  'setVariable',
]);
```

In `frontend/lib/workflow/nodeSchemas.ts`, add this entry directly after the `excelModels` entry (after line 29):

```ts
  manualModels: {
    parameters: [],
    flowInputs: [],
    flowOutputs: [{ id: 'flow:models', label: 'models' }],
    valueOutputs: [],
  },
```

In `frontend/lib/workflow/palette.ts`, add to the Core group (after line 48):

```ts
  { type: 'manualModels', label: 'Model List', category: 'core', keywords: ['manual', 'names', 'list', 'typed', 'no excel'] },
```

- [ ] **Step 4: Run the nodeKinds test to verify it passes**

Run (from `frontend/`): `npx vitest run lib/workflow/__tests__/nodeKinds.test.ts`
Expected: PASS.

- [ ] **Step 5: Create the node component**

Create `frontend/components/workflow/nodes/ManualModelsNode.tsx`:

```tsx
'use client';

import React, { useState } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { BaseNode } from './BaseNode';
import { ListChecks, ChevronDown, ChevronRight } from 'lucide-react';
import { ManualModelsNodeData } from '@/lib/workflow/types';
import { nodeSchemas } from '@/lib/workflow/nodeSchemas';

export function ManualModelsNode(props: NodeProps) {
  const { data, selected } = props as unknown as {
    data: ManualModelsNodeData;
    selected?: boolean;
  };
  const schema = nodeSchemas.manualModels;
  const modelNames = (data as unknown as ManualModelsNodeData).modelNames || [];

  const [expanded, setExpanded] = useState(false);

  return (
    <BaseNode
      title="Model List"
      icon={<ListChecks className="w-4 h-4 text-white" />}
      color="from-emerald-500 to-teal-600"
      borderColor="rgb(16, 185, 129)"
      glowColor="rgba(16, 185, 129, 0.4)"
      nodeState={(data as any).nodeState}
      warnings={(data as any).warnings}
      inputs={schema.flowInputs}
      outputs={schema.flowOutputs}
      selected={selected}
    >
      <div className="text-xs text-white/80 space-y-2">
        {modelNames.length > 0 ? (
          <>
            <p className="text-white/60">{modelNames.length} models</p>
            <div>
              <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                className="flex items-center gap-1 text-[11px] text-emerald-200/90 hover:text-emerald-100"
              >
                {expanded ? (
                  <ChevronDown className="w-3 h-3" />
                ) : (
                  <ChevronRight className="w-3 h-3" />
                )}
                <span>
                  {expanded ? 'Hide models' : 'Show models'} ({modelNames.length})
                </span>
              </button>
              {/* Always render per-model handles so imported edges remain valid,
                  but visually collapse the list when not expanded */}
              <div
                className={
                  expanded
                    ? 'mt-1 max-h-24 overflow-y-auto space-y-0.5 pr-1'
                    : 'mt-1 max-h-0 overflow-hidden space-y-0.5 pr-1'
                }
              >
                {modelNames.map((name: string, index: number) => (
                  <div
                    key={index}
                    className="relative flex items-center text-[11px] text-white/80 truncate pr-4"
                    title={name}
                  >
                    {index + 1}. {name}
                    <Handle
                      type="source"
                      position={Position.Right}
                      id={`value:model:${index}`}
                      className="w-3 h-3 bg-white border-2 border-green-600 absolute -right-1 top-1/2 -translate-y-1/2"
                    />
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : (
          <p className="text-white/60">No models yet — add names in the Properties panel</p>
        )}
      </div>
    </BaseNode>
  );
}
```

- [ ] **Step 6: Register the component on the canvas**

In `frontend/components/workflow/WorkspaceCanvas.tsx`, add the import next to the other node imports (after line 19):

```tsx
import { ManualModelsNode } from './nodes/ManualModelsNode';
```

Add to the `nodeTypes` map (after line 81, `excelModels: ExcelModelsNode,`):

```tsx
    manualModels: ManualModelsNode,
```

(Optional, for MiniMap parity) in the `nodeColor` switch (after line 189), add:

```tsx
              case 'manualModels':
                return '#10b981';
```

- [ ] **Step 7: Add the RightSidebar editor**

In `frontend/components/workflow/RightSidebar.tsx`, add this import after line 6:

```tsx
import { parseModelList } from '@/lib/workflow/modelSources';
```

Then insert this block immediately after the `nodeData` declaration (after line 113, `const nodeData = selectedNode.data as any;`) and before the `setVariable` block:

```tsx
  // PC-1002: Manual Model List editor — paste-friendly textarea, one name/line.
  if (selectedNode.type === 'manualModels') {
    const rawText = (nodeData.rawText as string) ?? '';
    const modelNames = (nodeData.modelNames as string[]) ?? [];

    const handleChange = (text: string) => {
      onUpdateNode(selectedNode.id, {
        rawText: text,
        modelNames: parseModelList(text),
      } as Partial<WorkflowNodeData>);
    };

    return (
      <EditorShell
        selectedNodeId={selectedNode.id}
        runFileDetails={runFileDetails}
        runSessionId={runSessionId}
      >
        <h3 className="text-lg font-bold text-white mb-4">Properties</h3>
        <div className="space-y-4">
          <div>
            <Label className="text-sm font-semibold text-gray-300 mb-1 block">Node Type</Label>
            <p className="text-sm text-gray-400">{selectedNode.type}</p>
          </div>
          <div>
            <Label className="text-sm font-semibold text-gray-300 mb-1 block">
              Model names (one per line)
            </Label>
            <textarea
              className="w-full h-48 bg-gray-800 border border-gray-700 rounded-md p-2 text-sm text-gray-200 font-mono resize-y"
              placeholder={'Model-A\nModel-B\nModel-C'}
              value={rawText}
              onChange={(e) => handleChange(e.target.value)}
            />
            <p className="text-xs text-gray-500 mt-1">
              {modelNames.length} model{modelNames.length === 1 ? '' : 's'}
            </p>
          </div>
        </div>
      </EditorShell>
    );
  }
```

- [ ] **Step 8: Typecheck + lint + run the full frontend suite**

Run (from `frontend/`): `npx tsc --noEmit; npm run lint; npm run test`
Expected: no type errors, no lint errors, all tests pass. (UI registration is verified by typecheck/build + the manual smoke in Task 8; there is no RTL harness for node components in this repo.)

- [ ] **Step 9: Commit**

```bash
git add frontend/lib/workflow/nodeSchemas.ts frontend/lib/workflow/palette.ts frontend/lib/workflow/nodeKinds.ts frontend/lib/workflow/__tests__/nodeKinds.test.ts frontend/components/workflow/nodes/ManualModelsNode.tsx frontend/components/workflow/WorkspaceCanvas.tsx frontend/components/workflow/RightSidebar.tsx
git commit -m "feat(PC-1002): add manualModels Model List source node" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: Frontend — generalize the run trigger in `page.tsx`

**Files:**
- Modify: `frontend/app/page.tsx` (import; `onNodeClick`; `handleRunChain` source discovery + error modal; `canRun`; progress label; rename `selectedExcelNodeIds`)

This file has no unit test; the risky logic lives in the tested `modelSources` module. Verification is typecheck/build (Step 7) + the manual smoke in Task 8.

- [ ] **Step 1: Add the import**

Near the other `@/lib/workflow/...` imports at the top of `frontend/app/page.tsx`, add:

```tsx
import { isSourceNode, isReadySource, hasReadyModelSource } from '@/lib/workflow/modelSources';
```

- [ ] **Step 2: Rename the selection state to be source-generic**

Rename every occurrence of `selectedExcelNodeIds` → `selectedSourceNodeIds` and `setSelectedExcelNodeIds` → `setSelectedSourceNodeIds` (declaration at line 76; resets at lines ~196 and ~1191; uses at ~538, ~549; dependency array at ~1118). A find/replace on those two identifiers across the file is the cleanest.

- [ ] **Step 3: Generalize canvas selection in `onNodeClick`**

In `onNodeClick` (lines 533–556), change the condition `if (node.type === 'excelModels') {` to:

```tsx
    if (isSourceNode(node)) {
```

(The body — Ctrl/Cmd multi-select vs single-select — is unchanged except for the renamed setter.)

- [ ] **Step 4: Generalize source discovery in `handleRunChain`**

In `handleRunChain` (starting line 808), replace the `excelNodes` discovery and the empty-selection guard (lines 809–834) with:

```tsx
    const sourceNodes = nodes.filter((n) => isReadySource(n));
    const selectedSourceIds = selectedSourceNodeIds.size > 0
      ? Array.from(selectedSourceNodeIds).filter((id) =>
        sourceNodes.some((n) => n.id === id)
      )
      : sourceNodes.length > 0
        ? [sourceNodes[0].id]
        : [];

    if (selectedSourceIds.length === 0) {
      const firstSourceNode = nodes.find((n) => isSourceNode(n));
      setErrorModal({
        isOpen: true,
        title: 'No model source selected',
        message: 'Add an Excel Models node with a file, or a Model List with names, then run.',
        isExcelError: true,
        focusNodeId: firstSourceNode?.id,
      });
      return;
    }
```

Then, in the rest of `handleRunChain` and `runSingleWorkflow`, rename the loop/identifier usages `selectedExcelIds` → `selectedSourceIds` and the per-run parameter `excelNodeId` may stay as-is (it is just an id) — but update the three `selectedExcelIds` references (the pre-validate loop ~854, and the single-vs-multi branch ~975 and ~1008) to `selectedSourceIds`.

- [ ] **Step 5: Make the progress label tolerate a source with no file**

In `excelLabelFor` (lines 962–966), replace the body with:

```tsx
    const node = nodes.find((n) => n.id === excelNodeId);
    const file = (node?.data as any)?.file as File | undefined;
    return file?.name ?? ((node?.data as any)?.label as string | undefined) ?? 'Model List';
```

(The folder-name fallback at lines 930–932 already handles the no-file case via `workflow_${sessionId...}` — no change needed there.)

- [ ] **Step 6: Generalize `canRun`**

Replace the `canRun` derivation (lines 1389–1392) with:

```tsx
  const canRun =
    hasReadyModelSource(nodes) &&
    (nodes || []).some((n) => n.type === 'foreachModel') &&
    (nodes || []).some((n) => n.type === 'chainFileOutput');
```

- [ ] **Step 7: Typecheck, lint, build**

Run (from `frontend/`): `npx tsc --noEmit; npm run lint; npm run build`
Expected: clean typecheck, no lint errors, successful production build.

- [ ] **Step 8: Commit**

```bash
git add frontend/app/page.tsx
git commit -m "feat(PC-1001): run the chain from any ready model source (excel or manual)" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: Full-stack verification + ROADMAP update

**Files:**
- Modify: `ROADMAP.md` (mark PC-1001 and PC-1002 done)

- [ ] **Step 1: Run the entire backend suite**

Run (from `backend/`): `python -m pytest tests/ -q`
Expected: all pass.

- [ ] **Step 2: Run the entire frontend suite + lint + typecheck + build**

Run (from `frontend/`): `npm run test; npm run lint; npx tsc --noEmit; npm run build`
Expected: all green.

- [ ] **Step 3: Manual smoke test**

Start backend (`python main.py` from `backend/`) and frontend (`npm run dev` from `frontend/`). In the app:
1. Drag a **Model List** node from the Core palette; select it; paste three names (one per line) in the Properties panel. Confirm the node shows "3 models".
2. Add **Foreach Model** + **Chain Output**; wire Model List → Foreach → Chain Output. Confirm the **Run** button enables (no Excel uploaded).
3. Run. Confirm a ZIP downloads with three `.chain` files and the per-model progress panel shows all three.
4. Confirm the existing Excel path still works end-to-end (upload an .xlsx, pick a column, run).

- [ ] **Step 4: Mark the tickets done in ROADMAP.md**

Change the `PC-1001` and `PC-1002` bullets in `ROADMAP.md` to `✅` and append a one-line "shipped" rationale to each (matching the style of other completed tickets — what was built, where, and the test files). Update the Phase 2 entries in "Suggested Order of Attack" (items 4 and 5) to `✅`.

- [ ] **Step 5: Commit**

```bash
git add ROADMAP.md
git commit -m "docs(PC-1001): mark flexible model-name source (PC-1001 + PC-1002) shipped" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Self-review notes (for the implementer)

- **Type consistency:** `CompiledWorkflow.excelFile?` and `selectedColumnIndex?` are optional (Task 4); `buildRunFormData` (Task 5) guards on both; `compileWorkflow` only sets them in the excel branch.
- **Shared readiness:** `isReadySource` / `hasReadyModelSource` (Task 3) are the single source of truth reused by `canRun` (Task 7); `compileWorkflow`/`validateWorkflow` keep granular per-kind messaging (Task 4).
- **Excel path unchanged:** the backend Excel read is moved verbatim into `_read_model_names_from_excel`; the per-model loop, `selectedModelNames` filter, PC-301/302/303/907 plumbing are untouched.
- **Behavior change to flag in review:** the "no source node" error message changed from Excel-specific to the generic "Add a model source" (two existing `compile.test.ts` cases updated accordingly).
