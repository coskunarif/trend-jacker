# SPEC.md - Topic Image Generation & Caching

This specification details the implementation plan for resolving missing/broken trend/topic images by dynamically generating and caching a topic-themed SVG image using the Gemini API.

## Problem Statement
Some trends retrieved from RSS feeds do not have an OpenGraph image (`ogImage`), or the images are broken on the client side (e.g. returning 404, blocked due to hotlinking restrictions). This results in empty dark purple boxes in the list view (thumbnails) and the detail view (hero banner), as observed in the screenshot:

![Broken Topic Images and Empty Placeholder Boxes](/home/ubuntuadmin/.gemini/antigravity-cli/brain/4e9a0665-21dc-4070-a3f0-e8ff0cd6dcf7/s_20260613_014947.png)

## Acceptance Criteria

### `[AC-1] Database Caching Schema & Helpers`
- **Criterion**: The SQLite database must contain a `topic_images` table (and a corresponding `topic_images` collection in Firestore for production) to cache generated SVGs.
- **Verification**:
  - The SQLite table schema must contain `trend` (TEXT PRIMARY KEY), `svg` (TEXT), and `created_at` (TEXT).
  - The module `db.js` must export two async helper functions: `getCachedTopicImage(trend)` and `setCachedTopicImage(trend, svg)`.
  - In-memory mock maps must be used when SQLite/Firestore are unavailable.

### `[AC-2] Dynamic SVG Image Generation Endpoint`
- **Criterion**: A new endpoint `GET /api/topic-image/:slug` must serve a topic-themed SVG.
- **Verification**:
  - The slug is matched against cached trends (or parsed into Title Case).
  - The endpoint first queries `getCachedTopicImage(trend)`.
  - If a cache hit occurs, it returns the cached SVG.
  - If a cache miss occurs, in test/dev mode it returns a deterministic mock SVG, and in production mode it generates a custom topic-related SVG using `gemini-3.5-flash` with JSON schema enforcement (`responseSchema` of type `OBJECT` with required property `svg` of type `STRING`).
  - The generated SVG is cached via `setCachedTopicImage(trend, svg)`.
  - The HTTP response header must contain `Content-Type: image/svg+xml`.

### `[AC-3] Client-Side Image Integration & Fallback`
- **Criterion**: The UI must display the dynamically generated SVG when `ogImage` is absent or broken.
- **Verification**:
  - In `public/app.js` (list item thumbnails), if `trend.news.ogImage` is null, the `src` must be immediately set to `/api/topic-image/:slug`. If `trend.news.ogImage` is non-null but fails to load, the `onerror` event handler must swap the `src` to `/api/topic-image/:slug`.
  - In `public/app.js` (detail view hero banner), the hero image must similarly use `/api/topic-image/:slug` directly if `ogImage` is missing, and switch to `/api/topic-image/:slug` via `onerror` if the original image fails to load.

---

## Out of Scope
- Localizing the generated SVGs or translating text elements within the generated SVG (a single generic topic-related image is sufficient).
- Replacing working/valid external `ogImage` URLs (only missing or broken images fall back to the generated SVGs).

---

## Slices

### `[S-1] Database Schema & Caching Layer`
- **Goal**: Implement SQLite schema initialization and caching helpers.
- **ACs Mapped**: `[AC-1]`
- **Files Modified**: `db.js`
- **Details**:
  - Initialize the `topic_images` table.
  - Implement `getCachedTopicImage` and `setCachedTopicImage`.
  - Implement in-memory map backup `inMemoryTopicImages`.

### `[S-2] API Endpoint & Gemini Logic`
- **Goal**: Implement the endpoint `/api/topic-image/:slug` with cache lookup and Gemini generation logic.
- **ACs Mapped**: `[AC-2]`
- **Files Modified**: `server.js`
- **Details**:
  - Register `GET /api/topic-image/:slug`.
  - Implement caching check and LLM generation with JSON schema enforcement for SVG output.
  - Add test environment mock branch returning a static valid SVG.

### `[S-3] Frontend Integration & Fallback`
- **Goal**: Update client-side thumbnail and hero banner loading and `onerror` fallback behavior.
- **ACs Mapped**: `[AC-3]`
- **Files Modified**: `public/app.js`
- **Details**:
  - Update `thumbnailHtml` logic to default to or fallback to `/api/topic-image/:slug`.
  - Update `#detail-hero-image` src logic to default to or fallback to `/api/topic-image/:slug`.

---

## Test Strategy (Refinement)
- Since this is a refinement task, we will add new assertions/tests to existing test files (specifically `tests/og-favicon.spec.js` and `tests/llm-caching-optimization.spec.js`) to verify:
  1. The new SQLite schema table exists and retrieves values correctly.
  2. The `/api/topic-image/:slug` endpoint is responsive and serves correct headers and SVGs.
  3. The frontend properly uses fallback images on 404/onerror.
