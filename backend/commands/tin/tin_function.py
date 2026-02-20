"""
Generate TIN function command
"""
from typing import List


def tin_function_command(modified_variable: str, continue_on_failure: bool = True, comments: str = "") -> List[str]:
    failure_str = 'true' if continue_on_failure else 'false'
    """
    Generate TIN function command (Label + Function for recalculating tin)
    
    Args:
        modified_variable: Variable name (with spaces instead of hyphens)
    
    Returns:
        List of XML lines for TIN function command (Label + Function)
    """
    return [
        '      <Label>',
        '        <Name>run tin function</Name>',
        '        <Active>true</Active>',
        '        <Continue_on_failure>false</Continue_on_failure>',
        '        <Uses_parameters>false</Uses_parameters>',
        '        <Interactive>false</Interactive>',
        f'<Comments>{comments}</Comments>',
        '      </Label>',
        '      <Function>',
        f'        <Name>Recalc {modified_variable} tin</Name>',
        '        <Active>true</Active>',
        '        <Continue_on_failure>false</Continue_on_failure>',
        '        <Uses_parameters>false</Uses_parameters>',
        '        <Interactive>false</Interactive>',
        '        <Comments>',
        '        </Comments>',
        f'        <Function>{modified_variable} tin</Function>',
        '      </Function>'
    ]



