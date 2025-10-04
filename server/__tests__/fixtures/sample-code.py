"""
Sample Python code for testing
"""

def greet(name):
    """Greet someone by name"""
    return f"Hello, {name}!"

def calculate(a, b, operation='+'):
    """Perform basic arithmetic"""
    if operation == '+':
        return a + b
    elif operation == '-':
        return a - b
    elif operation == '*':
        return a * b
    elif operation == '/':
        return a / b if b != 0 else None
    return None

if __name__ == '__main__':
    print(greet("Python"))
    result = calculate(10, 5, '+')
    print(f"10 + 5 = {result}")
