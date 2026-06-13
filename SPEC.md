# Specification: Global Trivia Leaderboard

## Introduction
We are introducing a competitive global trivia leaderboard for each trending topic. This feature aims to increase user session duration and retention by providing social proof and a sense of competition. Users will be able to see the top scores for the current trend on both the trivia start screen and the trivia results screen, claim/save their nickname, and instantly see their position relative to others.

---

## Acceptance Criteria

### `[AC-1]` Database Schema & Persistence
- A new table `client_nicknames` is defined in SQLite containing `client_id` (TEXT, Primary Key) and `nickname` (TEXT).
- Database helper functions are implemented for Firestore, SQLite, and in-memory mock storage:
  - `saveClientNickname(clientId, nickname)`: Persists the user's nickname.
  - `getClientNickname(clientId)`: Retrieves the nickname.
  - `getTriviaLeaderboard(trend, clientId)`: Retrieves the top 10 scores for the normalized trend sorted by `score` DESC, then by `completed_at` ASC. It also calculates the `userRank` and `userScore` for the given `clientId`.
- Case-insensitivity for the trend query is maintained by normalizing trends to lowercase.
- *How to verify*: Unit tests calling the new helper functions directly to insert and query scores/nicknames, asserting correct ordering, joins, and limit restrictions.

### `[AC-2]` Backend API Endpoints
- **`GET /api/trivia/leaderboard`**
  - Query parameters: `trend` (required) and `clientId` (optional).
  - Returns `200 OK` with JSON:
    ```json
    {
      "success": true,
      "leaderboard": [
        {
          "rank": 1,
          "nickname": "Player1",
          "score": 3,
          "completed_at": "2026-06-13T12:00:00.000Z",
          "isCurrentUser": false
        }
      ],
      "userRank": null,
      "userScore": null
    }
    ```
  - If a user has no nickname saved, a default anonymous masked name `Player_<client-id-last-5-chars>` is generated on-the-fly.
  - Returns `400 Bad Request` if `trend` is missing.
- **`POST /api/trivia/nickname`**
  - Request body: `{ clientId, nickname }`.
  - Validates that `clientId` and `nickname` are strings.
  - Validates that `nickname` is non-empty and length is `≤ 15` characters.
  - Trims leading/trailing whitespace.
  - Returns `200 OK` with JSON `{ success: true, nickname: "trimmed_nickname" }` and stores it.
  - Returns `400 Bad Request` if validation fails.
- *How to verify*: Integration tests making HTTP requests to `/api/trivia/leaderboard` and `/api/trivia/nickname` with valid and invalid payloads.

### `[AC-3]` Start Screen Global Leaderboard UI
- A leaderboard card/container is added below the "Start Trivia Challenge" button on the `trivia-start-screen`.
- On loading a trend, the leaderboard for that trend is fetched and rendered:
  - Displays a loading spinner/text while fetching.
  - If no scores exist, displays "No scores recorded yet. Be the first!".
  - Displays the top 10 list of ranks, nicknames, and scores (e.g. `3/3`).
  - Highlights the current user's entry (e.g. bold or different background) if they are in the top 10.
  - Displays the user's personal rank and high score below the list (e.g. "Your Rank: #15 (High Score: 2/3)") if they have played but are not in the top 10.
- *How to verify*: E2E test using Playwright that visits the page, selects a trend, and checks that the leaderboard container is visible and displays correct initial state.

### `[AC-4]` Results Screen Leaderboard UI & Nickname Submission
- On the `trivia-results-screen`, a similar leaderboard container is displayed.
- A nickname entry card/form is displayed:
  - Input field (`maxlength="15"`, placeholder `"Enter nickname"`) prefilled with any previously saved nickname from `localStorage` or backend.
  - A "Save" button.
- When the "Save" button is clicked:
  - Performs validation (non-empty, max 15 chars).
  - Posts the nickname to `/api/trivia/nickname` asynchronously.
  - Saves the nickname to local storage (`trivia-nickname`).
  - Displays a status notification ("Nickname saved!").
  - Refreshes the leaderboard display in-place on the results screen immediately to reflect the new nickname.
- When a trivia challenge is completed, the score is auto-submitted, limits update, and the leaderboard list is refreshed.
- All actions are asynchronous and do not cause page reloads or yields in event loop rendering that create E2E race conditions.
- *How to verify*: E2E test completing a trivia challenge, verifying the results leaderboard, typing a nickname, clicking Save, and checking that the saved nickname is updated in the list immediately without page reload.

---

## Out of Scope
- Global/overall leaderboard aggregated across all topics (leaderboards are strictly partitioned by trend).
- User authentication, profiles, or passwords (users are identified by their `clientId` cookie/localStorage).
- Sharing to social platforms via OAuth APIs (sharing copies score text/emojis to clipboard as done currently).

---

## Slices

### `[S-1]` Database Schema & Model Helpers
- **Description**: Implement DB table creation and helper functions for SQLite, Firestore, and in-memory mock storage.
- **ACs covered**: `[AC-1]`
- **Files**: `db.js`
- **Verification**: Run unit/helper tests directly.
- **Dependencies**: None.

### `[S-2]` Backend API Routes
- **Description**: Add `/api/trivia/leaderboard` and `/api/trivia/nickname` endpoints in Fastify.
- **ACs covered**: `[AC-2]`
- **Files**: `server.js`
- **Verification**: Run API integration tests.
- **Dependencies**: `[S-1]`

### `[S-3]` Global Leaderboard Frontend UI Components
- **Description**: Add the HTML markup for the leaderboard section in `public/index.html` and styles in `public/styles.css`.
- **ACs covered**: `[AC-3]`, `[AC-4]`
- **Files**: `public/index.html`, `public/styles.css`
- **Verification**: Inspect DOM elements.
- **Dependencies**: None (Can be built in parallel).

### `[S-4]` Frontend Controller Logic & Live Sync
- **Description**: Connect the UI components to backend endpoints in `public/app.js`, handle nickname submissions, fetch leaderboard data on load and post-submission, and apply dynamic UI refreshes.
- **ACs covered**: `[AC-3]`, `[AC-4]`
- **Files**: `public/app.js`
- **Verification**: E2E integration test verification.
- **Dependencies**: `[S-2]`, `[S-3]`

---

## Test Strategy (Additive)
Since this is an additive feature, we follow the **tests first** methodology:
1. **Adversarial Test Suite Writing**: The Tester will write unit, API, and E2E integration tests targeting the new table creation, helper logic, Fastify routes, DOM elements, and nickname claim behaviors.
2. **Pre-Implementation Test Failures**: Ensure all new tests fail cleanly against the baseline codebase.
3. **Incremental greening**: The Builder will implement slices `[S-1]` to `[S-4]` incrementally, bringing each corresponding test to green.
