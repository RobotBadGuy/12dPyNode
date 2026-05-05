# PC-302 — Per-Model Error Isolation and Partial Results

**Date:** 2026-05-05
**Roadmap item:** [PC-302] `[P1]` — EPIC-03
**Scope guarantee:** backend changes to `services/workflow_runner.py::run_workflow` and `main.py::run_workflow_job`, plus minimal frontend type and success-modal updates. No new schemas, no new endpoints, no changes to chain-file generation or the graph compiler. Two new backend test files, one optional frontend test addition.

---

## Goal

When one model in a batch raises during chain-file generation, the rest of the batch must still run, the ZIP must still contain the chain files for the models that succeeded, and the user must be able to tell which models failed and why.

Today, any single failure aborts the whole batch and the user gets `status: "error"` with no partial output.

## Non-goals

- **Per-node error isolation.** PC-302 isolates at the per-model boundary (the `generate_chain_file` call). Per-node feedback is PC-303's job.
- **Streaming or live progress.** This PR keeps the existing poll-based status flow. Per-node SSE/WebSocket events are PC-303.
- **Canvas-level error highlighting.** Failed models are surfaced in the success modal and in `_summary.txt`. Painting nodes red is PC-303.
- **Retry of failed models.** The user can rerun the workflow with a filtered model list via existing UI controls. No automatic retry.
- **Changing the status taxonomy** to add `completed_with_errors`. Partial-success state lives in structured data (`failed_count`, per-model rows), not a third enum value.
- **Touching `build_command_chain`, `execute_node`, `resolve_variable`, or any command generator under `backend/commands/`.**
- **Changing how `selectedColumnIndex`, `selectedModelNames`, or `projectFolder` are resolved.**

---

## The bug, concretely

In `backend/services/workflow_runner.py::run_workflow` (lines 854–871):

```python
for model_name in model_names:
    chain_file = generate_chain_file(
        model_name, nodes, edges, variables,
        per_run_vars, output_folder, project_folder,
    )
    if chain_file:
        generated_files.append(chain_file)
        file_details.append({...})
```

