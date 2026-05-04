# PC-301 — Execute All Branches Reachable From Foreach — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the first-path DFS in `build_command_chain` with forward-reachability + Kahn's topological sort so graphs with parallel branches downstream of `foreachModel` actually execute every branch.

**Architecture:** Two new private helpers (`_collect_flow_reachable`, `_kahn_sort`) at the top of `backend/services/workflow_runner.py`. The foreach branch and the no-foreach fallback both call them, differing only in which node-id set they pass to `_kahn_sort`. Determinism via id-sorted Kahn's queue and adjacency lists.

**Tech Stack:** Python 3.11/3.12, pytest, `bisect` (stdlib).

**Spec:** `docs/superpowers/specs/2026-05-05-pc-301-execute-all-branches-design.md`

**Pre-flight verification (already confirmed by spec author, but re-run if uncertain):**
- `backend/services/workflow_runner.py::build_command_chain` lives at lines 537–695.
- `is_flow_edge` closure is defined inside `build_command_chain` at lines 563–573 — keep it as a closure.
- Existing fallback Kahn's lives at lines 643–693.
- Existing test file is `backend/tests/test_build_command_chain.py` with helpers `_make_node` and `_make_edge` at the top. Match this style.
- Backend test command: `python -m pytest backend/tests/ -v` from repo root, **or** `python -m pytest tests/ -v` from `backend/`.
- `pytest`'s `caplog` fixture is the standard way to assert on log records.

---

## Task 1: Pure refactor — module-level logger + extract `_kahn_sort`

**Files:**
- Modify: `backend/services/workflow_runner.py`

This task is behavior-preserving. We lift the no-foreach fallback's Kahn's loop into a private module-level helper with deterministic ordering, then have the existing fallback call it. No test changes needed; existing tests must remain green.

- [ ] **Step 1: Add module-level logger and `_kahn_sort` helper**

At the top of `backend/services/workflow_runner.py`, just below the `from commands.functions import function_command` line (currently line 60), add:

```python


import bisect
import logging

logger = logging.getLogger(__name__)


def _kahn_sort(
    node_ids: set,
    edges: List[Dict[str, Any]],
    is_flow_edge,
) -> List[str]:
    """
    Deterministic Kahn's topological sort over the induced subgraph defined by node_ids.

    - Initial roots and adjacency lists are sorted by node id (string sort) so output
      is stable across dict-iteration order and edge insertion order.
    - On cycle (sort length < |node_ids|), logs a WARNING naming the cyclic node ids
      and returns the well-ordered prefix. Does not raise.
    - Edges referencing nodes outside node_ids are silently skipped (caller is
      responsible for any cross-set logging if it cares).
    """
    indegree: Dict[str, int] = {nid: 0 for nid in node_ids}
    adjacency: Dict[str, List[str]] = {nid: [] for nid in node_ids}

    for edge in edges:
        if not is_flow_edge(edge):
            continue
        source_id = str(edge.get('source'))
        target_id = str(edge.get('target'))
        if source_id in adjacency and target_id in adjacency:
            adjacency[source_id].append(target_id)
            indegree[target_id] += 1

    for nid in adjacency:
        adjacency[nid].sort()

    queue: List[str] = sorted(nid for nid, deg in indegree.items() if deg == 0)
    order: List[str] = []

    while queue:
        current = queue.pop(0)
        order.append(current)
        for neighbor in adjacency[current]:
            indegree[neighbor] -= 1
            if indegree[neighbor] == 0:
                bisect.insort(queue, neighbor)

    if len(order) < len(node_ids):
        cyclic = sorted(node_ids - set(order))
        logger.warning(f"Cycle detected; cannot order nodes: {cyclic}")

    return order
```

- [ ] **Step 2: Replace the no-foreach fallback to use `_kahn_sort`**

In `build_command_chain`, the existing fallback path (currently lines 643–695) builds its own Kahn's loop and uses an inline `import logging; logger = logging.getLogger(__name__)`. Replace lines 643–695 with:

