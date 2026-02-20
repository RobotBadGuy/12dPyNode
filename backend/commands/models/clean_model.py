"""
Generate Clean_model command
"""
from typing import List


def clean_model_command(
    command_name: str,
    model_name: str,
    comments: str,
    continue_on_failure: bool = True,
) -> List[str]:
    failure_str = 'true' if continue_on_failure else 'false'
    """
    Generate Clean_model XML command (in the malformed single-line format that 12d Model expects)
    
    Args:
        model_name: name of model to clean
        command_name: name of command
        continue_on_failure: Continue on failure
        comments: Comments
    
    Returns:
        List containing a single XML line for Clean_model command
    """
    
    # Return as single-line format (malformed but expected by 12d Model)
    clean_model_line = (
        '<Clean_model>'
            f'<Name>{command_name}</Name>'
            f'<Active>true</Active>'
            f'<Continue_on_failure>{failure_str}</Continue_on_failure>'
            f'<Uses_parameters>false</Uses_parameters>'
            f'<Interactive>false</Interactive>'
            f'<Comments>{comments}</Comments>'
            f'<Model_Name>{model_name}</Model_Name>'
            f'<Model_ID>0</Model_ID>'
            f'<Raster_Mode>0</Raster_Mode>'
        '</Clean_model>'
    )
    
    return [clean_model_line]



