# SPEC: Mobile Quick-Action Toolbar & Engagement Optimization

## Problem Statement
Explainer content blocks are vertically long, forcing mobile users to scroll heavily to reach interactive trivia and predictions.
Additionally, core interaction actions (such as voting and sharing) scroll off-screen, leading to reduced mobile interaction and sharing rates.
We need to implement a sticky bottom quick-action toolbar on mobile viewports to keep sharing, voting, and trivia shortcuts persistently available to users, driving engagement metrics.

## Test Strategy
- **Strategy Type**: Additive.
- **Process**: The Tester will write E2E tests first (e.g. in `tests/mobile-action-toolbar.spec.js`) to assert the toolbar's visibility, responsiveness, structure, interaction flows (sharing, voting, trivia scrolling/pulsing), and proper behavior across viewport sizes (mobile vs desktop). Once tests are in place, the Builder will implement the code slices to pass the test suite.

---

## Design Mockup
Below is the modern high-fidelity visual mockup of the mobile quick-action toolbar:

![Mobile Quick-Action Toolbar Mockup](/home/ubuntuadmin/.gemini/antigravity-cli/brain/2e6a66ec-9036-4067-9d54-8a9e50d2d700/mobile_toolbar_mockup_1781868251539.jpg)

---

## Acceptance Criteria

### `[AC-1]` Mobile Action Toolbar HTML Structure
- A new persistent element `#mobile-action-toolbar` with class `mobile-action-toolbar` and `hidden-toolbar` must be added in the body of `public/index.html` (before the scripts and footer).
- The toolbar must contain the following semantic elements:
  - **Share Action Button**:
    - `#toolbar-btn-share` with class `toolbar-btn`.
    - Contains a share SVG icon and the text "Share".
  - **Sentiment Poll Interaction Group**:
    - `#toolbar-sentiment-group` with class `toolbar-sentiment-group`.
    - Contains two visual states:
      1. **Vote Actions Sub-container** (`#toolbar-vote-actions`):
         - `#toolbar-btn-genius` with class `toolbar-btn` or `vote-genius` containing "Genius ⚡".
         - `#toolbar-btn-overrated` with class `toolbar-btn` or `vote-overrated` containing "Overrated 🥱".
      2. **Vote Results Sub-container** (`#toolbar-vote-results` with class `hidden` by default):
         - Genius percentage label `#toolbar-pct-genius` (e.g., "G: 65%").
         - Overrated percentage label `#toolbar-pct-overrated` (e.g., "O: 35%").
         - Mini progress bar visualizer: a wrapper container containing `#toolbar-bar-genius` (representing the Genius proportion) and `#toolbar-bar-overrated` (representing the Overrated proportion).
         - Share Poll button `#toolbar-btn-share-poll` with class `toolbar-icon-btn` containing a share SVG icon.
  - **Trivia Shortcut Button**:
    - `#toolbar-btn-trivia` with class `toolbar-btn`.
    - Contains a target/badge SVG icon and the text "Trivia".
- **How to test**: Load the page in Playwright, inspect the DOM on a mobile viewport size, and verify the presence and nesting of all these HTML elements and their IDs.

### `[AC-2]` Responsive Layout, CSS Variables, and Margin Safety
- Style rules must be added to `public/styles.css`.
- The toolbar `#mobile-action-toolbar` must be hidden by default (`display: none` or `.hidden-toolbar { display: none !important; }`).
- Within a `@media (max-width: 768px)` media query, when `#mobile-action-toolbar` is active (i.e. does not have `.hidden-toolbar` class), it must display as a sticky toolbar:
  - Position: `fixed; bottom: 0; left: 0; right: 0; z-index: 1000;`.
  - Height: `64px`.
  - Layout: `display: flex; align-items: center; justify-content: space-between;`.
  - Design: Glassmorphism (`backdrop-filter: blur(12px)`), solid top border using `--border`, background using a semi-transparent variation of `--bg` or `--surface`.
  - Styling tokens: Use only existing variables (`--bg`, `--surface`, `--border`, `--primary`, `--secondary`, `--genius`, `--overrated`, `--space-*`, `--font-*`).
