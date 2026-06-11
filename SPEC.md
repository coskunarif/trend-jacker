# SPEC - Mocking SSE stream for baseline E2E test stability

## Acceptance Criteria

- **[AC-1] Mock SSE Stream in baseline E2E tests**: The baseline E2E tests in `tests/e2e.spec.js` (specifically `should submit a sentiment vote and update poll percentages` and any other baseline tests performing assertions on poll percentages or UI) must mock the global `/api/sentiment-stream` SSE connection. 
  - Implementation: Inject a `MockEventSource` helper via `page.addInitScript` prior to page load.
  - The `MockEventSource` must override the global `EventSource` constructor and intercept requests to `/api/sentiment-stream`.
  - It should not allow actual network-based SSE ticks to bypass mocking and trigger live UI updates (such as updating poll percentages mid-test).
- **[AC-2] Test Suite Stability**: The complete test suite runs successfully and reliably under parallel execution (e.g. `npm test`), with zero flakiness from background server-sent events.

## Out of Scope
- Modifying backend server logic or SQLite schema for tests.
- Re-implementing the visual timeline or chat message generation APIs.

## Slices

- **[S-1] Intercept/Mock SSE stream in `tests/e2e.spec.js`**
  - **Description**: Add `page.addInitScript` helper to intercept and mock the client's `EventSource` connection in `tests/e2e.spec.js` tests. We can either do this globally in a `beforeEach` hook or specifically in the baseline test `should submit a sentiment vote and update poll percentages`.
  - **Files**: `tests/e2e.spec.js`
  - **AC Mapped**: `[AC-1]`, `[AC-2]`
  - **Test Strategy**: Refinement task. Run `npm test` and verify E2E suite passes cleanly.
