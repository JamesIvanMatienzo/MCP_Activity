def check_even_odd(n):
    """Return 'even' or 'odd' for the given integer."""
    return "even" if n % 2 == 0 else "odd"


def check_divisible(n, divisor):
    """Return True if n is divisible by divisor."""
    return n % divisor == 0


def main():
    try:
        number = int(input("Enter a number: "))
    except ValueError:
        print("Invalid input. Please enter a whole number.")
        return

    print(f"{number} is {check_even_odd(number)}.")

    try:
        divisor = int(input("Enter a number to check divisibility by: "))
    except ValueError:
        print("Invalid input. Please enter a whole number.")
        return

    if divisor == 0:
        print("Cannot divide by zero.")
    elif check_divisible(number, divisor):
        print(f"{number} is divisible by {divisor}.")
    else:
        print(f"{number} is not divisible by {divisor}.")


if __name__ == "__main__":
    main()
