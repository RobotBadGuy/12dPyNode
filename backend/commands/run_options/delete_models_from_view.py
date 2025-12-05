"""
Generate Delete models from view Run_option command
"""
from typing import List, Tuple


def delete_models_from_view_command(
    modified_variable: str,
    coordinates: Tuple[int, int] = None,
    continue_on_failure: bool = True
) -> List[str]:
    """
    Generate Delete models from view Run_option XML command
    
    Args:
        modified_variable: View name (variable with spaces instead of hyphens)
        coordinates: Tuple of (x, y) panel coordinates. Defaults to Model coordinates (497, 319)
                    For TIN, use (241, 386)
        continue_on_failure: Whether to continue on failure. Default True for Model, False for TIN
    
    Returns:
        List of XML lines for Delete models from view Run_option command
    """
    if coordinates is None:
        # Default Model coordinates
        x, y = 497, 319
    else:
        x, y = coordinates
    
    return [
        '      <Run_option>',
        '        <Name>Delete models from view</Name>',
        '        <Active>true</Active>',
        f'        <Continue_on_failure>{"true" if continue_on_failure else "false"}</Continue_on_failure>',
        '        <Uses_parameters>false</Uses_parameters>',
        '        <Interactive>false</Interactive>',
        '        <Comments>',
        '        </Comments>',
        '        <SLF_data>',
        '          <screen_layout>',
        '            <version>1.0</version>',
        '            <panel>',
        '              <name>Delete</name>',
        f'              <x>{x}</x>',
        f'              <y>{y}</y>',
        '              <source_box>',
        '                <name>Data to delete</name>',
        '                <mode>Source_Box_View</mode>',
        '                <input_box>',
        '                  <name>Data to delete - View</name>',
        f'                  <value>{modified_variable}</value>',
        '                </input_box>',
        '              </source_box>',
        '              <input_box>',
        '                <name>Delete mode</name>',
        '                <value>Split</value>',
        '              </input_box>',
        '              <target_box>',
        '                <name>Target</name>',
        '                <mode>Target_Box_Copy_To_One_Model</mode>',
        '                <input_box>',
        '                  <name>Target - Copy to model</name>',
        '                  <value/>',
        '                </input_box>',
        '              </target_box>',
        '              <run_button>',
        '                <name>Delete</name>',
        '              </run_button>',
        '            </panel>',
        '          </screen_layout>',
        '        </SLF_data>',
        '        <Parameter_Mappings>',
        '        </Parameter_Mappings>',
        '      </Run_option>'
    ]



