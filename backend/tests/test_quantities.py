"""
Tests for commands/quantities — surface_area, trimesh_volume, volume_tin_to_tin.
"""
from commands.quantities import (
    get_total_surface_area_command,
    trimesh_volume_report_command,
    volume_tin_to_tin_command,
)


class TestGetTotalSurfaceArea:
    def test_returns_list(self):
        result = get_total_surface_area_command(
            "Get Surface Area", "C:\\export", "my_tin", "my_poly"
        )
        assert isinstance(result, list)
        assert len(result) > 0

    def test_contains_tin_name(self):
        result = get_total_surface_area_command("cmd", "loc", "THE_TIN", "poly")
        joined = '\n'.join(result)
        assert '<value>THE_TIN</value>' in joined

    def test_contains_export_location(self):
        result = get_total_surface_area_command("cmd", "C:\\reports\\out.html", "t", "p")
        joined = '\n'.join(result)
        assert 'C:\\reports\\out.html' in joined

    def test_run_option_wrapper(self):
        result = get_total_surface_area_command("cmd", "loc", "t", "p")
        assert '<Run_option>' in result[0]
        assert '</Run_option>' in result[-1]


class TestTrimeshVolumeReport:
    def test_returns_list(self):
        result = trimesh_volume_report_command("tm_name", "C:\\out", "report")
        assert isinstance(result, list)
        assert len(result) > 0

    def test_contains_trimesh_name(self):
        result = trimesh_volume_report_command("my_trimesh", "loc", "f")
        joined = '\n'.join(result)
        assert 'my_trimesh' in joined


class TestVolumeTinToTin:
    def test_returns_list(self):
        result = volume_tin_to_tin_command("orig", "new", "C:\\out", "report")
        assert isinstance(result, list)
        assert len(result) > 0

    def test_contains_tin_names(self):
        result = volume_tin_to_tin_command("original_tin", "new_tin", "loc", "f")
        joined = '\n'.join(result)
        assert 'original_tin' in joined
        assert 'new_tin' in joined
