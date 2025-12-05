"""
Generate Remove_model_from_view command
"""
from typing import List


def remove_model_from_view_command(
    model_pattern: str,
    modified_variable: str
) -> List[str]:
    """
    Generate Remove_model_from_view XML command
    
    Args:
        model_pattern: Model pattern to remove (e.g., "*", "*tin", "*tm", "*Label", "*Mark")
        modified_variable: View name (variable with spaces instead of hyphens)
    
    Returns:
        List of XML lines for Remove_model_from_view command
    """
    # Generate appropriate name based on pattern
    if model_pattern == "*":
        name = f"Remove model * from view {modified_variable}"
    else:
        name = f"Remove model {model_pattern} from view {modified_variable}"
    
    return [
        '      <Remove_model_from_view>',
        f'        <Name>{name}</Name>',
        '        <Active>true</Active>',
        '        <Continue_on_failure>true</Continue_on_failure>',
        '        <Uses_parameters>false</Uses_parameters>',
        '        <Interactive>false</Interactive>',
        '        <Comments>',
        '        </Comments>',
        f'        <Model>{model_pattern}</Model>',
        f'        <View>{modified_variable}</View>',
        '      </Remove_model_from_view>'
    ]



