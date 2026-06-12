# Specification: Dynamic Canvas Layout & Overflow Prevention

## Acceptance Criteria

- **[AC-1] Dynamic Subtitle & Header Positioning (Infographic)**
  - **Check**: When `generateInfographicCard()` is invoked with a custom subtitle, the position of the "THE AI HOOK" header must be calculated dynamically based on the bottom coordinate of the wrapped subtitle text plus a spacing of 65px. If no custom subtitle is present, the header must start at its default y-coordinate of 275.
  - **Verifiable via**: `window.__canvasLayouts.infographic.hookHeaderY` in the browser console/tests.

- **[AC-2] Enhanced wrapText Helper**
  - **Check**: The `wrapText` function in `public/app.js` must be updated to accept an optional `dryRun` boolean parameter (default `false`) and return the final y-coordinate `currentY` of the last line drawn/measured. If `dryRun` is `true`, no canvas drawing (`ctx.fillText`) must occur, but the text-wrapping and coordinate math must execute fully.
  - **Verifiable via**: Programmatic checks in E2E tests asserting that `wrapText` returns correct heights without drawing when `dryRun` is enabled.

- **[AC-3] Dynamic Hook Box Sizing (Infographic)**
  - **Check**: The AI Hook background box (drawn with `ctx.roundRect`) must scale its height dynamically to accommodate the wrapped hook text. The height must be calculated as `(lastHookTextY - hookTextStartY) + 80` (padding), with a minimum height of 120px.
  - **Verifiable via**: `window.__canvasLayouts.infographic.hookBoxHeight` in tests.

- **[AC-4] Dynamic Font Scaling & Footer Boundary Constraint (Infographic)**
  - **Check**: To prevent overlapping with the footer (at y=560) or sentiment labels (at y=505), the bottom of the Hook box must not exceed y=540. If the calculated bottom exceeds 540, the generator must enter a loop reducing the hook text font-size (starting at 18px, down to minimum 12px) and line-height (starting at 28px, down to minimum 19px) and recalculate the layout until it fits. If it still exceeds at 12px, the box height is capped at `540 - hookBoxY`.
  - **Verifiable via**: E2E test verifying that a card with a long custom subtitle and long hook text is successfully generated and fits within y=540.

- **[AC-5] Dynamic Positioning & Sizing on Standard Share Card**
  - **Check**: The `generateTrendCardImage()` function must also dynamically size the hook background box based on the wrapped hook text height, dynamically shift the subsequent "COMMUNITY SENTIMENT" header and poll bar down, and scale the hook font size if the layout bottom exceeds y=540 (leaving room for the footer).
  - **Verifiable via**: `window.__canvasLayouts.trendCard` layout parameters in tests.

- **[AC-6] Global Layout Telemetry**
  - **Check**: Both card generators must write their calculated layout parameters to `window.__canvasLayouts` (specifically `window.__canvasLayouts.infographic` and `window.__canvasLayouts.trendCard`) containing fields: `subtitleLines` (optional), `hookHeaderY`, `hookBoxY`, `hookBoxHeight`, `lastHookTextY`, and `hookFontSize`.
  - **Verifiable via**: `await page.evaluate(() => window.__canvasLayouts)` in Playwright.

- **[AC-7] E2E Layout & Overlay Validation**
  - **Check**: E2E tests in `tests/infographic-overlays.spec.js` must verify that cards render and download correctly with no overlapping elements or boundary violations under three test scenarios:
    1. No custom subtitle text.
    2. A normal custom subtitle (1 line).
    3. An extremely long custom subtitle (multiple lines) and long hook text.
  - **Verifiable via**: Running `npx playwright test tests/infographic-overlays.spec.js`.

## Out of Scope
- Making changes to the right-side sentiment gauge coordinates/visuals on the infographic card (remains statically at x=930, y=380, radius=80).
- Introducing third-party layout or image manipulation dependencies. All sizing and rendering must be done natively using standard HTML5 Canvas 2D context operations.
- Modifying interactive modal keyboard accessibility or sentiment feed DOM cleanup.

## Slices

- **[S-1] Enhanced wrapText Helper**
  - **Description**: Update `wrapText()` in `public/app.js` to support the `dryRun` flag and return the final y-coordinate.
  - **Files**: `public/app.js`
  - **ACs**: `[AC-2]`
  - **Independent**: Yes

- **[S-2] Dynamic Infographic Card Layout & Bounds Loop**
  - **Description**: Modify `generateInfographicCard()` to compute dynamic offsets for the subtitle and hook sections, size the background box dynamically, run the font size reduction loop if it exceeds y=540, and write coordinates to `window.__canvasLayouts.infographic`.
  - **Files**: `public/app.js`
  - **ACs**: `[AC-1]`, `[AC-3]`, `[AC-4]`, `[AC-6]`
  - **Independent**: No (depends on S-1)

- **[S-3] Dynamic Standard Share Card Layout**
  - **Description**: Modify `generateTrendCardImage()` to dynamically size the hook box, offset the community sentiment section, apply the font-scaling loop, and write coordinates to `window.__canvasLayouts.trendCard`.
  - **Files**: `public/app.js`
  - **ACs**: `[AC-5]`, `[AC-6]`
  - **Independent**: No (depends on S-1)

- **[S-4] E2E Test Suite Update & Layout Verification**
  - **Description**: Add new E2E tests to `tests/infographic-overlays.spec.js` asserting the layout coordinate validation via `window.__canvasLayouts` for all three subtitle scenarios.
  - **Files**: `tests/infographic-overlays.spec.js`
  - **ACs**: `[AC-7]`
  - **Independent**: No (depends on S-2, S-3)
