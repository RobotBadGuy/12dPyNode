"""
Generate If_function_exists command
"""
from typing import List


def if_function_exists_command(
    modified_variable: str,
    function_name: str,
    pass_action_go_to_label: str,
    fail_action_go_to_label: str
) -> List[str]:
    """
    Generate If_function_exists XML command
    
    Args:
        modified_variable: Variable name (with spaces instead of hyphens)
        function_name: Function name to check (e.g., "{modified_variable} tin")
        pass_action_go_to_label: Label to go to if the function exists
        fail_action_go_to_label: Label to go to if the function does not exist
    
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
        f'          <Pass_Action>{pass_action_go_to_label}</Pass_Action>',
        '          <Fail_Mode>1</Fail_Mode>',
        f'          <Fail_Action>{fail_action_go_to_label}</Fail_Action>',
        '        </Conditional>',
        f'        <Function>{function_name}</Function>',
        '      </If_function_exists>'
    ]

    # Pass_Mode: 0 = Continue
    # Pass_Mode: 1 = Go To Label
    # Pass_Mode: 2 = Run Chain
    # Pass_Mode: 3 = Halt