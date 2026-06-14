# Specification: Multi-lingual SEO, Trend Continuation Probability Engine & UX Polish

## Objective
Enhance search engine visibility, index coverage, and user engagement on TrendJacker. This will be achieved by implementing programmatic multi-lingual SEO verification, submitting localized variants to IndexNow, building an AI-driven Trend Continuation Probability Engine, optimizing LLM caching to lower costs, adding a manual feed refresh action, and polishing sharing formats.

---

## Acceptance Criteria

### `[AC-1]` Multi-lingual Canonical & Hreflang Link Injection
* Homepage `/`, trend detail `/t/:slug`, and localized trend `/t/:slug/:lang` must render correct `<link rel="canonical" href="..." />` tags in their HTML `<head>`. The URL path, slug, and lang code must be normalized to lowercase.
* Every trend detail and localized trend page must render `<link rel="alternate" hreflang="..." href="..." />` tags for `x-default`, `en`, `es`, `fr`, and `ja` in the HTML `<head>`.
* Detail and localized pages must serve enriched JSON-LD (`application/ld+json`) matching Schema.org `NewsArticle`. The JSON-LD must contain the canonicalized `mainEntityOfPage` URL, valid `datePublished`/`dateModified` timestamps (synced with the trend's database `created_at` field), and a `citation` object containing `headline`, `url`, and `publisher` of the primary news source if available (or appropriate fallbacks).
* **Verification**: Verify using Playwright tests (`page.goto`) by querying head elements (`head link[rel="canonical"]`, `head link[rel="alternate"]`) and parsing the contents of the `<script type="application/ld+json">` tag.

### `[AC-2]` Multi-lingual IndexNow Submission
* Newly discovered trends must trigger IndexNow HTTP POST submissions containing both the canonical English URL and all 3 localized variants (`es`, `fr`, `ja`) in a single payload.
* Before triggering the ping, trend slugs must be trimmed, converted to lowercase, and deduplicated.
* **Verification**: Intercept/mock `fetch` calls to the IndexNow API (`https://api.indexnow.org/indexnow`) and assert that the request contains exactly 4 URLs per trend in the `urlList` payload, normalized to lowercase with the configured `APP_HOST`.

### `[AC-3]` Trend Continuation Probability Engine
* The trend analysis backend must generate a "Trend Continuation Probability" (an integer from 0 to 100 representing the likelihood of the trend continuing tomorrow) and a "Continuation Rationale" (max 2 sentences explaining the probability).
* The Gemini API response schema inside `generationConfig` for `getTrendExplanation` must enforce the inclusion of:
  - `continuationProbability` (integer)
  - `continuationRationale` (string)
* Update database caching helpers (`getCachedExplanation`, `setCachedExplanation`) in `db.js` to map and persist these new fields in the SQLite/Firestore cache payloads.
* Localized translations (`getLocalizedTrendExplanation`) must translate the `continuationRationale` alongside the rest of the metadata and preserve `continuationProbability`.
* Mock environment setup (`process.env.NODE_ENV === 'test'`) must generate default continuation fields (`continuationProbability: 75`, `continuationRationale: 'Mocked continuation rationale based on test parameters.'`) to prevent test breakage.
* **Verification**: Send a `POST /api/explain` request and assert that the returned JSON contains `continuationProbability` (integer, 0-100) and `continuationRationale` (string). Verify that these fields are correctly stored in the cached database record.

### `[AC-4]` Trend Continuation Probability UI Integration
* The "Trend Prediction Stake" card in the detail view must display the "Trend Continuation Probability" percentage in a high-fidelity visual indicator (e.g. a stylized pill, progress bar, or badge).
* A hoverable tooltip or explanation text must display the generated "Continuation Rationale" directly under the probability score to guide user predictions.
* **Verification**: Navigate to `/t/google-gemini` in a browser test, assert that the continuation percentage element is visible, and verify that the rationale tooltip displays the expected explanation.

### `[AC-5]` Cost-Saving Caching & Schema Enforcement
* Client-side chat responses must be cached in browser `sessionStorage` using fully lowercased lookup keys (`chat_cache:<trend>:<query>:<history>`) to avoid redundant API network calls for casing mismatches in duplicate questions.
* Server-side database `chat_cache` lookup keys must be normalized to lowercase for both trends, queries, and history hashes.
* Enforce `responseSchema` on all JSON-based Gemini API calls (trend explanation, translation, trivia, and custom SVG image endpoints) to ensure structured payloads and prevent formatting retries.
* **Verification**: Verify that repeat chat queries pull directly from `sessionStorage` without creating network calls. Verify that database entries in the `chat_cache` table use fully lowercased keys.

### `[AC-6]` Feed Refresh Button and Post Optimization
* Sidebar headers must render a "Refresh Trends" button (using a circular-arrow icon) that triggers a fetch request to `GET /api/trends` in-place, updating the trends feed without reloading the page.
* While refetching, the refresh button must show a loading spinner/transition state, which is removed when rendering is complete.
* Generated social post contents must enforce character limit rules (X/Twitter posts under 280 characters) and platform-specific hashtag parameters. Ensure the generated post links use the correct `viraljacker.com/t/<slug>` format rather than hardcoded mock domains.
* **Verification**: Assert the refresh button exists, triggers a network call to `/api/trends`, and updates the sidebar items. Verify generated social posts meet length and link format requirements.

---

## Out of Scope
* Modifying actual production database schemas (since explanations are stored as serialized JSON strings in SQLite/Firestore, this does not require schema updates).
* Integrating third-party APIs other than Gemini and IndexNow (e.g., search engine indexing beyond IndexNow/Google Sitemap pings is out of scope).

---

## Implementation Slices

### `[S-1]` Multi-lingual SEO Link Injection & IndexNow Submission
* **Description**: Implement `<link rel="canonical">` and `<link rel="alternate">` tag injection in Fastify detail page handlers. Expand the IndexNow pinger (`indexing.js`) to generate and submit all language code variants normalized to lowercase. Update dynamic JSON-LD generation with citation properties.
* **AC Mapping**: `[AC-1]`, `[AC-2]`
* **Files**: `indexing.js`, `server.js`
* **Test Strategy**: Additive. Write Playwright tests verifying the presence and correctness of canonical, hreflang, and JSON-LD script elements on both homepage, English detail, and localized detail views before modifying implementation code.

### `[S-2]` Trend Continuation Probability Engine
* **Description**: Update the Gemini prompt and JSON schema definition in `server.js` for both English generation and translation. Update the `db.js` helper mappings (`getCachedExplanation`, `setCachedExplanation`) to persist the new probability and rationale fields. Update test mock response templates to return placeholder fields.
* **AC Mapping**: `[AC-3]`, `[AC-5]`
* **Files**: `db.js`, `server.js`
* **Test Strategy**: Additive. Update/create backend tests verifying that `POST /api/explain` yields the new continuation probability and rationale keys, and check that database cache inserts contain the serialized keys.

### `[S-3]` UI Integration of Trend Continuation & Trends Refresh
* **Description**: Add the "Refresh Trends" button to the sidebar HTML header. Implement click listeners in `public/app.js` to refetch trends and show a spinning transition state. Update the "Trend Prediction Stake" card HTML in `public/index.html` to add the continuation percentage badge and tooltip element. Add rendering logic in `public/app.js` to populate these elements.
* **AC Mapping**: `[AC-4]`, `[AC-6]`
* **Files**: `public/index.html`, `public/app.js`, `public/styles.css`
* **Test Strategy**: Additive. Write E2E browser tests asserting the existence and behavior of the refresh button and prediction card details. Verify in-place feed updates.

### `[S-4]` Social Post Refinement & Cache Key Normalizations
* **Description**: Update client-side and server-side chat caching functions to enforce case-insensitive lowercased keys. Refine social media post prompts to ensure links are formatted using the correct production host and fit within Twitter character boundaries.
* **AC Mapping**: `[AC-5]`, `[AC-6]`
* **Files**: `server.js`, `public/app.js`
* **Test Strategy**: Refinement. Update/extend existing caching tests and social generation tests to verify that lowercase keys are logged and character boundaries are strictly honored.
