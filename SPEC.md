# Specification: Test Suite Reliability under Concurrent Execution

## Acceptance Criteria

- **`[AC-1] Concurrency Configuration`**
  - Playwright configuration (`playwright.config.js`) is updated to run with concurrent workers by setting `workers` to `undefined` (or omitting it) instead of constraining execution to `workers: 1`.
  - When the test suite runs, multiple workers execute tests in parallel.

- **`[AC-2] E2E Direct SQLite Connection WAL Mode & Timeout`**
  - Every direct database connection instantiated in the E2E test files (`new DatabaseSync(dbPath)`) must immediately run:
    ```javascript
    db.exec('PRAGMA journal_mode = WAL;');
    db.exec('PRAGMA busy_timeout = 5000;');
    ```
    This matches the backend configurations in `db.js`.
  - Applies to the following spec files:
    - `tests/caching.spec.js`
    - `tests/chat-limit-referral.spec.js`
    - `tests/daily-streaks-rewards.spec.js`
    - `tests/demographic-presentation.spec.js`
    - `tests/gamified-milestones.spec.js`
    - `tests/llm-caching-optimization.spec.js`
    - `tests/localization.spec.js`
    - `tests/seo-visibility.spec.js`
    - `tests/trend-predictions.spec.js`
    - `tests/trivia-challenge.spec.js`
    - `tests/trivia-chat-rewards.spec.js`
    - `tests/trivia-leaderboard.spec.js`

- **`[AC-3] Database Connection Scoping and Leak Prevention`**
  - Every database connection opened in the test suite must be scoped cleanly using `try { ... } finally { db.close(); }` blocks to ensure the connection is closed even if assertions fail or errors are thrown.
  - Connections must be closed before initiating API/network requests to avoid holding locks during asynchronous network calls.

- **`[AC-4] E2E Async Testing Race Condition Prevention`**
  - For tests verifying asynchronous page actions, tests must await page load network responses via `page.waitForResponse` before making assertions on counts or state to ensure stability under concurrent load.

- **`[AC-5] 100% Pass Rate`**
  - Under concurrent execution (multiple workers, e.g., `--workers=4`), the complete test suite runs and achieves a 100% pass rate with zero transient database locking or race condition failures.

## Out of Scope

- Modifying the SQLite database schema, table structures, or keys.
- Implementing client-side response caching or other feature additions from the backlog.
- Any UI/UX changes on the website itself.

## Slices

- **`[S-1] Playwright Concurrency Configuration`**
  - **Files**: `playwright.config.js`
  - **ACs**: `[AC-1]`
  - **Description**: Modify the Playwright configuration file to remove `workers: 1` or change it to `workers: undefined` to enable concurrent execution of tests across multiple workers.
  - **Verification**: Run `npx playwright test` to verify that Playwright initializes multiple workers in parallel.
  - **Dependency**: None.

- **`[S-2] Direct SQLite Connections Refinement in E2E Tests`**
  - **Files**:
    - `tests/caching.spec.js`
    - `tests/chat-limit-referral.spec.js`
    - `tests/daily-streaks-rewards.spec.js`
    - `tests/demographic-presentation.spec.js`
    - `tests/gamified-milestones.spec.js`
    - `tests/llm-caching-optimization.spec.js`
    - `tests/localization.spec.js`
    - `tests/seo-visibility.spec.js`
    - `tests/trend-predictions.spec.js`
    - `tests/trivia-challenge.spec.js`
    - `tests/trivia-chat-rewards.spec.js`
    - `tests/trivia-leaderboard.spec.js`
  - **ACs**: `[AC-2]`, `[AC-3]`, `[AC-4]`, `[AC-5]`
  - **Description**: Add WAL mode and busy timeout configuration to all instances of `new DatabaseSync` in the test files. Wrap the connections in `try/finally` blocks ensuring `db.close()` is called correctly, and verify that no connections are held open during network API calls.
  - **Verification**: Run the full E2E test suite concurrently using parallel workers (e.g. `npx playwright test --workers=4`) and confirm a 100% pass rate.
  - **Dependency**: `[S-1]`.
