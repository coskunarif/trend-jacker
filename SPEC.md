# Specification - Eliminate Localization Test Flakiness

## Acceptance Criteria

### `[AC-1]` Sequential Test Execution
- Playwright tests must be configured to run with a single worker (`workers: 1` or equivalent) to prevent database lockups/race conditions on the shared SQLite database file (`polls.db`) when run in parallel.
- Verified by checking that `playwright.config.js` explicitly defines the `workers: 1` configuration.

### `[AC-2]` Async Request Synchronization in E2E Switcher Test
- The E2E language switcher test in `tests/localization.spec.js` must asynchronously wait for the mock API response of `/api/explain` using `page.waitForResponse(...)` after changing the select element option.
- Verified by checking that `expect(apiExplainRequestData).toBeDefined()` is asserted only *after* the promise returned by `page.waitForResponse` is fully resolved.

### `[AC-3]` Polling Assertions for DOM State Updates
- The E2E test must utilize Playwright's auto-retry assertions (e.g. `expect(locator).toContainText()`) to verify elements populated by the `/api/explain` request, ensuring they are evaluated after the DOM has updated.
- Verified by checking that UI assertions like `#detail-hook`, `#detail-what`, and `#detail-takeaway` do not rely on hardcoded timeouts or non-retrying assertions.

## Out of Scope
- Modifying actual translations in `UI_DICTIONARY`, language fallback handling, or SEO tag generation logic.
- Schema migrations or refactoring of SQLite database functions (`db.js`).

## Slices

### `[S-1]` Configure Playwright Single-Worker Execution
- **AC Mapping**: `[AC-1]`
- **Files**: `playwright.config.js`
- **Details**: Configure the number of workers in `playwright.config.js` to 1.
- **Dependency**: None

### `[S-2]` Implement Async Response Await in Localization E2E Test
- **AC Mapping**: `[AC-2]`, `[AC-3]`
- **Files**: `tests/localization.spec.js`
- **Details**: Refactor the dropdown interaction test to wait for the `/api/explain` POST response before running payload and DOM assertions.
- **Dependency**: `[S-1]`
