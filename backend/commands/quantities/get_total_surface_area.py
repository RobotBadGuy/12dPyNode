"""
Generate Get Total Surface Area command
"""
from typing import List


def get_total_surface_area_command(
    command_name: str,
    export_location: str,
    tin_name: str,
    polygon_name: str,
    continue_on_failure: bool = True,
    comments: str = ""
) -> List[str]:
    failure_str = 'true' if continue_on_failure else 'false'
    """
    Generate Get Total Surface Area XML command
    
    Args:
        command_name: name of command
        export_location: Location to export the report file
        tin_name: Name of the TIN
        polygon_name: Name of the polygon
        continue_on_failure: Continue on failure
        comments: Comments
    
    Returns:
        List of XML lines for Get Total Surface Area command
    """
    return [
        '      <Run_option>',
        f'        <Name>{command_name}</Name>',
        f'        <Active>true</Active>',
        f'        <Continue_on_failure>{failure_str}</Continue_on_failure>',
        f'        <Uses_parameters>false</Uses_parameters>',
        f'        <Interactive>false</Interactive>',
        f'        <Comments>{comments}</Comments>',
        '        <SLF_data>',
        '          <screen_layout>',
        '            <version>1.0</version>',
        '            <panel>',
        '              <name>Surface Area Within a Polygon</name>',
        '              <x>1320</x>',
        '              <y>377</y>',
        '              <resize>',
        '                <width>1.38857143</width>',
        '                <height>1</height>',
        '              </resize>',
        '              <input_box>',
        '                <name>Tin</name>',
        f'                <value>{tin_name}</value>',
        '              </input_box>',
        '              <input_box>',
        '                <name>Report type</name>',
        '                <value>html report</value>',
        '              </input_box>',
        '              <file_box>',
        '                <name>Report file</name>',
        f'                <value>{export_location}</value>',
        '              </file_box>',
        '              <polygon_box>',
        '                <name>&amp;Poly</name>',
        '              </polygon_box>',
        '              <run_button>',
        '                <name>&amp;Area</name>',
        '              </run_button>',
        '            </panel>',
        '          </screen_layout>',
        '        </SLF_data>',
        '        <Parameter_Mappings>',
        '        </Parameter_Mappings>',
        '      </Run_option>'
    ]
