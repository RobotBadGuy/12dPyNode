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

def load_naming_data(excel_path, header=None):
    """Loads model naming data from an Excel file.
    
    Args:
        excel_path: Path to Excel file
        header: Row to use as column names. None means no header row (all rows are data).
                Default None to ensure first row is included as data.
    """
    try:
        # pip install openpyxl
        # Use header=None to read all rows as data (including first row)
        # This ensures we don't lose the first model if there's no header row
        df = pd.read_excel(excel_path, engine='openpyxl', header=header)
        
        # If no header was specified, create default column names
        if header is None:
            # Use first row values as column names, or default names if needed
            if len(df) > 0:
                # Check if first row looks like a header (all strings, no numbers)
                first_row = df.iloc[0]
                # If first row has mixed types or looks like data, use it as data
                # Otherwise, we'll keep it as data and use default column names
                df.columns = [f'col_{i}' for i in range(len(df.columns))]
            else:
                df.columns = [f'col_{i}' for i in range(len(df.columns))]
        
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