- **Margin/Padding Safety**: On mobile viewports when the toolbar is active, the main `.explainer-container` must have a bottom padding of at least `80px` (`calc(64px + var(--space-4))`) to ensure that elements at the absolute bottom of the page (such as the footer or prediction forms) can be fully scrolled into view without being occluded by the sticky toolbar.
- **How to test**: Verify via Playwright that:
  - At a desktop viewport (`1280x800`), the toolbar has `display: none` or is off-screen.
  - At a mobile viewport (`375x667`), the toolbar has `position: fixed` at the bottom and is visible.
  - Programmatically verify that the bounding box of `.explainer-container` bottom padding is correctly adjusted.

### `[AC-3]` Client-Side Lifecycle and Trend Visibility Sync
- The visibility of the toolbar must sync with the loaded trend explainer view state:
  - Remove `.hidden-toolbar` from `#mobile-action-toolbar` when a trend explainer is loaded (in sync with `#explainer-view` becoming visible).
  - Add `.hidden-toolbar` to `#mobile-action-toolbar` when returning to the welcome view or encountering an error.
- Event bindings:
  - Clicking `#toolbar-btn-share` must trigger the general share flow (equivalent to clicking `#btn-share-trend` / calling `openShareModal('general')`).
  - Clicking `#toolbar-btn-share-poll` must trigger the poll share flow (equivalent to clicking `#btn-share-poll` / calling `openShareModal('poll')`).
- **How to test**: Verify that when a user selects a trend on mobile, the toolbar becomes visible. Verify that clicking the share buttons triggers the unified share modal with the correct default content populated. Verify that when no trend is selected (welcome screen), the toolbar is hidden.

