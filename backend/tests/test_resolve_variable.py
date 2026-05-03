"""
Tests for services/workflow_runner — resolve_variable.
"""
from services.workflow_runner import resolve_variable


class TestDirectVariableName:
    def test_per_run_variable(self):
        per_run = {"project_folder": "C:\\Projects"}
        result = resolve_variable("project_folder", "model1", [], per_run)
        assert result == "C:\\Projects"

    def test_variable_binding(self):
        variables = [{"name": "my_var", "value": "hello", "scope": "per-run"}]
        result = resolve_variable("my_var", "model1", variables, {})
        assert result == "hello"

    def test_per_run_takes_precedence(self):
        """per_run_vars should be checked before variable bindings."""
        variables = [{"name": "x", "value": "from_binding", "scope": "per-run"}]
        per_run = {"x": "from_per_run"}
        result = resolve_variable("x", "m", variables, per_run)
        assert result == "from_per_run"


class TestBuiltinVariables:
    def test_model_name(self):
        result = resolve_variable("model_name", "TestModel", [], {})
        assert result == "TestModel"

    def test_modified_variable(self):
        result = resolve_variable("modified_variable", "my-model-name", [], {})
        assert result == "my model name"

    def test_variable_returns_model_name(self):
        result = resolve_variable("variable", "XYZ", [], {})
        assert result == "XYZ"


class TestTemplateSubstitution:
    def test_single_token(self):
        result = resolve_variable("{model_name}", "MyModel", [], {})
        assert result == "MyModel"

    def test_mixed_text_and_token(self):
        result = resolve_variable("prefix_{model_name}_suffix", "M1", [], {})
        assert result == "prefix_M1_suffix"

    def test_multiple_tokens(self):
        per_run = {"project": "PRJ"}
        result = resolve_variable("{project}/{model_name}", "M1", [], per_run)
        assert result == "PRJ/M1"

    def test_unknown_token_preserved(self):
        result = resolve_variable("{unknown_var}", "M", [], {})
        assert result == "{unknown_var}"


class TestPerModelVariable:
    def test_per_model_substitution(self):
        variables = [
            {"name": "output_path", "value": "C:\\out\\{model_name}", "scope": "per-model"}
        ]
        result = resolve_variable("output_path", "Bridge-01", variables, {})
        assert result == "C:\\out\\Bridge-01"


class TestRecursionGuard:
    def test_self_referencing_variable_does_not_loop(self):
        """A variable that references itself should not cause infinite recursion."""
        variables = [{"name": "a", "value": "{a}", "scope": "per-model"}]
        # Should return without hanging — the exact value doesn't matter,
        # just that it terminates.
        result = resolve_variable("a", "M", variables, {})
        assert isinstance(result, str)

    def test_unknown_returns_as_is(self):
        result = resolve_variable("not_a_var", "M", [], {})
        assert result == "not_a_var"
