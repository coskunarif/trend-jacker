# SPEC.md - Chat Limiting & Referral Loop Architect Spec

## 1. Acceptance Criteria

### [AC-1] Lowercase Caching Keys
* **Requirement**: Database cache lookup and insertion keys for chat responses (`chat_cache`) and generated social posts (`generated_posts`) must be normalized to lowercase.
* **Verification**: In test and dev environments, check that querying the cache with mixed-casing trends or query text retrieves the cached data (avoiding redundant LLM generation).

### [AC-2] Persistent Client ID
* **Requirement**: The frontend client ID (`localClientId`) must be persisted in `localStorage` so that page reloads do not reset the identifier (which would bypass the message limits).
* **Verification**: Verify that `localStorage.getItem('clientId')` remains the same across browser reloads.

### [AC-3] Chat message Tracking & Referral Storage (Backend)
* **Requirement**: Support server-side storage of client chat counts and referrals.
  * SQLite schema should declare:
    * `client_referrals` (Primary Key: `client_id`, `referee_id`)
    * `client_chat_counts` (Primary Key: `client_id`, `trend`, `count` INTEGER)
  * Firestore schema must handle corresponding models using equivalent documents and sub-collections.
* **Verification**: Expose `POST /api/referral` to record referral relationships and `GET /api/chat-limit` to return `{ limitReached, currentCount, allowedLimit }` for a client and trend.

### [AC-4] Enforcing Chat Limits on Chat Endpoint
* **Requirement**: Intercept `POST /api/chat` calls to verify the client's message count against their computed limit (`3 + 5 * referral_count`).
  * If limit is reached, return `403 Forbidden` with `{ error: 'limit_reached', allowedLimit }`.
  * If below limit, increment the count in `client_chat_counts` and return the chat answer.
  * Limit checks must be bypassed if `process.env.NODE_ENV === 'test'`.
* **Verification**: Mock a client ID, trigger `POST /api/chat` 4 times, and assert that the 4th request returns a `403 Forbidden` status.

### [AC-5] Chat Limit UI & Locked State (Frontend)
* **Requirement**: Hide the chat input form `#chat-form` and display a styled `#chat-lock-container` inside the AI Q&A card when the user hits their limit.
  * The locked interface must clearly state the current limit (e.g. `3/3 messages`), supply share links containing the client's `?ref=clientId` parameter, and display a "Check Status" button.
* **Verification**: Click on a trend, query the chat 3 times, verify the form is hidden, and verify that the lock overlay/message block is visible.

### [AC-6] Referral Visit Loop Execution
* **Requirement**: On page load, if a `ref` parameter exists in the URL query string and does not match the current visitor's `localClientId`, send `POST /api/referral` to record the referral.
* **Verification**: Load `/?ref=client-xyz` in a new window/session, check that a database entry records client-xyz as the referrer, and clicking "Check Status" on Client XYZ's screen unlocks their chat.

---

## 2. Out of Scope
* IP-based rate limiting or CAPTCHA validation.
* Multi-device client ID syncing (profiles/accounts).

---

## 3. Slices

### [S-1] Case-Insensitive Caching Keys
* **Files**: `db.js`
* **Type**: Refinement
* **AC Mapping**: `[AC-1]`
* **Test Strategy**: Update/snapshot tests ensuring keys are converted to lowercase prior to DB insert or query.
* **Independent**: Yes

### [S-2] Database Schema and Server-Side Tracking for Limits & Referrals
* **Files**: `db.js`
* **Type**: Additive
* **AC Mapping**: `[AC-3]`
* **Test Strategy**: Additive tests verifying table/collection initialization and CRUD operations for referrals and chat counts.
* **Independent**: No (pre-requisite for API endpoints)

### [S-3] Limit & Referral HTTP Endpoints
* **Files**: `server.js`
* **Type**: Additive
* **AC Mapping**: `[AC-3]`, `[AC-4]`
* **Test Strategy**: Integration tests validating `GET /api/chat-limit`, `POST /api/referral`, and `POST /api/chat` limit enforcement.
* **Independent**: No

### [S-4] Persistent Client ID and Referral Capture
* **Files**: `public/app.js`
* **Type**: Refinement
* **AC Mapping**: `[AC-2]`, `[AC-6]`
* **Test Strategy**: E2E verification of `localStorage` client ID retention and query parameter detection on initialization.
* **Independent**: Yes

### [S-5] Chat Limit UI & Referral Share Actions
* **Files**: `public/index.html`, `public/app.js`, `public/styles.css`
* **Type**: Refinement
* **AC Mapping**: `[AC-5]`, `[AC-6]`
* **Test Strategy**: E2E DOM structure assertions, button click handlers, and transition tests from locked to unlocked state.
* **Independent**: No
