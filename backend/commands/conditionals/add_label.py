"""
Generate Label command
"""
from typing import List


def add_label_command(
    label_name: str,
    continue_on_failure: bool = True,
    comments: str = ""
) -> List[str]:
    failure_str = 'true' if continue_on_failure else 'false'
    """
    Generate Label XML command
    
    Args:
        label_name: Name of the label
        continue_on_failure: Continue on failure
        comments: Comments
    
    Returns:
        List of XML lines for Label command
    """
    return [
        '      <Label>',
        f'        <Name>{label_name}</Name>',
        '        <Active>true</Active>',
        f'        <Continue_on_failure>{failure_str}</Continue_on_failure>',
        '        <Uses_parameters>false</Uses_parameters>',
        '        <Interactive>false</Interactive>',
        f'        <Comments>{comments}</Comments>',
        '      </Label>'
    ]