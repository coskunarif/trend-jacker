# Specification: Repair Social Sharing Preview E2E Tests

## Acceptance Criteria

### [AC-1] Remove External Page Load Waits in Pinterest Outbound Sharing E2E Test
- **Description**: The E2E test `Verify Pinterest Outbound Intent Link Formatting` in `tests/pinterest-sharing-suite.spec.js` must verify the outbound Pinterest share URL construction immediately upon popup page capture without awaiting the external page load state (`newPage.waitForLoadState()`).
- **Verification**: Run `npx playwright test tests/pinterest-sharing-suite.spec.js` and verify that the Pinterest outbound intent test passes without performing full document load waits on the external domain.

### [AC-2] Remove External Page Load Waits in X/Twitter Outbound Sharing E2E Test
- **Description**: The E2E test `Verify Outbound Sharing Intent` in `tests/viral-generator.spec.js` must verify the outbound X/Twitter share URL construction immediately upon popup page capture without awaiting the external page load state (`newPage.waitForLoadState()`).
- **Verification**: Run `npx playwright test tests/viral-generator.spec.js` and verify that the X/Twitter outbound intent test passes without performing full document load waits on the external domain.

### [AC-3] Implement Robust Retrying Assertion for Outbound Sharing URLs
- **Description**: Use a Playwright retrying assertion block `expect(async () => { ... }).toPass()` when asserting the constructed URL parameters on the intercepted popup page for both Pinterest and X/Twitter share buttons to prevent race conditions during URL population on page initialization.
- **Verification**: Verify that the URL checks for Pinterest (`https://www.pinterest.com/pin/create/button/` with query parameters `url`, `media`, `description`) and X (`https://x.com/intent/tweet?text=`) are wrapped in `expect(async () => { ... }).toPass()`.

## Out of Scope
- Modifying any of the frontend social sharing UI layout styles or HTML elements.
- Adding any new social platform APIs or mock route handlers in `server.js`.

## Slices

### [S-1] Repair Pinterest sharing E2E test
- **Description**: Modify `tests/pinterest-sharing-suite.spec.js` to remove `await newPage.waitForLoadState()` and use a retrying assertion `expect(async () => { ... }).toPass()` to verify target URL construction.
- **Files**: `tests/pinterest-sharing-suite.spec.js`
- **AC Mapping**: `[AC-1]`, `[AC-3]`
- **Independent**: Yes

### [S-2] Repair X/Twitter sharing E2E test
- **Description**: Modify `tests/viral-generator.spec.js` to remove `await newPage.waitForLoadState()` and use a retrying assertion `expect(async () => { ... }).toPass()` to verify target URL construction.
- **Files**: `tests/viral-generator.spec.js`
- **AC Mapping**: `[AC-2]`, `[AC-3]`
- **Independent**: Yes
