# Specification — Client-Side Image Fallbacks for Broken Assets

This specification outlines the requirements and implementation plan to handle client-side image and favicon loading failures on the TrendJacker website. When external images (OG images or publisher favicons) fail to load due to 404/403 errors, network failures, or CORS policies, the app must gracefully revert to CSS-based placeholders or default icons rather than displaying broken image indicators.

---

## 🎯 Acceptance Criteria

### `[AC-1]` List Item Thumbnail Fallback
- **Requirement**: If a trend's thumbnail image (`trend.news.ogImage`) fails to load in the sidebar/trend list, the broken image must be hidden and the CSS-based gradient placeholder (`.trend-thumbnail-placeholder`) must be shown in its place.
- **Verification**: In Playwright, intercept the `ogImage` URL to return a `404` status code. Navigate to the page and assert that the `<img>` element with class `.trend-thumbnail` is either hidden or has `display: none` applied, and the `.trend-thumbnail-placeholder` is visible.

### `[AC-2]` List Item Publisher Favicon Fallback
- **Requirement**: If a trend's publisher favicon (`trend.news.favicon`) fails to load in the sidebar/trend list, the `<img>` element with class `.publisher-favicon` must be hidden.
- **Verification**: Intercept the favicon URL to return a `404` status code. Assert that the `.publisher-favicon` element is either removed from the DOM or has `display: none` applied.

### `[AC-3]` Detail View Hero Image Fallback
- **Requirement**: If a trend's detail hero image (`#detail-hero-image`) fails to load, the image must hide (`display: none`), and the CSS gradient fallback (`.detail-hero-gradient`) must be displayed (`display: block`).
- **Verification**: Intercept the detail hero image URL to return a `404`. Assert that `#detail-hero-image` is hidden and `.detail-hero-gradient` is visible.

### `[AC-4]` News Footer Favicon Fallback
- **Requirement**: If the favicon (`#footer-favicon-img`) in the news footer fails to load, the image must be hidden, and the generic newspaper SVG (`svg.lucide-newspaper`) must be displayed.
- **Verification**: Intercept the news footer favicon URL to return a `404`. Assert that `#footer-favicon-img` is hidden and `svg.lucide-newspaper` is visible.

---

## 🚫 Out of Scope

- Re-scraping metadata or introducing server-side image proxy endpoints/third-party image proxying services.
- Designing or hosting new static image files/assets for placeholders (all placeholders must use the existing CSS classes `.trend-thumbnail-placeholder` and `.detail-hero-gradient`).

---

## 🛠️ Implementation Slices

### `[S-1]` Add E2E Tests for Client-Side Image Load Errors
- **Description**: Add new E2E tests in `tests/og-favicon.spec.js` that mock/intercept the trends API and route image requests to return HTTP `404` errors. Assert that the frontend hides the broken images and shows the corresponding fallbacks.
- **Target Files**: 
  - `tests/og-favicon.spec.js`
- **Mapped ACs**: `[AC-1]`, `[AC-2]`, `[AC-3]`, `[AC-4]`
- **Dependency**: None (Independent)
- **Test Strategy**: Additive / Tests First. The tests must be added and verified to fail (or run with mocked fallbacks asserting properly) before the code is updated.

### `[S-2]` Implement List Item Image Fallbacks
- **Description**: Update the template literal generation in `public/app.js` for trend items. For thumbnails, render both the `<img>` and a hidden `.trend-thumbnail-placeholder` side-by-side, adding an `onerror` handler to the `<img>` to hide itself and show the placeholder. For publisher favicons, add an `onerror` handler to hide the element.
- **Target Files**:
  - `public/app.js`
- **Mapped ACs**: `[AC-1]`, `[AC-2]`
- **Dependency**: `[S-1]`

### `[S-3]` Implement Detail View & News Footer Image Fallbacks
- **Description**: In `public/app.js`, add `onerror` listeners to `#detail-hero-image` and `#footer-favicon-img` inside the detail views population logic. The hero image error listener will hide itself and show the gradient fallback. The footer favicon error listener will hide itself and restore the generic newspaper SVG icon.
- **Target Files**:
  - `public/app.js`
- **Mapped ACs**: `[AC-3]`, `[AC-4]`
- **Dependency**: `[S-1]`

---

## 💡 Playwright Assertions Guidelines
- **Polling & Retrying**: Use Playwright's retrying assertions rather than arbitrary timeouts when asserting visibility changes of images and fallbacks after error states are triggered.
- **Correct Syntax**: Remember that the correct syntax for polling assertions in Playwright is:
  ```javascript
  await expect(async () => {
    // assertion logic
  }).toPass();
  ```
  Attempting to pass the assertion block as an argument (e.g., `expect(async () => {}).toPass()`) is required.
