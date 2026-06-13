# Specification — Case-Insensitive Cache Lookups & Mobile-First Engagement Redesign

This document outlines the detailed system design, acceptance criteria, vertical implementation slices, and verification guidelines to address case-sensitivity caching inefficiencies and enhance mobile user engagement.

---

## 🎯 Target Objectives

1. **LLM Cost Reduction**: Normalize all DB cache lookup keys to lowercase/trimmed values to eliminate duplicate LLM generation requests from casing mismatches.
2. **Engagement & Retention**: Redesign the trending list sidebar for mobile viewports to replace a flat, long list of text with an interactive layout featuring filtering, search, collapsible truncation, and visual category badges.

---

## 🎯 Acceptance Criteria

### `[AC-1] Case-Insensitive Cache Lookups`
* **Requirement**: Storing and retrieving trend explanations and localized translations in SQLite, Firestore, and memory caches must be case-insensitive.
* **Verification**:
  1. Call POST `/api/explain` with trend `"GOOGLE GEMINI"`. The server will fetch and cache it.
  2. Modify the cached entry in the database directly to have a unique text string.
  3. Call POST `/api/explain` with trend `"google gemini"` and `"Google Gemini"`. Verify both return the custom modified text, confirming a cache hit.
  4. Verify that the SQLite columns for `trend` (and `lang`) in both `trend_explanations` and `localized_explanations` are defined with `COLLATE NOCASE`. On server startup, if these tables exist but lack `COLLATE NOCASE`, they must be programmatically dropped and recreated with the correct case-insensitive collation to ensure raw SQL test assertions match.

### `[AC-2] Mobile Trends List Search and Category Filtering`
* **Requirement**: The trends sidebar panel must support a real-time search box and source-platform filter tabs (All, Google, Reddit).
* **Verification**:
  1. Load the application. Type a partial query (e.g. `"gemini"`) into the `#trends-search` input. Verify the trends list filters in real-time to only show items containing that text (case-insensitive).
  2. Click the `"Google"` filter tab; verify only Google trends are displayed. Click `"Reddit"`; verify only Reddit trends are displayed. Click `"All"`; verify the list resets to show both sources.

### `[AC-3] Mobile Trends List Truncation and "Show More" Pagination`
* **Requirement**: On mobile viewports (width <= 768px), the trends list must be truncated to show only the top 6 trends by default, followed by a "+ Show More Trends" toggle button.
* **Verification**:
  1. Load the page on a mobile viewport (e.g., width 390px). Confirm that exactly 6 trend items are visible in the trends list.
  2. Confirm the `+ Show More Trends` button is visible.
  3. Click `+ Show More Trends`. Verify the list expands to show all trends, and the button changes text to `- Show Less Trends`. Click it again; verify the list collapses back to 6.

### `[AC-4] Dynamic Emojis & Fluid Mobile Typography`
* **Requirement**: Each trend item card must show a dynamic emoji category icon based on its content, and main titles must scale fluidly using CSS `clamp()`.
* **Verification**:
  1. Verify each trend card has a category emoji (e.g., 🤖 for tech/AI, 📈 for business/finance, 🎮 for gaming, 🔥 for other trends).
  2. Resize the viewport from 1280px to 375px. Verify that the `.trend-title` font-size fluidly scales using `clamp(1.6rem, 5vw, 2.25rem)` without wrapping problems or horizontal layout leaks.

---

## 🚫 Out of Scope

* **Third-Party Frameworks**: Do not pull in React, Vue, Tailwind, or other runtime frameworks. Keep modifications within vanilla HTML, CSS, and JS.
* **Other SQLite tables**: Avoid modifying non-caching tables like `votes` or `vote_events` unless schema migrations are explicitly required for cache compatibility.
* **New Translation Languages**: Do not add new languages beyond the existing es, fr, ja support.

---

## 🛠️ Vertical Slices

Slices are ordered by dependency. Independent slices can be parallelized.

### `[S-1] Case-Insensitive Cache Normalization (Backend)`
* **Files**: `db.js`, `server.js`
* **Description**:
  - Implement dynamic SQLite schema checks in `db.js` on startup: inspect `trend_explanations` and `localized_explanations` schemas. If they don't contain `COLLATE NOCASE` on the `trend` (and `lang`) columns, drop and recreate them with `COLLATE NOCASE` enabled.
  - Normalize keys in `db.js` helper functions (`getCachedExplanation`, `setCachedExplanation`, `getLocalizedExplanation`, `setLocalizedExplanation`) by trimming and lowercasing the `trend` (and `lang`) inputs.
  - Suffix localized demographic keys using `{trend}:{bracket}` normalized to lowercase.
  - Normalize cache keys in `server.js` functions `getTrendExplanation` and `getLocalizedTrendExplanation` before retrieving/storing entries. Maintain original casing in prompts sent to the LLM to avoid semantic degradation.

### `[S-2] Search & Category Filter UI and Logic (Frontend)`
* **Files**: `public/index.html`, `public/app.js`, `public/styles.css`
* **Description**:
  - Insert search input `#trends-search` and platform filter tabs `.trends-filter-tabs` inside `.trends-section` in `public/index.html`.
  - In `public/app.js`, add state variables for search query and platform selection. Update `renderTrends` to apply filters before drawing cards. Add input/click event listeners to update state and trigger re-rendering.
  - In `public/styles.css`, style the controls wrapper with glassmorphism overlays and hover effects.

### `[S-3] Collapsible Trend List on Mobile (Frontend)`
* **Files**: `public/index.html`, `public/app.js`, `public/styles.css`
* **Description**:
  - Insert `#btn-show-more-trends` below `#trends-list` in `public/index.html`.
  - In `public/app.js`, implement mobile viewport detection. Modify `renderTrends` to slice the list at index 6 when on mobile and `showAllTrendsMobile` is false. Show the toggle button and bind its click event to toggle expansion.
  - Add transition rules and responsive margins in `public/styles.css` to make list expansion smooth.

### `[S-4] Visual Accent Emojis & Fluid Typography (Frontend)`
* **Files**: `public/app.js`, `public/styles.css`
* **Description**:
  - Implement keyword-based classification in `public/app.js` (mapping tech, AI, gaming, finance keywords to specific emojis). Inject the resolved emoji class/text inside the trend item HTML template.
  - Refactor `.trend-title` in `public/styles.css` to use `clamp()` for fluid responsive font scaling.

---

## 🚦 Testing Strategy

* **Refinement Approach**: The Tester will update existing unit and integration tests (such as `tests/llm-caching-optimization.spec.js` and `tests/responsive.spec.js`) to assert case-insensitivity on cache lookups, search/filter behaviors, and mobile viewport truncation.
* **Auto-Execution**: All tests must run successfully via `npx playwright test` under SQLite WAL mode with a single worker.
