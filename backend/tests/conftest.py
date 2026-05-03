"""
Pytest configuration and shared fixtures for backend tests.
"""
import sys
from pathlib import Path

# Ensure the backend package is importable
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
