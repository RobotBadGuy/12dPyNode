# PC-301 — Execute All Branches Reachable From Foreach

**Date:** 2026-05-05
**Roadmap item:** [PC-301] `[P1]` — EPIC-03
**Scope guarantee:** backend-only. Single function modified (`build_command_chain` in `backend/services/workflow_runner.py`). No new modules, no public-API changes, no schema changes, no frontend changes. Total expected change: ~80 lines of production code + ~120 lines of tests.

---

## Goal

Make graphs with parallel branches downstream of `foreachModel` actually execute every branch. Today they silently drop everything not on the first DFS path to `chainFileOutput`.

## Non-goals

- Multi-`chainFileOutput` semantics (multiple chain files per model, mixed `modelType` warnings). PC-301's roadmap entry is about reachability, not output multiplicity.
- Multi-`foreachModel` graphs. That is what PC-403 (loop-local scope) addresses.
- Frontend validation that a branch will be executed. PC-305 already validates edge legality at draw time; reachability feedback in the canvas is a future concern.
- Touching `execute_node`, `resolve_variable`, or any command generator under `backend/commands/`.
- Any change to `generate_chain_file`'s scaffolding behavior or `run_workflow`'s outer loop.

---

## The bug, concretely

In `backend/services/workflow_runner.py::build_command_chain` (lines 575-641), the `foreach → chainFileOutput` path uses DFS that returns on the first path found. Given:

```
foreach ─┬─ A ─ B ─ chainFileOutput
         └─ C ─ D ─ E       (parallel branch)
```

DFS finds `foreach → A → B → chainFileOutput`, returns, and silently drops C/D/E. The same problem affects diamonds (`foreach → A; foreach → B; A → C; B → C`): only the first arm's nodes are walked, even though the merge node `C` does execute via the first arm.

## Approach

Replace the DFS-find-path logic with **forward-reachability + topological sort**.

When a `foreachModel` node exists:

1. **Reach set** — BFS from the foreach node id over flow edges (`is_flow_edge`, line 563) only. Collect every reachable node id. This bounds execution to the per-model subgraph and naturally excludes upstream `excelModels`/`setVariable` nodes.
2. **Induced subgraph** — keep only flow edges where both endpoints are in the reach set; build the indegree + adjacency maps over this subset.
3. **Kahn's topological sort** over the induced subgraph. Sort initial roots by node id; sort each adjacency list by node id before iterating. This makes the output order fully deterministic regardless of dict iteration order or edge insertion order.
4. **Cycle handling** — if Kahn's terminates with `len(execution_order) < len(reach_set)`, log a `WARNING` naming the cyclic node ids, emit XML for the well-ordered prefix, and skip the remainder. Mirrors PC-102's log-and-continue posture.
5. **Execute** in computed order, skipping the existing `control_flow_types = {'foreachModel', 'chainFileOutput', 'excelModels', 'setVariable'}` set so they contribute their flow edges to ordering but don't generate XML.

When no `foreachModel` exists, keep the existing whole-graph topological-sort fallback. Apply the same root/adjacency id-sort there as well, for the same determinism reason.

## Code shape

Two small private helpers introduced inside `workflow_runner.py` so the algorithm stays testable and readable:

- `_collect_flow_reachable(start_id: str, edges: list[dict], is_flow_edge) -> set[str]`
- `_kahn_sort(node_ids: set[str], edges: list[dict], is_flow_edge, logger) -> list[str]` — handles deterministic ordering and cycle warning, returns the well-ordered prefix.

Both branches inside `build_command_chain` (foreach-present and foreach-absent) call `_kahn_sort`. They differ only in which node-id set they pass in:

- foreach present → `_collect_flow_reachable(foreach_id, edges)`
- foreach absent → `set(all_node_ids)`

The `is_flow_edge` closure stays where it is (top of `build_command_chain`); helpers receive it as a parameter so they remain easily testable in isolation if we choose to.

A single module-level `logger = logging.getLogger(__name__)` replaces the two inline `logging.getLogger(__name__)` calls at lines 624 and 654.

## Data flow & control-flow node handling

- **Edge taxonomy is unchanged.** `is_flow_edge` already filters: `flow:*` traversed; `param:*` and `value:*` not. Both reach-set BFS and Kahn's use it. Parameter and value edges remain pure data dependencies that don't influence execution order.
- **Control-flow nodes** (`foreachModel`, `chainFileOutput`, `excelModels`, `setVariable`) stay in the topological order so their successors are correctly placed, but `execute_node` is not called for them — same as today (lines 630, 686).
- **Per-model XML scaffolding is unchanged.** `generate_chain_file` (line 698) still wraps the command list with `xml_header` + `meta_data_{tin|model}` + `chain_wrapper` + `chain_settings` and `chain_closing`. `modelType` still comes from the first `chainFileOutput` node found in the graph (line 723). PC-301 does not touch multi-output semantics.
- **`projectFolder` resolution unchanged.** Read once in `run_workflow` (line 824) from the first `chainFileOutput.data.projectFolder`.
- **Linear graphs are byte-identical.** Kahn's over `foreach → A → B → chainFileOutput` produces the same execution order as the current DFS, so `test_simple_linear_graph` and all golden chain-file tests continue to pass without modification.
- **Diamond merges are now correct.** A merge node executes once, and Kahn's places it after both its predecessors finish — strictly more correct than today's "execute at first reach" DFS behavior.

