# Specification: Trend Details View Typographic and Layout Polish

## Acceptance Criteria

- **[AC-1] Demographic Selector Flex Wrapping**
  - **Description**: The demographic selection container `#demographic-selector` must allow its children pills (`.demo-pill`) to wrap onto multiple lines when horizontal viewport space is restricted (e.g., <= 375px wide).
  - **Verification**: In Playwright tests (viewport width 320px and 375px), assert that no demographic pill overflows the viewport or clipping boundary, and that the container's height adjusts dynamically to fit wrapped children.

- **[AC-2] Trend Title Flow and Spacing**
  - **Description**: The trend title `#detail-title` must always flow vertically below `#demographic-selector` without overlapping it.
  - **Verification**: Assert that the bounding box top of `#detail-title` is strictly greater than or equal to the bounding box bottom of `#demographic-selector` + 8px across all viewports (320px, 375px, 1280px).

- **[AC-3] Multiline Title Formatting and Line Height**
  - **Description**: Multi-line trend titles must wrap gracefully without clipping at the edges. Explicit, readable line-height (between `1.2` and `1.25`) must be enforced, and overflow-wrap/word-wrap rules must be active.
  - **Verification**: Mock a long title (e.g., "This is an extremely long trend title that spans multiple lines to verify wrapping behavior") and assert in Playwright that all text wraps correctly and does not overflow horizontally.

- **[AC-4] Viewport Overflow Prevention**
  - **Description**: Layout elements inside the main explainer panel must not trigger horizontal scrollbars or extend past the viewport boundary on narrow mobile sizes.
  - **Verification**: In Playwright, verify `document.documentElement.scrollWidth <= window.innerWidth` is true on all viewports (320px, 375px, 1280px).

## Out of Scope
- Changing or adding API endpoints or demographic logic.
- Redesigning other parts of the trend cards grid or the theme layout.

## Test Strategy (Refinement)
- Since this is a refinement task, we will update the existing E2E/responsive layout tests to assert strict boundary and overlap constraints (specifically checking `boundingBox` coordinates of `.demographic-selector` vs `.trend-title` and verifying that the page does not overflow on a 320px viewport).

## Slices

### [S-1] Demographic Selector Wrapping & Spacing
- **Files**: `public/styles.css`
- **ACs**: `[AC-1]`, `[AC-4]`
- **Description**: Modify `.demographic-selector` styles to enable flex wrapping (`flex-wrap: wrap`), set appropriate gaps, and ensure no horizontal clipping or layout break on narrow screens.
- **Independence**: Independent

### [S-2] Trend Title Typographic Polish
- **Files**: `public/styles.css`
- **ACs**: `[AC-2]`, `[AC-3]`, `[AC-4]`
- **Description**: Define explicit `line-height`, `word-wrap`, `overflow-wrap` on `.trend-title` in both base and mobile styles to support multi-line title wrapping without line or element collision.
- **Independence**: Independent
