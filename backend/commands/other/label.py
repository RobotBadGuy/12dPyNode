"""
Generate Label command
"""
from typing import List


def label_command(name: str, active: bool = True) -> List[str]:
    """
    Generate Label XML command
    
    Args:
        name: Label name
        active: Whether the label is active (default: True)
    
    Returns:
        List of XML lines for Label command
    """
    return [
        '      <Label>',
        f'        <Name>{name}</Name>',
        f'        <Active>{"true" if active else "false"}</Active>',
        '        <Continue_on_failure>false</Continue_on_failure>',
        '        <Uses_parameters>false</Uses_parameters>',
        '        <Interactive>false</Interactive>',
        '        <Comments>',
        '        </Comments>',
        '      </Label>'
    ]



