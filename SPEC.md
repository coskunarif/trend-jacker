# SPEC.md - Technical Specification: Firestore Optimization and Gemini Chat Capping

## Acceptance Criteria

- **[AC-1] Zero-Read Session Caching**:
  - Implement a server-side, database-agnostic in-memory cache (`clientSessionCache` using a `Map`) with a 5-minute TTL (300,000 ms) for client-specific data.
  - Client-specific data to be cached includes:
    1. Client Nicknames (key: `nickname:${clientId}`)
    2. Daily Streaks (key: `streak:${clientId}`)
    3. Chat Counts (key: `chat_count:${clientId}:${trend}`)
    4. Single Trivia Scores (key: `trivia_score:${clientId}:${trend}`)
    5. Aggregate Trivia Scores list for the achievements dashboard (key: `trivia_scores_all:${clientId}`)
  - Any retrieval function (`getClientNickname`, `getClientStreak`, `getChatCount`, `getTriviaScore`, and the trivia scores query in `getClientAchievements`) must first check `clientSessionCache`. If a valid unexpired entry exists, it must return the cached value directly (0 Firestore reads).
  - Any write/modification function (`saveClientNickname`, `updateClientStreak`, `incrementChatCount`, `recordTriviaScore`) must write to the database and update or invalidate the corresponding keys in `clientSessionCache` immediately.
  
- **[AC-2] Dynamic Cache Invalidation**:
  - The global trend and explanation list cached in `allExplanationsCache` must be kept indefinitely in-memory by modifying the cache TTL check to ignore the time difference or setting `ALL_EXPLANATIONS_CACHE_TTL = Infinity`.
  - Invalidate the cache (set `allExplanationsCache = null`) strictly when the following three operations occur:
    1. Explanation Ingestion (`setCachedExplanation`)
    2. Sentiment Voting (`incrementVote`)
    3. Historical Pruning (`pruneOldExplanations`)
  - Periodic Firestore polling or timed refetching of the global trend/explanation list is completely eliminated.

- **[AC-3] Gemini Chat Abuse Cap**:
  - Enforce a strict limit of maximum 5 actual Gemini AI chat messages (uncached, non-mock API calls) per trend per client ID.
  - Initialize a new SQLite table `client_gemini_chat_counts` (schema: `client_id TEXT, trend TEXT, count INTEGER DEFAULT 0, PRIMARY KEY (client_id, trend)`) and a Firestore collection `client_gemini_chat_counts`.
  - Expose helper database functions `getGeminiChatCount(clientId, trend)` and `incrementGeminiChatCount(clientId, trend)`.
  - In `POST /api/chat`, before calling the Gemini API (after verifying `allowedLimit` and checking the cache), verify that the client's actual Gemini chat count is less than 5. If it is 5 or more, return a `403 Forbidden` response with `{ error: 'limit_reached', allowedLimit: 5 }`.
  - On a successful call to the Gemini API, increment the count using `incrementGeminiChatCount(clientId, trend)`.
  - Ensure mock responses in test mode (`process.env.NODE_ENV === 'test'`) bypass actual Gemini API incrementing and capping, allowing existing tests with larger message limits to pass.

- **[AC-4] Test Coverage**:
  - All existing Playwright and unit tests must pass.
  - New test cases must be added to verify:
    - Session caching: Lookups to client-specific data are returned from memory and do not trigger database reads.
    - Global cache invalidation: Cache is cleared on vote, ingestion, or prune, and holds indefinitely otherwise.
    - Chat Cap: A strict cap of 5 actual Gemini calls is enforced, returning a 403 Forbidden on the 6th call.

---

## Performance KPIs

- **[KPI-1] Cache Retrieval Latency**: Server-side retrieval of cached client data (e.g., nicknames, streaks) from memory must have a latency of `< 5ms`.
- **[KPI-2] Firestore Read Reduction**: Secondary and subsequent client session reads for cached data must result in exactly `0` Firestore read operations.
- **[KPI-3] SQLite Write Latency**: Initialization and inserts to `client_gemini_chat_counts` in local SQLite must complete in `< 15ms`.

---

## Interface Contract

The Tester and Builder must share and adhere to these specifications across [db.js](file:///home/ubuntuadmin/projects/trend-jacker/db.js) and [server.js](file:///home/ubuntuadmin/projects/trend-jacker/server.js):

### 1. Database Helper Signatures (`db.js` exports)
- `export async function getGeminiChatCount(clientId: string, trend: string): Promise<number>`
- `export async function incrementGeminiChatCount(clientId: string, trend: string): Promise<void>`

### 2. SQLite Schema Configuration
```sql
CREATE TABLE IF NOT EXISTS client_gemini_chat_counts (
  client_id TEXT,
  trend TEXT,
  count INTEGER DEFAULT 0,
  PRIMARY KEY (client_id, trend)
);
```

### 3. Firestore Schema Configuration
- Collection: `client_gemini_chat_counts`
- Document ID: `${clientId}_${trend}` (normalized to lowercase)
- Document Body:
  ```json
  {
    "client_id": "string (lowercase)",
    "trend": "string (lowercase)",
    "count": "number"
  }
  ```

---

## Out of Scope

- Changing the database provider (must retain Firestore and local SQLite fallback).
- Altering background RSS feed scraping frequency or logic.
- Rewriting front-end styles, layouts, or graphics.
- Modifying prompt content or changing the model away from `gemini-3.1-flash-lite`.

---

## Slices

### `[S-1] Client-Specific Data Caching`
- **Files**: [db.js](file:///home/ubuntuadmin/projects/trend-jacker/db.js)
- **Description**: Add `clientSessionCache` (in-memory Map) with helper getter/setter. Update `getClientNickname`, `saveClientNickname`, `getClientStreak`, `updateClientStreak`, `getChatCount`, `incrementChatCount`, `getTriviaScore`, `recordTriviaScore`, and the database retrieval logic inside `getClientAchievements` to utilize the cache.
- **Independent**: Yes

### `[S-2] Indefinite Global Trend Cache & Invalidation`
- **Files**: [db.js](file:///home/ubuntuadmin/projects/trend-jacker/db.js)
- **Description**: Update `ALL_EXPLANATIONS_CACHE_TTL` to `Infinity` or remove time-based expiration in `getAllCachedExplanations`. Add `allExplanationsCache = null` to `incrementVote` to invalidate the cache on voting.
- **Independent**: Yes

### `[S-3] Gemini Chat Count Database Helper`
- **Files**: [db.js](file:///home/ubuntuadmin/projects/trend-jacker/db.js)
- **Description**: Initialize `client_gemini_chat_counts` table schema in SQLite. Implement `getGeminiChatCount` and `incrementGeminiChatCount` with support for Firestore collections, SQLite queries, and in-memory fallbacks.
- **Independent**: Yes

### `[S-4] Gemini Chat Cap API Integration`
- **Files**: [server.js](file:///home/ubuntuadmin/projects/trend-jacker/server.js)
- **Description**: In `POST /api/chat`, verify actual Gemini calls against the 5-message limit using `getGeminiChatCount`. Return `403 Forbidden` if capped, and call `incrementGeminiChatCount` after calling the Gemini API. Ensure mock/test environments are bypassed.
- **Independent**: No (depends on S-3)
