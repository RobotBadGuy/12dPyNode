"""
Tests for commands/views — create_view, add_model_to_view, remove_model, delete_models.
"""
from commands.views import (
    create_view_command,
    add_model_to_view_command,
    remove_model_from_view_command,
    delete_models_from_view_command,
)


class TestCreateView:
    def test_returns_list(self):
        result = create_view_command("Test View")
        assert isinstance(result, list)
        assert len(result) > 0

    def test_contains_view_name(self):
        result = create_view_command("My View")
        joined = '\n'.join(result)
        assert '<View>My View</View>' in joined
        assert '<Name>Create view My View</Name>' in joined

    def test_default_coordinates(self):
        result = create_view_command("V")
        joined = '\n'.join(result)
        assert '<Top>40</Top>' in joined
        assert '<Left>30</Left>' in joined
        assert '<Bot>565</Bot>' in joined
        assert '<Right>715</Right>' in joined

    def test_custom_coordinates(self):
        result = create_view_command("V", coordinates=(130, 120, 640, 790))
        joined = '\n'.join(result)
        assert '<Top>130</Top>' in joined
        assert '<Left>120</Left>' in joined

    def test_continue_on_failure_true(self):
        result = create_view_command("V", continue_on_failure=True)
        joined = '\n'.join(result)
        assert '<Continue_on_failure>true</Continue_on_failure>' in joined

    def test_continue_on_failure_false(self):
        result = create_view_command("V", continue_on_failure=False)
        joined = '\n'.join(result)
        assert '<Continue_on_failure>false</Continue_on_failure>' in joined

    def test_comments(self):
        result = create_view_command("V", comments="test comment")
        joined = '\n'.join(result)
        assert '<Comments>test comment</Comments>' in joined


class TestAddModelToView:
    def test_contains_model_and_view(self):
        result = add_model_to_view_command("ModelA", "ViewB")
        joined = '\n'.join(result)
        assert '<Model>ModelA</Model>' in joined
        assert '<View>ViewB</View>' in joined
        assert 'Add model ModelA to view ViewB' in joined

    def test_failure_flag(self):
        result = add_model_to_view_command("M", "V", continue_on_failure=False)
        joined = '\n'.join(result)
        assert '<Continue_on_failure>false</Continue_on_failure>' in joined


class TestRemoveModelFromView:
    def test_returns_list(self):
        result = remove_model_from_view_command("*", "my_view")
        assert isinstance(result, list)
        assert len(result) > 0


class TestDeleteModelsFromView:
    def test_returns_list(self):
        result = delete_models_from_view_command("my_view")
        assert isinstance(result, list)
        assert len(result) > 0
