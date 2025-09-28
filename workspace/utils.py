"""
Utility functions for the Python IDE demo
"""

from typing import Dict, Any
import json


def load_config(config_path: str) -> Dict[str, Any]:
    """Load configuration from JSON file"""
    try:
        with open(config_path, 'r') as f:
            return json.load(f)
    except FileNotFoundError:
        return {}


def save_config(config: Dict[str, Any], config_path: str) -> bool:
    """Save configuration to JSON file"""
    try:
        with open(config_path, 'w') as f:
            json.dump(config, f, indent=2)
        return True
    except Exception:
        return False


def format_size(bytes_size: int) -> str:
    """Format file size in human readable format"""
    size_float = float(bytes_size)
    for unit in ['B', 'KB', 'MB', 'GB']:
        if size_float < 1024.0:
            return f"{size_float:.1f} {unit}"
        size_float /= 1024.0
    return f"{size_float:.1f} TB"


def calculate_sum(numbers: list[int]) -> int:
    """Calculate sum of numbers in a list"""
    return sum(numbers)


def find_max(numbers: list[int]) -> int:
    """Find maximum number in a list"""
    if not numbers:
        raise ValueError("List cannot be empty")
    return max(numbers)


def fibonacci_generator(n: int):
    """Generate fibonacci sequence"""
    a, b = 0, 1
    for _ in range(n):
        yield a
        a, b = b, a + b


class MathUtils:
    """Math utility class"""

    @staticmethod
    def add(a: float, b: float) -> float:
        """Add two numbers"""
        return a + b

    @staticmethod
    def multiply(a: float, b: float) -> float:
        """Multiply two numbers"""
        return a * b

    @classmethod
    def power(cls, base: float, exponent: float) -> float:
        """Calculate power of a number"""
        return base ** exponent