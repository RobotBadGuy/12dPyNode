"""
Generate Add_model_to_view command
"""
from typing import List


def add_model_to_view_command(modified_variable: str) -> List[str]:
    """
    Generate Add_model_to_view XML command
    
    Args:
        modified_variable: View name (variable with spaces instead of hyphens)
    
    Returns:
        List of XML lines for Add_model_to_view command
    """
    return [
        '      <Add_model_to_view>',
        f'        <Name>Add model {modified_variable}* to view {modified_variable}</Name>',
        '        <Active>true</Active>',
        '        <Continue_on_failure>true</Continue_on_failure>',
        '        <Uses_parameters>false</Uses_parameters>',
        '        <Interactive>false</Interactive>',
        '        <Comments>',
        '        </Comments>',
        f'        <Model>{modified_variable}*</Model>',
        f'        <View>{modified_variable}</View>',
        '      </Add_model_to_view>'
    ]



