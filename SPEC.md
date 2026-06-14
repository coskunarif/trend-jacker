# Specification — LLM Operational Cost Reduction and Latency Optimization

This specification outlines the requirements and implementation slices to optimize LLM query response times, enforce prompt safety, and decrease Gemini token usage through sliding-window history truncation and browser-side `sessionStorage` caching.

---

## 🎯 Acceptance Criteria

### `[AC-1]` Client & Server Chat History Truncation (Sliding Window)
- **Requirement**: The follow-up chat integration must cap conversation history to a sliding window of the last 4 messages (representing the last 2 user-assistant turns).
- **Client implementation**: `public/app.js` must truncate `chatMessages` array to the last 4 elements prior to transmitting it to the server. All chat bubble DOM elements must remain visible to the user.
- **Server implementation**: `server.js` `/api/chat` route must truncate any incoming `history` array to the last 4 messages prior to cache key generation and prompt formulation.
- **How to verify**: 
  - Send 6 chat messages sequentially. Verify in network payloads that the `history` parameter contains only the last 4 messages.
  - Verify that the SQLite `chat_cache` table is populated using keys computed from the truncated history.

### `[AC-2]` Browser-Side `sessionStorage` Chat Caching
- **Requirement**: Chat queries and responses must be cached client-side in `sessionStorage` to allow instantaneous responses for duplicate queries in the same context.
- **Key format**: The key must be `chat_cache:${trend}:${query}:${historyKey}` where:
  - `trend` is the current trend title in lowercase.
  - `query` is the user query in lowercase.
  - `historyKey` is the JSON stringified representation of the truncated `chatMessages` array (lowercased).
- **How to verify**:
  - Open a trend and submit query `A`. Verify a network call is made.
  - Submit the identical query `A` again. Verify the response is returned instantly without hitting `/api/chat`.
  - Inspect browser `sessionStorage` to confirm the key follows the lowercase pattern.

### `[AC-3]` Non-Blocking UI Updates and Event Loop Yields
- **Requirement**: Asynchronous checks (such as fetching `/api/chat-limit`) must not be awaited inside UI detail rendering or event handlers. They must run as un-awaited background promises to prevent event loop yielding and subsequent E2E test race conditions.
- **How to verify**:
  - Run the Playwright test suite. Verify that switching demographics/languages executes synchronous DOM updates immediately, and the test assertions do not fail due to network delays or event loop delays.

### `[AC-4]` Casing-Agnostic Database Cache & Schema Safety
- **Requirement**: Ensure database queries for cached explanations/chats normalize search terms to lowercase to prevent casing-based cache misses. Verify SQLite tables `trend_explanations` and `localized_explanations` maintain `COLLATE NOCASE` settings.
- **How to verify**:
  - Query `sqlite_master` in `polls.db` and assert the schema constraints are active.
  - POST requests with differing case formats (e.g. `GOOGLE GEMINI` vs `google gemini`) must hit the same database cache line.

---

## 🚫 Out of Scope
- Server-side persistence of chat session histories across app instances.
- Adding custom settings/UI controls to adjust the sliding window size.
- Restructuring the database schemas or introducing non-relational database dependencies.

---

## 🛠️ Implementation Slices

### `[S-1]` Server-Side Chat History Truncation
- **Description**: Truncate the incoming chat history to the last 4 messages inside `POST /api/chat` in `server.js`. The truncated history is passed to `getCachedChatResponse`, `setCachedChatResponse`, and the Gemini model generator prompt.
- **Task Type**: Refinement (Update tests / database checks)
- **Target Files**: 
  - `server.js`
  - `db.js`
- **AC Mapping**: `[AC-1]`, `[AC-4]`
- **Verification**: Run `npx playwright test tests/llm-caching-optimization.spec.js` to ensure the chat caching layer aligns with casing rules and successfully caches the responses.

### `[S-2]` Client-Side Chat History Truncation & `sessionStorage` Cache
- **Description**: Limit the frontend `chatMessages` array to the last 4 entries. Before dispatching the `/api/chat` network fetch, check `sessionStorage` using the lowercase key format `chat_cache:${trend}:${query}:${historyKey}`. If cached, append the reply synchronously. Otherwise, fetch, append, and save the result into `sessionStorage`.
- **Task Type**: Refinement (Update tests)
- **Target Files**:
  - `public/app.js`
- **AC Mapping**: `[AC-1]`, `[AC-2]`
- **Verification**: Run `npx playwright test tests/retention-api-reduction.spec.js` to verify client-side caching behaves properly and reduces API query counts.

### `[S-3]` Non-blocking UI Alignment
- **Description**: Inspect and ensure that all detail renders or demographic/language switches do not await network calls like limit checks or streak fetches. Ensure they run as un-awaited background promises.
- **Task Type**: Refinement (Update tests)
- **Target Files**:
  - `public/app.js`
- **AC Mapping**: `[AC-3]`
- **Verification**: Confirm E2E test runs for responsiveness and UI rendering execute reliably without timing out or racing.
