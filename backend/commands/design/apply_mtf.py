"""
Generate Apply MTF command
"""
from typing import List


def apply_mtf_command(function_name: str, continue_on_failure: bool = True, comments: str = "") -> List[str]:
    failure_str = 'true' if continue_on_failure else 'false'
    """
    Generate Apply MTF Function XML command
    
    Args:
        function_name: Function name for the MTF
    
    Returns:
        List of XML lines for Apply MTF command
    """
    return [
        '      <Function>',
        f'        <Name>Recalc {function_name}</Name>',
        '        <Active>true</Active>',
        f'        <Continue_on_failure>{failure_str}</Continue_on_failure>',
        '        <Uses_parameters>false</Uses_parameters>',
        '        <Interactive>false</Interactive>',
        f'        <Comments>{comments}</Comments>',
        f'        <Function>{function_name}</Function>',
        '      </Function>'
    ]