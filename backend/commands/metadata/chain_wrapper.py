"""
Generate Chain wrapper and Settings
"""
from typing import List


def generate_chain_wrapper() -> List[str]:
    """
    Generate Chain wrapper opening tag
    
    Returns:
        List of XML lines for Chain wrapper
    """
    return [
        '  <Chain>',
        '    <version>1</version>'
    ]


def generate_chain_settings() -> List[str]:
    """
    Generate Chain Settings section
    
    Returns:
        List of XML lines for Settings
    """
    return [
        '    <Settings>',
        '      <Parameter_File/>',
        '      <Prompt_for_parameters>false</Prompt_for_parameters>',
        '      <Always_record_for_parameters>false</Always_record_for_parameters>',
        '      <Interactive>false</Interactive>',
        '    </Settings>',
        '    <Commands>'
    ]


def generate_chain_closing() -> List[str]:
    """
    Generate Chain closing tags
    
    Returns:
        List of XML lines for closing Chain and xml12d tags
    """
    return [
        '    </Commands>',
        '  </Chain>',
        '</xml12d>'
    ]



