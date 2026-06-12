# Specification: LLM Caching and Content Optimization

This document specifies the requirements, acceptance criteria, scope boundaries, and vertical slices for caching LLM calls and optimizing prompt outputs for a catchy, fluff-free user experience.

## Acceptance Criteria

### `[AC-1] Chat Q&A API Caching`
* **Requirement**: Responses from `POST /api/chat` must be cached to avoid duplicate LLM calls for identical queries and context.
* **Cache Key**: A unique key derived from:
  1. `trend`
  2. `query`
  3. SHA-256 hash of the `history` array (serialized to a stable JSON string).
* **Storage Systems**:
  * **Production**: Cloud Firestore collection `chat_cache` (doc ID hashed for safety).
  * **Local/Development**: SQLite table `chat_cache`.
  * **In-Memory**: A fallback Map `inMemoryChatCache`.
* **Testing / Verification**:
  1. Make a request to `/api/chat` with dynamic payload. A response is generated and cached.
  2. Modify the SQLite database row for that cache key directly to replace the reply text.
  3. Issue the exact same request to `/api/chat`. It must instantly return the modified text, verifying it was served from the cache.

### `[AC-2] Social Media Post Generator Caching`
* **Requirement**: Responses from `POST /api/generate-post` must be cached to avoid duplicate LLM calls.
* **Cache Key**: A unique key derived from:
  1. `trendTitle`
  2. `platform`
  3. `contextType`
* **Storage Systems**:
  * **Production**: Cloud Firestore collection `generated_posts` (doc ID hashed for safety).
  * **Local/Development**: SQLite table `generated_posts`.
  * **In-Memory**: A fallback Map `inMemoryGeneratedPosts`.
* **Testing / Verification**:
  1. Make a request to `/api/generate-post` for a trend. The post is generated and cached.
  2. Modify the SQLite database row for that cache key directly to replace the post text.
  3. Issue the exact same request. It must instantly return the modified text.

### `[AC-3] LLM Prompt Quality and Style Optimization (Fluff-Free & Catchy)`
* **Requirement**: All Gemini prompt templates must be refined to enforce crisp, high-impact, active-voice content and ban AI clichés.
* **Impacted Prompts**:
  1. `getTrendExplanation` (primary trend explanation template)
  2. `getLocalizedTrendExplanation` (translation style rules)
  3. `/api/chat` (follow-up Q&A instructions)
  4. `/api/generate-post` (social media templates)
* **Optimization Guidelines**:
  * Demand high information density and zero fluff.
  * Require active voice and authentic human-like framing.
  * Explicitly blacklist generic AI transition and filler words: `delve`, `tapestry`, `revolutionize`, `unlock`, `moreover`, `testament to`, `it is important to note`, `firstly`, `in conclusion`, `embark`.
* **Testing / Verification**:
  * E2E/Unit test parsing `server.js` or mocking Gemini API calls to assert that all prompts contain instructions to write catchy, fluff-free copy and contain the blacklisted buzzword directives.

---

## Out of Scope
* Caching search engine pings or sitemap generation (since these are live status/indexing requirements).
* Redesigning the social post sharing UI modal or adding new UI elements (scope is strictly LLM optimizations and backend caching).

---

## Vertical Slices

### `[S-1] DB Schema & Caching Functions`
* **ACs**: `[AC-1]`, `[AC-2]`
* **Files**: `db.js`
* **Description**:
  * Update SQLite initialization to create tables `chat_cache` and `generated_posts`.
  * Export the following caching helpers from `db.js`:
    * `getCachedChatResponse(trend, query, history)`
    * `setCachedChatResponse(trend, query, history, reply)`
    * `getCachedGeneratedPost(trendTitle, platform, contextType)`
    * `setCachedGeneratedPost(trendTitle, platform, contextType, postText)`
  * Implement Firestore, SQLite, and In-Memory storage paths within these functions.
* **Test Strategy**: Additive. Create unit tests directly verifying that the export functions work and save/retrieve values correctly under test database contexts.

### `[S-2] Server Route Caching Integration`
* **ACs**: `[AC-1]`, `[AC-2]`
* **Files**: `server.js`
* **Description**:
  * Integrate `getCachedChatResponse` / `setCachedChatResponse` into the `/api/chat` handler.
  * Integrate `getCachedGeneratedPost` / `setCachedGeneratedPost` into the `/api/generate-post` handler.
  * Ensure even under `process.env.NODE_ENV === 'test'` mock mode, the mock outputs are stored in the cache so caching can be verified via integration tests.
* **Test Strategy**: Additive. Add Playwright E2E/API integration tests under `tests/caching.spec.js` that check `/api/chat` and `/api/generate-post` caching behavior by seeding/modifying database records.

### `[S-3] Prompt Refinements & Output Optimization`
* **ACs**: `[AC-3]`
* **Files**: `server.js`
* **Description**:
  * Update all four prompt templates with anti-fluff instructions, banned words lists, and active voice requirements.
* **Test Strategy**: Additive. Add unit tests asserting the inclusion of stylistic rules and banned words in the server's prompt constructs.
