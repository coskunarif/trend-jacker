# Implementation Plan — TJ-24: Desktop Tabbed Sidebar & Live Feed Hydration

This document outlines the design specification and step-by-step test-driven implementation plan to unify the sidebar layout on desktop, hydrate the global activity feed, and style controls with high fidelity.

---

## 🎯 Target Specifications

### 1. Unified Tabbed Sidebar & Scroll Heights
- **Desktop Switcher**: The mobile `.sidebar-tabs` controller will be made visible on desktop (`display: flex;` instead of `display: none;`).
- **Dynamic Panels Visibility**: Tab switching classes (`.sidebar-panel.show-sentiment` / `.sidebar-panel.show-trending`) will be moved outside of mobile media queries to govern layout on both mobile and desktop viewports.
- **Scroll Heights**: Active panels (`#trends-list` and `.live-feed-section`) will take 100% of the remaining sidebar height when visible (`flex: 1 1 auto; height: 100%;` with `overflow-y: auto;`).
- **UI Styling**: The tab switcher `.sidebar-tabs` will be styled as a high-fidelity pill-segmented control with smooth transitions, round borders, and active/hover visual indicators matching the dark/neon theme.

### 2. Server-Side Memory Activity Log & Staggered Seeding
- **Memory Queue**: Introduce `recentActivityLog` queue capped at 15 items in `server.js`.
- **Chronological Staggered Seeding**: On startup, seed the queue with 10 mock historical votes. The timestamps must be staggered chronologically backward in time (e.g. up to 15 minutes ago) to simulate organic history.
- **Mock Topics**: Mock entries will dynamically select topics from `latestTrends` (falling back to `DEFAULT_TRENDS` if empty) to ensure relevance.
- **User Vote Logging**: The POST `/api/poll` endpoint must add user-submitted votes directly to `recentActivityLog` and broadcast them via SSE.

### 3. Client Timezone-based Geolocation & User Vote Attribution
- **Location Resolution**: In `app.js`, use the client's timezone `Intl.DateTimeFormat().resolvedOptions().timeZone` to detect their country/city and format it as `[City], [Country]`. If unresolved, fallback to a clean `You` badge.
- **Client Identity**: Generate a unique client identifier `localClientId` on initialization (saved in memory) and include it in `POST /api/poll` payloads.
- **Attribution (You)**: In the SSE broadcast feed, if an event matches `localClientId`, append `(You)` to the user location text to reinforce interaction.

### 4. Batched SSE Hydration Stream
- **Option B (Batch Event)**: Upon client SSE connection at `/api/sentiment-stream`, immediately stream all 10-15 stored logs in a single batch initialization event (`event: 'hydration'`).
- **Flicker-free Client Parsing**: The client `app.js` will listen to the `hydration` event on the `EventSource`, clear the feed list, and render all hydrated records at once. Subsequent live votes will arrive as standard `message` events and prepend individually.

### 5. Pinned Static Explanation Banner
- **Placement**: A banner will be pinned statically below the tab header (above the scrolling feed) inside the `.live-feed-section`.
- **Dismissibility**: The banner will have a close (`×`) button, persisting its dismissed state in `localStorage` so it does not reappear on reload.
- **Copy**: *"This feed displays live community sentiment from around the world. Select any trending topic to cast your vote!"*

---

## 🛠️ Detailed Step-by-Step Execution Plan

### Step 1: Automated Test Suite (Militant TDD)
*Goal: Write all tests in a new file `tests/sidebar-hydration.spec.js` and verify they fail before writing application code.*

1. **Verify Startup Hydration & Staggered Timestamps**:
   - Navigate to `/` and intercept SSE stream `/api/sentiment-stream`.
   - Send `event: hydration` with 10 staggered mock objects.
   - Assert the client clears the empty state and renders all 10 feed items correctly.
2. **Verify Desktop Tab Toggle & Scroll Heights**:
   - Set viewport to desktop (`1280x800`).
   - Assert `.sidebar-tabs` is visible.
   - Click "Sentiment Feed" tab and assert `#trends-list` is hidden, and `.live-feed-section` is visible taking 100% relative height.
3. **Verify Timezone Location & User Vote Attribution**:
   - Mock POST `/api/poll` to return updated poll counts.
   - Mock client timezone resolver (e.g. mock resolved options to return `Europe/London`).
   - Trigger a vote and verify payload includes a timezone-resolved location and `clientId`.
   - Intercept SSE and broadcast a message matching `clientId`. Assert the feed card appends `(You)` to the location.
