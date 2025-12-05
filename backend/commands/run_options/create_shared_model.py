"""
Generate Create shared model Run_option command
"""
from typing import List


def create_shared_model_command(
    discipline: str,
    prefix: str,
    description: str,
    object_dimension: str,
    file_ext: str,
    variable: str,
    modified_variable: str
) -> List[str]:
    """
    Generate Create shared model Run_option XML command (in single-line format)
    
    Args:
        discipline: Discipline name
        prefix: Prefix name
        description: Description
        object_dimension: Object dimension
        file_ext: File extension
        variable: Variable name (filename stem)
        modified_variable: View name (variable with spaces instead of hyphens)
    
    Returns:
        List containing a single XML line for Create shared model Run_option command
    """
    # Build the model name from Excel data (no option suffix needed)
    model_name = f'{discipline}/{prefix} {description} {object_dimension} {file_ext}'
    
    # Return as single-line format
    shared_model_line = (
        f'      <Run_option>        <Name>Create {model_name} Share model</Name>        '
        f'<Active>true</Active>        <Continue_on_failure>false</Continue_on_failure>        '
        f'<Uses_parameters>false</Uses_parameters>        <Interactive>false</Interactive>        '
        f'<Comments>        </Comments>        <SLF_data>          <screen_layout>            '
        f'<version>1.0</version>            <panel>              <name>Change String Info</name>              '
        f'<x>313</x>              <y>281</y>              <resize>                <width>1.26571429</width>                '
        f'<height>1</height>              </resize>              <source_box>                <name>Data to convert</name>                '
        f'<mode>Source_Box_View</mode>                <input_box>                  <name>Data to convert - View</name>                  '
        f'<value>{modified_variable}</value>                </input_box>              </source_box>              '
        f'<input_box>                <name>New name</name>                <value />              </input_box>              '
        f'<input_box>                <name>New colour</name>                <value />              </input_box>              '
        f'<tick_box>                <name>Clear individual segment colours</name>                <value>false</value>              </tick_box>              '
        f'<input_box>                <name>New style</name>                <value />              </input_box>              '
        f'<tick_box>                <name>Clear individual segment linestyles</name>                <value>false</value>              </tick_box>              '
        f'<input_box>                <name>New pt-line type</name>                <value>leave as is</value>              </input_box>              '
        f'<input_box>                <name>New weight</name>                <value />              </input_box>              '
        f'<target_box>                <name>Target</name>                <mode>Target_Box_Move_To_One_Model</mode>                '
        f'<input_box>                  <name>Target - Move to model</name>                  <value>{model_name}</value>                '
        f'</input_box>              </target_box>              <run_button>                <name>Change</name>              </run_button>            '
        f'</panel>          </screen_layout>                  </SLF_data>        <Parameter_Mappings>        </Parameter_Mappings>      </Run_option>'
    )
    
    return [shared_model_line]



