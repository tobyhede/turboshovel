## 1. Aggregation
- PASS ALL: CONTINUE
- FAIL ANY: STOP "Failed"

## 2. Optimistic
- PASS ANY: GOTO 4
- FAIL ALL: RETRY 3

## 3. Empty
Wait for 4.

## 4. End
Done.
