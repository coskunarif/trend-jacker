# SPEC.md — Consolidate social sharing buttons into a unified high-fidelity share modal

## Acceptance Criteria

- **[AC-1] Unified Modal Component Structure**:
  - The UI must have a single `#share-modal` overlays elements with `hidden` class toggle control.
  - The modal must contain:
    - `#share-modal-title` for the dynamic header.
    - `#btn-close-share-modal` to close the modal.
    - `#share-context-select` dropdown (values: `general` and `poll`).
    - Four `.platform-pill` buttons (data-platform: `x`, `linkedin`, `facebook`, `reddit`).
    - `#share-preview-text` textarea showing generating status or final generated text.
    - `#btn-copy-share` button to copy content to clipboard.
    - `#btn-post-share` button to trigger the sharing intent url.

- **[AC-2] Pre-selection & Behavior**:
  - Opening via `#btn-share-trend` opens modal with `#share-context-select` set to `general`.
  - Opening via `#btn-share-poll` opens modal with `#share-context-select` set to `poll`.
  - Selecting another context select option or platform pill must update the post preview dynamically via backend API `/api/generate-post`.

- **[AC-3] Redundant Button Removal**:
  - Legacy individual buttons `#btn-share-x` and `#btn-share-poll-x` must not be attached or rendered.

- **[AC-4] Social Media Copy Constraints**:
  - Platform X: Under 280 characters, includes target URL, contains 2-3 relevant hashtags.
  - Platform LinkedIn: Professional style, includes target URL, contains exactly 3 hashtags on the last line.
  - Platform Facebook: Clean style, includes target URL, contains 1-2 relevant hashtags.
  - Platform Reddit: Reddit styling, includes target URL, headline hook, structured body, contains no hashtags.

## Out of Scope
- Creating new backend API endpoints for other platforms.
- Implementing actual server-side posting to social networks.

## Slices

- **[S-1] Setup SPEC and Validate Test Suite**:
  - Files: `SPEC.md`, `tests/viral-generator.spec.js`
  - Already completed & verified as part of architecture bootstrap. No further action needed.
