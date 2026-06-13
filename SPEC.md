# Specification — Gamifying Chat Limits with Daily Streaks & Trivia Rewards

This document specifies the design, requirements, and vertical slices to gamify chat limits with daily streaks and trivia rewards, boosting user session duration and retention through engaging visual feedback loops.

---

## 🎨 UI/UX Design & Behaviors

### 1. Active Chat Capacity Progress Bar
* **Element**: A styled progress bar (`#chat-capacity-bar` with inner track `#chat-capacity-fill`) placed inside the "Dig Deeper with AI" card, just above the message history container (`#chat-history`).
* **Visuals**:
  * Progress Fill is color-coded based on percentage of messages used:
    * **< 50%**: Emerald Green (`#10b981`)
    * **50% - 80%**: Amber/Orange (`#f59e0b`)
    * **> 80%**: Rose/Red (`#ef4444`)
  * Displays a text indicator next to it: `Message Capacity: {currentCount} / {allowedLimit}`.
  * Transitions smoothly when capacity updates or messages are sent.

### 2. Daily Streak Pulse Badge
* **Element**: A beautiful animated badge (`#streak-badge-container`) positioned next to the capacity indicator.
* **Visuals**:
  * Shows a fire emoji (`🔥`), the current streak count (e.g. `3-Day Streak`), and the added message bonus (e.g. `+6 capacity`).
  * If the streak is active (count >= 1), the badge executes a CSS pulse keyframe animation (`pulse-streak`) simulating a glowing fire aura using a violet-to-primary shadow/text glow.
  * Updates instantly when the status is retrieved or refreshed.

### 3. Gamified Lock Screen Streak CTA
* **Element**: Inside the `#chat-lock-container`, add a specialized section detailing the daily streak bonus.
* **Visuals**:
  * Explains that return visits tomorrow preserve/extend the daily streak and reward more capacity.
  * Text template: `Come back tomorrow to keep your 🔥 {nextStreakCount}-Day streak alive and unlock +{nextStreakBonus} messages!`

### 4. Dynamic Unlocking Animations & Toast Overlay
* **Unlocking Transition**: When chat limit transitions from locked to unlocked:
  * `#chat-lock-container` fades out smoothly (`opacity` 1 -> 0) and `#chat-form` fades in (`opacity` 0 -> 1) over `300ms`.
  * Avoid raw style replacement; use CSS transition classes.
* **Celebration Toast**:
  * Renders a temporary toast notification (`#chat-unlock-toast`) at the top of the chat panel.
  * Displays: `Capacity Unlocked! +{rewardCount} messages available.`
  * Automatically fades out and is removed after `2.5` seconds.

---

## 🎯 Acceptance Criteria

### `[AC-1]` SQLite/Firestore Streak Persistence & Helpers
- **SQLite Table**: `client_streaks` must be created automatically during db initialization with columns:
  - `client_id TEXT PRIMARY KEY`
  - `streak_count INTEGER DEFAULT 1`
  - `last_active_date TEXT` (stored as `YYYY-MM-DD` string).
- **Firestore Schema**: A collection named `client_streaks` with documents named after normalized client IDs, containing `client_id`, `streak_count` (number), and `last_active_date` (string).
- **Helpers**: `updateClientStreak(clientId, localDate)` and `getClientStreak(clientId)` must be implemented and exported from `db.js`.
  - Normalization: Normalize `clientId` to lowercase and trim.
  - If no record exists: Insert record with `streak_count = 1` and `last_active_date = localDate`.
  - Let `diff` be calendar day difference between `localDate` and the stored `last_active_date`:
    - **diff == 0**: Keep `streak_count` unchanged. Update `last_active_date = localDate`.
    - **diff == 1**: Increment `streak_count = streak_count + 1`. Update `last_active_date = localDate`.
    - **diff > 1 or diff < 0**: Reset `streak_count = 1`. Update `last_active_date = localDate`.
- **Fallback**: Implement in-memory Map fallback `inMemoryClientStreaks` if both SQLite and Firestore are unavailable.

