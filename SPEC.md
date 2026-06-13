# SPEC.md - Trivia Challenge Chat Capacity Rewards

This specification defines the additions and refinements required to connect user chat limits to trivia milestone rewards, driving user session retention and referral-driven sharing loops.

---

## Acceptance Criteria

### `[AC-1]` Client Trivia Score Database Cache & Helpers
- **Description:** A database table/collection must store each client's highest trivia score per trend to allow persistence across page reloads.
- **Verification:**
  - Verify `client_trivia_scores` table exists in SQLite with columns `client_id` (TEXT), `trend` (TEXT), `score` (INTEGER), and `completed_at` (TEXT), with primary key `(client_id, trend)`.
  - Import `db.js` and verify exported helpers `recordTriviaScore(clientId, trend, score)` and `getTriviaScore(clientId, trend)` store and retrieve values correctly.
  - Assert that `recordTriviaScore` only updates the score in the database if the newly submitted score is greater than the existing record for the client and trend.
  - Verify that a Firestore mock implementation or in-memory map handles these functions when local SQLite is bypassed.

### `[AC-2]` Case-Insensitive Key Normalization
- **Description:** Trend parameters in chat counting and trivia score tracking must be normalized to lowercase and trimmed to avoid duplicate storage, double queries, and casing mismatch.
- **Verification:**
  - Verify that `recordTriviaScore` and `getTriviaScore` normalize the `trend` string to lowercase before executing queries/updates.
  - Verify that `getChatCount` and `incrementChatCount` in `db.js` are updated to normalize the `trend` string to lowercase.
  - Assert that calling chat counting or trivia score operations with different casings (e.g. "Google Gemini", "google gemini", "GOOGLE GEMINI") retrieves and updates the exact same record.

### `[AC-3]` Gamified Chat Limit API
- **Description:** The chat limit checks must use a combined formula incorporating both referrals and trivia milestones, and expose an endpoint to submit scores.
- **Verification:**
  - The endpoint `GET /api/chat-limit` and chat message limit enforcement in `POST /api/chat` must calculate `allowedLimit` using:
    `allowedLimit = 3 + 5 * referralCount + triviaBonus`
    where `triviaBonus` is:
      - `+5` if `triviaScore` is `3` (perfect score)
      - `+3` if `triviaScore` is `2`
      - `+1` if `triviaScore` is `0` or `1` (participation/completion reward)
      - `+0` if `triviaScore` is not found/null (trivia not played)
  - Verify that `POST /api/trivia/score` accepts JSON containing `clientId`, `trend`, and `score`, records the score, and returns `{ success: true, allowedLimit, currentCount, limitReached }`.

### `[AC-4]` Chat Lock Screen CTA for Trivia Challenge
- **Description:** The UI block shown when a user reaches their chat limit must invite them to play the trivia challenge to increase their chat limit.
- **Verification:**
  - Lock container `#chat-lock-container` displays text inviting users to play the trivia challenge (e.g. "Complete the Trivia Challenge to earn up to +5 bonus messages!").
  - Lock container contains a "Play Trivia Challenge" button (`#chat-lock-play-trivia-btn`).
  - Clicking this button smoothly scrolls the page to `#trivia-card-container` and focuses `#btn-start-trivia`.

### `[AC-5]` Trivia Results Celebration & Go to Chat Button
- **Description:** The trivia results screen must celebrate the unlocked chat capacity and provide a quick action to return to the Q&A chat.
- **Verification:**
  - Results screen `.trivia-results-screen` displays a success message badge `#trivia-reward-display` showing the earned chat capacity reward (e.g., "+5 bonus messages unlocked").
  - Results screen contains a "Go to Chat" button (`#btn-return-to-chat`). Clicking this button smoothly scrolls the viewport back up to the Dig Deeper chat component (`#chat-history`).

### `[AC-6]` Automatic UI Sync and Unlocking
- **Description:** Submitting a trivia score must automatically update the chat limits and unlock the chat interface in real-time.
- **Verification:**
  - Completing the trivia gameplay triggers an asynchronous `POST /api/trivia/score` request with the user's score.
  - Upon success, the frontend immediately requests updated limit status and refreshes the chat limit UI.
  - If the new limit exceeds the message count, the lock overlay `#chat-lock-container` is hidden, and the chat form `#chat-form` is restored without requiring a page reload or "Check Status" click.

---

## Out of Scope

- Redesigning the core responsive layout or the visual grids.
- Altering the LLM generation prompt for trivia questions or chat responses.
- User registration, authentication, or session management beyond `localClientId` in `localStorage`.

---

## Implementation Slices

### `[S-1]` Database Schema & Case-Insensitive Helpers
- **Description:** Add the new schema for client trivia score cache and update helper functions with lowercase trend normalization.
- **ACs Mapped:** `[AC-1]`, `[AC-2]`
- **Files:** `db.js`
- **Dependencies:** None (Independent)

### `[S-2]` Backend API Routes & Limit Logic
- **Description:** Add `POST /api/trivia/score` and update the allowed chat limit calculation in existing routes.
- **ACs Mapped:** `[AC-3]`
- **Files:** `server.js`
- **Dependencies:** `[S-1]`

### `[S-3]` Chat Lock CTA & Smooth Scroll Behavior
- **Description:** Refine the chat lock container markup and implement the play trivia scroll behavior.
- **ACs Mapped:** `[AC-4]`
- **Files:** `public/index.html`, `public/app.js`
- **Dependencies:** None (Independent)

### `[S-4]` Trivia Results Celebration, Score Submission, and Auto-Unlock
- **Description:** Connect trivia completion to frontend score submission, show the earned rewards, and auto-restore the chat interface.
- **ACs Mapped:** `[AC-5]`, `[AC-6]`
- **Files:** `public/index.html`, `public/app.js`
- **Dependencies:** `[S-2]`, `[S-3]`
