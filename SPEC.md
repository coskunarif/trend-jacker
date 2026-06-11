# Specification: Fix Split-Screen/Sentiment Dashboard UI Layout and Transitions

## Acceptance Criteria

- **[AC-1]: Hide Mobile Tab Switcher on Desktop**
  - The mobile tab switcher (`.sidebar-tabs`) must be hidden (`display: none;`) on desktop screens (>768px).
  - Verification: At viewport width >768px, verify using CSS rules or Playwright locators that `.sidebar-tabs` is hidden.

- **[AC-2]: Display Both Panels in Split-Screen Layout on Desktop**
  - On desktop screens (>768px), both Trending Searches (`.scroll-container` / `#trends-list`) and Sentiment Feed (`.live-feed-section`) must remain visible simultaneously.
  - Interactive class modifications like adding `.tabs-toggled`, `.show-sentiment`, or `.show-trending` to `.sidebar-panel` must NOT hide either panel on desktop.
  - Verification: At viewport width >768px, simulate clicking tab buttons or adding these classes to the sidebar panel and verify that both columns remain visible.

- **[AC-3]: Retain Mobile Tab Switcher Functionality on Mobile**
  - The tab switcher (`.sidebar-tabs`) must remain visible (`display: flex;`) on mobile screens (<=768px).
  - Toggling tabs on mobile must correctly show only the active panel (`#trends-list` for Trending Searches, and `.live-feed-section` for Sentiment Feed) and hide the other.
  - Verification: At viewport width <=768px, clicking the mobile tab buttons correctly switches visibility between Trending and Sentiment panels.

- **[AC-4]: Enable View Transitions in All Environments**
  - Do not disable View Transitions animation via client-side check on `navigator.webdriver`.
  - Remove code adding `playwright-e2e-desktop` class on `navigator.webdriver` check and the CSS rule overriding animation transitions for it.
  - Verification: Verify in `public/app.js` and `public/styles.css` that `navigator.webdriver` / `playwright-e2e-desktop` conditional animation overrides are deleted.

## Out of Scope
- Introducing a three-column layout or changing the grid layout structure.
- Modifying the visual style of tabs, gauges, or cards beyond their layout visibility.

## Slices

### [S-1]: Test Strategy & Specification Updates
- Update the responsive/layout test suite (`tests/sidebar-hydration.spec.js`) to assert new desktop split-screen rules and verify `navigator.webdriver` removal.
- Update tests that assert `sidebarTabs.toBeVisible()` on desktop to instead assert that it is hidden, and ensure both panels are visible.
- **Files:** `tests/sidebar-hydration.spec.js`
- **ACs:** `[AC-1]`, `[AC-2]`, `[AC-4]`
- **Test Strategy:** Refinement - update existing tests to reflect new split-screen layout assertions.

### [S-2]: UI Layout & Transition Rules Implementation
- Modify `public/styles.css` to hide `.sidebar-tabs` by default on desktop, show it only under the max-width 768px media query, and delete the top-level override classes (`.sidebar-panel.tabs-toggled.show-sentiment .scroll-container`, etc.) that hide elements on desktop.
- Delete the `navigator.webdriver` checking logic from `public/app.js` and the corresponding `body.playwright-e2e-desktop` animation disables from `public/styles.css`.
- **Files:** `public/styles.css`, `public/app.js`
- **ACs:** `[AC-1]`, `[AC-2]`, `[AC-3]`, `[AC-4]`
- **Test Strategy:** Verify via Playwright test run using the updated tests from [S-1].
