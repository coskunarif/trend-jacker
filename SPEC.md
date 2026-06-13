# Specification: Interactive AI-Generated Trivia Challenge

This document defines the functional requirements, acceptance criteria, vertical development slices, and test strategy for implementing the interactive AI-Generated Trivia Challenge in TrendJacker.

## Acceptance Criteria

### [AC-1] Trivia Card UI Component
- **Description:** A new interactive Trivia Challenge card is rendered in the trend detail view below the interactive-grid.
- **Verification:** When a trend's details load, verify that the `#trivia-card-container` element is visible, styled using the application's glassmorphism style sheet, and displays the "Start Screen" with the active trend's title and a "Start Trivia Challenge" button.

### [AC-2] On-Demand Trivia Generation / Loading & DB Caching
- **Description:** Trivia questions are loaded lazily on demand when the user clicks "Start Trivia Challenge", querying the cached database first or generating via Gemini in production.
- **Verification:** 
  - Clicking "Start Trivia Challenge" sends a request to `POST /api/trivia` with `trend` and `lang` body parameters.
  - The server checks SQLite database table `trend_trivia` (or Firestore collection `trend_trivia` in production) first.
  - If a cache miss occurs in test/mock mode (`process.env.NODE_ENV === 'test'`), return mocked questions.
  - If a cache miss occurs in production mode, generate 3 trivia questions about the trend using the `gemini-3.5-flash` model, enforcing structured JSON via `responseSchema` containing `question` (string), `options` (array of 4 strings), `correctAnswer` (0-based integer index), and `explanation` (string). Cache the generated questions in the database, and return them to the client.

### [AC-3] Interactive Trivia Gameplay
- **Description:** Users can answer the 3 trivia questions one-by-one with immediate visual correctness feedback and explanation.
- **Verification:**
  - The Question Screen displays a progress indicator (e.g. "Question 1 of 3"), the question text, and 4 option buttons.
  - Clicking an option button locks the selection, disables all options, and reveals the explanation block.
  - The explanation block shows correct/incorrect feedback (e.g. "Correct! 🟩" or "Incorrect! 🟥"), the correct option highlighted, the explanation text, and a navigation button: "Next Question" (for questions 1 & 2) or "See Results" (for question 3).

### [AC-4] Wordle-style Score Card & Results Screen
- **Description:** Upon completing all questions, users are shown their score and a visual Wordle-style score card representation.
- **Verification:**
  - The Results Screen displays "Challenge Completed!", the user's score (e.g. "You scored 2 out of 3"), and a block of colored emojis (e.g., `🟩🟥🟩` where green indicates correct and red indicates incorrect).
  - A "Play Again" button resets the trivia card state machine back to the Start Screen.

### [AC-5] Wordle Score Card Social Share & Unified Modal Integration
- **Description:** Users can share their trivia scores via clipboard copy and the application's Unified Share Modal.
- **Verification:**
  - A "Share Score" button on the results screen copies the Wordle score card text representation to the user's clipboard (containing the emoji grid, score, and trend link) and triggers the Unified Share Modal.
  - The Unified Share Modal context select element dropdown includes a new "Trivia Score" option. When opened from the trivia screen, the modal opens with the "trivia" context active, pre-loading the post textarea with the Wordle-style score card text.
  - The server-side `POST /api/generate-post` endpoint is updated to support `contextType: 'trivia'` and reads optional `score` and `pattern` body parameters to construct platform-specific post text templates.

---

## Out of Scope
- Multi-user global leaderboards, user authentication, or database persistence of individual user gameplay histories.
- Custom trivia settings such as choosing custom number of questions, setting a game timer, or selecting difficulty categories.

---

## Slices

### [S-1] Database Schema Migration & Caching Helpers
- **Description:** Set up the database table and helpers for caching generated trivia questions.
- **Target Files:**
  - `db.js`
- **Implementation Details:**
  - Add SQL migration to initialize the SQLite `trend_trivia` table: `CREATE TABLE IF NOT EXISTS trend_trivia (trend TEXT, lang TEXT, trivia TEXT, created_at TEXT, PRIMARY KEY (trend, lang))`.
  - Implement and export helper functions `getTrendTrivia(trend, lang)` and `setTrendTrivia(trend, lang, trivia)` supporting SQLite, Firestore (in production), and in-memory mock map.
- **ACs Mapped:** `[AC-2]`
- **Dependencies:** None (Independent)

