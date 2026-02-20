"""
Generate Remove_model_from_view command
"""
from typing import List


def remove_model_from_view_command(
    pattern: str,
    view_name: str,
    continue_on_failure: bool = True,
    comments: str = ""
) -> List[str]:
    failure_str = 'true' if continue_on_failure else 'false'
    """
    Generate Remove_model_from_view XML command
    
    Args:
        pattern: Model pattern to remove (e.g., "*", "*tin", "*tm", "*Label", "*Mark")
        view_name: View name (variable with spaces instead of hyphens)
    
    Returns:
        List of XML lines for Remove_model_from_view command
    """
    # Generate appropriate name based on pattern
    if pattern == "*":
        name = f"Remove model * from view {view_name}"
    else:
        name = f"Remove model {pattern} from view {view_name}"
    
    return [
        '      <Remove_model_from_view>',
        f'        <Name>{name}</Name>',
        '        <Active>true</Active>',
        f'        <Continue_on_failure>{failure_str}</Continue_on_failure>',
        '        <Uses_parameters>false</Uses_parameters>',
        '        <Interactive>false</Interactive>',
        f'<Comments>{comments}</Comments>',
        f'        <Model>{pattern}</Model>',
        f'        <View>{view_name}</View>',
        '      </Remove_model_from_view>'
    ]