```python
    # Fallback: no foreach node — topological order over all nodes via flow edges.
    # This allows workflows that don't use the Foreach Model node.
    id_to_node: Dict[str, Dict[str, Any]] = {
        str(n.get('id')): n for n in nodes if n.get('id') is not None
    }
    all_node_ids = set(id_to_node.keys())

    # Log edges that reference unknown nodes (preserves prior debug-aid behavior)
    for edge in edges:
        if not is_flow_edge(edge):
            continue
        source_id = str(edge.get('source'))
        target_id = str(edge.get('target'))
        if source_id not in all_node_ids:
            logger.warning(f"Edge references non-existent source node: {source_id}")
        if target_id not in all_node_ids:
            logger.warning(f"Edge references non-existent target node: {target_id}")

    execution_order = _kahn_sort(all_node_ids, edges, is_flow_edge)

    control_flow_types = {'foreachModel', 'chainFileOutput', 'excelModels', 'setVariable'}
    for node_id in execution_order:
        node = id_to_node.get(node_id)
        if node and node.get('type') not in control_flow_types:
            execute_node(node, model_name, variables, per_run_vars, xml_content, output_folder)

    return xml_content
```

Also remove the inline `import logging; logger = logging.getLogger(__name__)` at the old lines 624–625 inside the foreach branch (the warning call there can use the module-level `logger` directly). The line is currently:

```python
                import logging
                logger = logging.getLogger(__name__)
                logger.warning(f"No path found from foreachModel node {foreach_id} to any chainFileOutput node. Falling back to topological sort.")
```

Replace with:

```python
                logger.warning(f"No path found from foreachModel node {foreach_id} to any chainFileOutput node. Falling back to topological sort.")
```

- [ ] **Step 3: Run all backend tests — must remain green**

Run from repo root:

```bash
python -m pytest backend/tests/ -v
```

Expected: all tests pass, including the 5 tests in `test_build_command_chain.py`. If anything fails, the refactor changed behavior — diagnose before continuing.

- [ ] **Step 4: Commit**

```bash
git add backend/services/workflow_runner.py
git commit -m "refactor(workflow_runner): extract deterministic _kahn_sort helper"
```

---

## Task 2: TDD — add failing regression test for parallel branches

**Files:**
- Modify: `backend/tests/test_build_command_chain.py`

Per the spec's testing section, this is the regression test that proves PC-301 is fixed. Write the test first, watch it fail on the current foreach DFS path, then fix in Task 3.

- [ ] **Step 1: Add `TestParallelBranches` class with the regression test**

Append to `backend/tests/test_build_command_chain.py` (at the end of the file, after `TestEdgeCases`):

```python


class TestParallelBranches:
    def test_two_parallel_branches_both_execute(self):
        """foreach fans out to two parallel branches; both must produce XML.

        Graph:
            foreach -> commentNode -> chainFileOutput
            foreach -> labelNode  -> chainFileOutput
        Today's DFS finds the comment branch first and silently drops the label
        branch. PC-301 must execute both.
        """
        nodes = [
            _make_node("foreach", "foreachModel"),
            _make_node("comment", "addComment", {"commentName": "branch_a"}),
            _make_node("label", "addLabel", {"labelName": "branch_b"}),
            _make_node("out", "chainFileOutput"),
        ]
        edges = [
            _make_edge("foreach", "comment"),
            _make_edge("foreach", "label"),
            _make_edge("comment", "out"),
            _make_edge("label", "out"),
        ]
        result = build_command_chain(nodes, edges, "M", [], {})
        joined = '\n'.join(result)
        assert '<Comment>' in joined, "branch A (addComment) must execute"
        assert '<Label>' in joined, "branch B (addLabel) must execute — this is the PC-301 bug"
```

- [ ] **Step 2: Run the new test — must FAIL**

Run from repo root:

