"""
Generate Create Trimesh from TIN command
"""
from typing import List


def create_trimesh_from_tin_command(
    prefix: str,
    cell_value: str,
    trimesh_name: str,
    tin_name: str,
    z_offset: str,
    depth: str,
    colour: str
) -> List[str]:
    """
    Generate Create Trimesh from TIN XML command
    
    Args:
        prefix: Prefix for the model
        cell_value: Cell value for naming
        trimesh_name: Name for the trimesh
        tin_name: Name of the TIN to convert
        z_offset: Z offset of trimesh
        depth: Depth of trimesh
        colour: Colour for trimesh
    
    Returns:
        List of XML lines for Create Trimesh from TIN command
    """
    return [
        '      <Run_option>',
        f'        <Name>{trimesh_name}</Name>',
        '        <Active>true</Active>',
        '        <Continue_on_failure>false</Continue_on_failure>',
        '        <Uses_parameters>false</Uses_parameters>',
        '        <Interactive>false</Interactive>',
        '        <Comments>',
        '        </Comments>',
        '        <SLF_data>',
        '          <screen_layout>',
        '            <version>1.0</version>',
        '            <panel>',
        '              <name>Trimesh from Tin</name>',
        '              <x>1280</x>',
        '              <y>429</y>',
        '              <resize>',
        '                <width>1.47311828</width>',
        '                <height>1</height>',
        '              </resize>',
        '              <input_box>',
        '                <name>Tin to convert</name>',
        f'                <value>{tin_name}</value>',
        '              </input_box>',
        '              <input_box>',
        '                <name>Name for trimesh</name>',
        f'                <value>{trimesh_name}</value>',
        '              </input_box>',
        '              <input_box>',
        '                <name>Model for trimesh</name>',
        f'                <value>{prefix}/{cell_value}</value>',
        '              </input_box>',
        '              <input_box>',
        '                <name>Z offset of trimesh</name>',
        f'                <value>{z_offset}</value>',
        '              </input_box>',
        '              <input_box>',
        '                <name>Depth of trimesh</name>',
        f'                <value>{depth}</value>',
        '              </input_box>',
        '              <tick_box>',
        '                <name>Use tin colour</name>',
        '                <value>false</value>',
        '              </tick_box>',
        '              <input_box>',
        '                <name>Colour for trimesh</name>',
        f'                <value>{colour}</value>',
        '              </input_box>',
        '              <run_button>',
        '                <name>Create</name>',
        '              </run_button>',
        '            </panel>',
        '          </screen_layout>',
        '        </SLF_data>',
        '        <Parameter_Mappings>',
        '        </Parameter_Mappings>',
        '      </Run_option>'
    ]
