"""
Tests for commands/trimesh — create_trimesh_from_tin.
"""
from commands.trimesh import create_trimesh_from_tin_command


class TestCreateTrimeshFromTin:
    def test_returns_list(self):
        result = create_trimesh_from_tin_command(
            "PREFIX", "cell", "tm_name", "tin_name", "0", "1", "red"
        )
        assert isinstance(result, list)
        assert len(result) > 0

    def test_contains_tin_name(self):
        result = create_trimesh_from_tin_command(
            "P", "C", "TM", "my_tin", "0", "1", "blue"
        )
        joined = '\n'.join(result)
        assert '<value>my_tin</value>' in joined

    def test_contains_trimesh_name(self):
        result = create_trimesh_from_tin_command(
            "P", "C", "my_trimesh", "tin", "0", "1", "blue"
        )
        joined = '\n'.join(result)
        assert '<value>my_trimesh</value>' in joined

    def test_contains_colour(self):
        result = create_trimesh_from_tin_command(
            "P", "C", "TM", "T", "0", "1", "magenta"
        )
        joined = '\n'.join(result)
        assert '<value>magenta</value>' in joined

    def test_contains_model_path(self):
        result = create_trimesh_from_tin_command(
            "MyPrefix", "CellVal", "TM", "T", "0", "1", "red"
        )
        joined = '\n'.join(result)
        assert '<value>MyPrefix/CellVal</value>' in joined

    def test_run_option_wrapper(self):
        result = create_trimesh_from_tin_command(
            "P", "C", "TM", "T", "0", "1", "red"
        )
        assert '<Run_option>' in result[0]
        assert '</Run_option>' in result[-1]
