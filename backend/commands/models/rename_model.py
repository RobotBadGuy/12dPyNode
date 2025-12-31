"""
Generate Rename Model command
"""
from typing import List


def rename_model_command(pattern_replace: str, pattern_search: str) -> List[str]:
    """
    Generate Global Model Rename XML command
    
    Args:
        pattern_replace: Pattern replace value (prefix for the model)
        pattern_search: Pattern search value (model name pattern)
    
    Returns:
        List of XML lines for Rename Model command
    """
    return [
        '      <Manual_option>',
        '        <Name>Option Global Model Rename - MP Pad</Name>',
        '        <Active>true</Active>',
        '        <Continue_on_failure>false</Continue_on_failure>',
        '        <Uses_parameters>false</Uses_parameters>',
        '        <Interactive>false</Interactive>',
        '        <Comments>',
        '        </Comments>',
        '        <Panel_Data><screen_layout>',
        '  <version>1.0</version>',
        '  <panel>',
        '    <name>Global Model Rename</name>',
        '    <x>1093</x>',
        '    <y>159</y>',
        '    <resize>',
        '      <width>1.93367347</width>',
        '      <height>1.81743869</height>',
        '    </resize>',
        '    <tick_box>',
        '      <name>Match sub strings</name>',
        '      <value>false</value>',
        '    </tick_box>',
        '    <tick_box>',
        '      <name>Pattern expression</name>',
        '      <value>true</value>',
        '    </tick_box>',
        '    <input_box>',
        '      <name>Pattern Search</name>',
        f'      <value>{pattern_search}</value>',
        '    </input_box>',
        '    <input_box>',
        '      <name>Pattern Replace</name>',
        f'      <value>{pattern_replace}</value>',
        '    </input_box>',
        '    <tick_box>',
        '      <name>Regular expression</name>',
        '      <value>false</value>',
        '    </tick_box>',
        '    <input_box>',
        '      <name>Regex Search</name>',
        f'      <value>^{pattern_search}(.*)$</value>',
        '    </input_box>',
        '    <input_box>',
        '      <name>Regex Replace</name>',
        f'      <value>{pattern_replace}$1</value>',
        '    </input_box>',
        '    <tick_box>',
        '      <name>Only show matches</name>',
        '      <value>true</value>',
        '    </tick_box>',
        '    <run_button>',
        '      <name>Rename</name>',
        '    </run_button>',
        '  </panel>',
        '</screen_layout></Panel_Data>',
        '        <Panel_Name>Global Model Rename</Panel_Name>',
        '        <Clean_Up>1</Clean_Up>',
        '        <Buttons>',
        '          <Button>',
        '            <Name>Rename</Name>',
        '            <Order>0</Order>',
        '          </Button>',
        '        </Buttons>',
        '        <Parameter_Mappings>',
        '        </Parameter_Mappings>',
        '      </Manual_option>'
    ]
