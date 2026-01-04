"""
Generate Apply MTF command
"""
from typing import List


def apply_mtf_command(prefix: str, cell_value: str) -> List[str]:
    """
    Generate Apply MTF Function XML command
    
    Args:
        prefix: Prefix for the model
        cell_value: Cell value (model name)
    
    Returns:
        List of XML lines for Apply MTF command
    """
    return [
        '      <Function>',
        f'        <Name>Recalc {cell_value} mtf</Name>',
        '        <Active>true</Active>',
        '        <Continue_on_failure>false</Continue_on_failure>',
        '        <Uses_parameters>false</Uses_parameters>',
        '        <Interactive>false</Interactive>',
        '        <Comments>',
        '        </Comments>',
        f'        <Function>{cell_value} mtf</Function>',
        '      </Function>'
    ]

