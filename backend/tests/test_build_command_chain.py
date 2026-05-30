"""
Tests for services/workflow_runner — build_command_chain.
"""
from services.workflow_runner import build_command_chain


def _make_node(node_id, node_type, data=None):
    """Helper to create a minimal node dict."""
    return {"id": node_id, "type": node_type, "data": data or {}}


def _make_edge(source, target, source_handle="flow:out", target_handle="flow:in"):
    """Helper to create a minimal edge dict."""
    return {
        "source": source,
        "target": target,
        "sourceHandle": source_handle,
        "targetHandle": target_handle,
    }


class TestForeachToChainOutput:
    def test_simple_linear_graph(self):
        """foreach → cleanModel → chainFileOutput should execute cleanModel."""
        nodes = [
            _make_node("1", "foreachModel"),
            _make_node("2", "cleanModel", {
                "modelName": "model_name",
                "comments": "",
                "commandName": "Clean model",
            }),
            _make_node("3", "chainFileOutput"),
        ]
        edges = [
            _make_edge("1", "2"),
            _make_edge("2", "3"),
        ]
        result = build_command_chain(nodes, edges, "TestModel", [], {})
        assert len(result) > 0
        joined = '\n'.join(result)
        assert '<Clean_model>' in joined

    def test_control_flow_nodes_excluded(self):
        """foreachModel, excelModels, setVariable, chainFileOutput should not generate XML."""
        nodes = [
            _make_node("1", "foreachModel"),
            _make_node("2", "excelModels"),
            _make_node("3", "setVariable"),
            _make_node("4", "chainFileOutput"),
        ]
        edges = [
            _make_edge("1", "4"),
        ]
        result = build_command_chain(nodes, edges, "M", [], {})
        # Should produce no XML since all nodes are control-flow
        assert len(result) == 0

    def test_sticky_note_emits_nothing(self):
        """PC-908: a stickyNote in the flow path is skipped (control-flow) and
        never emits its text into the chain."""
        nodes = [
            _make_node("1", "foreachModel"),
            _make_node("2", "stickyNote", {"text": "high-detail branch only"}),
            _make_node("3", "chainFileOutput"),
        ]
        edges = [
            _make_edge("1", "2"),
            _make_edge("2", "3"),
        ]
        result = build_command_chain(nodes, edges, "M", [], {})
        joined = "\n".join(result)
        assert "high-detail" not in joined
        assert len(result) == 0


class TestFlowEdgeFiltering:
    def test_param_edges_ignored(self):
        """Edges with param: prefix should not be traversed."""
        nodes = [
            _make_node("1", "foreachModel"),
            _make_node("2", "addComment", {"commentName": "test"}),
            _make_node("3", "chainFileOutput"),
            _make_node("4", "addLabel", {"labelName": "skipped"}),
        ]
        edges = [
            _make_edge("1", "2"),  # flow edge
            _make_edge("2", "3"),  # flow edge
            _make_edge("2", "4", source_handle="param:out", target_handle="param:in"),  # param edge — should be ignored
        ]
        result = build_command_chain(nodes, edges, "M", [], {})
        joined = '\n'.join(result)
        assert '<Comment>' in joined
        # addLabel should NOT be in the output since it's only reachable via param edge
        assert 'skipped' not in joined


class TestTopologicalSortFallback:
    def test_graph_without_foreach(self):
        """Without a foreachModel node, should fall back to topological sort."""
        nodes = [
            _make_node("1", "addComment", {"commentName": "first"}),
            _make_node("2", "addLabel", {"labelName": "second"}),
        ]
        edges = [
            _make_edge("1", "2"),
        ]
        result = build_command_chain(nodes, edges, "M", [], {})
        joined = '\n'.join(result)
        assert '<Comment>' in joined
        assert '<Label>' in joined


class TestEdgeCases:
    def test_missing_node_edge(self):
        """Edge referencing a non-existent node should not crash."""
        nodes = [
            _make_node("1", "addComment", {"commentName": "only"}),
        ]
        edges = [
            _make_edge("1", "999"),  # node 999 doesn't exist
        ]
        # Should not raise
        result = build_command_chain(nodes, edges, "M", [], {})
        assert isinstance(result, list)

    def test_empty_graph(self):
        """Empty node/edge lists should return empty XML."""
        result = build_command_chain([], [], "M", [], {})
        assert result == []


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