### `[AC-4]` Bidirectional Sentiment Vote and Percentage Sync
- Clicking `#toolbar-btn-genius` or `#toolbar-btn-overrated` must submit the vote choices via the backend `submitVote(choice)` handler.
- The toolbar state must sync bidirectionally with the main poll card:
  - If the user has not voted: `#toolbar-vote-actions` is visible and `#toolbar-vote-results` is hidden.
  - When the user votes (either from the toolbar or the main page's card), the toolbar's sentiment group must update:
    - Hide `#toolbar-vote-actions` (add `.hidden`).
    - Show `#toolbar-vote-results` (remove `.hidden`).
    - The percentage labels `#toolbar-pct-genius` / `#toolbar-pct-overrated` and the widths of the progress bars `#toolbar-bar-genius` / `#toolbar-bar-overrated` must be synchronized in the `updatePollPercentages` function.
  - When switching to a new trend, the voting state must be reset: hide the results container and display the voting pills again.
- **How to test**: In a mobile viewport test, mock `/api/poll` API responses. Assert that clicking `#toolbar-btn-genius` calls the poll API, updates the toolbar to show the percentage layout, and updates the main poll card in the explainer view simultaneously. Also verify that voting on the main poll card updates the toolbar to the results state.

### `[AC-5]` Trivia Challenge Focus Scroll and Start Trigger
- Clicking `#toolbar-btn-trivia` must:
  - Scroll `#trivia-card-container` into view smoothly (`scrollIntoView({ behavior: 'smooth', block: 'center' })`).
  - Add class `.trivia-pulse-highlight` to `#trivia-card-container` to execute a custom CSS shadow-glow keyframe animation for `1.2s` before removing the class.
  - Check if the trivia challenge has not started yet (i.e. the start screen `.trivia-start-screen` does not have the class `.hidden`). If not started, programmatically trigger the `startTrivia()` execution path (or simulate click on `#btn-start-trivia`) to start the trivia challenge gameplay immediately.
- **How to test**: Assert that clicking `#toolbar-btn-trivia` on mobile scrolls the page to the trivia card container, initiates the game, and triggers the pulse glow style classes.

---

## Performance KPIs
- `[KPI-1]` Cumulative Layout Shift (CLS): Initial loading and toggling of toolbar visibility must not cause layout shift (CLS < 0.05).
- `[KPI-2]` Interactive latency: Click events on toolbar elements (share/vote/trivia) must trigger state updates under 100ms inside browser context (excluding remote API delay).

---

## Interface Contract

### HTML Element IDs
```
#mobile-action-toolbar       (Toolbar main container)
#toolbar-btn-share           (Share Trend button)
#toolbar-sentiment-group     (Sentiment poll group)
#toolbar-vote-actions        (Voting action buttons container)
#toolbar-btn-genius          (Vote Genius button)
#toolbar-btn-overrated       (Vote Overrated button)
#toolbar-vote-results        (Vote results container)
#toolbar-pct-genius          (Genius percent text)
#toolbar-pct-overrated       (Overrated percent text)
#toolbar-bar-genius          (Genius fill bar)
#toolbar-bar-overrated       (Overrated fill bar)
#toolbar-btn-share-poll      (Share Poll results button)
#toolbar-btn-trivia          (Trivia shortcut button)
```

### CSS Style Classes & Animations
```css
/* Sticky layout wrapper */
.mobile-action-toolbar { ... }

/* Utility class to hide/show toolbar */
.hidden-toolbar { display: none !important; }

/* Custom keyframes & class to pulse-glow trivia container */
@keyframes pulseGlow {
  0% {
    box-shadow: 0 0 0 0px rgba(139, 92, 246, 0.4);
    transform: scale(1);
  }
  50% {
    box-shadow: 0 0 20px 10px rgba(139, 92, 246, 0.8);
    transform: scale(1.02);
  }
  100% {
    box-shadow: 0 0 0 0px rgba(139, 92, 246, 0);
    transform: scale(1);
  }
}
.trivia-pulse-highlight {
  animation: pulseGlow 1.2s ease-out;
}
```

### JS State Bindings (`public/app.js`)
- Visibility state hooks integrated into the trend explanation loading/unloading handlers.
- Bidirectional updates in `submitVote(choice)` and `updatePollPercentages(polls)`.

---

## Out of Scope
- Creating any desktop-side sticky panels or dashboard layout alterations.
- Implementing database schema migrations or additions to `/api/poll` parameters.
- Inline text editing or custom modal sheets on mobile viewports.

---

## Objections and Resolutions
- **Objection**: Sticky bottom toolbars can block accessibility tap targets or collide with mobile browser navigation bars.
  - **Resolution**: Use standard safe height (`64px`), absolute bottom positioning, and add bottom-safe scroll padding (`80px`) to the main content layout container to prevent visual occlusion of other interactive blocks.
- **Objection**: Tapping buttons in a sticky bar while scrolling can cause accidental clicks.
  - **Resolution**: Apply standard flex-gap layouts (`var(--space-3)`) and distinct clickable dimensions for the buttons (`height: 40px`, rounded pills).

---

## Slices

### `[S-1] HTML Mobile action toolbar markup`
- Define `#mobile-action-toolbar` structure in `public/index.html` at the end of the body.
- **Files**: [index.html](file:///home/ubuntuadmin/projects/trend-jacker/public/index.html)
- **AC Mapped**: `[AC-1]`
- **Independent**: Yes

### `[S-2] CSS Sticky bottom layout, media queries, and pulse animation`
- Add mobile sticky styling, dividers, glassmorphism, mini progress bars, safe scroll padding, and `.trivia-pulse-highlight` keyframe animations to `styles.css`.
- **Files**: [styles.css](file:///home/ubuntuadmin/projects/trend-jacker/public/styles.css)
- **AC Mapped**: `[AC-2]`, `[AC-5]`
- **Independent**: Yes

### `[S-3] JS visibility toggling, share triggers, and smooth-scroll trivia shortcut`
- Bind selectors for share/trivia buttons. Set up trend lifecycle visibility hooks. Implement the smooth scrolling and pulse animation triggers for the trivia button, along with auto-starting gameplay.
- **Files**: [app.js](file:///home/ubuntuadmin/projects/trend-jacker/public/app.js)
- **AC Mapped**: `[AC-3]`, `[AC-5]`
- **Independent**: No (Depends on `[S-1]`)

### `[S-4] JS Bidirectional voting synchronization and results update`
- Set up listeners for toolbar vote actions. Synchronize vote submissions with `submitVote(choice)`. Ensure `updatePollPercentages(polls)` correctly feeds into progress bars and labels of the toolbar results view.
- **Files**: [app.js](file:///home/ubuntuadmin/projects/trend-jacker/public/app.js)
- **AC Mapped**: `[AC-4]`
- **Independent**: No (Depends on `[S-1]`, `[S-3]`)
