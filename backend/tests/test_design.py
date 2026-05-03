"""
Tests for commands/design — apply_mtf, create_mtf_file, create_template.
"""
import os
from commands.design import apply_mtf_command
from commands.design.create_mtf_file import create_mtf_file
from commands.design.create_template_file import create_template


class TestApplyMtf:
    def test_returns_list(self):
        result = apply_mtf_command("my_function")
        assert isinstance(result, list)
        assert len(result) > 0

    def test_recalc_name(self):
        result = apply_mtf_command("road_function")
        joined = '\n'.join(result)
        assert '<Name>Recalc road_function</Name>' in joined

    def test_function_element(self):
        result = apply_mtf_command("road_function")
        joined = '\n'.join(result)
        assert '<Function>road_function</Function>' in joined

    def test_wrapper_tags(self):
        result = apply_mtf_command("fn")
        assert '<Function>' in result[0]
        assert '</Function>' in result[-1]


class TestCreateMtfFile:
    def test_creates_mtf_file(self, tmp_path):
        os.chdir(tmp_path)
        create_mtf_file("test_mtf", "LeftTemplate", "RightTemplate")
        mtf_path = tmp_path / "test_mtf.mtf"
        assert mtf_path.exists()

    def test_mtf_content_contains_template_names(self, tmp_path):
        os.chdir(tmp_path)
        create_mtf_file("test_mtf", "Left_TPL", "Right_TPL")
        content = (tmp_path / "test_mtf.mtf").read_text()
        # Note: left_side_modifier contains the RIGHT template and vice versa
        assert 'Left_TPL' in content
        assert 'Right_TPL' in content

    def test_mtf_file_has_sections(self, tmp_path):
        os.chdir(tmp_path)
        create_mtf_file("test_mtf", "L", "R")
        content = (tmp_path / "test_mtf.mtf").read_text()
        assert 'left_side' in content
        assert 'right_side' in content
        assert 'hinge_modifier' in content


class TestCreateTemplate:
    def test_creates_tpl_file(self, tmp_path):
        create_template("test_tpl", output_dir=str(tmp_path))
        assert (tmp_path / "test_tpl.tpl").exists()

    def test_strips_tpl_suffix(self, tmp_path):
        create_template("test_tpl.tpl", output_dir=str(tmp_path))
        assert (tmp_path / "test_tpl.tpl").exists()
        # Should not create test_tpl.tpl.tpl
        assert not (tmp_path / "test_tpl.tpl.tpl").exists()

    def test_template_content_has_slopes(self, tmp_path):
        create_template("test_tpl", final_cut_slope="3", final_fill_slope="4",
                        final_search_distance="50", output_dir=str(tmp_path))
        content = (tmp_path / "test_tpl.tpl").read_text(encoding='utf-16')
        assert 'cut_slope 3' in content
        assert 'fill_slope 4' in content
        assert 'search_distance 50' in content
