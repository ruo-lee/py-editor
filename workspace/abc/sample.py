#!/usr/bin/env python3
"""
Sample Python file for testing the IDE
"""

from typing import List


def greet(name: str) -> str:
    """Greet a person with their name"""
    return f"Hello, {name}!"


def fibonacci(n: int) -> List[int]:
    """Generate fibonacci sequence up to n numbers"""
    if n <= 0:
        return []
    elif n == 1:
        return [0]
    elif n == 2:
        return [0, 1]

    sequence = [0, 1]
    for i in range(2, n):
        sequence.append(sequence[i-1] + sequence[i-2])

    return sequence


class Calculator:
    """Simple calculator class"""

    def __init__(self):
        self.history: List[str] = []

    def add(self, a: float, b: float) -> float:
        """Add two numbers"""
        result = a + b
        self.history.append(f"{a} + {b} = {result}")
        return result

    def multiply(self, a: float, b: float) -> float:
        """Multiply two numbers"""
        result = a * b
        self.history.append(f"{a} * {b} = {result}")
        return result

    def get_history(self) -> List[str]:
        """Get calculation history"""
        return self.history.copy()


def main() -> None:
    """Main function"""
    print(greet("Python IDE"))

    # Test fibonacci
    fib_numbers = fibonacci(10)
    print(f"Fibonacci sequence: {fib_numbers}")

    # Test calculator
    calc = Calculator()
    result1 = calc.add(5, 3)
    result2 = calc.multiply(4, 7)

    print(f"Addition result: {result1}")
    print(f"Multiplication result: {result2}")
    print(f"History: {calc.get_history()}")


if __name__ == "__main__":
    main()