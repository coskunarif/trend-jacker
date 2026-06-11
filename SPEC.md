# SPEC.md: TJ-30: Interactive Sentiment Timeline Dashboard

## Acceptance Criteria

- **[AC-1] Database Schema & API Endpoint**
  - GET `/api/poll/history?trend=<trend>` returns a JSON array containing 8 to 10 chronologically sorted timeline points.
  - Each timeline point must have `timestamp` (ISO string), `geniusPercentage` (integer, 0-100), and `velocity` (integer, >= 0).
  - If a trend has no prior voting history, the server must automatically seed realistic randomized historical baseline data (between 8 and 10 segments over the past 24 hours) and persist it to the local SQLite/in-memory store.
  - Verification: Handled via API checks in Playwright tests matching `tests/sentiment-timeline.spec.js`.

- **[AC-2] Frontend Timeline Container & Layout**
  - A card container labeled "Interactive Sentiment Timeline" must render inside the active trend view.
  - The container must house a canvas with ID `sentiment-timeline-canvas` and a tooltip element with ID `timeline-tooltip`.
  - Verification: Query selectors `.timeline-card-wrap`, `#sentiment-timeline-canvas`, and `#timeline-tooltip` are visible in DOM.

- **[AC-3] Canvas Rendering & Fluid Animations**
  - The canvas must draw a line graph representing the cumulative genius percentage over time, and bar graphs representing voting velocity (activity) per interval.
  - The chart must resize responsively when the window is resized.
  - Submitting a vote (Genius/Overrated) must update the timeline data and trigger a fluid, animated transition of the line and bars to their new values.
  - Verification: Checking canvas rendering and interaction updates via Playwright tests.

- **[AC-4] Interactive Hover Tooltips**
  - Moving the cursor over the canvas coordinates must identify the closest timeline point along the X-axis.
  - A tooltip with ID `timeline-tooltip` must appear at the correct coordinate relative to the hovered point.
  - The tooltip must display the formatted time, genius percentage, and voting velocity.
  - Moving the cursor off the canvas must immediately hide the tooltip.
  - Verification: Playwright mouse events trigger showing and hiding of tooltip with expected text.

- **[AC-5] E2E Playwright Tests**
  - Full automated coverage in `tests/sentiment-timeline.spec.js` asserting correct status codes, data properties, rendering, voting interactions, and tooltips.
  - Verification: Running `npx playwright test tests/sentiment-timeline.spec.js` executes successfully.

## Out of Scope
- Real-time WebSockets synchronization (simulated intervals/polling/manual refresh is sufficient).
- Advanced chart configurations (e.g., zoom/pan controls, custom date ranges outside the 24-hour baseline).

## Slices

- **[S-1] API & Seeding**
  - **Description**: Expose the `/api/poll/history` endpoint in `server.js` and implement database helpers in `db.js`.
  - **ACs mapped**: `[AC-1]`
  - **Files**: `server.js`, `db.js`
  - **Independent**: Yes
  - **Test Strategy**: API integration tests.

- **[S-2] Canvas Layout & Draw Loop**
  - **Description**: Set up the HTML5 canvas layout in `public/index.html` and the rendering draw loop in `public/app.js`.
  - **ACs mapped**: `[AC-2]`, `[AC-3]`
  - **Files**: `public/index.html`, `public/app.js`
  - **Independent**: No (depends on S-1 for data points)
  - **Test Strategy**: Playwright component visibility & rendering tests.

- **[S-3] Tooltip & Interaction**
  - **Description**: Add event listeners for mouse interaction, coordinate collision detection, and showing/hiding `#timeline-tooltip` with correct formatting.
  - **ACs mapped**: `[AC-4]`
  - **Files**: `public/app.js`, `public/styles.css`
  - **Independent**: No (depends on S-2)
  - **Test Strategy**: Playwright mouse event E2E testing.

- **[S-4] End-to-End Test Suite Execution**
  - **Description**: Run and verify the comprehensive Playwright test suite `tests/sentiment-timeline.spec.js`.
  - **ACs mapped**: `[AC-5]`
  - **Files**: `tests/sentiment-timeline.spec.js`
  - **Independent**: No
  - **Test Strategy**: E2E test runner execution.
