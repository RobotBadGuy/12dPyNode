"""
Generate Comment command
"""
from typing import List


def add_comment_command(comment_name: str, continue_on_failure: bool = True, comments: str = "") -> List[str]:
    failure_str = 'true' if continue_on_failure else 'false'
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
        f'        <Continue_on_failure>{failure_str}</Continue_on_failure>',
        '        <Uses_parameters>false</Uses_parameters>',
        '        <Interactive>false</Interactive>',
        f'        <Comments>{comments}</Comments>',
        '      </Comment>'
    ]