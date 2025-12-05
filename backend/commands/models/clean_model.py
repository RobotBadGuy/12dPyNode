"""
Generate Clean_model command
"""
from typing import List


def clean_model_command(
    discipline: str,
    prefix: str,
    description: str,
    object_dimension: str,
    file_ext: str,
    variable: str
) -> List[str]:
    """
    Generate Clean_model XML command (in the malformed single-line format that 12d Model expects)
    
    Args:
        discipline: Discipline name
        prefix: Prefix name
        description: Description
        object_dimension: Object dimension
        file_ext: File extension
        variable: Variable name (filename stem)
    
    Returns:
        List containing a single XML line for Clean_model command
    """
    # Build the model name from Excel data (no option suffix needed)
    model_name = f'{discipline}/{prefix} {description} {object_dimension} {file_ext}'
    
    # Return as single-line format (malformed but expected by 12d Model)
    clean_model_line = (
        f'      <Clean_model>        <Name>Clean model {model_name}</Name>        '
        f'<Active>true</Active>        <Continue_on_failure>true</Continue_on_failure>        '
        f'<Uses_parameters>false</Uses_parameters>        <Interactive>false</Interactive>        '
        f'<Comments>        </Comments>        <Model_Name>{model_name}</Model_Name>        '
        f'<Model_ID>0</Model_ID>        <Raster_Mode>0</Raster_Mode>      </Clean_model>'
    )
    
    return [clean_model_line]



