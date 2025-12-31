"""
Generate Get Total Surface Area command
"""
from typing import List


def get_total_surface_area_command(export_location: str, tin_name: str, polygon_name: str) -> List[str]:
    """
    Generate Surface Area Within a Polygon XML command
    
    Args:
        export_location: Export location for the report file
        tin_name: Name of the TIN
        polygon_name: Name of the polygon
    
    Returns:
        List of XML lines for Get Total Surface Area command
    """
    return [
        '      <Run_option>',
        '        <Name>FS Finished Surface Total Surface Area</Name>',
        '        <Active>true</Active>',
        '        <Continue_on_failure>false</Continue_on_failure>',
        '        <Uses_parameters>false</Uses_parameters>',
        '        <Interactive>false</Interactive>',
        '        <Comments>',
        '        </Comments>',
        '        <SLF_data>',
        '        <screen_layout>',
        '            <version>1.0</version>',
        '            <panel>',
        '            <name>Surface Area Within a Polygon</name>',
        '            <x>1320</x>',
        '            <y>377</y>',
        '            <resize>',
        '                <width>1.38857143</width>',
        '                <height>1</height>',
        '            </resize>',
        '            <input_box>',
        '                <name>Tin</name>',
        f'                <value>{tin_name}</value>',
        '            </input_box>',
        '            <input_box>',
        '                <name>Report type</name>',
        '                <value>html report</value>',
        '            </input_box>',
        '            <file_box>',
        '                <name>Report file</name>',
        f'                <value>{export_location}</value>',
        '            </file_box>',
        '            <polygon_box>',
        '                <name>&amp;Poly</name>',
        '            </polygon_box>',
        '            <run_button>',
        '                <name>&amp;Area</name>',
        '            </run_button>',
        '            </panel>',
        '        </screen_layout>',
        '        </SLF_data>',
        '        <Parameter_Mappings>',
        '        </Parameter_Mappings>',
        '      </Run_option>'
    ]
