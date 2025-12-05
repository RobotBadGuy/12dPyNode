"""
Utility functions for file importers
"""
import unicodedata
from typing import Union


def normalize_file_path(file_path: Union[str, None]) -> Union[str, None]:
    """
    Normalize file path to handle Unicode characters properly.
    
    Args:
        file_path: File path string to normalize
        
    Returns:
        Normalized file path string
    """
    if isinstance(file_path, str):
        # Normalize Unicode characters using NFKC normalization
        normalized = unicodedata.normalize('NFKC', file_path)
        # Replace en-dash with regular hyphen to prevent encoding issues
        normalized = normalized.replace('–', '-')
        return normalized
    return file_path

