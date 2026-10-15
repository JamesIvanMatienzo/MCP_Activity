# Decision 001: Fibonacci — Iterative Algorithm

**Date:** 2026-10-03  
**Status:** Accepted  
**Context:** Choosing the algorithm for the Fibonacci demo task.

## Options considered

| Option | Time | Space | Pros | Cons |
|---|---|---|---|---|
| Naive recursion | O(2ⁿ) | O(n) stack | Simple to write | Exponential blowup past n ≈ 35 |
| Memoized recursion | O(n) | O(n) | Still readable | Uses a cache dict; stack depth for large n |
| Iterative loop | O(n) | O(1) extra | Fast, no stack risk, clear | Slightly less "elegant" |
| Matrix exponentiation | O(log n) | O(1) | Fastest for huge n | Over-engineered for a demo |

## Decision

**Iterative loop.** It is the best balance of clarity, performance, and safety for a demo deliverable. Python's arbitrary-precision integers mean no overflow at any n.

## Consequences

- Sequence starts `0, 1, 1, 2, 3, 5, ...` (0-indexed).
- Standard library only (`argparse` for CLI).
- Negative `n` raises `ValueError`; `main()` converts it to a clean exit with code 2.
- Out of scope: memoized, generator, or matrix variants.
