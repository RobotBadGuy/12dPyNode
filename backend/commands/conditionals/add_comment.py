"""
Generate Comment command
"""
from typing import List


def add_comment_command(comment_name: str) -> List[str]:
    """
    Generate Comment XML command
    
    Args:
        comment_name: Name of the comment
    
    Returns:
        List of XML lines for Comment command
    """
    return [
        '      <Comment>',
        f'        <Name>{comment_name}</Name>',
        '        <Active>true</Active>',
        '        <Continue_on_failure>false</Continue_on_failure>',
        '        <Uses_parameters>false</Uses_parameters>',
        '        <Interactive>false</Interactive>',
        '        <Comments>',
        '        </Comments>',
        '      </Comment>'
    ]
