"""
Tests for commands/models — clean_model, rename_model.
"""
from commands.models import clean_model_command, rename_model_command


class TestCleanModel:
    def test_returns_single_line(self):
        result = clean_model_command("Clean model", "TestModel", "no comment")
        assert isinstance(result, list)
        assert len(result) == 1

    def test_xml_structure(self):
        result = clean_model_command("Clean model", "TestModel", "")
        line = result[0]
        assert line.startswith('<Clean_model>')
        assert line.endswith('</Clean_model>')

    def test_contains_model_name(self):
        result = clean_model_command("Clean model", "My Model", "")
        assert '<Model_Name>My Model</Model_Name>' in result[0]

    def test_contains_command_name(self):
        result = clean_model_command("Custom Name", "M", "")
        assert '<Name>Custom Name</Name>' in result[0]

    def test_continue_on_failure_true(self):
        result = clean_model_command("C", "M", "", continue_on_failure=True)
        assert '<Continue_on_failure>true</Continue_on_failure>' in result[0]

    def test_continue_on_failure_false(self):
        result = clean_model_command("C", "M", "", continue_on_failure=False)
        assert '<Continue_on_failure>false</Continue_on_failure>' in result[0]

    def test_comments(self):
        result = clean_model_command("C", "M", "my comment")
        assert '<Comments>my comment</Comments>' in result[0]


class TestRenameModel:
    def test_returns_list(self):
        result = rename_model_command("Rename", "NEW_*", "OLD_*", True, "")
        assert isinstance(result, list)
        assert len(result) > 1

    def test_contains_pattern_search(self):
        result = rename_model_command("Rename", "NEW_*", "OLD_*", True, "")
        joined = '\n'.join(result)
        assert '<value>OLD_*</value>' in joined

    def test_contains_pattern_replace(self):
        result = rename_model_command("Rename", "NEW_*", "OLD_*", True, "")
        joined = '\n'.join(result)
        assert '<value>NEW_*</value>' in joined

    def test_manual_option_wrapper(self):
        result = rename_model_command("Rename", "A", "B", True, "")
        assert result[0].strip().startswith('<Manual_option>')
        assert result[-1].strip().endswith('</Manual_option>')
