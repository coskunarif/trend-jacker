# Specification — Gamified User Achievement Dashboard

This specification defines the requirements, acceptance criteria, test strategy, and implementation slices to build a unified **Gamified User Achievement Dashboard** within TrendJacker. This dashboard will consolidate daily streaks, trivia milestones, and trend predictions into a single interactive view to drive repeat visits and viral retention.

---

## 🎯 Acceptance Criteria

### [AC-1] Toggleable Achievements Dashboard View
* **Trigger**: Clicking the top navbar button (`#btn-show-achievements`) or the sidebar link (`#sidebar-show-achievements`) must transition the main explainer panel to the achievements dashboard view (`#achievements-view`).
* **Transition**: The toggle must occur synchronously in the event handler (no awaiting of API requests before toggling visibility class `hidden`) to prevent yielding the event loop and E2E race conditions.
* **Exit**: Clicking any trend item in the left sidebar (`#trends-list .trend-item`) must immediately hide `#achievements-view` and show `#explainer-view` or `#explainer-skeleton`.
* **Responsive Layout**: The dashboard grid must align with the `320px 1fr` responsive grid layout on desktop and stack to `1fr` on mobile. Side panels must prevent scrollbar clutter and outer layout leakage by isolating with `overflow: hidden` and applying `overflow-y: auto` to the inner scrollable container.

### [AC-2] Unified Stats Room Grid
* **UI**: The achievements dashboard must display a responsive grid (`.achievements-stats-grid`) consisting of 4 stats cards:
  1. **Streak Stats**: Displays the active daily streak count (e.g. `🔥 3-Day Streak`) and the total message capacity bonus unlocked.
  2. **Trivia Stats**: Displays the total completed quizzes count and average score out of 3.
  3. **Prediction Stats**: Displays the correct prediction count, total predictions made, and the accuracy percentage.
  4. **Referral Stats**: Displays the total number of referrals and the total referral capacity bonus.

### [AC-3] Interactive Badges Gallery
* **UI**: The dashboard must display a visual grid of 9 milestone badges, each styled as a modern glass-card with a themed emoji/badge graphics, title, and unlock criteria.
* **States**:
  * **Unlocked**: Styled with full color opacity, glowing borders, and an unlocked indicator.
  * **Locked**: Styled with `opacity: 0.4`, grayed-out colors, a lock emoji/badge, and the criteria instructions.
* **Badge Matrix**:
  1. **Explorer**: Total activity (trivia quizzes + predictions) > 0.
  2. **Streak Starter**: Daily streak >= 1.
  3. **Consistent Reader**: Daily streak >= 3.
  4. **Weekly Legend**: Daily streak >= 7.
  5. **Sharp Challenger**: Maximum score on any trivia challenge >= 2.
  6. **Brainiac Mastermind**: Maximum score on any trivia challenge = 3.
  7. **Apprentice Oracle**: Total predictions made >= 1.
  8. **Ultimate Seer**: Total resolved correct predictions >= 3.
  9. **Viral Pioneer**: Total referrals >= 1.

### [AC-4] Unified Activity History Log
* **UI**: Displays a reverse-chronological scrollable list of the user's completed milestones (trivia challenges, resolved predictions, active streaks).
* **Format**:
  * Trivia: "Completed trivia for **[Trend]** with score [Score]/3 on [Date]"
  * Prediction: "Predicted **[Outcome]** on **[Trend]** - [Resolved Status] on [Date]"
* **Edge Case**: If the history is empty, a clean fallback text "No achievements recorded yet. View a trend to start your journey!" must be rendered.

### [AC-5] Asynchronous Data Hydration
* **Behavior**: Stats, badge states, and history logs must load asynchronously in the background. The frontend must hit `GET /api/achievements?clientId=<id>` to retrieve the user's stats dynamically.
* **Instant Update**: Completing a trivia challenge, placing a prediction, or logging a streak update must asynchronously trigger an immediate cache invalidation and reload of the achievements data to keep the UI synchronized without requiring a page reload.

