task: Improve test suite reliability to achieve a 100% pass rate under concurrent execution. Metric: test pass rate. Why now: baseline test suite has database locking failures. Runner-up: Reduce LLM API request volume and user latency via client-side response caching.              tier: T2   creativity: 0.3
state: verify              budget: repairs 1/3
branch: asf/20260613-test-reliability          checkpoint: none
caps: agents,ui,web,human

## Log
- 2026-06-13: Conductor starting fresh run with T2 (Scout trigger). Starting Scout phase.
- 2026-06-13: Scout completed. Selected task: Improve test suite reliability. Conductor starting Architect phase.
- 2026-06-13: Architect completed SPEC.md. Conductor starting Tester phase.
- 2026-06-13: Tester completed test suite. Observed state: red. Conductor starting Verifier phase.
- 2026-06-13: Verifier failed. Hypothesis: Tests running concurrently on the same database interfere via global DELETEs, and direct connections are not fully isolated or closed before server requests. Conductor restarting Tester phase.
- 2026-06-13: Tester updated tests, suite is green. Conductor starting Verifier phase.

## Verdict

### Check 1: Playwright Test Concurrency & SQLite WAL Mode
- **Status**: FAIL
- **Acceptance Criteria Broken**: `[AC-1]`, `[AC-2]`, `[AC-3]`, `[AC-5]`
- **Evidence**:
  1. `tests/daily-streaks-rewards.spec.js` failed at line 133 with `TypeError: Cannot read properties of null (reading 'client_id')`. Log contains: `Local SQLite query failed for getClientStreak "my-weird-client-123": database is locked`.
  2. `tests/llm-caching-optimization.spec.js` failed at line 198 with `Expected: 1, Received: 0` (found 0 cached rows).
  3. `tests/share-preview.spec.js` failed at line 162 with `Expected: "14", Received: "44"`.
- **Suspected Cause**:
  - **Test**: `tests/llm-caching-optimization.spec.js` executes global `DELETE FROM chat_cache` and `DELETE FROM generated_posts` which interfere with concurrently running tests in other workers.
  - **Code**: The backend SQLite connection pool/wrapper still encounters transaction lockups during concurrent load.
  - **Code/Test**: The frontend sharing modal triggers asynchronous `/api/generate-post` requests that race with Playwright `fill` inputs under CPU load.

### Check 2: Behavioral / Dogfooding
- **Status**: skipped
- **Reason**: Halted at the first real failure cluster (automated tests failing under concurrency) to avoid burning execution budget.

## Done
