# Specification: Daily Streak Recovery Mechanics and Social Achievements

## Introduction
We are introducing daily streak tracking and trivia reward mechanics to increase user retention and sharing virality. Users will build a consecutive daily active streak to earn chat capacity bonuses. If they run out of capacity, a lock screen will prompt them to invite friends or complete a trivia challenge to unlock bonus messages. Successful unlocks will trigger smooth transitions and celebratory notifications.

---

## Acceptance Criteria

### `[AC-1]` SQLite/Firestore Streak Persistence & Helpers
- A `client_streaks` table must exist in the SQLite database (`polls.db`) with columns:
  - `client_id` (TEXT, Primary Key)
  - `streak_count` (INTEGER, Default 1)
  - `last_active_date` (TEXT)
- The database module (`db.js`) must export:
  - `getClientStreak(clientId)`: Returns the client streak info or `null`. Client ID must be trimmed and normalized to lowercase.
  - `updateClientStreak(clientId, localDate)`: Updates or inserts a streak record based on consecutive activity. Client ID must be normalized to lowercase.
  - `inMemoryClientStreaks`: An in-memory `Map` fallback representing client streaks when SQLite/Firestore is not available.
- **Streak Calculation Logic**:
  - `diff = localDate - last_active_date` (in days):
    - `diff === 0`: Same day active, `streak_count` remains unchanged.
    - `diff === 1`: Consecutive day active, `streak_count` increments by 1.
    - `diff > 1` or `diff < 0`: Gap day or past/out-of-order date, `streak_count` resets/initializes to 1.
- *How to verify*: Unit tests (like `tests/daily-streaks-rewards.spec.js` AC-1 tests) importing `db.js` and verifying table columns, key normalization, and correct streak counts on sequential mock calls.

### `[AC-2]` Backend API & Chat Limit Logic Integration
- **`GET /api/chat-limit`**
  - Query parameters: `clientId` (required), `trend` (required), `localDate` (optional).
  - If `localDate` is provided, calls `updateClientStreak(clientId, localDate)` before calculating limit.
  - Calculates allowed chat limit:
    - Formula: `allowedLimit = 3 + 5 * referralCount + triviaBonus + streakBonus`
    - `referralCount` retrieved via `getReferralCount(clientId)`.
    - `triviaBonus`: Based on `getTriviaScore(clientId, trend)`.
      - Score 3 => 5
      - Score 2 => 3
      - Score 0 or 1 => 1
      - Score null/undefined => 0
    - `streakBonus`: `streakCount * 2` (where `streakCount` is retrieved via `getClientStreak(clientId)`).
  - Returns `200 OK` with JSON:
    ```json
    {
      "limitReached": false,
      "currentCount": 0,
      "allowedLimit": 5,
      "streakCount": 1,
      "streakBonus": 2
    }
    ```
- **`POST /api/trivia/score` & `POST /api/chat` limit enforcement**
  - Limit checks are performed using the same capacity formula.
  - In `POST /api/chat`, if limits are enforced and `clientId` is provided:
    - If `currentCount >= allowedLimit`, returns `403 Forbidden` with JSON:
      ```json
      {
        "error": "limit_reached",
        "allowedLimit": 10
      }
      ```
    - Otherwise, increments chat count and processes the query.
- *How to verify*: Integration tests (like `tests/daily-streaks-rewards.spec.js` AC-2 tests) making requests to `/api/chat-limit`, `/api/trivia/score`, and `/api/chat`.

### `[AC-3]` Chat Capacity Progress Bar UI
- A progress bar layout must be rendered inside the AI Q&A card in `public/index.html` consisting of:
  - `#chat-capacity-bar` (container)
  - `#chat-capacity-fill` (progress visual fill)
  - `#chat-capacity-text` (capacity text label)
- The fill bar color (background-color) must dynamically update based on the percentage of used capacity (`(currentCount / allowedLimit) * 100`):
  - Used < 50% => Emerald Green (`rgb(16, 185, 129)` or `#10b981`)
  - Used 50% to 80% => Amber/Orange (`rgb(245, 158, 11)` or `#f59e0b`)
  - Used > 80% => Rose/Red (`rgb(239, 68, 68)` or `#ef4444`)
- The label `#chat-capacity-text` must display the current capacity text in the format:
  - `Message Capacity: X / Y` (where X is `currentCount` and Y is `allowedLimit`).
- *How to verify*: E2E browser tests routing/mocking `/api/chat-limit` responses and asserting class additions and computed background color and text values.

### `[AC-4]` Dynamic Daily Streak UI Badge
- A daily streak badge is rendered in the header of the AI Q&A card inside `#streak-badge-container` (containing `#streak-badge-count` and `#streak-badge-bonus`).
- When streak count is active (streakCount >= 1):
  - The badge container is visible and has class `active` applied.
  - CSS animation `pulse-streak` must run on the container (pulsing glow/shadow using keyframes).
  - Displays the fire emoji (🔥), the active streak count (e.g. `3-Day Streak`), and the capacity bonus (e.g. `+6 capacity`).
