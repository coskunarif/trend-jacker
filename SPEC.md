# Specification: Dashboard Redesign & Global Sentiment Feed Removal

This specification outlines the redesign of the TrendJacker dashboard to remove the Global Sentiment Feed, expand the main workspace area, and implement modern UI/UX design practices.

## Test Strategy
* **Task Type**: Subtractive (removing Global Sentiment Feed) & Refinement (restyling layout and elements).
* **Test Flow**: 
  1. Delete/modify obsolete E2E assertions and visual tests (such as `.sidebar-tabs`, `#live-sentiment-feed`, and tab switching behavior) to avoid failing on deleted elements.
  2. Update viewport and layout tests to assert the new desktop grid dimensions (`320px 1fr` columns) and verify the absence of tabs.
  3. Run the tests to ensure clean compilation/failures on missing layout elements, then execute the implementation slices.

## Acceptance Criteria

### [AC-1] Global Sentiment Feed Removal (Subtractive)
* **Description**: The Global Sentiment Feed section must be completely removed from the left sidebar panel in the DOM.
* **Verification**: Verify that `#live-sentiment-feed` is absent from the DOM, and that the title/banner/indicators for the Global Sentiment Feed are gone.

### [AC-2] Sidebar Tab Bar Removal
* **Description**: The mobile/tablet sidebar tab-switcher must be completely removed from the DOM.
* **Verification**: Verify that `.sidebar-tabs` and its tab buttons (`Trending`, `Sentiment Feed`) are absent from the DOM, and only the "Trending Searches" content is displayed.

### [AC-3] Expanded Desktop Grid Layout
* **Description**: On screen widths >= 769px, the dashboard layout columns are configured to `320px 1fr`, reducing the left sidebar's desktop width to 320px and expanding the main explainer panel.
* **Verification**: Using a viewport width of 1280px, assert that the `.dashboard-grid` has `grid-template-columns` matching `320px 1fr`. Verify the main panel occupies the remaining space and is significantly wider than before.

### [AC-4] Sidebar Mobile Drawer Width Preservation
* **Description**: On mobile viewports (<= 768px), the slide-out `.sidebar-panel` width remains at `290px` when open, but displays no tabs.
* **Verification**: Set viewport to 375px wide, click `#sidebar-toggle`, assert `.sidebar-panel` is visible and its width is `290px`, with no `.sidebar-tabs` or `#live-sentiment-feed` elements inside.

### [AC-5] SSE Stream Resilience
* **Description**: The EventSource listener for `/api/sentiment-stream` in `app.js` must handle the missing `#live-sentiment-feed` gracefully without throwing JavaScript errors, while still updating active trend poll statistics and timeline drawings.
* **Verification**: Verify that background votes for the currently selected trend still dynamically update the community poll percentages and trigger timeline redraws, without console errors.

### [AC-6] Redesigned Welcome Screen
* **Description**: The empty welcome screen (`#welcome-view`) must be styled as a clean, modern dashboard landing state.
* **Verification**: Verify the welcome view uses refined glassmorphism container formatting, high-quality typography, and structured info elements for a polished first impression.

### [AC-7] Modern Card & Border Aesthetics
* **Description**: Card styling (`.glass-card`) is modernized by using fine, low-opacity borders (`rgba(255, 255, 255, 0.08)`), improved spacing, subtle backdrop saturations, and smooth micro-glowing translation animations on hover.
* **Verification**: Inspect CSS styles for `.glass-card` and verify clean borders, micro-animations, and lack of visual noise.

## Out of Scope
* Modifying backend database schemas or fastify server APIs (e.g., leaving `/api/sentiment-stream` SSE endpoint fully operational).
* Adding new social media integrations beyond what is currently supported in the share modal.

## Slices

### [S-1] Remove Global Sentiment Feed and Tab Switcher from markup and client scripts
* **Files**:
  - `public/index.html`
  - `public/app.js`
* **Description**: Delete the sidebar tabs and Global Sentiment Feed DOM nodes. Simplify `initSentimentFeed` in `app.js` to run in the background (updating active trend polls/timeline) without referencing the deleted feed elements. Remove the `switchTab` helper and click listeners for the tabs.
* **ACs Mapped**: `[AC-1]`, `[AC-2]`, `[AC-5]`
* **Dependency**: None (Independent)

### [S-2] Refactor Grid Columns & Sidebar Width in CSS
* **Files**:
  - `public/styles.css`
* **Description**: Modify media queries so that the `.dashboard-grid` columns are defined as `320px 1fr` on screens >= 769px. Ensure `.sidebar-panel` has a width of 320px on desktop and that the layout handles overflow isolation properly. Adjust mobile media overrides to remove tab-toggled rules.
* **ACs Mapped**: `[AC-3]`, `[AC-4]`
* **Dependency**: `[S-1]`

### [S-3] Redesign Cards and Welcome Screen with modern UI/UX principles
* **Files**:
  - `public/styles.css`
  - `public/index.html`
* **Description**: Improve the welcome state design by utilizing structured info grids and subtle border highlights. Refine `.glass-card` CSS styling to use modern translucent gradients, minimal border contrast, and micro-interactions on hover.
* **ACs Mapped**: `[AC-6]`, `[AC-7]`
* **Dependency**: `[S-2]`
