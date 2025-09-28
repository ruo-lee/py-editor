#!/usr/bin/env python3
"""
Test file for import suggestions and go-to-definition
"""

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


def another_function():
    """Another function to test go-to-definition"""
    # Try typing "from utils import " and see autocomplete suggestions
    pass


if __name__ == "__main__":
    test_utils()