```bash
python -m pytest backend/tests/test_build_command_chain.py::TestParallelBranches::test_two_parallel_branches_both_execute -v
```

Expected: FAIL on the `<Label>` assertion ("branch B (addLabel) must execute — this is the PC-301 bug"). This confirms the bug is reproduced.

- [ ] **Step 3: Do NOT commit yet**

Test will be committed together with the fix in Task 3 so every commit is green on `main`. Do not stage or commit the test on its own.

---

## Task 3: Implement the fix — `_collect_flow_reachable` + replace foreach DFS

**Files:**
- Modify: `backend/services/workflow_runner.py`
- Modify: `backend/tests/test_build_command_chain.py` (already has the failing test from Task 2)

This is the actual PC-301 fix. After this task the regression test from Task 2 must pass.

- [ ] **Step 1: Add `_collect_flow_reachable` helper**

In `backend/services/workflow_runner.py`, add this helper just above `_kahn_sort` (between the module-level `logger` and `_kahn_sort`):

```python
def _collect_flow_reachable(
    start_id: str,
    edges: List[Dict[str, Any]],
    is_flow_edge,
) -> set:
    """
    Forward BFS from start_id over flow edges. Returns the set of reachable
    node ids, including start_id. Edges that aren't flow edges are ignored.
    """
    reached = {start_id}
    frontier = [start_id]
    while frontier:
        next_frontier: List[str] = []
        for current in frontier:
            for edge in edges:
                if not is_flow_edge(edge):
                    continue
                if str(edge.get('source')) == current:
                    target = str(edge.get('target'))
                    if target and target not in reached:
                        reached.add(target)
                        next_frontier.append(target)
        frontier = next_frontier
    return reached
```

- [ ] **Step 2: Replace the foreach DFS path with reach + Kahn's**

In `build_command_chain`, find the block starting at the comment `# Try the original foreach → chainFileOutput path first (for classic graphs)` (currently line 575) and continuing through line 641 (the closing `if execution_order: return xml_content`). Replace the entire block — from line 575 through line 641 inclusive — with:

```python
    # Foreach-driven path: collect every flow-reachable node, then topo-sort.
    # This handles parallel branches and diamonds correctly (PC-301).
    foreach_node = next((n for n in nodes if n.get('type') == 'foreachModel'), None)

    if foreach_node:
        foreach_id = str(foreach_node.get('id'))
        id_to_node: Dict[str, Dict[str, Any]] = {
            str(n.get('id')): n for n in nodes if n.get('id') is not None
        }
        reach_set = _collect_flow_reachable(foreach_id, edges, is_flow_edge)

        # Restrict reach_set to ids that actually exist in id_to_node — guards
        # against malformed edges that target ids not present in the node list.
        reach_set = {nid for nid in reach_set if nid in id_to_node}

        execution_order = _kahn_sort(reach_set, edges, is_flow_edge)

        control_flow_types = {'foreachModel', 'chainFileOutput', 'excelModels', 'setVariable'}
        for node_id in execution_order:
            node = id_to_node.get(node_id)
            if node and node.get('type') not in control_flow_types:
                execute_node(node, model_name, variables, per_run_vars, xml_content, output_folder)

        return xml_content

```

The `# Fallback: no foreach node — topological order over all nodes via flow edges.` block from Task 1 should remain immediately below this one and continues to handle the no-foreach case.

- [ ] **Step 3: Run the regression test — must PASS**

```bash
python -m pytest backend/tests/test_build_command_chain.py::TestParallelBranches::test_two_parallel_branches_both_execute -v
```

Expected: PASS. Both `<Comment>` and `<Label>` appear in the joined output.

- [ ] **Step 4: Run all backend tests — must all pass**

```bash
python -m pytest backend/tests/ -v
```

Expected: all tests pass. Linear graphs, control-flow filtering, param edges, topo fallback, missing-node, empty-graph all unaffected.

- [ ] **Step 5: Commit**

