# Specification: Immediate UI Detail Panel Responsiveness

This specification outlines the changes required to ensure immediate UI responsiveness of the trend detail panel (under 300ms) upon user interaction.

## Acceptance Criteria

- **[AC-1] Synchronous UI Initialization**: When a trend item is clicked, `loadTrendDetails` must immediately (synchronously, in the same event loop tick) update the detail panel's static/available information. This includes:
  - Setting `#detail-title` to the clicked trend's name.
  - Setting `#detail-traffic` to the trend's searches text.
  - Setting up the speedometer velocity needle rotation and text indicator.
  - Animating the canvas sparkline.
  - Initializing the sentiment timeline canvas drawing.
  - Populating the custom vibe card emoji, category, and background gradients.
  - Setting up news publisher, source, and headline info in the news footer immediately (if news metadata is present in the trend).
  - Resetting the chat history container to the initial greeting message block customized for the trend title.
- **[AC-2] Non-Blocking Background API Fetching**: Asynchronous requests (such as `/api/explain`, `/api/chat-limit`, and `/api/predictions`) must be triggered immediately and execute as un-awaited background promises or concurrently, preventing event loop blocking during the initial render block.
- **[AC-3] UI Detail Panel Responsiveness**: Selecting any trend item must update the `#detail-title` element in the DOM to the selected trend name in less than 300ms, regardless of whether background API responses are delayed or slow.
- **[AC-4] Post-API Loading & Cache Preservation**:
  - Once `/api/explain` resolves in the background, explanation-dependent details (hook, description, takeaways, viral tags, poll percentages, and skeleton loading visibility toggles) must be populated.
  - Resulting data must be correctly cached in `explanationCache` so subsequent details for the same trend/demographic/language query are retrieved instantly.

## Out of Scope

- Changing the visual style/assets of the skeleton loading animation.
- Restructuring/modifying the backend APIs or SQLite database schema.
- Adding new sharing platforms or modifying existing social media sharing capabilities.

## Implementation Slices

- **[S-1] Immediate Synchronous UI Initialization**:
  - Refactor `loadTrendDetails(trend, force)` in `public/app.js` to synchronously populate non-asynchronous detail panel components (title, traffic, speed needle rotation/text, sparkline canvas, vibe metadata card, news footer elements, and chatbot greeting) at the start of the function, before checking `explanationCache` or initiating network requests.
  - *Files*: `public/app.js`
  - *ACs*: `[AC-1]`, `[AC-3]`
  - *Dependency*: None

- **[S-2] Background Async Refactoring**:
  - Wrap the `/api/explain` cache check, API fetch request, and post-explanation rendering logic (hook, description, takeaways, viral tags, poll percentage updates, and skeleton loading hidden toggle) inside a self-invoking asynchronous block inside `loadTrendDetails`.
  - Ensure `/api/chat-limit`, `resetTrivia`, and `fetchPredictionHistory` are invoked concurrently as background tasks.
  - *Files*: `public/app.js`
  - *ACs*: `[AC-2]`, `[AC-4]`
  - *Dependency*: `[S-1]`
