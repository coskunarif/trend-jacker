# SPEC.md - Real OG Images and Publisher Favicons Integration

This specification details the design and implementation plan to integrate real Open Graph (OG) images and publisher favicons from trending news URLs into trend details and list items, replacing text-only explainers and generic SVGs.

## Acceptance Criteria

- **[AC-1] Server-Side Metadata Fetcher & Caching**
  - The server (`server.js`) must parse the HTML of the trending `news.url` (if present) during `updateTrendsCache()` to extract:
    - The Open Graph image URL from `<meta property="og:image" ...>` or fallback `<meta name="twitter:image" ...>`.
    - The publisher favicon URL from `<link rel="icon" ...>`, `<link rel="shortcut icon" ...>`, or fallback.
  - The extracted metadata must be cached in memory under the `latestTrends` data structures (`trend.news.ogImage` and `trend.news.favicon`).
  - To prevent startup delay or request blocking, URL fetches must use a timeout (e.g., maximum 2 seconds) and run concurrently/asynchronously.

- **[AC-2] Robust Fallbacks & Test Safety**
  - If a metadata fetch fails, times out, or contains no OG image/favicon, the system must:
    - Fall back to a domain-based favicon provider (e.g., `https://www.google.com/s2/favicons?domain=DOMAIN&sz=32`).
    - Fall back to `null` or a placeholder indicator for the OG image, enabling clean UI handling.
  - In test environments (`process.env.NODE_ENV === 'test'`), the server must not execute external HTTP requests. It must return deterministic mock OG image URLs and mock favicon URLs.

- **[AC-3] Trend List Items Visual Upgrade**
  - The trend list items (`.trend-item` in `public/app.js`) must be updated to include:
    - A visual thumbnail (rendered from `trend.news.ogImage`) with modern styling (e.g., `aspect-ratio: 16/9`, object-fit cover, small size like `60px` width) next to the info block. If no image is available, a clean gradient placeholder is rendered.
    - The publisher favicon image (rendered from `trend.news.favicon`) placed next to the publisher/source badge text.
  - Existing CSS selectors (`.trend-item .source-badge.google-spike`, `.trend-item .source-badge.reddit-spike`) and text contents must be preserved to keep existing tests passing.

- **[AC-4] Trend Details & News Footer Enhancement**
  - The active trend detail view (`#explainer-view` in `public/index.html`) must display:
    - A prominent hero image banner rendering `trend.news.ogImage` (with a clean aspect ratio like `16/9` or `21/9`, lazy loading, and rounded corners) directly above the trend content (e.g., above or below the title `#detail-title`).
    - If the trend has no valid OG image, the hero block should hide gracefully or render a high-quality CSS gradient fallback.
  - In the news context footer (`.news-footer-card`), the generic newspaper SVG icon must be replaced with the actual publisher's favicon image.

- **[AC-5] Playwright E2E Verification**
  - A test suite `tests/og-favicon.spec.js` must verify:
    - Each trend list item renders a visible thumbnail image or visual placeholder.
    - Each trend list item renders a favicon next to the source badge.
    - The detail view displays a hero image banner (when `ogImage` is present).
    - The news footer card renders the correct publisher favicon instead of the generic SVG icon.

## Out of Scope

- Setting up external image caching proxies or processing services (e.g., Cloudinary, Imgix).
- Support for user uploads of custom icons or images.

## Slices

- **[S-1] Additive: Test Suite Setup (Test-First)**
  - **Files**: `tests/og-favicon.spec.js`
  - **Details**: Implement mock trend data containing test `ogImage` and `favicon` URLs. Write Playwright tests verifying the presence and layout of these elements in list items and detail views under both successful metadata matches and fallback conditions.
  - **Status**: Additive test slice.

- **[S-2] Server-Side Scraper & Fallbacks**
  - **Files**: `server.js`
  - **Details**: Implement the metadata extractor helper with regex/parse logic, request timeouts, caching, and fallback favicon generation. Ensure external HTTP requests are completely bypassed in `test` mode.
  - **Status**: Backend dependency slice.

- **[S-3] Frontend UI Integration & Styling**
  - **Files**: `public/index.html`, `public/app.js`, `public/styles.css`
  - **Details**: Update UI code to render the new metadata fields. Apply modern responsive styles to thumbnails, hero banners, and favicon icons. Verify visually with tests.
  - **Status**: Frontend UI slice.