4. **Verify Dismissible Static Banner**:
   - Verify the explanation banner copy is correct.
   - Click close (`×`) on the banner and assert it disappears.
   - Reload page and assert it remains hidden (via mocked or real `localStorage` check).
5. **Run tests**:
   - Run `npx playwright test tests/sidebar-hydration.spec.js` and confirm all fail.

### Step 2: Backend Memory Queue & Event Streaming (`server.js`)
*Goal: Implement server-side queue and batch hydration.*

1. Define `recentActivityLog` and `MAX_ACTIVITY_LOG_SIZE = 15`.
2. Write a helper function `seedRecentActivityLog()` that:
   - Fetches active topics from `latestTrends` (or `DEFAULT_TRENDS`).
   - Generates 10 mock votes with locations from `LOCATIONS`.
   - Staggers timestamps chronologically (e.g. `now - i * 1.5 minutes` where `i` goes from 0 to 9).
   - Push to `recentActivityLog`.
3. Call `seedRecentActivityLog()` on server startup (and in test mode initialization).
4. Update the SSE `/api/sentiment-stream` handler:
   - Immediately upon connection, write the batch payload format:
     `event: hydration\ndata: ${JSON.stringify(recentActivityLog)}\n\n`
5. Update POST `/api/poll` endpoint:
   - Accept optional `location` and `clientId` from body.
   - Log vote to `recentActivityLog` and broadcast SSE to all clients with the updated poll percentages.

### Step 3: Frontend Layout & Styling Overhaul (`styles.css` & `index.html`)
*Goal: Update HTML structural panels and modernize CSS styles.*

1. **Modify HTML (`index.html`)**:
   - Place the explanation banner container inside `.live-feed-section` directly above `#live-sentiment-feed`:
     ```html
     <div id="sentiment-explanation-banner" class="explanation-banner">
       <span>This feed displays live community sentiment from around the world. Select any trending topic to cast your vote!</span>
       <button id="btn-close-banner" aria-label="Dismiss banner">&times;</button>
     </div>
     ```
2. **Move tab layout rules outside media query (`styles.css`)**:
   - Apply `.sidebar-panel.show-sentiment .scroll-container` and other tab toggle classes at root level so they affect both desktop and mobile.
   - Make `.sidebar-tabs` visible (`display: flex;`) at all viewport sizes.
3. **Style Pill-Segmented Tab Control**:
   - Modernize `.sidebar-tabs` as a dark, round container with inner pill buttons.
   - Style `.tab-btn` to use `border-radius: 99px;` and have a active visual transition state.
4. **Modernize Feed Cards**:
   - Style `.feed-item` with clean borders, raised background, card shadow, status badges for `genius`/`overrated`, and clear typography.
5. **Style Explanation Banner**:
   - Design `.explanation-banner` with static height, semi-transparent purple/gray border and background, nice text colors, and absolute/flex layout for the close button.

### Step 4: Client-Side Hydration, Timezone & Attribution Logic (`app.js`)
*Goal: Complete frontend event listeners and voting payload extensions.*

1. **Client Identity**:
   - Generate a random `localClientId` string on load and store it in-memory.
2. **Timezone Geolocation Mapper**:
   - Create a helper mapping common timezones to `{ city, country, flag }` objects:
     - e.g. Timezones containing `London` -> London, United Kingdom 🇬🇧
     - Timezones containing `New_York`, `Chicago`, `Los_Angeles` -> New York, United States 🇺🇸
     - Timezones containing `Tokyo` -> Tokyo, Japan 🇯🇵
     - Include 10-12 major fallback mappings for other continents (Europe, Asia, Americas, Australia).
     - Fallback to `{ city: '', country: '', flag: '📍' }` if unresolved.
3. **EventSource Listeners**:
   - Add listener for `hydration` event:
     - Clear the feed list.
     - Parse array and render all feed items (newest at the top, oldest at the bottom).
     - Check if `clientId === localClientId` to attribute `(You)`.
   - Update `message` event handler to prepend single live votes, keeping list capped at 15 items.
4. **Vote Payload Expansion**:
   - In POST `/api/poll` trigger, detect client location and send `{ trend, vote, location: resolvedLocation, clientId: localClientId }`.
5. **Banner Persistence**:
   - Check `localStorage.getItem('sentiment-banner-dismissed')`. If set, add `hidden` class to `#sentiment-explanation-banner`.
   - Add close event click listener to save state in `localStorage` and hide the banner.

### Step 5: Verification and AutoCover
1. Run Playwright test suite: `npx playwright test`.
2. Address any failing tests or edge cases.
