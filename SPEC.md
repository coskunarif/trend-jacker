# SPEC.md: Stable Testing Baseline & Social Sharing Reliability

This spec outlines the plan to resolve the race condition in the social sharing preview tests (securing a stable testing baseline) and to fix the reliability issues associated with social media sharing.

## 1. Acceptance Criteria

*   **`[AC-1] E2E Test Suite Synchronization`**:
    All Playwright E2E tests that interact with the share modal (in `tests/share-preview.spec.js`, `tests/pinterest-sharing-suite.spec.js`, and `tests/viral-generator.spec.js`) must wait for the active trend item to render in the DOM (`await expect(page.locator('.trend-item.active')).toBeVisible();`) after `page.goto('/')` before clicking `#btn-share-trend`. This prevents clicking before the page-load async API responses have populated the active trend.
*   **`[AC-2] Intent Test Clipboard Permissions`**:
    All E2E tests verifying outbound sharing intents (clicking `#btn-post-share`) must grant clipboard permissions (`await context.grantPermissions(['clipboard-read', 'clipboard-write']);`) before navigating *only* if the current browser name is `'chromium'`. If running under Firefox or WebKit, the permissions call must be skipped to prevent CDP configuration exceptions.
*   **`[AC-3] Share Button Loading Guards`**:
    The "Post Now" (`#btn-post-share`) and "Copy" (`#btn-copy-share`) buttons must be disabled and styled with reduced opacity (`0.5`) and a `not-allowed` cursor based on explicit internal boolean state variables (`isGenerating`, `hasError`). The state-based checks must prevent premature enabling if the user edits the textarea content, and must not depend on hardcoded textarea string matching.
*   **`[AC-4] Automated Copy on Share`**:
    Clicking `#btn-post-share` must trigger `navigator.clipboard.writeText` synchronously in the background *without* awaiting its resolution, immediately followed by the synchronous call to `window.open`. This prevents yielding to the event loop and losing the user gesture context, which would trigger browser popup blockers. The clipboard check must be feature-guarded (`navigator.clipboard && typeof navigator.clipboard.writeText === 'function'`) and wrapped in a `try...catch` block to handle unsecure contexts (HTTP) or permission denials gracefully.
*   **`[AC-5] Visual Toast Notification`**:
    Clicking `#btn-post-share` must display a clean, absolute-positioned toast notification (`#share-toast`) inside the modal with the message `"Copied post to clipboard! Redirecting..."` for 2 seconds. The toast should fade in and out smoothly.
*   **`[AC-6] Outbound Intent Retries`**:
    E2E tests verifying outbound intents must capture the target popup page via `context.waitForEvent('page')` and verify the constructed query parameters using retrying assertions `expect(async () => { ... }).toPass()`, avoiding awaiting full page load states to prevent timeouts under runner load.
*   **`[AC-7] Generation Request ID Synchronization`**:
    Social post generation must trace requests with an auto-incrementing ID (`activeGenerateId`). When an asynchronous post generation response returns, its request ID must match the active ID before updating `sharePreviewText.value` or `updatePreviewAndValidation()`. This prevents out-of-order resolution race conditions when a user quickly toggles platforms or contexts.

## 2. Performance KPIs

*   **`[KPI-1] Visual Preview Update Latency`**: Real-time rendering of typed preview text in the mockup card must execute in `< 16ms` (within a single animation frame).
*   **`[KPI-2] Modal Open Responsiveness`**: The unified share modal must transition to visible in `< 100ms` from the click on `#btn-share-trend` once the active trend is loaded.

## 3. Interface Contract

### Client Assets:
*   **`public/index.html`**:
    *   Add `<div id="share-toast" class="share-toast hidden"></div>` inside the `#share-modal` `.modal-content` wrapper.
*   **`public/styles.css`**:
    *   Add styling for `.share-toast` and `.share-toast.hidden` to position it absolutely at the top center of the modal with high z-index and fade transitions.
    *   Add styling for `.modal-btn:disabled` and `.modal-btn.disabled` to set `opacity: 0.5`, `cursor: not-allowed`, and `pointer-events: none`.