### `[AC-2]` Backend API & Chat Limit Logic Integration
- **GET `/api/chat-limit`**:
  - Accept optional `localDate` query parameter (format `YYYY-MM-DD`, e.g. `2026-06-13`).
  - If `clientId` and `localDate` are provided, execute `updateClientStreak(clientId, localDate)` before returning counts.
  - JSON payload must return: `{ limitReached, currentCount, allowedLimit, streakCount, streakBonus }`.
- **Capacity Formula**: Streak bonus is `2 * streakCount` messages.
  - `allowedLimit = 3 + 5 * referralCount + triviaBonus + (streakCount * 2)`.
- **Integrations**: Both `POST `/api/trivia/score`` and `POST `/api/chat`` must use the identical capacity formula to decide limit locks and calculate available capacity.

### `[AC-3]` Chat Capacity Progress Bar UI
- **HTML Element**: Insert `#chat-capacity-bar` containing `#chat-capacity-fill` and text label `#chat-capacity-text` inside the Dig Deeper with AI card in `public/index.html`.
- **Visual Color-coding**:
  - CSS rule updates fill background-color:
    - `< 50%` used: `#10b981` (green)
    - `50% - 80%` used: `#f59e0b` (orange)
    - `> 80%` used: `#ef4444` (red)
- **State Update**: Updates dynamically when the active trend loads, after a message is sent successfully, or when status is checked/unlocked.

### `[AC-4]` Dynamic Daily Streak UI Badge
- **HTML Element**: Place `#streak-badge-container` inside the Q&A card in `public/index.html`.
- **Visuals**:
  - Renders a fire icon (`🔥`), streak count (e.g. `3-Day Streak`), and bonus (e.g. `+6 capacity`).
  - Pulsing fire glow effect via keyframes `pulse-streak` on active streaks.
  - Must remain hidden or styled as inactive (e.g., translucent grey) if streak count is 0.

### `[AC-5]` Lock Screen Streak Retention CTA
- **Text & Math**: `#chat-lock-container` displays:
  - The current active streak & bonus message capacity.
  - A retention prompt: `Come back tomorrow to keep your 🔥 {nextStreakCount}-Day streak alive and unlock +{nextStreakBonus} messages!`
  - Next streak count is `streakCount + 1`. Next streak bonus is `(streakCount + 1) * 2`.

### `[AC-6]` Smooth Unlock Transition & Celebratory Toast
- **Unlock Animation**:
  - Transition chat container: Fade-out `#chat-lock-container` (`opacity` 1 -> 0) and fade-in `#chat-form` (`opacity` 0 -> 1) over `300ms` when unlocked.
- **Celebration Toast**:
  - Display `#chat-unlock-toast` at the top of the chat layout with text `Capacity Unlocked! +{rewardCount} messages available.`.
  - Dismiss/fade out automatically after `2.5` seconds.

---

## 🚫 Out of Scope

- Real user authentication, session-duration tracking, or persistence across multiple physical devices.
- Direct push notifications, email alerts, or SMS marketing for retention.

---

## 📅 Vertical Slices

### `[S-1] DB Streak Schema & Logic Helpers` (Independent)
* **ACs Mapped**: `[AC-1]`
* **Files**: `db.js`
* **Description**: Create SQLite `client_streaks` schema block and write helper functions `updateClientStreak` and `getClientStreak` (including Firestore + in-memory fallback mappings).

### `[S-2] Server Endpoint Integration` (Depends on S-1)
* **ACs Mapped**: `[AC-2]`
* **Files**: `server.js`
* **Description**: Integrate streak calculations into `/api/chat-limit` (accepting `localDate`), `/api/trivia/score`, and `/api/chat` limit checks. Update the allowed limit equation.

### `[S-3] Frontend Capacity Progress & Streak Badge UI` (Independent)
* **ACs Mapped**: `[AC-3]`, `[AC-4]`, `[AC-5]`
* **Files**: `public/index.html`, `public/styles.css`
* **Description**: Structure the DOM elements for progress bar, streak badge, and toast. Add css rules, color-coding transitions, and pulsing animations.

### `[S-4] Reactive UI Synchronization & Unlock Transitions` (Depends on S-2, S-3)
* **ACs Mapped**: `[AC-6]`
* **Files**: `public/app.js`
* **Description**: Implement javascript logic to calculate local date client-side, pass it to APIs, render the progress bar and streak badge dynamically, trigger lock-to-unlock animations, and display celebratory toast notifications.
