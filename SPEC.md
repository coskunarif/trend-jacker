# Specification - Interactive Sentiment History

## Acceptance Criteria

### `[AC-1]` Lowercase Case-Insensitive Cache & DB Lookups
- The backend must normalize the trend name query parameter to lowercase in the `/api/poll/history` route handler.
- Database access and caching methods in `db.js` (`getPollData`, `incrementVote`, `getVoteEvents`, `seedVoteEvents`) must sanitize and normalize the `trend` parameter using `.toLowerCase()` to prevent case mismatch cache misses, duplicate seeds, or duplicate database records.
- Verified by sending subsequent GET requests to `/api/poll/history` with different casings (e.g. `Google Gemini` and `google gemini`) and ensuring they return the exact same stable, chronologically sorted dataset.

### `[AC-2]` Sentiment Comparison Selector in UI
- A dropdown selection element `#compare-trend-select` must be added to the header area of the Interactive Sentiment Timeline card.
- The dropdown list must be populated dynamically with options corresponding to all available trends in the client state (excluding the currently active trend).
- Changing the selected option must fetch the selected trend's history from `/api/poll/history?trend=<compared-trend>`.
- The user selector change listener must guard against redundant actions: if the clicked option is already active or matches the current compared trend, the handler must return early without triggering a new network request.

### `[AC-3]` Overlay Comparative Sentiment Chart Canvas
- The HTML5 canvas timeline chart must support overlay rendering:
  - **Active Trend Line**: Styled with a solid emerald line (`#10b981`, width 3, circular points) and translucent green area fill (`rgba(16, 185, 129, 0.25)`).
  - **Compared Trend Line**: Styled with a solid purple line (`#a855f7`, width 3, circular points) and translucent purple area fill (`rgba(168, 85, 247, 0.15)`).
- If no comparison trend is selected, only the active trend line and fill are rendered.
- The canvas must update dynamically, resize responsively, and handle updates when new votes are received.

### `[AC-4]` Comparative Interactive Tooltip
- When a comparison trend is active, hovering over the timeline canvas must display a tooltip containing data for BOTH trends for the hovered time segment.
- The tooltip must clearly label the statistic for each trend (e.g., `Google Gemini: 75% Genius | OpenAI Search: 60% Genius`).
- The tooltip positioning must be computed dynamically relative to the cursor position and must not crash at canvas boundaries.

### `[AC-5]` Event Loop Yield Safety & Async Limit Updates
- Limit checks, referral lookups, or other non-critical API requests triggered on user interaction or voting must be executed as un-awaited background promises or after the main render block to prevent blocking the event loop and causing test race conditions.

## Out of Scope
- Modifying other infographic cards, changing the viral social media post generator logic, or introducing new database tables/schema migrations.
- Changing the underlying 10-point 24-hour segmentation logic in the backend history API.

## Slices

### `[S-1]` Case-Insensitive Casing Normalization in Backend and DB
- **AC Mapping**: `[AC-1]`
- **Files**: `db.js`, `server.js`
- **Details**: Implement `.toLowerCase()` normalization for `trend` keys in `db.js` (`getPollData`, `incrementVote`, `getVoteEvents`, `seedVoteEvents`) and in `server.js` (for route query parameters).
- **Dependency**: None

### `[S-2]` Implement Selector UI for Sentiment History Comparison
- **AC Mapping**: `[AC-2]`
- **Files**: `public/index.html`, `public/styles.css`, `public/app.js`
- **Details**: Insert the `#compare-trend-select` element in the Interactive Sentiment Timeline card header. Style the dropdown component. Create `populateCompareSelect()` in `public/app.js` to dynamically add non-active trend options.
- **Dependency**: None

### `[S-3]` Implement Selector Change Handler with Fetch Logic & Guards
- **AC Mapping**: `[AC-2]`, `[AC-5]`
- **Files**: `public/app.js`
- **Details**: Attach selector change listener with active-option guard. Fetch history dataset for comparison trend and handle success/failure states gracefully.
- **Dependency**: `[S-2]`

### `[S-4]` Overlay Canvas Rendering & Comparative Tooltip
- **AC Mapping**: `[AC-3]`, `[AC-4]`
- **Files**: `public/app.js`
- **Details**: Refactor `drawTimelineChart()` to draw dual lines and area fills when `compareTimelinePoints` exists. Update the hover interaction tooltip `#timeline-tooltip` to show formatted comparative details side-by-side.
- **Dependency**: `[S-3]`
