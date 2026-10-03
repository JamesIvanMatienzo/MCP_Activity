# Plan 001: Fibonacci Sequence Script

**Status:** Planned, not yet implemented
**Target file:** `fibonacci.py`

## Goal
A small, dependency-free Python script that prints the first N Fibonacci numbers, with N given on the command line.

## Design decisions
- Sequence starts 0, 1, 1, 2, 3, 5, ...
- Iterative implementation (O(n) time, O(1) extra space), not naive recursion, which is exponential.
- Pure standard library (`argparse` for the CLI).
- Python ints are arbitrary precision, so large N does not overflow.

## Steps
1. **Create `fibonacci.py`** with a module docstring describing usage.
2. **Write `fibonacci(n: int) -> list[int]`**
   - Return `[]` for `n == 0`.
   - Raise `ValueError` for `n < 0`.
   - Start with `a, b = 0, 1`; loop `n` times, appending `a`, then `a, b = b, a + b`.
3. **Write `main()`** using `argparse`:
   - Positional arg `n` (int).
   - Print the sequence space-separated.
   - Show a clean error message on invalid input.
4. **Add the entry point:** `if __name__ == "__main__": main()`.
5. **Write tests (`test_fibonacci.py`)** covering:
   - `n = 0` gives `[]`
   - `n = 1` gives `[0]`
   - `n = 2` gives `[0, 1]`
   - `n = 10` gives `[0, 1, 1, 2, 3, 5, 8, 13, 21, 34]`
   - negative `n` raises `ValueError`
6. **Run and verify:** `python fibonacci.py 10` and `python -m unittest`.

## Out of scope
Memoized or matrix-exponentiation variants, generators, and big-N performance tuning. These can be a follow-up if wanted.

## Definition of done
- `python fibonacci.py 10` prints `0 1 1 2 3 5 8 13 21 34`.
- All tests pass.
- `PROJECT_STATE.md` updated to "complete".
