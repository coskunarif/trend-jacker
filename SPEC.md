# SPEC.md — TJ-30: Interactive Sentiment Timeline Dashboard

## Acceptance Criteria

- **[AC-1] Database Schema and API Endpoint**
  - Update `db.js` to create and maintain a `vote_events` table (SQLite) to store each individual vote with `trend`, `vote` ('genius' or 'overrated'), `timestamp` (DATETIME), and location details.
  - Implement a new API endpoint `GET /api/poll/history?trend=<trend_name>` in `server.js`.
  - The endpoint must return an array of timeline points (at least 8-10 points) representing sentiment changes (Genius % ratio) and voting velocity (count of votes in that period).
  - If a trend has no historical votes, the endpoint must dynamically generate a realistic, randomized historical baseline of mock votes spanning the last 24 hours so the timeline is never blank on load.
  - *Verification*: A fetch request to `/api/poll/history?trend=Google%20Gemini` returns a 200 status with JSON data containing timestamps, genius percentage, and vote velocity.

- **[AC-2] Frontend Timeline Container & Layout**
  - Add a new dashboard card `Interactive Sentiment Timeline` containing a `<canvas id="sentiment-timeline-canvas">` inside `public/index.html` (replacing or augmenting the existing gauge/chart layout).
  - The card must fit fluidly into the responsive grid layout, respect dark-mode styles, and handle canvas size scaling correctly on high-DPI screens (retina scaling).
  - *Verification*: Locate the canvas in the DOM and ensure it doesn't overflow its parent container on mobile or desktop viewports.

- **[AC-3] Canvas Rendering & Fluid Animations**
  - Develop a custom timeline drawer in `public/app.js` using the 2D HTML5 Canvas API.
  - The chart must display two layers: a smooth line/gradient area representing the Genius % sentiment curve, and bars representing the voting velocity.
  - Animate the rendering of the line (e.g. ease-in scale or progressive stroke draw) when a trend is loaded.
  - When a new vote is received (user vote or simulated vote via SSE), the chart must animate the addition of the new data point (smooth transition / slide).
  - *Verification*: Visually confirm that selecting a trend or casting a vote triggers a smooth transition/animation on the canvas.

- **[AC-4] Interactive Hover Tooltips**
  - Add mouse movement event listeners to the canvas to track the cursor position relative to the plotted timeline coordinates.
  - When the cursor is near a data point, show an interactive HTML-based or canvas-rendered tooltip showing details: the timestamp, sentiment percentage (e.g., "75% Genius"), and velocity (e.g., "12 votes/hr").
  - The tooltip must hide when the cursor leaves the canvas area.
  - *Verification*: Hovering over different segments of the canvas triggers the appearance of the tooltip element with dynamic, matching data.

- **[AC-5] E2E Playwright Tests**
  - Write comprehensive E2E tests in a new file `tests/sentiment-timeline.spec.js` using Playwright.
  - The tests must mock the `/api/poll/history` response, check that the canvas is successfully mounted, simulate canvas hover triggers to verify tooltip visibility, and ensure live vote events trigger updates.
  - **Important constraint**: Do not conditionally disable the View Transitions API based on `navigator.webdriver`.
  - *Verification*: Run `npx playwright test tests/sentiment-timeline.spec.js` and verify all tests pass.

## Out of Scope
- Time-series database integration (e.g., InfluxDB). All data is persisted in SQLite with a simple runtime fallback.
- Zooming/Panning interactions on the timeline chart. The timeline will show a fixed 10-point historical window.

## Slices

- **[S-1] Test Framework & Mocking Setup** (Independent)
  - *Strategy*: Additive task -> tests first.
  - *AC mapped*: `[AC-5]`
  - *Files*: `tests/sentiment-timeline.spec.js`
  - *Description*: Create the test suite declaring mocks for the history endpoint and checking layout, canvas container, and tooltip interactions.

- **[S-2] Database & API History Endpoint**
  - *AC mapped*: `[AC-1]`
  - *Files*: `db.js`, `server.js`
  - *Description*: Add SQLite table `vote_events`, update `incrementVote` to insert rows, and create `GET /api/poll/history` with auto-seeded baselines.

- **[S-3] Frontend HTML/CSS Dashboard Card**
  - *AC mapped*: `[AC-2]`
  - *Files*: `public/index.html`, `public/styles.css`
  - *Description*: Add the timeline card markup and styling into the dashboard layouts.

- **[S-4] HTML5 Canvas Engine, Animations, & Tooltips**
  - *AC mapped*: `[AC-3]`, `[AC-4]`
  - *Files*: `public/app.js`
  - *Description*: Implement canvas drawing logic for the sentiment curve and velocity bars, timeline update animations, SSE connection sync, and cursor hover/tooltip detection.
