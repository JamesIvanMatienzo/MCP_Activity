"""Print the first N Fibonacci numbers.

Usage:
    python fibonacci.py 10
    -> 0 1 1 2 3 5 8 13 21 34
"""

import argparse


def fibonacci(n: int) -> list[int]:
    """Return the first n Fibonacci numbers, starting 0, 1, 1, 2, ..."""
    if n < 0:
        raise ValueError("n must be non-negative")
    result = []
    a, b = 0, 1
    for _ in range(n):
        result.append(a)
        a, b = b, a + b
    return result


def main() -> None:
    parser = argparse.ArgumentParser(description="Print the first N Fibonacci numbers.")
    parser.add_argument("n", type=int, help="how many numbers to print (>= 0)")
    args = parser.parse_args()
    try:
        print(" ".join(map(str, fibonacci(args.n))))
    except ValueError as exc:
        parser.error(str(exc))


if __name__ == "__main__":
    main()
