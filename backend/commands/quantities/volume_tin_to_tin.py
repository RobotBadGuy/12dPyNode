"""
Generate Volume TIN to TIN command
"""
from typing import List


def volume_tin_to_tin_command(
    original_tin_name: str,
    new_tin_name: str,
    output_location: str,
    filename: str,
    command_name: str = 'Volume TIN to TIN',
    comments: str = ''
) -> List[str]:
    """
    Generate Exact Volume Between Tins XML command
    
    Args:
        original_tin_name: Name of the original TIN
        new_tin_name: Name of the new TIN
        output_location: Output directory for the report file
        filename: Filename for the report (without extension)
        command_name: Name of the command (default: 'Volume TIN to TIN')
        comments: Optional comments for the command
    
    Returns:
        List of XML lines for Volume TIN to TIN command
    """
    return [
        '      <Run_option>',
        f'        <Name>{command_name}</Name>',
        '        <Active>true</Active>',
        '        <Continue_on_failure>false</Continue_on_failure>',
        '        <Uses_parameters>false</Uses_parameters>',
        '        <Interactive>false</Interactive>',
        '        <Comments>',
        f'          <Comment>{comments}</Comment>',
        '        </Comments>',
        '        <SLF_data>',
        '          <screen_layout>',
        '            <version>1.0</version>',
        '            <panel>',
        '              <name>Exact Volume Between Tins</name>',
        '              <x>843</x>',
        '              <y>383</y>',
        '              <resize>',
        '                <width>1.53753754</width>',
        '                <height>1</height>',
        '              </resize>',
        '              <input_box>',
        '                <name>Original tin</name>',
        f'                <value>{original_tin_name}</value>',
        '              </input_box>',
        '              <input_box>',
        '                <name>New tin</name>',
        f'                <value>{new_tin_name}</value>',
        '              </input_box>',
        '              <file_box>',
        '                <name>Range file</name>',
        '                <value />',
        '              </file_box>',
        '              <input_box>',
        '                <name>Plan view to paint</name>',
        '                <value />',
        '              </input_box>',
        '              <input_box>',
        '                <name>Model for faces</name>',
        '                <value />',
        '              </input_box>',
        '              <tick_box>',
        '                <name>Clean faces model beforehand</name>',
        '                <value>false</value>',
        '              </tick_box>',
        '              <input_box>',
        '                <name>Report type</name>',
        '                <value>html report</value>',
        '              </input_box>',
        '              <file_box>',
        '                <name>Report file</name>',
        f'                <value>{output_location}\\{filename}.html</value>',
        '              </file_box>',
        '              <tick_box>',
        '                <name>Use a polygon</name>',
        '                <value>true</value>',
        '              </tick_box>',
        '              <polygon_box>',
        '                <name>Polygon</name>',
        '              </polygon_box>',
        '              <tick_box>',
        '                <name>Use a model of polygons</name>',
        '                <value>false</value>',
        '              </tick_box>',
        '              <input_box>',
        '                <name>Model</name>',
        '                <value />',
        '              </input_box>',
        '              <run_button>',
        '                <name>&amp;Volume</name>',
        '              </run_button>',
        '            </panel>',
        '          </screen_layout>',
        '          ',
        '        </SLF_data>',
        '        <Parameter_Mappings>',
        '        </Parameter_Mappings>',
        '      </Run_option>'
    ]
