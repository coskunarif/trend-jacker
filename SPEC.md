# SPEC.md - Gamified Trivia Milestones and Daily Streaks with Shareable Visual Rewards

This specification outlines the acceptance criteria and implementation slices for introducing visual progression, daily streaks visualization, interactive trivia milestones, and shareable high-DPI canvas-based reward cards to drive user retention and social sharing virality.

## Test Strategy
- **Task Type**: Additive
- **Strategy**: Tests First. E2E and unit tests must be written by the Tester to verify the new elements, canvas drawings, and normalization before implementation begins.

## Out of Scope
- Direct integrations with social media platform API uploads (e.g. posting directly to X or Facebook via their REST APIs).
- Drag-and-drop badge customization or manual text drawing on canvas by the user.

## Acceptance Criteria

### [AC-1] Daily Streak Tracker UI & Visual Progression
- **UI Container**: A new visual progress track container `#streak-progress-track` is added to the chat interface (visible within the chat card or lock screen).
- **Daily Track**: It renders 7 consecutive status bubbles/circles representing checking in over a week.
- **Check-in Indicator**: Active days in the streak display a highlighted/colored check-in status (e.g. glowing orange/red 🔥 or filled color). Unfilled days display a translucent or outline shape.
- **Milestone Labels**: Clear text indicators highlight major streak thresholds and rewards:
  - Day 3: "Consistent 🔥 (+6 capacity)"
  - Day 7: "Weekly Legend 👑 (+14 capacity)"
- **Verification**: Locate `#streak-progress-track` and verify it contains 7 child items with correct filled/unfilled statuses matching the streak count from `/api/chat-limit`.

### [AC-2] Shareable Canvas Streak Milestone Card
- **Trigger Button**: A button `#btn-download-streak-reward` is rendered next to the daily streak badge/tracker if the client's current streak is >= 3.
- **Canvas Generation**: Clicking `#btn-download-streak-reward` generates a high-resolution PNG image on a 2400x1260 canvas (scaled 2x for high DPI).
- **Milestone Styling**:
  - Streak 3-6: Fire Orange gradient (`#f97316` to `#ef4444`), milestone name "Consistent Jacker 🔥".
  - Streak 7-14: Space Nebula gradient (`#7c3aed` to `#db2777`), milestone name "Weekly Legend 👑".
  - Streak 15+: Celestial Obsidian gradient (`#1e1b4b` to `#06b6d4`), milestone name "Trend Overlord 🌌".
- **Telemetry & Text content**: The card lists:
  - Heading: "TrendJacker Daily Streak Milestone"
  - Streak length: "X-Day Streak Active!"
  - Capacity Reward: e.g. "Unlocked +X Message Capacity"
  - Nickname: retrieved from local storage or API, fallback to "Anonymous Jacker"
  - CTA Footer: "Build your streak at viraljacker.com"
- **Verification**: Mock a 7-day streak, click `#btn-download-streak-reward`, verify a download event is fired for a filename matching `streak-reward-card-*.png` with exact dimensions 2400x1260 px.

### [AC-3] Interactive Trivia Score Milestones & Badges
- **Trophy Milestones**: When a user completes the trivia challenge and reaches the results screen, display a custom visual badge and title based on their score:
  - 3/3 correct answers: "Brainiac Mastermind" badge 🏆 (+5 capacity bonus)
  - 2/3 correct answers: "Sharp Challenger" badge 🥈 (+3 capacity bonus)
  - <=1/3 correct answers: "Curious Mind" badge 🥉 (+1 capacity bonus)
- **Elements**: Placeholders `#trivia-milestone-title` and `#trivia-milestone-badge` must show the corresponding achievement name and emoji in the results view.
- **Verification**: Complete trivia with a 3/3 score, assert `#trivia-milestone-title` displays "Brainiac Mastermind" and `#trivia-milestone-badge` displays "🏆".

### [AC-4] Shareable Canvas Trivia Milestone Card
- **Trigger Button**: Add a button `#btn-download-trivia-reward` to the `.trivia-results-screen`.
- **Canvas Generation**: Clicking `#btn-download-trivia-reward` dynamically draws a 2400x1260 px PNG image featuring:
  - Header: "TrendJacker Trivia Milestone"
  - Trend Title: e.g. "Google Gemini"
  - Performance Level: "Perfect Score! 🧠" (for 3/3), "Great Attempt!" (for 2/3), or "Trivia Challenger!" (for <= 1/3)
  - Milestone Badge Title: e.g., "Brainiac Mastermind 🏆"
  - Exact Score: e.g., "Score: 3 out of 3"
  - Nickname: retrieved from local storage, fallback to "Anonymous Jacker"
  - Grid pattern matching the user's answers (e.g. `🟩🟩🟩`).
  - CTA Footer: "Test your intelligence at viraljacker.com"
- **Verification**: Complete trivia, click `#btn-download-trivia-reward`, verify file name matching `trivia-reward-card-*.png` download event triggers, and image dimensions are 2400x1260 px.

### [AC-5] Caching, Case-Insensitive Normalization & Robustness
- **Casing Normalization**: Ensure that all database and api helpers (e.g. `recordTriviaScore`, `getTriviaScore`, `getTriviaLeaderboard`, `/api/chat-limit`) strictly normalize user/client IDs and Trend titles to lowercase to prevent cache misses or duplicate records.
- **Verification**: Query `/api/trivia/leaderboard` with a mixed-case trend like `GoOgLe GeMiNi` and client `ClIeNt-1` and verify the query handles normalization properly without duplicate entries in SQLite/Firestore.

## Implementation Slices

### [S-1] Visual Daily Streak Progress Tracker UI
- **Files**:
  - `public/index.html`
  - `public/styles.css`
  - `public/app.js`
- **Description**: Add the `#streak-progress-track` element into the chat card. Render 7 day bubbles representing the weekly path. Style filled/active flame states and label milestones.
- **Dependencies**: None. (Independent)

### [S-2] Canvas Streak Milestone Card Generator
- **Files**:
  - `public/app.js`
  - `public/index.html`
- **Description**: Add `#btn-download-streak-reward` button. Implement `generateStreakRewardCardImage` to render the customized badge/text on canvas (2400x1260) and trigger the download/share interface.
- **Dependencies**: [S-1]

### [S-3] Trivia Milestones & Badging UI
- **Files**:
  - `public/index.html`
  - `public/styles.css`
  - `public/app.js`
- **Description**: Add `#trivia-milestone-title` and `#trivia-milestone-badge` onto `.trivia-results-screen`. Update trivia complete handler to set correct milestone names, badges (🏆/🥈/🥉), and animate them.
- **Dependencies**: None. (Independent)

### [S-4] Canvas Trivia Milestone Card Generator
- **Files**:
  - `public/app.js`
  - `public/index.html`
- **Description**: Add `#btn-download-trivia-reward` button. Implement `generateTriviaRewardCardImage` to draw the trivia milestone card on canvas (2400x1260) and handle download/sharing.
- **Dependencies**: [S-3]

### [S-5] Casing Normalization & Leaderboard Cache Robustness
- **Files**:
  - `server.js`
  - `db.js`
- **Description**: Normalize keys (client IDs, trends) across trivia score submission, leaderboard fetches, and daily streaks to ensure seamless caching.
- **Dependencies**: None. (Independent)
