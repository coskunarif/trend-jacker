task: Improve test suite reliability to achieve a 100% pass rate under concurrent execution. Metric: test pass rate. Why now: baseline test suite has database locking failures. Runner-up: Reduce LLM API request volume and user latency via client-side response caching.              tier: T2   creativity: 0.18
state: verify              budget: repairs 2/3
branch: asf/20260613-test-reliability          checkpoint: none
caps: agents,ui,web,human

## Log
- 2026-06-13: Conductor starting fresh run with T2 (Scout trigger). Starting Scout phase.
- 2026-06-13: Scout completed. Selected task: Improve test suite reliability. Conductor starting Architect phase.
- 2026-06-13: Architect completed SPEC.md. Conductor starting Tester phase.
- 2026-06-13: Tester completed test suite. Observed state: red. Conductor starting Verifier phase.
- 2026-06-13: Verifier failed. Hypothesis: Tests running concurrently on the same database interfere via global DELETEs, and direct connections are not fully isolated or closed before server requests. Conductor restarting Tester phase.
- 2026-06-13: Tester updated tests, suite is green. Conductor starting Verifier phase.
- 2026-06-13: Verifier failed. Hypothesis: Write transactions in db.js deadlock under concurrent load, file-level Date.now() in tests collides, and page.goto races in tests. Conductor restarting Tester phase.
- 2026-06-13: Tester and Builder completed fixes, suite is green. Conductor starting Verifier phase.

## Verdict

### Check 1: Playwright Test Concurrency & SQLite WAL Mode
- **Status**: FAIL
- **Acceptance Criteria Broken**: `[AC-5]`
- **Evidence**:
  1. `tests/seo-visibility.spec.js` failed at line 71 with `TypeError: Cannot read properties of null (reading 'created_at')`. Log contains: `Local SQLite insert failed for setLocalizedExplanation: database is locked`.
  2. `tests/trivia-challenge.spec.js` failed at line 102 (and line 91 on retry) with `dbRow` undefined. Log contains: `Local SQLite query failed for getTrendTrivia: database is locked`.
  3. `tests/trivia-leaderboard.spec.js` failed at line 241 with `Expected length: 1, Received length: 0`. The database rows were deleted by a concurrent test's `beforeEach` hook.
  4. `tests/caching.spec.js` failed with `expect(data1.hook).toBe('Static Cached Hook')`. Log contains: `Local SQLite query failed for getCachedExplanation: database is locked`.
  5. `tests/chat-limit-referral.spec.js` failed at line 19 with key mismatch. Log contains: `Local SQLite query failed for getCachedChatResponse: database is locked`.
- **Suspected Cause**:
  - **Code**: Write transactions in `db.js` (e.g. `incrementVote`, `seedVoteEvents`, `incrementChatCount`, `resolvePredictions`) use deferred transactions (`BEGIN TRANSACTION;`) instead of immediate transactions (`BEGIN IMMEDIATE TRANSACTION;`). This causes concurrent writers to deadlock and SQLite to abort immediately with `database is locked`, bypassing the 5000ms `busy_timeout`.
  - **Test**: Spec files (like `tests/trivia-leaderboard.spec.js`) utilize file-level variables initialized via `Date.now()`. When run with `fullyParallel: true`, parallel workers spawned at the same millisecond load the file with identical variables, causing their `beforeEach` cleanups to delete each other's test data.
  - **Test**: Timing races occur in tests like `tests/chat-limit-referral.spec.js` where database assertions are executed immediately after `page.goto` without waiting for the backend's async operation to persist the referral.

### Check 2: Behavioral / Dogfooding
- **Status**: skipped
- **Reason**: Halted at the first real failure cluster (automated test suite reliability failures under concurrent execution) to avoid burning execution budget.

## Done