There is no try/except around `generate_chain_file`. Any exception — a missing import file path, a malformed variable reference, a write error, a generator bug — propagates up to `run_workflow_job` (`backend/main.py::309-361`), which has a single outer `except Exception` that sets `status: "error"` and discards every chain file generated for prior models on disk (they're never added to the ZIP because the ZIP step never runs).

The user sees: "error" with a single string, no idea which model failed, no partial output, no diagnostic file. If model 1 of 50 has a bad import path, models 2–50 don't run.

---

## Approach

**Three changes, in order of dependency:**

### 1. `run_workflow` — per-model try/except, expanded `file_details` rows

The model loop wraps each `generate_chain_file` call in try/except. Successes append a success row, failures log full traceback at `ERROR` (server-side) and append a failure row. The function's return signature stays `(generated_files, project_folder, file_details)` — only the row shape inside `file_details` changes.

Row shape (additive — existing keys preserved):

```python
# success
{
    "model": model_name,
    "filename": "ABC-01.chain",
    "output_path": "/abs/path/ABC-01.chain",
    "project_folder": "...",
    "status": "success",
    "error": None,
}

# failure
{
    "model": model_name,
    "filename": None,
    "output_path": None,
    "project_folder": "...",
    "status": "error",
    "error": "FileNotFoundError: D:/missing.dwg",
}
```

The error string is `f"{type(e).__name__}: {e}"`. No traceback in the user-facing field; full traceback goes to the server log via `logger.error(..., exc_info=True)`.

`file_details` row order matches model-name iteration order, regardless of success/failure mix. This is required for `_summary.txt` ordering and for the UI's failed-models list to be predictable.

Pre-loop failures (Excel parse, missing column, no models after filtering) continue to raise out of `run_workflow`. They are not per-model failures — the batch is unrunnable, and the existing top-level error path is correct for them.

### 2. `run_workflow_job` — write `_summary.txt`, populate session counts

The model-generation step is no longer wrapped in a swallowing `except` for per-model failures (those are now caught one level down). The outer `try/except Exception` stays — it still catches genuine bugs in `run_workflow` itself, pre-loop errors, and Excel/IO failures, all of which should produce `status: "error"`.

After `run_workflow` returns, the job:
1. Computes `succeeded_count = len([r for r in file_details if r["status"] == "success"])` and `failed_count` analogously.
2. Builds `_summary.txt` content from `file_details`, the session id, and a UTC timestamp.
3. Writes the ZIP exactly as today, then **always** adds `_summary.txt` to it via `zipf.writestr("_summary.txt", content)`. The `_` prefix sorts it to the top of the listing in most archive viewers.
4. Stores the new fields on the session result (`summary.succeeded_count`, `summary.failed_count`, plus the expanded `file_details`).

If `succeeded_count == 0` and `failed_count == 0`, the loop did not run. This is reachable today via two paths: (a) the Excel column produces no model names after filtering empties/headers, or (b) `selectedModelNames` filters every model out. Neither path raises. The ZIP is still written with only `_summary.txt`, status is `completed`, and the summary file's "0 total" line tells the user no models were processed. The frontend treats this as a degenerate completed run (zero-rows variant of the success-modal warning state).

### 3. Frontend — types + success-modal warning state

`frontend/lib/workflow/run.ts` adds optional fields to `WorkflowStatusResponse.results.file_details[*]` and `results.summary`. All new fields are optional so old in-flight sessions (created before deploy but read after) keep parsing.

`frontend/app/page.tsx` success-modal block (around the `setSuccessFileCount`/`setShowSuccess` calls):
- If `failed_count > 0` and `succeeded_count > 0` → warning tone, "X of Y models succeeded", expandable "View failed models" list rendering `{model, error}` per row.
- If `succeeded_count === 0` → error tone, "All N models failed", same list. ZIP download still offered (contains `_summary.txt` for diagnosis).
- If `failed_count === 0` → existing success behavior unchanged.

Multi-Excel batching loop (lines ~790+ in `app/page.tsx`): today it `throw`s on `status === 'error'` and accumulates file counts on success. New behavior: `completed` with `failed_count > 0` does **not** throw; the per-Excel `succeeded` and `failed` counts are accumulated and surfaced in one combined warning at the end.

---

## Code shape

**`run_workflow`** — model loop becomes:

```python
generated_files: List[str] = []
file_details: List[Dict[str, Any]] = []

for model_name in model_names:
    try:
        chain_file = generate_chain_file(
            model_name, nodes, edges, variables,
            per_run_vars, output_folder, project_folder,
        )
        if chain_file:
            generated_files.append(chain_file)
            file_details.append({
                "model": model_name,
                "filename": os.path.basename(chain_file),
                "output_path": chain_file,
                "project_folder": project_folder,
                "status": "success",
                "error": None,
            })
    except Exception as e:
        logger.error(
            "Chain file generation failed for model %r: %s",
            model_name, e, exc_info=True,
        )
        file_details.append({
            "model": model_name,
            "filename": None,
            "output_path": None,
            "project_folder": project_folder,
            "status": "error",
            "error": f"{type(e).__name__}: {e}",
        })

return generated_files, project_folder, file_details
```

**`run_workflow_job`** — the ZIP-and-store step becomes:

```python
generated_files, project_folder, file_details = run_workflow(...)

succeeded_count = sum(1 for r in file_details if r.get("status") == "success")
failed_count = sum(1 for r in file_details if r.get("status") == "error")

summary_text = _build_summary_text(
    session_id, file_details, succeeded_count, failed_count,
)

zip_path = OUTPUT_DIR / f"{session_id}_chain_files.zip"
with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zipf:
    for file_path in generated_files:
        if os.path.exists(file_path):
            zipf.write(file_path, os.path.basename(file_path))
    zipf.writestr("_summary.txt", summary_text)

session_store.update(session_id, {
    "status": "completed",
    "results": {
        "files": [os.path.basename(f) for f in generated_files],
        "file_details": file_details,
        "zip_path": str(zip_path),
        "summary": {
            "total_files": len(generated_files),
            "succeeded_count": succeeded_count,
            "failed_count": failed_count,
            "project_folder": project_folder or "",
        },
    },
})
```

A small private helper `_build_summary_text(session_id, file_details, succeeded_count, failed_count) -> str` is added to `main.py`, alongside `run_workflow_job` (its only caller). It does pure string formatting with no domain logic, so it doesn't belong in the workflow runner.

---

## `_summary.txt` format

```
PyChain workflow run summary
============================
Generated: 2026-05-05 14:32:11 UTC
Session:   3f2c1234-5678-9abc-def0-1234567890ab
Models:    3 total · 2 succeeded · 1 failed

SUCCEEDED
  ABC-01.chain
  ABC-03.chain

FAILED
  ABC-02
    FileNotFoundError: D:/missing.dwg
```

Rules:
- `SUCCEEDED` section omitted if `succeeded_count == 0`.
- `FAILED` section omitted if `failed_count == 0`.
- Order within each section follows `file_details` order (= model-name iteration order). Successes are listed by filename (basename), failures by model name + indented error string.
- UTC timestamp uses ISO format truncated to seconds: `datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC")`.

---

## Data shapes (full session response)

```json
{
  "status": "completed",
  "results": {
    "files": ["ABC-01.chain", "ABC-03.chain"],
    "file_details": [
      {"model": "ABC-01", "filename": "ABC-01.chain",
       "output_path": "...", "project_folder": "...",
       "status": "success", "error": null},
      {"model": "ABC-02", "filename": null, "output_path": null,
       "project_folder": "...", "status": "error",
       "error": "FileNotFoundError: D:/missing.dwg"},
      {"model": "ABC-03", "filename": "ABC-03.chain",
       "output_path": "...", "project_folder": "...",
       "status": "success", "error": null}
    ],
    "zip_path": "...",
    "summary": {
      "total_files": 2,
      "succeeded_count": 2,
      "failed_count": 1,
      "project_folder": "..."
    }
  }
}
```

`files` and `summary.total_files` keep their existing meaning: successfully generated chain files only. Existing consumers that count files for the success modal don't need to change.

---

## Frontend changes

### Types (`frontend/lib/workflow/run.ts`)

```typescript
export interface WorkflowStatusResponse {
  status: 'processing' | 'completed' | 'error';
  results?: {
    files: string[];
    file_details?: Array<{
      model?: string;
      filename: string | null;
      project_folder: string;
      output_path?: string | null;
      status?: 'success' | 'error';
      error?: string | null;
    }>;
    zip_path: string;
    summary: {
      total_files: number;
      succeeded_count?: number;
      failed_count?: number;
      project_folder: string;
    };
  };
  error?: string;
}
```

`filename` becomes `string | null` (was `string`). `output_path` becomes `string | null | undefined`. New fields are optional. Any consumer reading `filename` should null-check; today's consumers are the success modal and the multi-run aggregation, both of which can be updated to filter to `status === 'success'` rows before reading `filename`.

### Success modal (`frontend/app/page.tsx`)

After `setShowSuccess(true)`:
- Read `failed_count` and `succeeded_count` from `summary`. If either is `undefined` (old session created before deploy), treat the session as legacy and fall back to the existing success-modal path unconditionally — do not infer counts from `total_files`.
- Pass these counts and the failed-rows subset of `file_details` to the success modal component.
- The modal renders one of three states:
  - `failed_count === 0` → existing success view.
  - `succeeded_count > 0 && failed_count > 0` → warning view with expandable failed-models list.
  - `succeeded_count === 0` → error view with the same list, but red tone and "All N models failed" headline.

The collapsible failed-models list renders one `<li>` per failure row: model name in bold, error string below in monospace.

### Multi-Excel run path

Today the per-Excel inner loop throws on `status === 'error'`. Changes:
- Before throwing, check whether `status === 'completed'` first (existing).
- On `completed`, accumulate `succeeded_count` and `failed_count` from each Excel into batch-level totals.
- After all Excels finish, surface combined totals in the success modal: "Processed N Excel files; X of Y models succeeded across all of them."
- A pre-loop / hard error (`status === 'error'`) for any Excel still throws and stops the batch — that's the existing behavior and matches user expectation for unrunnable batches.

---

## Error handling & edge cases

| Scenario | Behavior |
| --- | --- |
| One model raises mid-batch | Logged at `ERROR` with full traceback. Failure row appended. Loop continues to next model. |
| All models raise | All rows are failure rows. ZIP is written containing only `_summary.txt`. Status is `completed`. UI shows error tone with the failed-models list. |
| Excel file unreadable / column missing | Pre-loop, raises out of `run_workflow` → caught by `run_workflow_job`'s outer try/except → `status: "error"`. Existing behavior. |
| `model_names` filtered to empty by `selectedModelNames` | Loop runs zero times. `file_details = []`, `succeeded_count = 0`, `failed_count = 0`. ZIP contains only `_summary.txt`. Status `completed`. The summary will show "0 total". This is reachable today; new behavior is no worse and is now self-explanatory via the summary file. |
| `generate_chain_file` returns `None` (currently can't happen, but the existing code has an `if chain_file:` guard) | No success row appended, no failure row appended. The loop moves on. Preserves today's tolerance. |
| Disk write fails inside `generate_chain_file` | Caught by per-model except, treated as a model failure. The partial file (if any) is left on disk; existing TTL cleanup handles it. |
| ZIP write fails | Caught by `run_workflow_job`'s outer except → `status: "error"`. Same as today. |

All warnings/errors stay at `ERROR` level for per-model failures (genuine errors worth seeing in production logs). Pre-loop and ZIP-write failures stay at whatever level the existing code uses.

---

## Backwards compatibility

- **Existing tests:** `test_generate_chain_file.py`, `test_build_command_chain.py`, and all command-generator tests are untouched and must pass unchanged. PC-302 changes the outer iteration, not chain-file generation.
- **Old in-flight sessions:** the new optional fields don't break any deserialization. A session created before deploy and read after deploy parses fine; the modal just falls back to the existing success path.
- **`file_details` consumers:** the only existing consumer is the multi-run aggregation in `app/page.tsx`, which reads `filename` and `output_path`. Both become nullable; the aggregation is updated to filter to `status === 'success'` rows first. Any future consumer should follow the same pattern.
- **API contract:** no new endpoints, no removed endpoints, no changed request shapes. Only `GET /api/workflow/status/{session_id}` response gains optional fields.

---

## Testing

### New file: `backend/tests/test_run_workflow.py`

There is no existing test for `run_workflow` — adding one is overdue regardless. Tests fixture a tiny Excel file with 3 model-name rows and a minimal valid workflow graph. They patch `services.workflow_runner.generate_chain_file` to deterministically control which model "succeeds" or "fails".

1. **`test_all_models_succeed`** — patched `generate_chain_file` returns a path. Assert: 3 success rows, no failure rows, `generated_files` has 3 entries, all `error` fields are `None`.
2. **`test_one_model_fails_others_succeed`** — patched `generate_chain_file` raises `FileNotFoundError("missing")` for model 2 only. Assert: rows 0 and 2 are success with their `.chain` paths, row 1 has `status="error"`, `error == "FileNotFoundError: missing"`, `filename is None`. `generated_files` has 2 entries.
3. **`test_all_models_fail`** — patched `generate_chain_file` always raises. Assert: 3 failure rows, no success rows, `generated_files == []`. `file_details` row order matches model-name order.
4. **`test_failure_logged_with_traceback`** — uses `caplog` at `ERROR` level. Assert per-model failure log contains the model name and exception message; assert `caplog.records[*].exc_info` is populated for the failure record.
5. **`test_pre_loop_excel_error_still_raises`** — Excel file path doesn't exist. Assert `run_workflow` raises (the path that lands in `run_workflow_job`'s outer except → `status: "error"`).
6. **`test_no_models_after_filtering_returns_empty`** — Excel column has only header and empty rows, OR `selectedModelNames` filters to empty. Assert `run_workflow` returns `([], project_folder, [])` without raising. (Confirms today's tolerance — the loop is just empty; the empty-batch state is rendered by the summary file.)
7. **`test_file_details_shape`** — every row (success and failure) has all six keys: `model`, `filename`, `output_path`, `project_folder`, `status`, `error`. Pins the contract the frontend depends on.
8. **`test_row_order_matches_model_order`** — given models `["A", "B", "C"]` with B failing, assert `[r["model"] for r in file_details] == ["A", "B", "C"]`. Important for `_summary.txt` ordering and the UI list.

### New file: `backend/tests/test_run_workflow_job.py`

These tests patch `services.workflow_runner.run_workflow` directly to return canned `file_details`, then assert on the ZIP contents and session state. This isolates `run_workflow_job` from the workflow-runner internals.

9. **`test_zip_contains_summary_txt_with_failures`** — patched `run_workflow` returns mixed success/failure. Assert ZIP contains `_summary.txt`; its content includes the failed model name and the error string; the SUCCEEDED and FAILED sections appear in the right order.
10. **`test_zip_contains_only_summary_when_all_fail`** — patched return: 3 failures, no successes. Assert ZIP entry list is exactly `["_summary.txt"]`.
11. **`test_summary_counts_in_session`** — patched return: 2 successes, 1 failure. Assert session result has `summary.succeeded_count == 2`, `summary.failed_count == 1`, `summary.total_files == 2`. Assert `file_details` is stored intact.
12. **`test_pre_loop_error_status_is_error`** — patched `run_workflow` raises `ValueError("bad excel")`. Assert session status is `"error"`, `error` field contains the message, no ZIP is written.
13. **`test_summary_text_format`** — golden-string assertion on a small example. Pins the format so future edits to `_build_summary_text` notice if the user-facing output changes.

### Optional frontend test

In `frontend/lib/workflow/__tests__/`, a small vitest case asserting the `WorkflowStatusResponse` type accepts both old-shape and new-shape sample objects (compile-time check via `satisfies`). Catches accidental backwards-incompatible type narrowing.

### Manual verification (in the implementation plan, not the spec)

1. Start backend and frontend.
2. Build a workflow that intentionally fails one model (e.g., an `import` node referencing a path valid for some models, missing for others).
3. Run with 3 models. Confirm:
   - Success modal shows "2 of 3 models succeeded" with a warning tone.
   - Expanding the failed-models list shows the failed model name and the error string.
   - Downloaded ZIP contains 2 `.chain` files and `_summary.txt`.
   - `_summary.txt` lists both succeeded files and the failed model with its error.
   - Server log has the failure traceback at `ERROR`.
4. Force all 3 models to fail (point all imports at a missing path). Confirm error tone, "All 3 models failed", ZIP contains only `_summary.txt`.

---

## Out-of-scope follow-ups (logged for awareness, not in this PR)

- **PC-303** — surface per-node execution logs to the UI. The per-model failure data this PR collects is the input to PC-303's richer per-node view; PC-303 will narrow from "model X failed" to "node Y in model X failed".
- **Retry of failed models** — the user can already filter `selectedModelNames` to rerun a subset. A "retry failed" button could one-click this; not in PC-302.
- **Persistent failure history** — today the session is in-memory / Supabase-backed for the TTL window. Long-term failure history would require a new table; not in PC-302.