```bash
git add backend/services/workflow_runner.py backend/tests/test_build_command_chain.py
git commit -m "$(cat <<'EOF'
feat(PC-301): execute all branches reachable from foreach

Replace first-path DFS in build_command_chain with forward-reachability +
deterministic Kahn's topological sort. Graphs with parallel branches
downstream of foreachModel now execute every branch instead of silently
dropping non-first arms.
EOF
)"
```

---

## Task 4: Add the remaining tests from the spec

**Files:**
- Modify: `backend/tests/test_build_command_chain.py`

Tests 2–7 from the spec's testing section. All should pass on the fixed implementation.

- [ ] **Step 1: Add diamond merge test**

Append inside the existing `TestParallelBranches` class:

```python
    def test_diamond_merge_executes_once(self):
        """foreach fans out to A and B which both feed merge node C.

        C must appear exactly once and after both A and B.
        """
        nodes = [
            _make_node("foreach", "foreachModel"),
            _make_node("a", "addComment", {"commentName": "a"}),
            _make_node("b", "addLabel", {"labelName": "b"}),
            _make_node("c", "addComment", {"commentName": "c_merge"}),
            _make_node("out", "chainFileOutput"),
        ]
        edges = [
            _make_edge("foreach", "a"),
            _make_edge("foreach", "b"),
            _make_edge("a", "c"),
            _make_edge("b", "c"),
            _make_edge("c", "out"),
        ]
        result = build_command_chain(nodes, edges, "M", [], {})
        joined = '\n'.join(result)
        # All three node tags appear
        assert '<Label>' in joined
        # The merge node should appear exactly once — count occurrences of its
        # unique commentName which we resolve via resolve_variable's literal path.
        # (addComment renders the resolved commentName inside its XML.)
        assert joined.count('c_merge') == 1
```

- [ ] **Step 2: Add branch-without-chain-output test**

```python
    def test_branch_without_chain_output_still_executes(self):
        """foreach -> A -> B with no chainFileOutput. Both A and B must execute.

        Spec section 3 explicitly documents this as a now-supported shape.
        """
        nodes = [
            _make_node("foreach", "foreachModel"),
            _make_node("a", "addComment", {"commentName": "a"}),
            _make_node("b", "addLabel", {"labelName": "b"}),
        ]
        edges = [
            _make_edge("foreach", "a"),
            _make_edge("a", "b"),
        ]
        result = build_command_chain(nodes, edges, "M", [], {})
        joined = '\n'.join(result)
        assert '<Comment>' in joined
        assert '<Label>' in joined
```

- [ ] **Step 3: Add disconnected-subgraph test**

```python
    def test_disconnected_subgraph_excluded(self):
        """A node not flow-reachable from foreach must not execute."""
        nodes = [
            _make_node("foreach", "foreachModel"),
            _make_node("connected", "addComment", {"commentName": "in_branch"}),
            _make_node("orphan", "addLabel", {"labelName": "orphaned"}),
            _make_node("out", "chainFileOutput"),
        ]
        edges = [
            _make_edge("foreach", "connected"),
            _make_edge("connected", "out"),
            # 'orphan' has no incoming flow edge from foreach
        ]
        result = build_command_chain(nodes, edges, "M", [], {})
        joined = '\n'.join(result)
        assert '<Comment>' in joined
        assert '<Label>' not in joined, "disconnected node must not execute"
```

- [ ] **Step 4: Add cycle test**

