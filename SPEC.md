# Spec: Fix Test Flakiness (Responsive Grid & Tooltip)

## Acceptance Criteria

- **[AC-1] Stabilize Responsive Grid E2E Layout Checks**:
  - Eliminate the flaky `page.waitForTimeout` inside `tests/responsive.spec.js`.
  - Use Playwright's auto-retrying assertions or `expect().toPass()` blocks to verify the coordinates and alignment of the grid cards (`#card-viral-vibe`, `#card-live-sentiment`, `#card-snapshot-share`) after viewport resizing.
  - Allow layout adjustments and any active CSS/View transitions to settle before measuring bounding boxes.

- **[AC-2] Stabilize Timeline Hover Tooltip E2E Checks**:
  - Prevent race conditions by explicitly waiting for the network response of `/api/poll/history` (using `page.waitForResponse`) before performing the mouse hover action in `tests/sentiment-timeline.spec.js`.
  - Ensure the tooltip visibility and positioning checks (`left` and `top` style properties) are wrapped in auto-retrying assertions or `expect().toPass()` blocks to tolerate CPU latency and view transition delays.

## Out of Scope
- Modifying the styling or HTML structures of the grid and timeline tooltip themselves, unless absolutely necessary to resolve layout bugs.
- Changing test coverage beyond the flakiness of responsive grid layout and hover tooltips.

## Slices

- **[S-1] Tooltip Hover Test Refinement**:
  - **Description**: Add `page.waitForResponse` for the `/api/poll/history` endpoint in the hover tooltip tests inside `tests/sentiment-timeline.spec.js` to ensure the chart data has loaded before testing hover functionality. Wrap tooltip verification in auto-retrying assertions.
  - **Files**: `tests/sentiment-timeline.spec.js`
  - **Test Strategy**: Refinement. Update existing hover tests to guarantee async data is loaded.

- **[S-2] Responsive Grid Test Refinement**:
  - **Description**: Replace hardcoded `waitForTimeout` with robust, auto-retrying assertions (e.g. `expect().toPass()`) in `tests/responsive.spec.js` to allow layouts to stabilize after resizing viewports.
  - **Files**: `tests/responsive.spec.js`
  - **Test Strategy**: Refinement. Verify the grid layout under desktop and mobile viewports cleanly passes under CPU load simulation.
