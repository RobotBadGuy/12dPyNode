"""
Tests for commands/conditionals — if_function_exists, add_comment, add_label.
"""
from commands.conditionals import (
    if_function_exists_command,
    add_comment_command,
    add_label_command,
)


class TestIfFunctionExists:
    def test_returns_list(self):
        result = if_function_exists_command("my_func", "pass_label", "fail_label")
        assert isinstance(result, list)
        assert len(result) > 0

    def test_contains_function_name(self):
        result = if_function_exists_command("my_func", "pl", "fl")
        joined = '\n'.join(result)
        assert '<Function>my_func</Function>' in joined

    def test_contains_pass_fail_labels(self):
        result = if_function_exists_command("fn", "on_pass", "on_fail")
        joined = '\n'.join(result)
        assert '<Pass_Action>on_pass</Pass_Action>' in joined
        assert '<Fail_Action>on_fail</Fail_Action>' in joined

    def test_conditional_block(self):
        result = if_function_exists_command("fn", "p", "f")
        joined = '\n'.join(result)
        assert '<Conditional>' in joined
        assert '</Conditional>' in joined

    def test_opening_closing_tags(self):
        result = if_function_exists_command("fn", "p", "f")
        assert '<If_function_exists>' in result[0]
        assert '</If_function_exists>' in result[-1]


class TestAddComment:
    def test_returns_list(self):
        result = add_comment_command("My Comment")
        assert isinstance(result, list)

    def test_comment_name(self):
        result = add_comment_command("Section A")
        joined = '\n'.join(result)
        assert '<Name>Section A</Name>' in joined

    def test_wrapper_tags(self):
        result = add_comment_command("C")
        assert '<Comment>' in result[0]
        assert '</Comment>' in result[-1]


class TestAddLabel:
    def test_returns_list(self):
        result = add_label_command("Label1")
        assert isinstance(result, list)

    def test_label_name(self):
        result = add_label_command("start_section")
        joined = '\n'.join(result)
        assert '<Name>start_section</Name>' in joined

    def test_wrapper_tags(self):
        result = add_label_command("L")
        assert '<Label>' in result[0]
        assert '</Label>' in result[-1]

    def test_continue_on_failure(self):
        result = add_label_command("L", continue_on_failure=False)
        joined = '\n'.join(result)
        assert '<Continue_on_failure>false</Continue_on_failure>' in joined
