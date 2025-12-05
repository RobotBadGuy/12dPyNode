"""
Generate If_function_exists command
"""
from typing import List


def if_function_exists_command(
    modified_variable: str,
    function_name: str
) -> List[str]:
    """
    Generate If_function_exists XML command
    
    Args:
        modified_variable: Variable name (with spaces instead of hyphens)
        function_name: Function name to check (e.g., "{modified_variable} tin")
    
    Returns:
        List of XML lines for If_function_exists command
    """
    return [
        '      <If_function_exists>',
        f'        <Name>If function {function_name} Exists</Name>',
        '        <Active>true</Active>',
        '        <Continue_on_failure>false</Continue_on_failure>',
        '        <Uses_parameters>false</Uses_parameters>',
        '        <Interactive>false</Interactive>',
        '        <Comments>',
        '        </Comments>',
        '        <Conditional>',
        '          <Pass_Mode>1</Pass_Mode>',
        '          <Pass_Action>run tin function</Pass_Action>',
        '          <Fail_Mode>0</Fail_Mode>',
        '          <Fail_Action/>',
        '        </Conditional>',
        f'        <Function>{function_name}</Function>',
        '      </If_function_exists>'
    ]



