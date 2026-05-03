"""
Tests for commands/functions — function_command.
"""
from commands.functions import function_command


class TestFunctionCommand:
    def test_returns_list(self):
        result = function_command("Run MyFunc", "MyFunc")
        assert isinstance(result, list)
        assert len(result) > 0

    def test_command_name(self):
        result = function_command("Custom Command", "func_name")
        joined = '\n'.join(result)
        assert '<Name>Custom Command</Name>' in joined

    def test_function_name(self):
        result = function_command("cmd", "target_function")
        joined = '\n'.join(result)
        assert '<Function>target_function</Function>' in joined

    def test_continue_on_failure(self):
        result = function_command("cmd", "fn", continue_on_failure=False)
        joined = '\n'.join(result)
        assert '<Continue_on_failure>false</Continue_on_failure>' in joined

    def test_wrapper_tags(self):
        result = function_command("cmd", "fn")
        assert '<Function>' in result[0]
        assert '</Function>' in result[-1]
