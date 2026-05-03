"""
Tests for commands/metadata — xml_header, chain_wrapper, meta_data.
"""
import re
from commands.metadata import (
    generate_xml_header,
    generate_chain_wrapper,
    generate_chain_settings,
    generate_chain_closing,
    generate_meta_data_tin,
    generate_meta_data_model,
)


# ── xml_header ──────────────────────────────────────────────────────────

class TestGenerateXmlHeader:
    def test_returns_list_of_two_lines(self):
        result = generate_xml_header()
        assert isinstance(result, list)
        assert len(result) == 2

    def test_xml_declaration(self):
        result = generate_xml_header()
        assert result[0] == '<?xml version="1.0"?>'

    def test_dynamic_date_time_defaults(self):
        """When called with no args, date and time should be today's values, not hardcoded."""
        result = generate_xml_header()
        joined = result[1]
        # Should contain a date= attribute in YYYY-MM-DD format
        assert re.search(r'date="\d{4}-\d{2}-\d{2}"', joined)
        # Should contain a time= attribute in HH:MM:SS format
        assert re.search(r'time="\d{2}:\d{2}:\d{2}"', joined)

    def test_explicit_date_time(self):
        result = generate_xml_header(date="2025-01-01", time="12:00:00")
        joined = result[1]
        assert 'date="2025-01-01"' in joined
        assert 'time="12:00:00"' in joined

    def test_namespace_declarations(self):
        result = generate_xml_header()
        joined = result[1]
        assert 'xmlns="http://www.12d.com/schema/xml12d-10.0"' in joined
        assert 'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"' in joined


# ── chain_wrapper / settings / closing ──────────────────────────────────

class TestChainWrapper:
    def test_wrapper_opens_chain(self):
        result = generate_chain_wrapper()
        assert any('<Chain>' in line for line in result)
        assert any('<version>1</version>' in line for line in result)

    def test_settings_structure(self):
        result = generate_chain_settings()
        joined = '\n'.join(result)
        assert '<Settings>' in joined
        assert '</Settings>' in joined
        assert '<Commands>' in joined

    def test_closing_tags(self):
        result = generate_chain_closing()
        joined = '\n'.join(result)
        assert '</Commands>' in joined
        assert '</Chain>' in joined
        assert '</xml12d>' in joined


# ── meta_data ───────────────────────────────────────────────────────────

class TestMetaDataTin:
    def test_contains_project_folder(self):
        result = generate_meta_data_tin("C:\\Projects\\Test", "my_model")
        joined = '\n'.join(result)
        assert '<project_folder>C:\\Projects\\Test</project_folder>' in joined

    def test_contains_export_file_name(self):
        result = generate_meta_data_tin("", "my_model")
        joined = '\n'.join(result)
        assert '<export_file_name>my_model Chain.chain</export_file_name>' in joined

    def test_contains_units(self):
        result = generate_meta_data_tin("", "model")
        joined = '\n'.join(result)
        assert '<linear>metre</linear>' in joined

    def test_project_name_is_project(self):
        """TIN meta_data uses project_name 'Project'."""
        result = generate_meta_data_tin("", "m")
        joined = '\n'.join(result)
        assert '<project_name>Project</project_name>' in joined


class TestMetaDataModel:
    def test_contains_project_folder(self):
        result = generate_meta_data_model("D:\\Work", "test_var")
        joined = '\n'.join(result)
        assert '<project_folder>D:\\Work</project_folder>' in joined

    def test_contains_export_file_name(self):
        result = generate_meta_data_model("", "test_var")
        joined = '\n'.join(result)
        assert '<export_file_name>test_var Chain.chain</export_file_name>' in joined

    def test_project_name_is_master(self):
        """Model meta_data uses project_name 'Master'."""
        result = generate_meta_data_model("", "m")
        joined = '\n'.join(result)
        assert '<project_name>Master</project_name>' in joined
