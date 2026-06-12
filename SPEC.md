# SPEC: Fix SQLite Concurrency Race Conditions in E2E Test Suite

## Acceptance Criteria

- **[AC-1] Prevent SQLite Locks in LLM Caching Tests**:
  Modify `tests/llm-caching-optimization.spec.js` to ensure database connections are closed before making API requests via Playwright's `request` client. Specifically:
  - Close connection before executing `request.post('/api/chat', ...)` in the chat caching test.
  - Close connection before executing `request.post('/api/generate-post', ...)` in the post generation caching test.
  - Verify that the test database operations are scoped cleanly (opening, executing statement, and immediately closing).

- **[AC-2] Complete Parallel Pass Rate**:
  The entire test suite must achieve a 100% pass rate when executed concurrently with multiple workers (e.g. `npx playwright test --workers=4`).

## Out of Scope

- Modifying `db.js` initialization logic or SQLite database configuration (e.g., changing WAL/PRAGMA settings).
- Changing the server-side API or endpoint logic.

## Slices

- **[S-1] Scoped SQLite Connections in LLM Caching Tests** (refinement)
  - **Files**: `tests/llm-caching-optimization.spec.js`
  - **ACs**: `[AC-1]`
  - **Description**: Refactor `tests/llm-caching-optimization.spec.js` so that `DatabaseSync` connections opened inside tests are closed before any `request.post` calls are made, avoiding overlapping DB locks.
  - **Verification**: Run `npx playwright test tests/llm-caching-optimization.spec.js` to verify they pass individually.

- **[S-2] Parallel Execution Validation** (refinement)
  - **Files**: All tests
  - **ACs**: `[AC-2]`
  - **Description**: Verify the entire test suite works concurrently.
  - **Verification**: Run the full suite with `npx playwright test --workers=4` to ensure no database locking or concurrency issues remain.
