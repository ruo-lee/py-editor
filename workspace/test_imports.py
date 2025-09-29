#!/usr/bin/env python3
"""
Test file for import suggestions and go-to-definition
"""

# Python standard library imports - test Ctrl+click on these
import os
import sys
import json
import time
from pathlib import Path

# Local imports
from utils import calculate_sum, find_max, MathUtils
import utils


def test_local_definition():
    """Test local variable and function definition"""
    my_variable = 42
    return my_variable


def test_utils():
    """Test utils functions"""
    numbers = [1, 2, 3, 4, 5]

    # Test imported functions - try Ctrl+click on these
    total = calculate_sum(numbers)
    maximum = find_max(numbers)

    # Test module import - try Ctrl+click on utils
    size = utils.format_size(1024)

    # Test class methods - try Ctrl+click on MathUtils
    result = MathUtils.add(5, 3)
    power_result = MathUtils.power(2, 3)

    # Test local function call - try Ctrl+click on test_local_definition
    local_result = test_local_definition()

    print(f"Sum: {total}")
    print(f"Max: {maximum}")
    print(f"Size: {size}")
    print(f"Add result: {result}")
    print(f"Power result: {power_result}")
    print(f"Local result: {local_result}")

    # Test local variable - try Ctrl+click on 'numbers'
    for number in numbers:
        print(number)


def test_stdlib_modules():
    """Test Python standard library go-to-definition"""

    # Test os module - try Ctrl+click on 'getcwd', 'path', 'environ'
    current_dir = os.getcwd()
    home_path = os.path.expanduser("~")
    env_var = os.environ.get("HOME", "/tmp")

    # Test sys module - try Ctrl+click on 'version', 'path', 'exit'
    python_version = sys.version
    python_path = sys.path

    # Test json module - try Ctrl+click on 'dumps', 'loads'
    data = {"test": "value"}
    json_str = json.dumps(data)
    parsed_data = json.loads(json_str)

    # Test time module - try Ctrl+click on 'sleep', 'time'
    current_time = time.time()

    # Test pathlib - try Ctrl+click on 'Path'
    file_path = Path(__file__)
    parent_dir = file_path.parent

    print(f"Current directory: {current_dir}")
    print(f"Python version: {python_version}")
    print(f"JSON: {json_str}")
    print(f"File path: {file_path}")


def another_function():
    """Another function to test go-to-definition"""
    # Try typing "from utils import " and see autocomplete suggestions
    pass


if __name__ == "__main__":
    test_utils()
    test_stdlib_modules()