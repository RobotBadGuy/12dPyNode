"""
Generate XML header with namespace declarations
"""
from typing import List
from datetime import datetime


def generate_xml_header(date: str = "", time: str = "") -> List[str]:
    """
    Generate XML header with namespace declarations
    
    Args:
        date: Date string (default: current date in YYYY-MM-DD format)
        time: Time string (default: current time in HH:MM:SS format)
    
    Returns:
        List of XML lines for the header
    """
    now = datetime.now()
    if not date:
        date = now.strftime("%Y-%m-%d")
    if not time:
        time = now.strftime("%H:%M:%S")
    return [
        '<?xml version="1.0"?>',
        f'<xml12d xmlns="http://www.12d.com/schema/xml12d-10.0" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" language="English" version="1.0" date="{date}" time="{time}" xsi:schemaLocation="http://www.12d.com/schema/xml12d-10.0 http://www.12d.com/schema/xml12d-10.0/xml12d.xsd">'
    ]
