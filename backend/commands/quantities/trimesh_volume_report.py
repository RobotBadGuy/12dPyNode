"""
Generate Trimesh Volume Report command
"""
from typing import List


def trimesh_volume_report_command(
    trimesh_name: str,
    output_location: str,
    filename: str,
    command_name: str = 'Trimesh Volume Report',
    continue_on_failure: bool = True,
    comments: str = ""
) -> List[str]:
    """
    Generate Trimesh Volume and Area Report XML command
    
    Args:
        trimesh_name: Name of the trimesh model
        output_location: Output directory for the report file
        filename: Filename for the report (without extension)
        command_name: Name of the command (default: 'Trimesh Volume Report')
        continue_on_failure: Whether the command should continue on failure (default: True)
        comments: Optional comments for the command
    
    Returns:
        List of XML lines for Trimesh Volume Report command
    """
    failure_str = 'true' if continue_on_failure else 'false'
    return [
        '      <Run_option>',
        f'        <Name>{command_name}</Name>',
        '        <Active>true</Active>',
        f'        <Continue_on_failure>{failure_str}</Continue_on_failure>',
        '        <Uses_parameters>false</Uses_parameters>',
        '        <Interactive>false</Interactive>',
        '        <Comments>',
        f'          <Comment>{comments}</Comment>',
        '        </Comments>',
        '        <SLF_data>',
        '          <screen_layout>',
        '            <version>1.0</version>',
        '            <panel>',
        '              <name>Trimesh Volume and Area Report</name>',
        '              <x>608</x>',
        '              <y>156</y>',
        '              <resize>',
        '                <width>1.41530055</width>',
        '                <height>1.30215827</height>',
        '              </resize>',
        '              <source_box>',
        '                <name>Data source for trimeshes</name>',
        '                <mode>Source_Box_Models</mode>',
        '                <grid_box>',
        '                  <name>Models</name>',
        '                  <columns>',
        '                    <column>Model</column>',
        '                  </columns>',
        '                  <data>',
        '                    <r>',
        f'                      <c>{trimesh_name}</c>',
        '                    </r>',
        '                  </data>',
        '                </grid_box>',
        '              </source_box>',
        '              <tick_box>',
        '                <name>Individual trimesh</name>',
        '                <value>false</value>',
        '              </tick_box>',
        '              <tick_box>',
        '                <name>Sum by model</name>',
        '                <value>false</value>',
        '              </tick_box>',
        '              <tick_box>',
        '                <name>Sum by name*</name>',
        '                <value>true</value>',
        '              </tick_box>',
        '              <tick_box>',
        '                <name>Sum by name* and model</name>',
        '                <value>false</value>',
        '              </tick_box>',
        '              <tick_box>',
        '                <name>Use pattern match replace</name>',
        '                <value>false</value>',
        '              </tick_box>',
        '              <input_box>',
        '                <name>Pattern</name>',
        '                <value />',
        '              </input_box>',
        '              <input_box>',
        '                <name>Replace</name>',
        '                <value />',
        '              </input_box>',
        '              <input_box>',
        '                <name>Report type</name>',
        '                <value>html report</value>',
        '              </input_box>',
        '              <file_box>',
        '                <name>Report file</name>',
        f'                <value>{output_location}\\{filename}.html</value>',
        '              </file_box>',
        '              <run_button>',
        '                <name>Report</name>',
        '              </run_button>',
        '            </panel>',
        '          </screen_layout>',
        '          ',
        '        </SLF_data>',
        '        <Parameter_Mappings>',
        '        </Parameter_Mappings>',
        '      </Run_option>'
    ]
