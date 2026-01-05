# Default Transitions

Tests implicit PASS→CONTINUE, FAIL→STOP when no transitions defined.

## 1. Step with no transitions

```bash
tsv test --result pass
```

## 2. Final step

```bash
tsv test --result pass
```

- PASS: DONE
