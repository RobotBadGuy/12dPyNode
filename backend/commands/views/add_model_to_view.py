"""
Generate Add_model_to_view command
"""
from typing import List


def add_model_to_view_command(modelName: str, viewName: str) -> List[str]:
    """
    Generate Add_model_to_view XML command
    
    Args:
        modelName: Model name to add to view
    
    Returns:
        List of XML lines for Add_model_to_view command
    """
    return [
        '      <Add_model_to_view>',
        f'        <Name>Add model {modelName} to view {viewName}</Name>',
        '        <Active>true</Active>',
        '        <Continue_on_failure>true</Continue_on_failure>',
        '        <Uses_parameters>false</Uses_parameters>',
        '        <Interactive>false</Interactive>',
        '        <Comments>',
        '        </Comments>',
        f'        <Model>{modelName}</Model>',
        f'        <View>{viewName}</View>',
        '      </Add_model_to_view>'
    ]



