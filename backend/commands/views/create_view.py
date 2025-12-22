"""
Generate Create_view command
"""
from typing import List, Tuple


def create_view_command(
    view_name: str,
    coordinates: Tuple[int, int, int, int] = None
) -> List[str]:
    """
    Generate Create_view XML command
    
    Args:
        view_name: View name (variable with spaces instead of hyphens)
        coordinates: Tuple of (Top, Left, Bot, Right). Defaults to Model coordinates (40, 30, 565, 715)
                    For TIN, use (130, 120, 640, 790)
    
    Returns:
        List of XML lines for Create_view command
    """
    if coordinates is None:
        # Default Model coordinates
        top, left, bot, right = 40, 30, 565, 715
    else:
        top, left, bot, right = coordinates
    
    return [
        '      <Create_view>',
        f'        <Name>Create view {view_name}</Name>',
        '        <Active>true</Active>',
        '        <Continue_on_failure>true</Continue_on_failure>',
        '        <Uses_parameters>false</Uses_parameters>',
        '        <Interactive>false</Interactive>',
        '        <Comments>',
        '        </Comments>',
        f'        <View>{view_name}</View>',
        '        <View_Type>2010</View_Type>',
        '        <View_Engine>GDI_legacy</View_Engine>',
        '        <Favourite_File></Favourite_File>',
        f'        <Top>{top}</Top>',
        f'        <Left>{left}</Left>',
        f'        <Bot>{bot}</Bot>',
        f'        <Right>{right}</Right>',
        '        <Exaggeration></Exaggeration>',
        '        <Use_Draw_Area>0</Use_Draw_Area>',
        '        <Draw_Area_Width>-2147483648</Draw_Area_Width>',
        '        <Draw_Area_Height>-2147483648</Draw_Area_Height>',
        '      </Create_view>'
    ]