- When streak count is inactive (streakCount === 0):
  - The badge is hidden or styled as inactive (hidden or translucent with opacity < 0.5).
- *How to verify*: E2E browser tests asserting the visibility, text content, and CSS properties of `#streak-badge-container`.

### `[AC-5]` Lock Screen Streak Retention CTA
- When a client is locked out of chat (capacity limit reached):
  - The chat form `#chat-form` is hidden, and `#chat-lock-container` is displayed.
  - A streak retention prompt container (`#streak-retention-container`) inside the lock card displays the CTA in `#streak-retention-prompt`.
  - The CTA text must encourage the user to return tomorrow in the format:
    - `Come back tomorrow to keep your 🔥 {nextStreakCount}-Day streak alive and unlock +{nextStreakBonus} messages!` (where `nextStreakCount` is `streakCount + 1` and `nextStreakBonus` is `nextStreakCount * 2`).
- *How to verify*: E2E browser test verifying that the correct CTA message is visible in `#chat-lock-container` when capacity is locked.

### `[AC-6]` Smooth Unlock Transition & Celebratory Toast
- When the chat is unlocked (e.g. user completes the trivia challenge and receives a perfect score of 3, yielding a +5 capacity reward):
  - Lock container `#chat-lock-container` fades out smoothly (opacity goes from 1 to 0 over 300ms) and is hidden.
  - Chat input form `#chat-form` fades in smoothly (opacity goes from 0 to 1 over 300ms) and becomes active.
  - A celebratory toast `#chat-unlock-toast` becomes visible containing the text:
    - `Capacity Unlocked! +{rewardCount} messages available.` (e.g. `Capacity Unlocked! +5 messages available.`).
  - The toast must auto-dismiss (hidden) after 2.5 seconds.
- *How to verify*: E2E browser test that plays trivia to unlock, completes all questions, and checks that the lock container fades out, the chat form becomes visible with opacity 1, and the toast is shown and later hidden.

---

## Out of Scope
- Global user accounts, password-based logins, or central user databases (users are tracked via `clientId` in localStorage/cookies).
- Native calendar/scheduling APIs (streaks are evaluated based on client-provided `localDate` strings).
- Paid streak recovery options (streak recovery is gamified and unlocked via the free trivia/referral loops).

---

## Slices

### `[S-1]` Daily Streak Database Schema & Helpers
- **Description**: Add `client_streaks` SQLite table and export helper functions `getClientStreak` and `updateClientStreak` along with `inMemoryClientStreaks` map.
- **ACs covered**: `[AC-1]`
- **Files**: `db.js`
- **Dependencies**: None.

### `[S-2]` Backend Chat Limit API & Route Integration
- **Description**: Expose `GET /api/chat-limit` and integrate the capacity formula with streak/trivia/referrals into `POST /api/trivia/score` and `POST /api/chat`.
- **ACs covered**: `[AC-2]`
- **Files**: `server.js`
- **Dependencies**: `[S-1]`

### `[S-3]` Chat Capacity Progress Bar & Daily Streak Badge UI
- **Description**: Add capacity bar elements, streak badge container, and lock screen retention container to the HTML, with supporting CSS styles (including `pulse-streak` animations and color-coded progress levels).
- **ACs covered**: `[AC-3]`, `[AC-4]`
- **Files**: `public/index.html`, `public/styles.css`
- **Dependencies**: None.

### `[S-4]` Frontend Controller Logic: Streak Badge & Progress Updates
- **Description**: Integrate streak and capacity status responses into the JS UI controller to dynamically update progress bar colors, text labels, and streak badges on page load and interaction.
- **ACs covered**: `[AC-3]`, `[AC-4]`, `[AC-5]`
- **Files**: `public/app.js`
- **Dependencies**: `[S-2]`, `[S-3]`

### `[S-5]` Smooth Unlock Transitions & Toast Notifications
- **Description**: Implement fade transitions between `#chat-lock-container` and `#chat-form`, along with the celebratory toast `#chat-unlock-toast` display and auto-dismiss timer.
- **ACs covered**: `[AC-6]`
- **Files**: `public/app.js`
- **Dependencies**: `[S-4]`

---

## Test Strategy (Additive)
This is an additive implementation. We follow the **tests first** approach:
1. **Adversarial Test Suite Setup**: The Tester creates the test file `tests/daily-streaks-rewards.spec.js` mapping all the criteria `[AC-1]` through `[AC-6]`.
2. **Greening Pipeline**: The Builder works through slices `[S-1]` to `[S-5]` to gradually bring all assertions in `tests/daily-streaks-rewards.spec.js` from red to green.
3. **Event Loop Yield Safety**: Ensure no async operations yield during atomic rendering blocks to prevent E2E race conditions.
