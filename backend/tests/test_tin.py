"""
Tests for commands/tin — triangulate_manual_option, tin_function, contours, drape.
"""
from commands.tin import (
    triangulate_manual_option_command,
    tin_function_command,
    create_contour_smooth_label_command,
    drape_strings_to_tin_command,
    run_or_create_contours_command,
)


class TestTriangulateManualOption:
    def test_returns_list(self):
        result = triangulate_manual_option_command(
            "my var", "PRE", "surface", "dwg", "opt", "DIS"
        )
        assert isinstance(result, list)
        assert len(result) > 0

    def test_contains_variable(self):
        result = triangulate_manual_option_command(
            "my var", "PRE", "surface", "dwg", "opt", "DIS"
        )
        joined = '\n'.join(result)
        assert 'my var' in joined


class TestTinFunction:
    def test_returns_label_and_function(self):
        result = tin_function_command("my model")
        joined = '\n'.join(result)
        assert '<Label>' in joined
        assert '<Function>' in joined

    def test_function_name_contains_variable(self):
        result = tin_function_command("test model")
        joined = '\n'.join(result)
        assert '<Function>test model tin</Function>' in joined

    def test_recalc_name(self):
        result = tin_function_command("test model")
        joined = '\n'.join(result)
        assert '<Name>Recalc test model tin</Name>' in joined


class TestCreateContourSmoothLabel:
    def test_returns_list(self):
        result = create_contour_smooth_label_command("prefix", "cell_val")
        assert isinstance(result, list)
        assert len(result) > 0


class TestDrapeStringsToTin:
    def test_returns_list(self):
        result = drape_strings_to_tin_command("data", "0", "tin_name")
        assert isinstance(result, list)
        assert len(result) > 0

    def test_contains_tin_name(self):
        result = drape_strings_to_tin_command("data", "0", "my_tin")
        joined = '\n'.join(result)
        assert 'my_tin' in joined


class TestRunOrCreateContours:
    def test_returns_list(self):
        result = run_or_create_contours_command("prefix", "cell_val")
        assert isinstance(result, list)
        assert len(result) > 0
