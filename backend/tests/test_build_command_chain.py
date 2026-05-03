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