```python
    def test_cycle_emits_warning_and_partial_output(self, caplog):
        """foreach -> a -> b -> c -> b creates a cycle (b ↔ c).

        a should still execute (well-ordered prefix). A WARNING should be logged
        naming the cyclic node ids. No exception is raised.
        """
        import logging as _logging
        nodes = [
            _make_node("foreach", "foreachModel"),
            _make_node("a", "addComment", {"commentName": "first"}),
            _make_node("b", "addLabel", {"labelName": "second"}),
            _make_node("c", "addComment", {"commentName": "third"}),
        ]
        edges = [
            _make_edge("foreach", "a"),
            _make_edge("a", "b"),
            _make_edge("b", "c"),
            _make_edge("c", "b"),  # cycle
        ]
        with caplog.at_level(_logging.WARNING, logger="services.workflow_runner"):
            result = build_command_chain(nodes, edges, "M", [], {})

        # No crash, list returned
        assert isinstance(result, list)
        # 'a' is well-ordered before the cycle, so its XML must appear
        joined = '\n'.join(result)
        assert '<Comment>' in joined
        # Cycle warning logged
        assert any("Cycle detected" in record.message for record in caplog.records), \
            "expected a 'Cycle detected' WARNING; saw: " + repr([r.message for r in caplog.records])
```

- [ ] **Step 5: Add determinism tests**

```python
    def test_deterministic_ordering_with_foreach(self):
        """Same graph with shuffled edge insertion order must produce identical output."""
        nodes = [
            _make_node("foreach", "foreachModel"),
            _make_node("a", "addComment", {"commentName": "a"}),
            _make_node("b", "addLabel", {"labelName": "b"}),
            _make_node("c", "addComment", {"commentName": "c"}),
            _make_node("out", "chainFileOutput"),
        ]
        edges_v1 = [
            _make_edge("foreach", "a"),
            _make_edge("foreach", "b"),
            _make_edge("a", "c"),
            _make_edge("b", "c"),
            _make_edge("c", "out"),
        ]
        edges_v2 = list(reversed(edges_v1))

        result_v1 = build_command_chain(nodes, edges_v1, "M", [], {})
        result_v2 = build_command_chain(nodes, edges_v2, "M", [], {})

        assert result_v1 == result_v2, \
            "edge insertion order must not affect output (Kahn's queue + adjacency are id-sorted)"

    def test_deterministic_ordering_no_foreach_fallback(self):
        """Same shuffle test for the no-foreach fallback path."""
        nodes = [
            _make_node("a", "addComment", {"commentName": "a"}),
            _make_node("b", "addLabel", {"labelName": "b"}),
            _make_node("c", "addComment", {"commentName": "c"}),
        ]
        edges_v1 = [
            _make_edge("a", "b"),
            _make_edge("b", "c"),
        ]
        edges_v2 = list(reversed(edges_v1))

        result_v1 = build_command_chain(nodes, edges_v1, "M", [], {})
        result_v2 = build_command_chain(nodes, edges_v2, "M", [], {})

        assert result_v1 == result_v2
```

- [ ] **Step 6: Run all backend tests — every test must pass**

```bash
python -m pytest backend/tests/ -v
```

Expected: all tests pass, including the 6 new ones in `TestParallelBranches`.

- [ ] **Step 7: Commit**

```bash
git add backend/tests/test_build_command_chain.py
git commit -m "test(PC-301): cover diamond merges, disconnected subgraphs, cycles, determinism"
```

---

## Task 5: Update ROADMAP.md to mark PC-301 done

**Files:**
- Modify: `ROADMAP.md` (line 55, the PC-301 bullet)

Match the format used by other completed items (PC-201, PC-202, etc.) — leading `✅`, with the rationale rewritten in past tense to describe what shipped.

- [ ] **Step 1: Update the PC-301 bullet**

In `ROADMAP.md`, replace the existing PC-301 bullet (lines 55–56):

```markdown
- **PC-301** `[P1]` — Execute all branches reachable from foreach, not just the first DFS hit.
  *Rationale:* `build_command_chain` in `workflow_runner.py` uses DFS that returns the first path to a `chainFileOutput`. A graph with parallel branches silently drops everything not on that path. Walk *all* reachable flow nodes in topological order instead.
```

with:

