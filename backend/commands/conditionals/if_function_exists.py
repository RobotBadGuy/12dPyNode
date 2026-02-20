"""
Generate If_function_exists command
"""
from typing import List


def if_function_exists_command(
    function_name: str,
    pass_action_go_to_label: str,
    fail_action_go_to_label: str,
    continue_on_failure: bool = True,
    comments: str = ""
) -> List[str]:
    failure_str = 'true' if continue_on_failure else 'false'
    """
    Generate If_function_exists XML command
    
    Args:
        function_name: Function name to check (e.g., "{function_name} tin")
        pass_action_go_to_label: Label to go to if the function exists
        fail_action_go_to_label: Label to go to if the function does not exist
        continue_on_failure: Whether to continue on failure (default: True)
        comments: Comments to add to the command
    
    Returns:
        List of XML lines for If_function_exists command
    """
    return [
        '      <If_function_exists>',
        f'        <Name>If function {function_name} Exists</Name>',
        '        <Active>true</Active>',
        f'        <Continue_on_failure>{failure_str}</Continue_on_failure>',
        '        <Uses_parameters>false</Uses_parameters>',
        '        <Interactive>false</Interactive>',
        f'        <Comments>{comments}</Comments>',
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