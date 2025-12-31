"""
Generate Label command
"""
from typing import List


def add_label_command(label_name: str) -> List[str]:
    """
    Generate Label XML command
    
    Args:
        label_name: Name of the label
    
    Returns:
        List of XML lines for Label command
    """
    return [
        '      <Label>',
        f'        <Name>{label_name}</Name>',
        '        <Active>true</Active>',
        '        <Continue_on_failure>false</Continue_on_failure>',
        '        <Uses_parameters>false</Uses_parameters>',
        '        <Interactive>false</Interactive>',
        '        <Comments>',
        '        </Comments>',
        '      </Label>'
    ]
