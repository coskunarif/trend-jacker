# Specification — High-DPI Visual Share Card Rendering

Retina-ready high-resolution rendering of social share cards (Trend Explainer and Infographic Cards) to ensure clear, pixel-perfect social click-through previews on high-DPI screens and mobile devices.

---

## 🎯 Acceptance Criteria

- **[AC-1] High-DPI Canvas Scaling Factor**:
  - The canvas dimensions must be scaled by a multiplier of `2` (making the physical size `2400x1260` instead of `1200x630`) to output high-definition images.
  - The 2D rendering context must use `ctx.scale(2, 2)` so that existing vector math coordinates do not have to be manually recalculated.
- **[AC-2] Unified Quality in Sharing/Downloads**:
  - Both the **Trend Card** (`generateTrendCardImage`) and the **Infographic Card** (`generateInfographicCard`) must render sharp text, borders, gradients, and SVGs on download or share.
- **[AC-3] Automated Validation**:
  - Playwright integration tests must mock the download trigger and assert that the generated/downloaded PNG images possess high-DPI dimensions (`2400` width and `1260` height).

---

## 🚷 Out of Scope

- Redesigning the visual assets/layout or modifying text content of the cards.
- Adding third-party image manipulation libraries.

---

## 🛠️ Slices

### [S-1] Additive/Refinement: High-DPI Canvas Scaling Implementation
- **Description**: Add canvas scale logic inside `generateTrendCardImage` and `generateInfographicCard` in `public/app.js`. Scale canvas dimensions to `2400x1260` and execute `ctx.scale(2, 2)` before drawing.
- **Files**: `public/app.js`
- **ACs**: `[AC-1]`, `[AC-2]`

### [S-2] Test: High-DPI E2E Verification
- **Description**: Update Playwright test suite to mock the download and check that the exported files have the high-resolution (`2400x1260`) properties.
- **Files**: `tests/viral-generator.spec.js`, `tests/visual.spec.js`
- **ACs**: `[AC-3]`
