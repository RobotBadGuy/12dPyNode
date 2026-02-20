"""
Generate Function command
"""
from typing import List


def function_command(
    command_name: str,
    function_name: str,
    continue_on_failure: bool = True,
    comments: str = ""
) -> List[str]:
    failure_str = 'true' if continue_on_failure else 'false'
    """
    Generate Function XML command
    
    Args:
        name: Command name (e.g., "Recalc {modified_variable} tin")
        function_name: Function name to execute (e.g., "{modified_variable} tin")
    
    Returns:
        List of XML lines for Function command
    """
    return [
        '      <Function>',
        f'        <Name>{command_name}</Name>',
        '        <Active>true</Active>',
        f'        <Continue_on_failure>{failure_str}</Continue_on_failure>',
        '        <Uses_parameters>false</Uses_parameters>',
        '        <Interactive>false</Interactive>',
        f'        <Comments>{comments}</Comments>',
        f'        <Function>{function_name}</Function>',
        '      </Function>'
    ]