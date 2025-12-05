"""
View-related commands
"""
from .create_view import create_view_command
from .add_model_to_view import add_model_to_view_command
from .remove_model_from_view import remove_model_from_view_command

__all__ = [
    'create_view_command',
    'add_model_to_view_command',
    'remove_model_from_view_command',
]



