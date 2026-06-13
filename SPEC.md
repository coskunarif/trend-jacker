# Specification: Gamified Trend Predictions

This specification details the implementation of a gamified trend predictions feature in TrendJacker to boost daily user retention and drive viral share conversions.

## 🎯 Acceptance Criteria

- **[AC-1] Database Schema & Methods**:
  - SQLite and Firestore initialize a `client_predictions` table/collection with the columns:
    - `client_id` (TEXT, PRIMARY KEY with `trend` and `prediction_date`)
    - `trend` (TEXT, PRIMARY KEY with `client_id` and `prediction_date`, case-insensitive)
    - `prediction` (TEXT: 'rise' or 'fall')
    - `prediction_date` (TEXT: YYYY-MM-DD)
    - `status` (TEXT: 'pending', 'correct', 'incorrect')
    - `resolved_at` (TEXT, ISO timestamp or NULL)
  - The `db.js` module exports the following helper functions (all normalized to lowercase/trimmed `client_id` and `trend`):
    - `recordPrediction(clientId, trend, prediction, predictionDate)`: inserts a new prediction with `status = 'pending'`.
    - `getClientPredictions(clientId)`: retrieves all predictions for a client.
    - `resolvePredictions(clientId, localDate)`: resolves any pending predictions dated before `localDate`. The correct outcome is computed deterministically using `crypto.createHash('sha256').update(trend.toLowerCase() + ":" + prediction_date).digest('hex')` — if the last character parsed as hex modulo 2 is 0, the outcome is 'rise', else 'fall'. Status is updated to 'correct' or 'incorrect'. Returns an array of newly resolved predictions.
    - `getPredictionBonus(clientId)`: returns the bonus capacity calculated as `correctCount * 3`.
  - In-memory mock Map fallback `inMemoryClientPredictions` matches the SQLite operations when sqlite database is not present.

- **[AC-2] Backend Route Handlers**:
  - `POST /api/predict`: accepts `clientId`, `trend`, `prediction` ('rise' or 'fall'), and `localDate` (YYYY-MM-DD). Validates parameters (returns `400` if invalid or missing) and calls `recordPrediction`.
  - `GET /api/predictions`: accepts `clientId`, validates and normalizes it, and returns the predictions list.
  - `/api/chat-limit` (GET), `/api/trivia/score` (POST), and `/api/chat` (POST) include the prediction bonus in `allowedLimit` computation:
    `allowedLimit = 3 + 5 * referralCount + triviaBonus + streakBonus + predictionBonus`.
  - `/api/chat-limit` automatically triggers `resolvePredictions(clientId, localDate)` when `localDate` is supplied, returning `newlyResolvedPredictions` list and updated `predictionBonus`.

- **[AC-3] Trend Predictor UI Card**:
  - Renders a new card `<div id="prediction-card-container" class="glass-card prediction-card">` in the explainer view below the interactive grid.
  - Displays prediction buttons **Keep Rising 📈** (class `btn-predict-rise`) and **Decline 📉** (class `btn-predict-fall`).
  - Disables buttons if a prediction has already been made for the trend today, showing the text: "You predicted this trend will [Rise/Fall] tomorrow."
  - Displays a correct prediction count badge (`#prediction-correct-count` in `#prediction-points-badge`) and a history table/list of previous predictions.

- **[AC-4] Celebratory Toast & Immediate Synchronization**:
  - Locking a prediction triggers an immediate un-awaited background call to `checkChatLimit(trend.title)` to update UI state asynchronously.
  - When `/api/chat-limit` returns `newlyResolvedPredictions` containing correct predictions, the frontend triggers `showUnlockToast(resolvedCount * 3)` displaying the celebratory toast "Capacity Unlocked! +[X] messages available."

- **[AC-5] Shareable Canvas Prediction Card**:
  - A button `#btn-download-prediction-card` renders a 2400x1260 PNG card suggested as `prediction-card-[trend].png` containing the user's prediction details, correct count, and brand markings.

- **[AC-6] Unified Share Preview Integration**:
  - Expose a `prediction` option in the Unified Share Modal dropdown and context.
  - Generate a viral prediction post inside `/api/generate-post` showing prediction angle (e.g. "I just predicted that [Trend] will Keep Rising 📈 tomorrow!...").

---

## 🚫 Out of Scope

- Integrating external real-time Google search trend volume tracking APIs to dynamically resolve predictions. (Resolutions are computed deterministically on the server via case-insensitive trend hashes to ensure speed, stability, and E2E testability).
- Any prediction leaderboards or real-time websocket prediction matching.

---

## 📐 Vertical Slices

Slices represent implementation code only. Tests are written independently by the Tester before the Builder begins. Slices are ordered by dependency and are fully automatable.

### [S-1] DB Schema, Methods, and Casing Normalization
- **Files**: `db.js`
- **Description**: Add the `client_predictions` table to SQLite schema setup. Define in-memory `inMemoryClientPredictions` map. Implement and export `recordPrediction`, `getClientPredictions`, `resolvePredictions`, and `getPredictionBonus` helpers. Implement the deterministic resolver rule with lowercase key normalization.

### [S-2] Backend API Integration & Chat Limit Updates
- **Files**: `server.js`
- **Description**: Register `POST /api/predict` and `GET /api/predictions` endpoints. Add `predictionBonus` to `allowedLimit` formula inside `/api/chat-limit`, `/api/trivia/score`, and `/api/chat` route handlers. Add auto-resolution of pending predictions inside `/api/chat-limit` and return the newly resolved list.

### [S-3] Trend Predictor UI Card and Toast
- **Files**: `public/index.html`, `public/styles.css`, `public/app.js`
- **Description**: Add prediction card structure and styles. Bind click events for predict buttons. Fetch predictions history and current trend prediction state. Highlight selected prediction and render status history list. Trigger immediate limit synchronization upon predicting. Fire celebratory toast when a correct prediction is resolved.

### [S-4] Shareable Canvas Card & Unified Share Preview
- **Files**: `public/app.js`, `server.js`
- **Description**: Add `generatePredictionCardImage` canvas renderer. Add prediction context logic to `/api/generate-post` and post generation helpers. Bind share modal context dropdown and trigger social preview generation.

---

## 🧪 Test Strategy
- **Task Type**: Additive (new prediction gamification feature).
- **Test Placement**: Tester writes automated E2E and unit tests in `tests/trend-predictions.spec.js` asserting all ACs prior to building.
