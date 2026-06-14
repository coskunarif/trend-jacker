# Specification: User Retention & API Request Reduction

## Acceptance Criteria

### [AC-1] Prevent Redundant Demographic Selector Calls
- **Description**: Clicking the already active demographic pill (e.g., "Adult (Default)" when it is already active) must not trigger any API calls to `/api/explain`.
- **Verification**: In browser developer tools or test logs, verify that clicking the active demographic button results in zero network request changes and keeps UI state unchanged.

### [AC-2] Prevent Redundant Language Selector Calls
- **Description**: Triggering a change event on the language select dropdown `#lang-select` with the current language value (e.g. re-selecting the active language) must not fire a POST request to `/api/explain`.
- **Verification**: Select the currently active language and verify no network requests are sent.

### [AC-3] Prevent Redundant Platform Pill Calls in Post Generator
- **Description**: Clicking the already active platform pill (e.g. X/Twitter, LinkedIn) must not send any POST requests to `/api/generate-post`.
- **Verification**: Click the active platform pill and verify no `/api/generate-post` request is made.

### [AC-4] Client-Side Explanation Caching
- **Description**: Implement a clientside in-memory Map cache (`explanationCache`) to store trend explanations. The cache key must be constructed as `${trendTitle}:${lang}:${bracket}`, normalized to lowercase.
- **Verification**: On first request to explain a trend for a demographic and language, the client fetches from `/api/explain` and caches the result. Subsequent toggling back to this demographic/language combination retrieves the data synchronously from cache without hitting `/api/explain`.

### [AC-5] Initial Cache Seeding
- **Description**: Seed the client-side explanation cache with `preloadedData` on page load, matching the current trend, initial language, and active demographic.
- **Verification**: Toggling away from the default demographic/language and back does not trigger any `/api/explain` requests, as the default state is already cached.

### [AC-6] Lock Screen Prediction CTA
- **Description**: Add a dedicated Prediction CTA section inside `#chat-lock-container`. If the user has not predicted today, show "Predict if this trend will Rise or Fall tomorrow to earn +3 capacity when correct!" along with a button `#chat-lock-predict-btn` ("Predict Trend's Next Move"). Clicking it scrolls smoothly to `#prediction-card-container` and focuses the rise prediction button. If already predicted, replace with: "You predicted this trend will [Rise/Fall] tomorrow. Correct predictions unlock +3 capacity!".
- **Verification**: Verify CTA display inside the lock container, click behavior (smooth scroll + focus), and status update immediately after submitting a prediction.

### [AC-7] Invite Link Clipboard Action
- **Description**: Enhance the `#referral-share-link` element in the lock container. Clicking it must prevent default browser navigation, copy the unique referral link to the clipboard, and temporarily change the element text to "Link Copied!" for 2000ms.
- **Verification**: Click the referral link element in the locked UI, check clipboard content, and verify the text change reverts after 2000ms.

## Out of Scope
- Adding any new server-side database tables or changing DB schema.
- Implementing social media posting API integration (leveraging existing mock post generator).

## Slices

### [S-1] Clientside Toggle Deduplication
- **Description**: Prevent redundant network requests when clicking active demographic pills, re-selecting the active language, or clicking active platform pills.
- **Files**: `public/app.js`
- **AC Mapping**: `[AC-1]`, `[AC-2]`, `[AC-3]`
- **Independent**: Yes

### [S-2] Client-Side Explanation Caching & Seeding
- **Description**: Implement the client-side explanation Map cache, check cache before `/api/explain` fetch, retrieve and render synchronously, and seed cache on initialization.
- **Files**: `public/app.js`
- **AC Mapping**: `[AC-4]`, `[AC-5]`
- **Independent**: Yes

### [S-3] Invite Referral Link Clipboard copy
- **Description**: Update `#referral-share-link` behavior to copy to clipboard with a temporary "Link Copied!" text state.
- **Files**: `public/app.js`
- **AC Mapping**: `[AC-7]`
- **Independent**: Yes

### [S-4] Lock Screen Prediction CTA Widget
- **Description**: Update `#chat-lock-container` HTML to add the prediction CTA section and button. Wire up the click listener for scrolling/focusing and update status text based on prediction state inside `public/app.js`. Add styling in `public/styles.css` if necessary.
- **Files**: `public/index.html`, `public/app.js`, `public/styles.css`
- **AC Mapping**: `[AC-6]`
- **Independent**: No (depends on S-1 for DOM layout structure)