*   **`public/app.js`**:
    *   Maintain global/state variables: `let isGenerating = false;`, `let hasError = false;`, and `let activeGenerateId = 0;`.
    *   Update `updatePreviewAndValidation()` to read `isGenerating` and `hasError` state flags, applying the `disabled` property and `.disabled` class to `#btn-post-share` and `#btn-copy-share`.
    *   Modify `generatePost()` to increment `activeGenerateId` and only update the text input and trigger UI synchronization if the request's ID matches the latest ID when the fetch response resolves.
    *   Modify the `#btn-post-share` click handler to run `navigator.clipboard.writeText()` asynchronously (without `await`) and display `#share-toast` before synchronously calling `window.open` for the platform sharing URL.

### E2E Test Suite:
*   **`tests/share-preview.spec.js`**:
    *   Update all tests to wait for `.trend-item.active` to be visible after navigation.
*   **`tests/pinterest-sharing-suite.spec.js`**:
    *   Update tests verifying sharing to wait for `.trend-item.active`.
    *   In tests checking outbound sharing, conditionally grant clipboard permissions: `if (browserName === 'chromium') { await context.grantPermissions(['clipboard-read', 'clipboard-write']); }`.
*   **`tests/viral-generator.spec.js`**:
    *   Update tests verifying sharing to wait for `.trend-item.active`.
    *   In outbound sharing test, conditionally grant clipboard permissions: `if (browserName === 'chromium') { await context.grantPermissions(['clipboard-read', 'clipboard-write']); }`.

## 4. Out of Scope

*   Modifying backend AI post generation parameters (`/api/generate-post`).
*   Modifying frontend theme design/styles other than the sharing modal/toast and disabled button states.
*   Integrating platform-specific native SDKs.

## 5. Critic Objections & Resolutions

*   **Objection 1**: Browser Popup Blocker vs. Asynchronous Clipboard Copy
    *   *Resolution*: Trigger copy asynchronously in the background (`navigator.clipboard.writeText(text).catch(...)`) and call `window.open` synchronously immediately to satisfy user gesture activation policy.
*   **Objection 2**: Race Condition in Concurrent Async Post Generation
    *   *Resolution*: Trace generation requests with an auto-incrementing ID (`activeGenerateId`) and verify the ID when the response resolves before updating the preview text or validation state.
*   **Objection 3**: Null Reference Exception on Navigator Clipboard Access
    *   *Resolution*: Guard all clipboard write calls with feature checks (`navigator.clipboard && typeof navigator.clipboard.writeText === 'function'`) and handle any permission errors inside a `try...catch` block.
*   **Objection 4**: Brittle UI State Guards via Hardcoded Text Value Validation
    *   *Resolution*: Track generation and error states with read-only boolean state variables (`isGenerating`, `hasError`) in JavaScript and configure disabled buttons using those states.
*   **Objection 5**: Non-Universal Clipboard Permissions API Support in E2E Engines
    *   *Resolution*: Explicitly scope `context.grantPermissions` calls inside E2E tests to only execute when `browserName === 'chromium'`.

## 6. Slices

### `[S-1] Core Social Sharing Reliability & Safety Guards`
*   **Target Files**: `public/app.js`, `public/index.html`, `public/styles.css`
*   **Acceptance Criteria**: `[AC-3]`, `[AC-4]`, `[AC-5]`, `[AC-7]`
*   **Independent**: Yes
*   **Description**: Add safety guards and sequential request tracing to prevent race conditions during generation. Inject the `#share-toast` notification structure and style sheet. Implement the copy-to-clipboard hook and toast activation on clicking "Post Now".

### `[S-2] E2E Test Suite Synchronization & Clipboard Alignment`
*   **Target Files**: `tests/share-preview.spec.js`, `tests/pinterest-sharing-suite.spec.js`, `tests/viral-generator.spec.js`
*   **Acceptance Criteria**: `[AC-1]`, `[AC-2]`, `[AC-6]`
*   **Independent**: No (Depends on S-1 for clipboard operations)
*   **Description**: Update test cases to wait for `.trend-item.active` to eliminate page-load race conditions. Add conditional clipboard permissions to all tests clicking `#btn-post-share`.
