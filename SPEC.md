# Specification - News Footer Test Suite Stability

## Acceptance Criteria

- **[AC-1] Synchronous and Atomic Detail View Rendering**: All UI detail view elements—including the hero image (`#detail-hero-image`), title (`#detail-title`), hook (`#detail-hook`), sentiment charts, and the news context footer (`.news-footer-card` elements like favicon image, source, separator, headline, blockquote, and link)—must update synchronously and atomically in a single execution block without yielding control to the browser event loop via `await` statements.
- **[AC-2] Flakiness-Free E2E Verification**: The Playwright test suite (`tests/og-favicon.spec.js`) must pass 100% of the time, specifically verifying that clicking between multiple trends updates the footer favicon, news content, and hero image correctly, without any async race condition failures.

## Out of Scope
- Modifying the visual layout/design of the news footer or main detail panel.
- Modifying the server-side API endpoints (`/api/chat-limit`, `/api/explain`, etc.).

## Test Strategy
- **Task Type**: Refinement / Bug Fix
- **Strategy**: Update/snapshot tests. Verify that existing E2E tests pass reliably. The Tester will ensure tests are run and confirm they assert the synchronous update correctly.

## Slices

- **[S-1]: Synchronous Chat Limit UI Execution** (Independent)
  - **Files**: `public/app.js`
  - **Acceptance Criteria**: `[AC-1]`, `[AC-2]`
  - **Description**: Remove the `await` statement from the `checkChatLimit(trend.title)` call inside `loadTrendDetails(trend)` in `public/app.js`. This allows the limit check to execute as an un-awaited background promise, preventing it from yielding the JavaScript event loop and allowing the subsequent news footer rendering logic to complete in the same synchronous execution block.