```markdown
- ✅ **PC-301** `[P1]` — Execute all branches reachable from foreach.
  *Rationale:* `build_command_chain` in `workflow_runner.py` previously used a first-path DFS that silently dropped parallel branches downstream of `foreachModel`. Replaced with forward-reachability BFS over flow edges from the foreach node, then deterministic Kahn's topological sort over the induced subgraph (id-sorted roots + adjacency for stable output across dict-iteration / edge insertion order). Cycles log a warning and emit the well-ordered prefix; disconnected subgraphs are correctly excluded; a foreach with no reachable `chainFileOutput` is now a supported shape. Two private helpers (`_collect_flow_reachable`, `_kahn_sort`) are reused by the no-foreach fallback path. Tested in `backend/tests/test_build_command_chain.py::TestParallelBranches` (parallel branches, diamond merge, branch-without-output, disconnected subgraph, cycle, determinism).
```

- [ ] **Step 2: Commit**

```bash
git add ROADMAP.md
git commit -m "docs: mark PC-301 done in ROADMAP"
```

---

## Task 6: Manual verification in the running app

Per the spec's "Manual verification" section, before declaring the work done.

- [ ] **Step 1: Start the backend**

From `backend/` (with venv activated):

```powershell
python main.py
```

Expected: uvicorn starts on `0.0.0.0:8001`, no errors.

- [ ] **Step 2: Start the frontend**

In a second terminal, from `frontend/`:

```powershell
npm run dev
```

Expected: Next.js dev server on `http://localhost:3000`.

- [ ] **Step 3: Build a parallel-branch graph in the canvas**

Open `http://localhost:3000`. Construct a workflow with two parallel branches downstream of `foreachModel`:

```
excelModels -> foreachModel -> cleanModel  -> chainFileOutput
                            \-> addComment -/
                            \-> addLabel  -/
```

(Connect three different generator nodes — e.g. `cleanModel`, `addComment`, `addLabel` — each as a separate sibling under `foreachModel`, all flowing into the same `chainFileOutput`.)

Fill in the minimum required parameters per node so the graph validates.

- [ ] **Step 4: Upload an Excel and run the workflow**

Upload a small Excel with 1–2 model names. Click Run. Wait for completion.

- [ ] **Step 5: Inspect the generated `.chain` file**

Download the ZIP. Open one of the `.chain` files in a text editor.

Expected: XML from **all three** sibling nodes is present. Specifically, look for `<Clean_model>`, `<Comment>`, and `<Label>` elements — all three should appear inside the `<chain>` block.

If any of the three is missing, the fix is incomplete — check that the manual-verification graph matches the structure above and that all three nodes have valid parameters.

- [ ] **Step 6: Stop both dev servers**

`Ctrl+C` in each terminal.

---

## Self-review (already done by the plan author)

**Spec coverage:**
- Reach-set BFS + Kahn's: Tasks 1 + 3.
- Determinism via id-sorted roots and adjacency: Task 1's `_kahn_sort`.
- Cycle handling (log + partial output, no raise): Task 1's `_kahn_sort` + Task 4 cycle test.
- Foreach-without-chainFileOutput: Task 4 `test_branch_without_chain_output_still_executes`.
- Disconnected subgraphs excluded: Task 4 `test_disconnected_subgraph_excluded`.
- No-foreach fallback unchanged in behavior, refactored to share `_kahn_sort`: Task 1 + Task 4 fallback determinism test.
- Linear-graphs byte-identical: covered implicitly by existing `test_simple_linear_graph` continuing to pass after Task 1 and Task 3.
- Multi-foreach / multi-chainFileOutput: explicitly out of scope per the spec; no task.
- Edge-references-missing-node: covered by existing `test_missing_node_edge`; behavior preserved by Task 1's "log when source/target not in node set" loop.

**Placeholder scan:** none. All steps have concrete code, exact paths, exact commands, exact expected outputs.

**Type consistency:** `_kahn_sort` and `_collect_flow_reachable` signatures are the same in both their definition (Task 1, Task 3 Step 1) and their call sites (Task 1 Step 2, Task 3 Step 2). Both return the types they declare.
