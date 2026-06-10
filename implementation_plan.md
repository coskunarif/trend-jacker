# Implementation Plan - TJ-21: Mobile Layout and Responsiveness Overhaul

This plan outlines the atomic, testable slices to fix mobile-view layout and responsiveness bugs on TrendJacker. It adheres to **Militant TDD** principles—all tests must be written and run to fail before any styling fixes are implemented.

---

## 🎯 Target Specifications

1. **Debate Bubble Layout & Avatar Positioning**
   - Keep `.debate-avatar` and `.debate-bubble` side-by-side (row layout) even on narrow viewports.
   - Enforce fixed size on avatar: `width: 36px; height: 36px; flex-shrink: 0;` so it is never squashed.
   - Set `.debate-bubble-wrap` to `width: fit-content; max-width: 85%;` to allow it to wrap properly without collapsing to a single-word column.
   - Maintain side-by-side alignments: Optimist left-aligned (`flex-start`), Skeptic right-aligned (`flex-end` with `flex-direction: row-reverse`).

2. **Metadata Row Wrapping and Alignment**
   - Configure `.trend-meta-row` to wrap fluidly as inline-flex items using `flex-wrap: wrap;`.
   - Align elements to the left on mobile viewports.
   - Enforce a standard gap between wrapped items of `var(--space-2)` (8px).

3. **Velocity Gauge Internal Sizing**
   - Keep the speedometer and sparkline canvas side-by-side inside `.velocity-gauge-container` by default.
   - On screens `<= 360px`, reduce internal gaps/padding or wrap/scale down the canvas (`#trend-sparkline`) and speedometer SVG fluidly so that the gauge does not cause overflow.

4. **Viewport Boundaries & Box Sizing**
   - Enforce `box-sizing: border-box` and `max-width: 100%` on all panels and cards inside `.main-panel` (e.g. `.trend-hero-card`, `.glass-card`).
   - Eliminate absolute widths and margins that push elements beyond the viewport.

---

## 🛠️ Execution Roadmap

### Slice 1: Automated Test Suite (Militant TDD)
*Goal: Write Playwright tests verifying the current bugs before modifying any CSS.*

1. **Create the Test File**
   - Create `tests/responsive.spec.js` (or add to `tests/e2e.spec.js` / `tests/visual.spec.js`).
2. **Implement Viewport Overflow Test**
   - Set viewport size to `375x667` (iPhone SE) and `320x568` (iPhone 5/SE first gen).
   - Load the page, trigger details fetch for a mock trend, and assert that the document scroll width does not exceed the viewport inner width:
     ```javascript
     const overflow = await page.evaluate(() => {
       return document.documentElement.scrollWidth > window.innerWidth;
     });
     expect(overflow).toBe(false);
     ```
3. **Implement Debate Bubble Collapse Test**
   - Check that the width of `.debate-bubble` is healthy (e.g., has a bounding box width of at least `150px` for average paragraph lengths instead of collapsing to single-word column width ~40-60px).
4. **Implement Chat Bubble Layout Test**
   - Check that `.chat-bubble` has `width: fit-content` behavior (e.g. shorter text takes less width than `max-width`).
5. **Implement Metadata Row Wrapping and Alignment Test**
   - Verify that the metadata row wrapping is enabled and items stack or wrap when horizontal space is limited, and verify their horizontal positions are left-aligned.
6. **Run Tests to Verify Failure**
   - Run `npm run test tests/responsive.spec.js` and ensure these assertions fail.

### Slice 2: CSS Layout Fixes
*Goal: Modify CSS to fulfill the specifications.*

1. **Fix Debate and Chat Bubbles**
   - Update `.debate-bubble-wrap` styles:
     - Ensure `width: fit-content;` and `max-width: 85%;` are declared.
     - Add `flex-shrink: 0;` to `.debate-avatar` to prevent squashing.
   - Update `.chat-bubble` styles:
     - Set `width: fit-content;` and verify `max-width: 85%;` is present.
2. **Fix Metadata Row Wrapping**
   - In `public/styles.css` under the `@media (max-width: 768px)` media query:
     - Set `.trend-meta-row` to `flex-wrap: wrap;`, `justify-content: flex-start;`, and `gap: var(--space-2);`.
3. **Optimize Velocity Gauge & Sparkline for Ultra-Narrow Viewports**
   - Add/update rules for `.velocity-gauge-container`:
     - Reduce padding and gaps for screens `<= 360px`.
     - Set `#trend-sparkline` to `max-width: 90px;` (or dynamically scale it) and ensure the speedometer SVG has `max-width: 100%;` and `height: auto;`.
4. **Enforce Box-Sizing & Viewport Boundaries**
   - Ensure all layout panels inside `.main-panel` use `max-width: 100%` and `box-sizing: border-box`.

### Slice 3: Verification & Visual Regression Audit
*Goal: Ensure tests pass and the UI looks pristine.*

1. **Run Playwright Test Suite**
   - Run `npm run test` to check both the new responsive tests and existing visual/E2E suites.
2. **Verify Layout visually**
   - Check that no visual layout regressions occur on desktop.
