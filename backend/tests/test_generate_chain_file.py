"""
Tests for services/workflow_runner — generate_chain_file.
"""
import os
from services.workflow_runner import generate_chain_file


def _make_node(node_id, node_type, data=None):
    return {"id": node_id, "type": node_type, "data": data or {}}


def _make_edge(source, target):
    return {"source": source, "target": target, "sourceHandle": "flow:out", "targetHandle": "flow:in"}


class TestGenerateChainFile:
    def test_creates_chain_file(self, tmp_path):
        nodes = [
            _make_node("1", "foreachModel"),
            _make_node("2", "addComment", {"commentName": "hello"}),
            _make_node("3", "chainFileOutput", {"modelType": "Model"}),
        ]
        edges = [_make_edge("1", "2"), _make_edge("2", "3")]

        result = generate_chain_file(
            "test_model", nodes, edges, [], {}, str(tmp_path)
        )
        assert result is not None
        assert os.path.exists(result)
        assert result.endswith(".chain")

    def test_chain_file_content_has_scaffolding(self, tmp_path):
        nodes = [
            _make_node("1", "foreachModel"),
            _make_node("2", "addComment", {"commentName": "hello"}),
            _make_node("3", "chainFileOutput", {"modelType": "Model"}),
        ]
        edges = [_make_edge("1", "2"), _make_edge("2", "3")]

        result = generate_chain_file(
            "test_model", nodes, edges, [], {}, str(tmp_path)
        )
        content = open(result, 'r', encoding='utf-8').read()
        assert '<?xml version="1.0"?>' in content
        assert '<Chain>' in content
        assert '</Chain>' in content
        assert '</xml12d>' in content
        assert '<meta_data>' in content

    def test_model_type_model(self, tmp_path):
        nodes = [
            _make_node("1", "foreachModel"),
            _make_node("2", "chainFileOutput", {"modelType": "Model"}),
        ]
        edges = [_make_edge("1", "2")]

        result = generate_chain_file(
            "test", nodes, edges, [], {}, str(tmp_path)
        )
        content = open(result, 'r', encoding='utf-8').read()
        assert '<project_name>Master</project_name>' in content

    def test_model_type_tin(self, tmp_path):
        nodes = [
            _make_node("1", "foreachModel"),
            _make_node("2", "chainFileOutput", {"modelType": "TIN"}),
        ]
        edges = [_make_edge("1", "2")]

        result = generate_chain_file(
            "test", nodes, edges, [], {}, str(tmp_path)
        )
        content = open(result, 'r', encoding='utf-8').read()
        assert '<project_name>Project</project_name>' in content

    def test_chain_file_name(self, tmp_path):
        nodes = [
            _make_node("1", "foreachModel"),
            _make_node("2", "chainFileOutput"),
        ]
        edges = [_make_edge("1", "2")]

        result = generate_chain_file(
            "my-model", nodes, edges, [], {}, str(tmp_path)
        )
        assert os.path.basename(result) == "my-model.chain"
