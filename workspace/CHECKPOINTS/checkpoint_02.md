# Checkpoint 02: Implementation complete

**Date:** 2026-10-03

## Done
- Created `fibonacci.py`: iterative `fibonacci(n)` plus an `argparse` CLI.
- Created `test_fibonacci.py`: 5 unittest cases (n = 0, 1, 2, 10, and negative).
- Verified by running copies in a sandbox, since the file server can't execute code:
  - `python fibonacci.py 10` printed `0 1 1 2 3 5 8 13 21 34`.
  - `n = 0` printed an empty line.
  - `n = -3` exited with code 2 and "n must be non-negative".
  - `python -m unittest`: 5 tests, all OK.

## Plan adherence
All six steps in `PLAN_LOG/001_fibonacci_plan.md` completed. Nothing deviated.

## Next
Nothing required. The project is complete.

## Open issues
None. The tests were run on sandbox copies, not inside the workspace, so run `python -m unittest` there once to confirm.
