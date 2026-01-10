"""
Generate Apply MTF command
"""
from typing import List


def apply_mtf_command(function_name: str) -> List[str]:
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
        '        <Continue_on_failure>false</Continue_on_failure>',
        '        <Uses_parameters>false</Uses_parameters>',
        '        <Interactive>false</Interactive>',
        '        <Comments>',
        '        </Comments>',
        f'        <Function>{function_name}</Function>',
        '      </Function>'
    ]



