"""
Generate XML header with namespace declarations
"""
from typing import List


def generate_xml_header(date: str = "2024-01-16", time: str = "20:57:27") -> List[str]:
    """
    Generate XML header with namespace declarations
    
    Args:
        date: Date string (default: "2024-01-16")
        time: Time string (default: "20:57:27")
    
    Returns:
        List of XML lines for the header
    """
    return [
        '<?xml version="1.0"?>',
        f'<xml12d xmlns="http://www.12d.com/schema/xml12d-10.0" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" language="English" version="1.0" date="{date}" time="{time}" xsi:schemaLocation="http://www.12d.com/schema/xml12d-10.0 http://www.12d.com/schema/xml12d-10.0/xml12d.xsd">'
    ]



