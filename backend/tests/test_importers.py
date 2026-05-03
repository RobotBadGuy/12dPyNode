"""
Tests for commands/importers — IFC, DWG, DGN XML content generators.
"""
from commands.importers import (
    generate_ifc_xml_content,
    generate_dwg_xml_content,
    generate_dgn_xml_content,
    normalize_file_path,
)


class TestNormalizeFilePath:
    def test_replaces_en_dash(self):
        assert normalize_file_path("path\u2013file") == "path-file"

    def test_returns_none_for_none(self):
        assert normalize_file_path(None) is None

    def test_preserves_normal_path(self):
        assert normalize_file_path("C:\\folder\\file.dwg") == "C:\\folder\\file.dwg"


class TestIfcImporter:
    def test_returns_list(self):
        result = generate_ifc_xml_content("C:\\test.ifc", "prefix_*")
        assert isinstance(result, list)
        assert len(result) > 0

    def test_run_option_wrapper(self):
        result = generate_ifc_xml_content("C:\\test.ifc", "p")
        assert '<Run_option>' in result[0]
        assert '</Run_option>' in result[-1]

    def test_ifc_express_reader_name(self):
        result = generate_ifc_xml_content("C:\\test.ifc", "p")
        joined = '\n'.join(result)
        assert '<Name>IFC Express Reader</Name>' in joined

    def test_contains_file_path(self):
        result = generate_ifc_xml_content("C:\\data\\model.ifc", "p")
        joined = '\n'.join(result)
        assert 'model.ifc' in joined

    def test_contains_prefix(self):
        result = generate_ifc_xml_content("C:\\test.ifc", "MY_PREFIX*")
        joined = '\n'.join(result)
        assert '<value>MY_PREFIX*</value>' in joined


class TestDwgImporter:
    def test_returns_list(self):
        result = generate_dwg_xml_content("C:\\test.dwg", "prefix_*")
        assert isinstance(result, list)
        assert len(result) > 0

    def test_read_dwg_name(self):
        result = generate_dwg_xml_content("C:\\test.dwg", "p")
        joined = '\n'.join(result)
        assert '<Name>Read DWG/DXF Data</Name>' in joined

    def test_contains_file_path(self):
        result = generate_dwg_xml_content("C:\\data\\drawing.dwg", "p")
        joined = '\n'.join(result)
        assert 'drawing.dwg' in joined


class TestDgnImporter:
    def test_returns_list(self):
        result = generate_dgn_xml_content("C:\\test.dgn", "prefix_*")
        assert isinstance(result, list)
        assert len(result) > 0

    def test_contains_file_path(self):
        result = generate_dgn_xml_content("C:\\data\\survey.dgn", "p")
        joined = '\n'.join(result)
        assert 'survey.dgn' in joined
