"""
Generate Add_model_to_view command
"""
from typing import List


def add_model_to_view_command(model_name: str, view_name: str, continue_on_failure: bool = True, comments: str = "") -> List[str]:
    failure_str = 'true' if continue_on_failure else 'false'
    """
    Generate Add_model_to_view XML command
    
    Args:
        modelName: Model name to add to view
    
    Returns:
        List of XML lines for Add_model_to_view command
    """
    return [
        '      <Add_model_to_view>',
        f'        <Name>Add model {model_name} to view {view_name}</Name>',
        '        <Active>true</Active>',
        f'        <Continue_on_failure>{failure_str}</Continue_on_failure>',
        '        <Uses_parameters>false</Uses_parameters>',
        '        <Interactive>false</Interactive>',
        f'<Comments>{comments}</Comments>',
        f'        <Model>{model_name}</Model>',
        f'        <View>{view_name}</View>',
        '      </Add_model_to_view>'
    ]



