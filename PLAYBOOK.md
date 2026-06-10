# TrendJacker Mobile View UI/UX Optimization Playbook

This playbook serves as the strategic backlog and implementation roadmap for TrendJacker's mobile view overhaul, addressing critical user experience and accessibility gaps identified during the codebase audit.

---

## 🎯 Scoring Rubric
Each brainstormed task is scored out of **10 points** across four key areas:
1. **UX & Retention (UX)**: Does it prevent user drop-off, load gracefully, feel native, and keep the user engaged?
2. **SEO & GEO (SEO)**: Does it improve mobile web accessibility (a11y), page indexing signals, and mobile friendliness?
3. **Viral Potential (VIR)**: Does it encourage users to share results or interact with polls and debates on mobile?
4. **Feasibility (FEAS)**: Can it be implemented cleanly in the vanilla JS/CSS frontend without adding bloated dependencies?

**Formula**: `Total = UX + SEO + VIR + FEAS` (Max 40 points)

---

## 📋 Brainstormed Mobile Tasks Backlog

| Task ID | Task Title & Description | UX | SEO | VIR | FEAS | Total | Status |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **TJ-13** | **Unified Mobile UX and Navigation Polish Suite**<br>Comprehensive mobile overhaul including: sidebar close button, tab-switcher for trends list vs sentiment feed, scroll-to-top on trend select, main explainer loading skeleton, and viewport overflow/navbar cleanup. | **9.5** | **6.0** | **6.0** | **9.0** | **30.5** | `[x]` Completed |
| **TJ-14** | **Main Explainer Panel Loading Skeleton & Fetch Feedback**<br>Add an animated CSS skeleton loader to replace the blank main screen while `/api/explain` is fetching, and add loading feedback on selected items. | 9.0 | 4.0 | 5.0 | 9.5 | **27.5** | Pending |
| **TJ-15** | **Mobile Sidebar Drawer Refactor & Accessibility Fixes**<br>Add mobile close button, fix invalid `aria-controls` reference, and refactor dual nested scroll pane into a single scroll. | 8.0 | 6.5 | 4.0 | 9.0 | **27.5** | Pending |
| **TJ-16** | **View Scroll Reset & Narrow Screen Header Polish**<br>Reset viewport scroll position to y=0 on trend load, and resolve header wrapping on devices <= 360px wide. | 8.5 | 4.0 | 4.0 | 10.0 | **26.5** | Pending |

---

## 🚀 Selected Task Details: TJ-13 — Unified Mobile UX and Navigation Polish Suite

### 1. Objective
Transform the mobile user experience of TrendJacker from a cramped desktop-port feel to a polished, responsive, and intuitive web application. This task targets several critical mobile-specific usability defects:
*   **The Blank Screen Trap**: When selecting a new trend, the screen goes completely blank for 2 to 4 seconds during API content generation, providing zero loading feedback.
*   **Cramped Scroll Containers (Scroll Chaining)**: The sidebar drawer splits its vertical space 50/50 between two scrolling containers. This creates nested scrolling areas that clash with native mobile thumb scroll gestures.
*   **Missing Drawer Dismissal**: There is no explicit "Close" button inside the sidebar panel on mobile, forcing users to click a narrow, non-obvious backdrop strip to exit.
*   **Scroll Position Lock**: If a user is scrolled down when reading a debate or chat, selecting a new trend leaves the page scrolled down, hiding the header and summary cards of the new trend.
*   **Narrow Viewport Clipping & Accessibility Violation**: The navbar wraps awkwardly on screens < 360px wide, and the sidebar trigger has a broken accessibility ID reference.

### 2. Why (Business Value & Rationale)
*   **Retention**: A blank screen during a 3-second API load on mobile results in massive bounce rates. Introducing visual skeletons reduces perceived latency.
*   **Usability**: Resetting the scroll position on navigation and providing explicit close controls keeps the user oriented and removes frustration.
*   **Accessibility & SEO**: Fixing broken ARIA references and ensuring comfortable touch targets improves Google Mobile-Friendliness scoring and technical SEO.
*   **Engagement**: A fluid, conflict-free scrolling layout increases the time-on-site, encouraging users to scroll to the interactive poll and debate sections.

### 3. Execution Plan

#### Step 1: Sidebar Drawer Refactor & Tab Integration
*   Modify `public/index.html` to add a Close Button (`<button id="sidebar-close" class="sidebar-close" ...>`) inside the sidebar panel header. Make it visible only under the `@media (max-width: 768px)` stylesheet query.
*   Add `id="sidebar-panel"` to the `<aside>` element so that the header trigger's `aria-controls="sidebar-panel"` has a valid target.
*   Add a simple Mobile Tab Bar layout (`.sidebar-tabs`) inside the sidebar on mobile, with buttons: "Trending" and "Sentiment Feed".
*   In `public/app.js`, show either `#trends-list` or `.live-feed-section` based on the active tab when on mobile. Set both to `flex: 1 1 100%` inside their respective views (hiding the inactive one) to eliminate the dual-nested scroll clashing and provide full-height scroll views.

#### Step 2: Implement Explainer View Loading Skeleton
*   Create a placeholder loading skeleton in `public/index.html` under `main-panel` with the ID `#explainer-skeleton`.
*   Style the skeleton with shimmering CSS gradient animations (`@keyframes shimmer`) and card outlines matching the actual trend explainer cards.
*   In `public/app.js`, when a new trend is clicked:
    1.  Show the `#explainer-skeleton`.
    2.  Keep the old explainer view and welcome view hidden.
    3.  Once the API fetch completes, hide the `#explainer-skeleton` and show `#explainer-view`.

#### Step 3: Implement Scroll Position Reset on Selection
*   In `public/app.js` under the `clickHandler` for trends, add `window.scrollTo({ top: 0, behavior: 'instant' })` (or smooth) so the page scrolls to the top immediately when a new trend details card is rendered.

#### Step 4: Visual Polish & Narrow Viewport Fixes
*   Update CSS for the header status indicator on mobile: hide the text label "Live Trends Feed" on viewports <= 380px wide, showing only the pulsing status dot to prevent horizontal overflow and wraps.
*   Audit and polish all padding/margin variables on mobile viewports to maximize readability.
