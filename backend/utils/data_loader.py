import os
import pandas as pd
import unicodedata

def normalize_unicode_string(text):
    """Normalize Unicode characters to prevent encoding issues."""
    if isinstance(text, str):
        # Normalize Unicode characters
        normalized = unicodedata.normalize('NFKC', text)
        # Replace en-dash with regular hyphen to prevent encoding issues
        normalized = normalized.replace('–', '-')
        return normalized
    return text

def load_naming_data(excel_path):
    """Loads model naming data from an Excel file."""
    try:
        # pip install openpyxl
        df = pd.read_excel(excel_path, engine='openpyxl')
        
        # Normalize Unicode characters in all string columns
        for column in df.columns:
            if df[column].dtype == 'object':  # String columns
                df[column] = df[column].apply(normalize_unicode_string)
        
        # make column names lowercase and replace spaces with underscores for easier access
        df.columns = df.columns.str.lower().str.replace(' ', '_')
        return df
    except FileNotFoundError:
        print(f"Error: Naming convention file not found at '{excel_path}'")
        return None
    except Exception as e:
        print(f"Error reading Excel file: {e}")
        return None 