### [S-2] Backend API for Trivia Generation
- **Description:** Create the API endpoint to fetch and generate trivia questions using Gemini.
- **Target Files:**
  - `server.js`
- **Implementation Details:**
  - Register route `POST /api/trivia` in Fastify.
  - On request, check database cache. If missing, generate questions.
  - In test mode, return static mock questions (specific mock trivia for "Google Gemini" to aid E2E tests, and generic mock trivia for other trends).
  - In production mode, prompt Gemini 3.5-flash with a structured schema to produce 3 multiple-choice questions with 4 options, a correct answer index, and explanation text. Cache and return the result.
- **ACs Mapped:** `[AC-2]`
- **Dependencies:** `[S-1]`

### [S-3] Social Share Post Generator Updates
- **Description:** Update backend share-post generation to support trivia context.
- **Target Files:**
  - `server.js`
- **Implementation Details:**
  - Update `/api/generate-post` endpoint to handle `contextType === 'trivia'`.
  - Accept `score` and `pattern` from the request body to generate platform-specific templates (Twitter/X, LinkedIn, Facebook, Reddit, Pinterest) containing the Wordle emoji score card and the trend URL.
- **ACs Mapped:** `[AC-5]`
- **Dependencies:** `[S-2]`

### [S-4] Frontend Trivia UI Structure & CSS Styles
- **Description:** Add the HTML structure and CSS styles for the trivia gameplay screens and Unified Share Modal.
- **Target Files:**
  - `public/index.html`
  - `public/styles.css`
- **Implementation Details:**
  - Add `#trivia-card-container` HTML component below `.interactive-grid` in `public/index.html`.
  - Add sub-elements for the Start Screen, Question Screen, and Results Screen.
  - Add `<option value="trivia">Trivia Score</option>` to the share modal context select.
  - Add styling rules in `public/styles.css` for trivia option buttons, feedback alerts, explanation box, results panel, and Wordle score card block layout matching the site's dark mode visual style.
- **ACs Mapped:** `[AC-1]`, `[AC-3]`, `[AC-4]`, `[AC-5]`
- **Dependencies:** None (Independent)

### [S-5] Client-Side Trivia State Machine & Gameplay Logic
- **Description:** Implement client-side gameplay, state transitions, and localization support.
- **Target Files:**
  - `public/app.js`
- **Implementation Details:**
  - Define state variables to track the active trend's trivia questions, current question index, user score, answer emoji patterns, and selected state.
  - Implement event listener for "Start Trivia Challenge" button to fetch questions from `POST /api/trivia` and start the game.
  - Render option buttons dynamically, wire up click handlers to disable options, check correctness, display the explanation panel, and show the next question button.
  - Implement reset handler on "Play Again" button.
  - Extend client-side `UI_DICTIONARY` and `translateUI` function to support localizing trivia headers, buttons, progress text, and feedback labels in English, Spanish, French, and Japanese.
- **ACs Mapped:** `[AC-1]`, `[AC-3]`, `[AC-4]`
- **Dependencies:** `[S-2]`, `[S-4]`

### [S-6] Wordle Share Integration
- **Description:** Connect the results screen sharing actions to the clipboard and Unified Share Modal.
- **Target Files:**
  - `public/app.js`
- **Implementation Details:**
  - Wire up the "Share Score" button on the results screen.
  - Copy the Wordle emoji score card text to the user's clipboard and display temporary feedback text.
  - Call `openShareModal('trivia')` to launch the Unified Share Modal, passing the user's score and emoji pattern to generate the social post.
- **ACs Mapped:** `[AC-5]`
- **Dependencies:** `[S-3]`, `[S-5]`

---

## Test Strategy

Since this is an **additive** feature, we will use a **tests-first** strategy.
- Before coding, the Tester will write new Playwright tests in `tests/trivia-challenge.spec.js`.
- The tests will verify:
  1. Default visibility of the Trivia Card on trend load showing the Start Screen.
  2. Clicking "Start Trivia Challenge" transitions to the first question (mocking `POST /api/trivia` response).
  3. Interactive feedback loop (clicking options disables choices, shows explanation, updates progress indicator).
  4. Completion of all 3 questions displays the results screen, the correct final score, and the Wordle emoji grid.
  5. Play Again resets back to the start screen.
  6. "Share Score" copies the score card text to the clipboard and opens the Unified Share Modal with the context set to "trivia" and the social post preloaded.
  7. Client-side localization translates headers, options, and progress blocks when switching language.
