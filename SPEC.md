# SPEC: User-Customized Infographic Overlays

This specification details the design, functionality, and acceptance criteria for adding customizable infographic overlays to allow users to personalize social share cards.

## Acceptance Criteria

### [AC-1] Infographic Customization Panel UI
- Add a new controls section inside the "Snapshot Share" card (`#card-snapshot-share`) above the download button.
- The panel must contain:
  - A theme select dropdown (`#info-theme-select`) with options:
    - **Midnight** (`midnight` - default)
    - **Cyberpunk** (`cyberpunk`)
    - **Sunset** (`sunset`)
    - **Forest** (`forest`)
  - A badge/sticker overlay select dropdown (`#info-overlay-badge-select`) with options:
    - **None** (`none` - default)
    - **HOT TAKE** (`hot-take`)
    - **TRENDING** (`trending`)
    - **VIRAL** (`viral`)
  - A text input field (`#info-custom-text-input`) allowing up to 60 characters for a custom subtitle or message overlay.
- The UI controls must style-integrate seamlessly with the existing dark/neon glassmorphism design.

### [AC-2] Interactive Theme Styles & Background Customization
- The `generateInfographicCard` function must read the selected theme from `#info-theme-select` and apply the corresponding gradients to the canvas:
  - **Midnight**: background `#0f1225` to `#05070f`; border gradient `#6366f1` to `#06b6d4`.
  - **Cyberpunk**: background `#1e0b36` to `#0b0214`; border gradient `#ec4899` to `#eab308`.
  - **Sunset**: background `#2a0845` to `#6441a5`; border gradient `#ff7e5f` to `#feb47b`.
  - **Forest**: background `#064e3b` to `#022c22`; border gradient `#10b981` to `#059669`.
- The final output canvas dimensions must remain exactly `2400x1260` (high-DPI, 2x scaled representation of a 1200x630 canvas).

### [AC-3] Custom Sticker / Badge Overlay Drawing
- If a custom sticker overlay is selected from `#info-overlay-badge-select` (e.g. `hot-take`, `trending`, `viral`), render a prominent customized badge on the infographic canvas:
  - The badge should be drawn in the top-right quadrant (near the default `INFOGRAPHIC CARD` indicator or replacing it).
  - Use distinct accent colors matching the theme or badge intent (e.g. Red for "HOT TAKE", Yellow/Amber for "TRENDING", Pink/Magenta for "VIRAL").

### [AC-4] Custom Text Overlay Render & Word Wrap
- Read the custom text from `#info-custom-text-input`. If present, render it as a clean subtitle on the infographic canvas (e.g. below the category vibe badge or trend header title).
- Ensure the text uses `wrapText` to prevent overflow and does not overlap the AI hook block or the sentiment gauge on the right side.

### [AC-5] E2E Playwright Automation & Dimensions Validation
- Add Playwright E2E tests verifying:
  - The UI controls exist and are interactive.
  - Selecting theme options, adding custom text, and clicking `#btn-download-infographic` triggers a valid download.
  - The downloaded PNG file's header bytes confirm exact dimensions of `2400x1260`.

---

## Out of Scope
- Creating a separate photo editor interface (e.g. drag-and-drop crop, stickers rotation, canvas paint). All customizations are driven via the structured UI dropdowns/inputs and compiled directly into the 2D canvas download.
- Storing customization templates or preferences in the SQLite backend. Customizations are strictly local and temporary per download.

---

## Slices

### [S-1] Customization Panel UI (HTML & CSS)
- **ACs**: `[AC-1]`
- **Files**: `public/index.html`, `public/styles.css`
- **Verification**: Inspect elements to ensure correct layout under the Snapshot Share preview.

### [S-2] Canvas Generator Integration (JS Customizations)
- **ACs**: `[AC-2]`, `[AC-3]`, `[AC-4]`
- **Files**: `public/app.js`
- **Verification**: Manually adjust inputs and trigger infographic downloads, checking visual elements.

### [S-3] E2E Automation & Dimensions Assertion (Tests First)
- **ACs**: `[AC-5]`
- **Files**: `tests/viral-generator.spec.js` (or a dedicated new spec file)
- **Verification**: Run tests with `PAGER=cat npm test` or Playwright runner to ensure the customization features pass.