## Error handling & edge cases

| Scenario | Behavior |
| --- | --- |
| Cycle in foreach-reachable subgraph | `logger.warning("Cycle detected in foreach-reachable subgraph; skipping nodes: <ids>")`, execute the well-ordered prefix, return XML. Does not raise. |
| Foreach exists but no `chainFileOutput` reachable | Execute the foreach-reachable subset via Kahn's. No warning — this is now a supported shape. Scaffolding still wraps the output, so the `.chain` file remains valid. (Behavior change: today this path warns and falls through to whole-graph topological sort, which incorrectly includes upstream `excelModels`/`setVariable` predecessors. New behavior is strictly more correct.) |
| Foreach exists but has no outgoing flow edges | Reach set is `{foreach_id}` only. Kahn's returns `[foreach_id]`, control-flow filter drops it, `xml_content` is `[]`. Equivalent to a control-flow-only graph. |
| No foreach node at all | Existing whole-graph topological-sort fallback runs unchanged. Already covered by `TestTopologicalSortFallback`. |
| Edge references a missing node | Both reach-set BFS and Kahn's skip such edges. Reuse the existing pattern at line 662 (`if source_id in adjacency and target_id in adjacency`). The existing missing-endpoint warning log is preserved. Already covered by `test_missing_node_edge`. |
| Multiple `foreachModel` nodes | Out of scope for PC-301. First match wins via `next(...)` at line 576 — same as today. No new validation in this PR. |
| Multiple `chainFileOutput` nodes with conflicting `modelType` | Out of scope. First match wins for `modelType` (line 723) — same as today. |

All warnings stay at `WARNING` level. Nothing is raised from `build_command_chain` in normal operation.

## Determinism

Kahn's queue order is FIFO and depends on iteration order of `indegree.items()` and adjacency lists. Both are sorted by node id (string sort) before queueing. The same graph + same input always produces the same order across Python versions, dict-iteration quirks, and edge insertion order. This is required for the existing golden-file tests in `tests/test_generate_chain_file.py` to remain stable.

## Testing

Extend `backend/tests/test_build_command_chain.py` with a new test class `TestParallelBranches`:

1. **`test_two_parallel_branches_both_execute`** — `foreach → A; foreach → B; A → out; B → out`. Assert XML from both A and B appears in output. **The PC-301 regression test.**
2. **`test_diamond_merge_executes_once`** — `foreach → A; foreach → B; A → C; B → C; C → out`. Assert C's XML appears exactly once and after both A and B in the joined output.
3. **`test_branch_without_chain_output_still_executes`** — `foreach → A → B`, no `chainFileOutput`. Assert A's and B's XML appear, validating the new "no chainFileOutput required" semantics.
4. **`test_disconnected_subgraph_excluded`** — node Z unreachable from foreach. Assert Z's XML does *not* appear.
5. **`test_cycle_emits_warning_and_partial_output`** — `foreach → A → B → A`. Use `caplog` to assert a `WARNING` is logged. Assert at least one node's XML appears (well-ordered prefix). Test does not assert exact prefix length to avoid coupling to internal queue order.
6. **`test_deterministic_ordering`** — same graph constructed twice with shuffled edge insertion order. Assert identical output strings.
7. **`test_no_foreach_fallback_still_deterministic`** — same shuffle test for the no-foreach path.

Existing tests continue to pass unchanged. The five tests in `test_build_command_chain.py` plus all chain-file golden tests in `test_generate_chain_file.py` are the contract for backwards compatibility.

No new test files. All additions go into `test_build_command_chain.py`. No frontend tests.

## Manual verification

Before marking PC-301 done:

1. Start backend (`python main.py`) and frontend (`npm run dev`).
2. Build a diamond-shaped graph: `excelModels → foreachModel → cleanModel → addComment → chainFileOutput` plus a parallel `foreachModel → addLabel → chainFileOutput` edge.
3. Run with a small Excel of 1-2 model names.
4. Open the generated `.chain` file from the ZIP and confirm commands from both branches (`<Clean_model>`, `<Comment>`, `<Label>`) are present.

This step is part of the implementation plan's final task, not the spec itself.

## Out-of-scope follow-ups (logged for awareness, not in this PR)

- **PC-302** — per-model error isolation. Independent of PC-301; will benefit from the cycle-warning logger added here.
- **PC-303** — surfacing per-node execution logs to the UI. Independent.
- **Frontend reachability hints** — showing in the canvas which nodes will and won't run. Future UX polish; not blocked by anything here.
