# Specification: Unified Social Sharing Preview Interface

Implement a visual, real-time post preview card within the Share Modal to increase share conversion by showing users exactly how their post will look on their chosen platform (X, LinkedIn, Facebook, Reddit, Pinterest).

## Acceptance Criteria

### [AC-1] Visual Preview Mockup Box
- The Share Modal must display a live post preview element (`#share-card-preview`) that visually mimics the layout of the selected platform.
- It must display:
  - User avatar placeholder (circle icon or placeholder image).
  - Profile name (e.g., "You" or a generic handle).
  - Dynamically updated post text inside the card that synchronizes in real-time as the user types/edits inside the `#share-preview-text` textarea.
  - A link preview card containing the trend title and domain name (`viraljacker.com`).
  - For Pinterest, it must visually render a Pin preview layout incorporating the generated Pinterest-specific title and description structure.

### [AC-2] Platform-Specific Themes & Layout Styles
- The `#share-card-preview` container must update its styles based on the active platform:
  - **X (Twitter)**: Dark theme (matching platform default) with rounded avatar, "@you" handle, and inline post text.
  - **LinkedIn**: Professional card style with rounded avatar, display name, and a large link card at the bottom.
  - **Facebook**: Standard post card with profile avatar, time indicator, and large link preview card.
  - **Reddit**: Subreddit post style (e.g., `r/trendjacker`) showing the post title and body text structure.
  - **Pinterest**: Vertical pin style showing the Pin image preview, Pin title, and Pin description.

### [AC-3] Real-time Character Counter & Limit Validation
- A character counter indicator (`#share-char-counter`) must be displayed below the textarea or preview card.
- For **X (Twitter)**, it must track character limit relative to the 280-character maximum (e.g., `X / 280`).
- If the post text exceeds the 280-character limit when X is selected:
  - The counter text/styling must change to a warning state (e.g., red text).
  - A visual validation warning must appear.
  - The "Post Now" button (`#btn-post-share`) must be disabled, or visually marked with an error state to prevent invalid API calls.
- For other platforms, the counter tracks the length without strict 280-character validation warnings.

### [AC-4] Test Coverage
- Playwright E2E tests must verify:
  - The preview mockup (`#share-card-preview`) is visible when the share modal is open.
  - The mockup content updates in real-time as the user edits the `#share-preview-text` input.
  - Changing the platform pills updates the visual theme/class of the preview mockup.
  - The character counter updates correctly and triggers validation/button disabled states on X when exceeding 280 characters.

## Out of Scope
- Integration with real social media API authentication/OAuth.
- Modifying the actual backend `/api/generate-post` endpoints.

## Slices

### [S-1] HTML & CSS Structure for Live Preview Card
- **Files**: `public/index.html`, `public/styles.css`
- **ACs**: `[AC-1]`, `[AC-2]`
- **Details**: Add the `#share-card-preview` container into the unified share modal in `public/index.html`. Define CSS rules in `public/styles.css` for platform themes (`preview-x`, `preview-linkedin`, etc.) and profile mockups. Add character counter container `#share-char-counter`.

### [S-2] JS Live Updates, Synced Input & Platform States
- **Files**: `public/app.js`
- **ACs**: `[AC-1]`, `[AC-2]`, `[AC-3]`
- **Details**: Add an event listener to `#share-preview-text` (e.g., `input` event) to sync text to `#share-card-preview`. Update platform pill selectors to change the preview mockup class dynamically. Add character count validation and button disabling logic when X exceeds 280 characters.

### [S-3] E2E Tests for the Preview Interface
- **Files**: `tests/share-preview.spec.js` (or updated `tests/viral-generator.spec.js`)
- **ACs**: `[AC-4]`
- **Details**: Add Playwright assertions verifying the live preview mockup, content syncing, platform styling transitions, and character counter validation behavior under limit breach conditions.
