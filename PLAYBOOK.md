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
| **TJ-13** | **Unified Mobile UX and Navigation Polish Suite** | 9.5 | 6.0 | 6.0 | 9.0 | **30.5** | `[x]` Completed |
| **TJ-14** | **Main Explainer Panel Loading Skeleton & Fetch Feedback** | 9.0 | 4.0 | 5.0 | 9.5 | **27.5** | `[x]` Completed |
| **TJ-15** | **Mobile Sidebar Drawer Refactor & Accessibility Fixes** | 8.0 | 6.5 | 4.0 | 9.0 | **27.5** | `[x]` Completed |
| **TJ-16** | **View Scroll Reset & Narrow Screen Header Polish** | 8.5 | 4.0 | 4.0 | 10.0 | **26.5** | `[x]` Completed |
| **TJ-17** | **Mobile-Native Web Share API Integration for Cards & Links** | 9.5 | 6.0 | 10.0 | 9.0 | **34.5** | `[x]` Completed |
| **TJ-18** | **Mobile Explainer Content Accordion & Sub-Tabbing** | 9.0 | 5.5 | 7.0 | 9.0 | **30.5** | Pending |
| **TJ-19** | **Sticky Bottom Quick-Action Toolbar** | 8.5 | 5.0 | 8.5 | 8.5 | **30.5** | Pending |
| **TJ-20** | **High-DPI Retina Scaling for Canvas Analytics** | 8.5 | 5.0 | 5.0 | 9.5 | **28.0** | Pending |
| **TJ-21** | **Mobile Layout and Responsiveness Overhaul** | 9.5 | 7.5 | 8.0 | 9.5 | **34.5** | `[x]` Completed |
| **TJ-22** | **Container Queries & Fluid Typography for Explainer Panel** | 8.0 | 6.0 | 5.0 | 8.5 | **27.5** | Pending |
| **TJ-23** | **Mobile Touch Targets & Swipe gesture Drawer** | 8.5 | 7.0 | 6.0 | 8.0 | **29.5** | Pending |
| **TJ-24** | **Desktop Tabbed Sidebar & Live Feed Hydration**<br>Overhaul the sidebar layout on desktop to match mobile's tabbed switcher, resolving the dual scrollbar problem. Implement server-side activity logging to immediately hydrate the "Global Sentiment Feed" with recent vote history upon connection, and broadcast live user votes in real-time. Style feed items and segmented controls with a modern, high-fidelity design. | **9.5** | **7.5** | **8.5** | **9.5** | **35.0** | `[x]` Completed |

---

## 🚀 Selected Task Details: TJ-24 — Desktop Tabbed Sidebar & Live Feed Hydration

### 1. Objective
Redesign and rebuild the TrendJacker sidebar for desktop and mobile using modern UX principles, addressing two key issues:
1. **Empty Feed Gaps**: The "Global Sentiment Feed" is empty upon connection, leaving users questioning if it works. We will build a server-side memory log of recent votes to hydrate the feed instantly upon connection, and route live user-submitted votes directly to it.
2. **Stacked Layout with Dual Scrollbars**: The desktop view splits the sidebar vertically into stacked "Trending Searches" and "Global Sentiment Feed" sections, creating dual scrollbars and cramped list containers. We will expand the mobile tab-switching controller to desktop to toggle between tabs dynamically, giving the active view 100% of the sidebar scroll height.
3. **UX Polish**: Style the tab selector as a high-fidelity pill segmented control and feed items with elegant cards, status badges, and interactive trend links.

### 2. Why (Business Value & Rationale)
*   **UX & Retention (9.5/10)**: Eliminates confusing dual scrollbars. Provides instant value to users via an populated, active feed upon loading the page.
*   **SEO & Mobile Friendliness (7.5/10)**: Guarantees unified responsive design and semantic tab elements.
*   **Viral Potential (8.5/10)**: Seeing a live stream of global votes builds a sense of active community. Showing the user's own votes in the live stream immediately reinforces their interaction.
*   **Feasibility (9.5/10)**: Straightforward server-side memory queue + SSE emission, with vanilla CSS tabs and layout.

### 3. Execution Plan

#### Step 1: Server-Side Hydration and Broadcast Overhaul
*   In [server.js](file:///home/ubuntuadmin/projects/trend-jacker/server.js), introduce a `recentActivityLog` queue capped at 15 items.
*   Write a helper to seed the queue with 10 mock historical votes on startup so it is never empty.
*   Upon initial SSE connection at `/api/sentiment-stream`, immediately stream all queue items to the client.
*   Update the POST `/api/poll` endpoint to log and broadcast user-submitted votes in real-time.

#### Step 2: Tabbed Sidebar Layout & CSS Modernization
*   In [styles.css](file:///home/ubuntuadmin/projects/trend-jacker/public/styles.css), make `.sidebar-tabs` visible on desktop and style it as a modern pill-segmented controller.
*   Move the tab visibility classes (e.g. `.sidebar-panel.show-sentiment .scroll-container`, `.sidebar-panel:not(.show-sentiment) .live-feed-section`) outside the mobile media query so they govern the layout on all viewports.
*   Set both container elements to take 100% height when active.

#### Step 3: Client-Side Feed and UI Updates
*   In [app.js](file:///home/ubuntuadmin/projects/trend-jacker/public/app.js), ensure click events on feed item trend links load details and navigate correctly.
*   Add a prominent explanation banner at the top of the Global Sentiment Feed tab.

#### Step 4: Verification and Automated Tests
*   Update Playwright tests to cover desktop tabbed behavior and ensure the live feed loads hydrated records on startup.
*   **TDD Verification status**: Tests written under [sidebar-hydration.spec.js](file:///home/ubuntuadmin/projects/trend-jacker/tests/sidebar-hydration.spec.js) and verified to fail on current codebase (4/4 tests failing).

