# Specification: Server-Side Pre-Rendering, Sitemap Pinging, Header/Footer Directory Link, & Lifespan Extension

This document outlines the technical specification for implementing SEO crawlability and indexing optimizations in the TrendJacker platform.

---

## 🎨 UI/UX Mockup

Below is the mockup for the header navigation bar showcasing the new "Historical Directory" link.

![Navbar with Directory Link](/home/ubuntuadmin/.gemini/antigravity-cli/brain/69c0e454-9fd3-4bb1-a525-83736c82a936/navbar_directory_mockup_1781891446971.jpg)

---

## 🎯 Acceptance Criteria

### `[AC-1]` Server-Side HTML Pre-Rendering (Core Fields)
- **Verification**: Programmatic HTTP GET request to `/` or `/t/:slug` (with JS disabled/ignored) must return indexable text within the main explainer container.
- **Requirements**:
  - The welcome screen `#welcome-view` must have the class `hidden` added.
  - The explainer view `#explainer-view` must have the class `hidden` removed.
  - The header title `#detail-title` must contain the active trend name.
  - The text container `#detail-hook` must contain the explanation's hook text.
  - The text container `#detail-what` must contain the explanation's `whatIsIt` text.
  - The text container `#detail-takeaway` must contain the explanation's `takeaway` text.
  - The container `#detail-viral-tags` must contain list item spans with class `viral-tag` for each item in the `whyIsItViral` array.

### `[AC-2]` Server-Side HTML Pre-Rendering (Polls & News Footer)
- **Verification**: Programmatic extraction of the rendered HTML for polls and news elements.
- **Requirements**:
  - The progress bars `#bar-genius` and `#bar-overrated` must have their `style="width: XX%"` attribute preloaded with calculated percentages from database polls.
  - The text elements `#pct-genius` and `#pct-overrated` must display the percentage texts (e.g. `65%` and `35%`).
  - The sentiment gauge `#gauge-genius-pct` text content must display the genius percentage, and `#gauge-fill` stroke-dashoffset must be set to the corresponding percentage offset (`251.2 * (1 - geniusPct / 100)`).
  - The `.news-footer-card` must contain pre-rendered news headline (`#detail-news-title`), publisher (`#detail-news-publisher`), snippet (`#detail-news-snippet`), blockquote `cite` and link `href` attributes set to `matchedNews.url` if news context is present.
  - If news context is missing, the `.news-footer-card` must have the class `hidden` added.

### `[AC-3]` Header Link & Client Translation
- **Verification**: E2E browser test navigating to `/` and checking the navbar layout.
- **Requirements**:
  - A new link with `id="header-directory-link"` must be added to the navigation bar header.
  - The link must point to `/directory` by default (for English locale) or `/directory/:lang` for localized page visits.
  - Client-side `translateUI(lang)` function in `public/app.js` must update `#header-directory-link` text content and `href` attribute dynamically matching the active language.

### `[AC-4]` Google Sitemap Ping Integration
- **Verification**: Execution of the sitemap ping script triggers a mock HTTP request to Google's ping endpoint in test mode.
- **Requirements**:
  - Whenever a new trend is generated/stored, `pingSearchEngines` in `indexing.js` must trigger an HTTP GET fetch request to:
    `https://www.google.com/ping?sitemap=${encodeURIComponent(sitemapUrl)}`
    where `sitemapUrl` is `https://<APP_HOST>/sitemap.xml` (or `http` for local hosts).
  - A standalone CLI script `scripts/ping-sitemap.js` must be provided to trigger the sitemap ping manually.
  - The ping must be safely bypassed in test environments (`process.env.NODE_ENV === 'test'`) and print a mock statement.
  - Update `tests/seo-canonical-redirects.spec.js` to assert that the Google sitemap ping request **is** sent in production/mocked mode.

### `[AC-5]` Database Lifespan Extension (Pruning Job)
- **Verification**: Unit/integration tests asserting that explanations older than 21 days are pruned, while recent entries are preserved.
- **Requirements**:
  - A new function `pruneOldExplanations()` must be exported from `db.js` that deletes records from both `trend_explanations` and `localized_explanations` where the `created_at` timestamp is older than 21 days (3 weeks).
  - The pruning function must be integrated into `updateTrendsCache()` to run periodically on cache refresh, ensuring a clean state while maintaining a healthy 3-week indexability window.

---

## ⚡ Performance KPIs

- `[KPI-1]` Initial HTML Response Size overhead: The addition of pre-rendered HTML to the index template must not increase the overall page size of `/` by more than 10KB.
- `[KPI-2]` Server response latency: Time to first byte (TTFB) for `/t/:slug` must remain under 150ms when serving from the database cache.

---

## 📝 Interface Contract

The Tester, Builder, and Conductor will share the following interfaces:

### File: `db.js`
- Exported API:
  ```typescript
  export function pruneOldExplanations(): Promise<void>;
  ```

### File: `indexing.js`
- Exported API (updated):
  ```typescript
  export function pingSearchEngines(slugs: string[]): Promise<{ success: boolean; urls: string[]; googlePinged?: boolean }>;
  ```

### File: `scripts/ping-sitemap.js`
- Standalone CLI entry-point: runs sitemap ping using `process.env.APP_HOST`.

---

## 🚫 Out of Scope

- Integrating Search Console OAuth authentication for API sitemap submissions.
- Pruning user action logs, streaking logs, or trivia scores.
- Re-generating canvas infographic cards on the server.

---

## 💬 Objections & Resolutions

### Critic Concerns:
- *Concern*: Pinging Google's sitemap endpoint is officially deprecated by Google since late 2023.
- *Resolution*: While deprecated, the prompt explicitly requests pinging Google's sitemap engine directly. We will implement it exactly as requested but ensure it is handled asynchronously and gracefully handles any network failures without crashing the application.

---

## 🍰 Implementation Slices

### `[S-1] Pre-render HTML template details on server`
- **Files**: [server.js](file:///home/ubuntuadmin/projects/trend-jacker/server.js)
- **Acceptance Criteria**: `[AC-1]`, `[AC-2]`
- **Independent**: Yes
- **Task Type**: Refinement

### `[S-2] Header directory link insertion and translation`
- **Files**: [public/index.html](file:///home/ubuntuadmin/projects/trend-jacker/public/index.html), [public/app.js](file:///home/ubuntuadmin/projects/trend-jacker/public/app.js)
- **Acceptance Criteria**: `[AC-3]`
- **Independent**: Yes
- **Task Type**: Additive

### `[S-3] Google Sitemap Ping Implementation`
- **Files**: [indexing.js](file:///home/ubuntuadmin/projects/trend-jacker/indexing.js), [scripts/ping-sitemap.js](file:///home/ubuntuadmin/projects/trend-jacker/scripts/ping-sitemap.js), [tests/seo-canonical-redirects.spec.js](file:///home/ubuntuadmin/projects/trend-jacker/tests/seo-canonical-redirects.spec.js)
- **Acceptance Criteria**: `[AC-4]`
- **Independent**: Yes
- **Task Type**: Additive

### `[S-4] Trend Lifespan Database Pruning`
- **Files**: [db.js](file:///home/ubuntuadmin/projects/trend-jacker/db.js), [server.js](file:///home/ubuntuadmin/projects/trend-jacker/server.js)
- **Acceptance Criteria**: `[AC-5]`
- **Independent**: Yes
- **Task Type**: Additive
