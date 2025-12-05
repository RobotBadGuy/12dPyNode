"""
Generate Function command
"""
from typing import List


def function_command(
    name: str,
    function_name: str
) -> List[str]:
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
        f'        <Name>{name}</Name>',
        '        <Active>true</Active>',
        '        <Continue_on_failure>false</Continue_on_failure>',
        '        <Uses_parameters>false</Uses_parameters>',
        '        <Interactive>false</Interactive>',
        '        <Comments>',
        '        </Comments>',
        f'        <Function>{function_name}</Function>',
        '      </Function>'
    ]



