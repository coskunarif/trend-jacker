# SPEC: TJ-26 Unified Share and Social Modal UI

## 1. Introduction & Context
Currently, the codebase contains partial implementations of a unified share modal (`#share-modal` in `public/index.html` and `public/app.js`), but it lacks a polished high-fidelity look and complete integration. This task involves refactoring the static/legacy sharing flows into a single unified high-fidelity modal dialog, implementing/enhancing live preview of the AI-generated post, platform selectors, quick copy-to-clipboard, and native outbound sharing links, as well as cleaning up legacy CSS classes or HTML trace references from old static share buttons (subtraction from TJ-27).

---

## 2. Acceptance Criteria

### [AC-1] Unified Share Modal Triggers
- **Description**: Clicking the primary "Share" button (`#btn-share-trend`) or the "Share Poll" button (`#btn-share-poll`) must trigger the unified share modal (`#share-modal`).
- **Verifiability**: 
  - Click `#btn-share-trend` -> verify `#share-modal` does not have the `hidden` class and is visible.
  - Click `#btn-share-poll` -> verify `#share-modal` is visible.

### [AC-2] Context-Aware Preselection
- **Description**: The modal must open with the appropriate context/angle selected based on the button clicked.
  - `#btn-share-trend` opens with context set to "General Explainer" (`general`).
  - `#btn-share-poll` opens with context set to "Poll Verdict" (`poll`).
- **Verifiability**: 
  - Open via `#btn-share-trend` -> `#share-context-select` value must be `'general'`.
  - Open via `#btn-share-poll` -> `#share-context-select` value must be `'poll'`.

### [AC-3] Platform Selection & Real-Time Post Generation
- **Description**: Clicking a platform pill (`x`, `linkedin`, `facebook`, `reddit`) must set the active platform, request a new post generation from the backend, and update the live preview textarea.
- **Verifiability**: 
  - Select LinkedIn pill -> mock `/api/generate-post` request is made with `{ trendTitle: "...", platform: "linkedin", contextType: "..." }`.
  - The text returned by the API is loaded into `#share-preview-text`.

### [AC-4] Quick Copy to Clipboard
- **Description**: Clicking `#btn-copy-share` must copy the content of the textarea to the user's system clipboard and temporarily toggle button text/feedback (e.g., "Copied!").
- **Verifiability**: 
  - Click `#btn-copy-share` -> read system clipboard to assert it matches `#share-preview-text`'s value. Assert text updates to "Copied!" and reverts.

### [AC-5] Outbound Native Share Intents
- **Description**: Clicking the primary action button (`#btn-post-share`) must open a new browser tab with the platform's native share/post intent URL prepopulated with the generated text.
- **Verifiability**: 
  - Click `#btn-post-share` -> a new window/tab is opened targeting `x.com/intent/tweet?text=...` (or other platform equivalent) containing the encoded preview text.

### [AC-6] Removal of Legacy Elements (Subtractive)
- **Description**: Clean up any remaining legacy static share elements or classes (such as references to `.share-x-btn` or `.share-poll-x-btn` or `#btn-share-x` or `#btn-share-poll-x`) from HTML and CSS.
- **Verifiability**: 
  - Check `public/index.html` and `public/styles.css` to ensure no unused static share elements exist in the DOM or style sheets.

---

## 3. Out of Scope
- Implementing real OAuth-based automated background posting to social media platforms.
- Creating native share sheet integration for mobile OS (using `navigator.share` which is restricted to SSL/secure contexts and has variable support in testing).

---

## 4. Vertical Slices

### [S-1] Subtractive Cleanup of Legacy Assets
- **Type**: Subtractive (Delete code/styles first)
- **Mapped ACs**: [AC-6]
- **Target Files**:
  - `public/index.html` (remove any leftover HTML/SVG for old static share buttons)
  - `public/styles.css` (clean up legacy selectors like `.share-x-btn` or `.share-poll-x-btn`)

### [S-2] Refine Share Modal Styling & High-Fidelity Transitions
- **Type**: Refinement
- **Mapped ACs**: [AC-1]
- **Target Files**:
  - `public/styles.css` (implement polished backdrop blur, hover states, active transitions, and responsive modal layout)
  - `public/index.html` (verify modal structure matches styling)

### [S-3] Functional Event Listeners & Live Preview Updates
- **Type**: Additive/Refinement
- **Mapped ACs**: [AC-2], [AC-3], [AC-4], [AC-5]
- **Target Files**:
  - `public/app.js` (modal show/hide logic, context selection handler, platform pill active classes toggling, API call triggered on change, clipboard handler, and outbound window open links)

---

## 5. Verification Strategy & Tests
- This is a refinement task. We will verify correctness using Playwright E2E tests.
- Run tests via `npx playwright test tests/viral-generator.spec.js` to assert modal launch, clipboard copying, context switching, API payload parameters, and correct outbound link formats.