### [AC-6] Casing & Caching Robustness
* **Database & Server**: The `GET /api/achievements` endpoint and all underlying helper queries must trim and lowercase the incoming `clientId` to prevent duplication of streaks or trivia stats.
* **Compatibility**: Must work correctly with SQLite, Firestore, and Memory fallback layers.

---

## 🚫 Out of Scope
* Creating or editing custom image assets or media files (uses standard emojis and SVG icons).
* Implementing global leaderboards for predictions or streaks (only localized trivia leaderboard is in scope).
* Awaiting third-party integrations or external APIs.

---

## 🚀 Slices

### [S-1] Backend API & Database Helpers
* **Objective**: Define DB queries and backend routes for user achievement aggregation.
* **Files**: `db.js`, `server.js`
* **ACs Mapped**: `[AC-6]`
* **Tasks**:
  * Implement `getClientAchievements(clientId)` in `db.js`. It must normalize `clientId` (trim, lowercase) and query:
    * Streaks count from `client_streaks`.
    * Trivia score statistics (count, average score, maximum score) from `client_trivia_scores`.
    * Predictions count categorized by status (correct, incorrect, pending) from `client_predictions`.
    * Referral count from `client_referrals`.
  * Support both SQLite, Firestore, and InMemory mock pathways.
  * Define `GET /api/achievements` in `server.js`, validating and normalizing `clientId` from request queries and returning the aggregated payload.

### [S-2] Dashboard HTML & CSS Layout
* **Objective**: Build the dashboard container structure, navigation entry points, and responsive styling.
* **Files**: `public/index.html`, `public/styles.css`
* **ACs Mapped**: `[AC-1]`, `[AC-2]`, `[AC-3]`
* **Tasks**:
  * Insert `#achievements-view` inside `<section class="main-panel">` in `public/index.html` as a sibling to `#explainer-view`.
  * Add navigation buttons: `#btn-show-achievements` in the header navbar and `#sidebar-show-achievements` in the sidebar.
  * Define CSS grid layouts for `.achievements-stats-grid`, `.badges-gallery-grid`, and scrollable `.achievements-history-list` inside `public/styles.css`. Ensure no scrollbar duplication and double overflow.

### [S-3] Frontend State, Toggles, and Hydration
* **Objective**: Drive view toggles and render the stats, badge unlocks, and history dynamically on the client.
* **Files**: `public/app.js`
* **ACs Mapped**: `[AC-1]`, `[AC-4]`, `[AC-5]`
* **Tasks**:
  * Bind click listeners to navbar/sidebar achievement buttons to synchronously toggle active panel view (`.classList.add('hidden')` and `.classList.remove('hidden')`).
  * Ensure selecting a trend in the sidebar closes the achievements dashboard and displays the explainer skeleton.
  * Fire off asynchronous background promise to fetch `/api/achievements?clientId=${localClientId}` and hydrate the stats cards, badge state rules, and list items.
  * Hook into trivia submissions, prediction submissions, and page load routines to fetch latest limits and achievements stats asynchronously.

---

## 🧪 Test Strategy
* **Task Type**: Additive
* **Strategy**: Tests First (Tester writes specification verification tests before implementation begins).
* **Test Plan**:
  * Unit/Integration: Verify `getClientAchievements` returns normalized casing counts correctly under SQLite and memory fallbacks. Test the API endpoint returns 200 with the aggregated payload.
  * E2E:
    * Assert clicking achievements buttons toggles `#achievements-view` visible and hides active explainer/welcome views immediately.
    * Assert selecting a trend switches back to the explainer view.
    * Verify that stats cards populate with correct values retrieved from route mocks.
    * Verify badge colors/opacities and locks display correctly based on mocks (e.g. `Weekly Legend` is locked at 2-day streak, unlocked at 7-day streak).
    * Verify the history log lists items correctly or shows the fallback message when empty.
