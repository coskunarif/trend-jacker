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
| **TJ-21** | **Mobile Layout and Responsiveness Overhaul**<br>Fix critical visual and layout bugs on mobile viewports: (1) prevent debate bubbles from collapsing to min-content width (single-word columns); (2) resolve horizontal scroll/viewport overflow caused by non-wrapping metadata row; (3) ensure chat bubbles use fit-content layout. | **9.5** | **7.5** | **8.0** | **9.5** | **34.5** | `[x]` Completed |
| **TJ-22** | **Container Queries & Fluid Typography for Explainer Panel**<br>Refactor headings and card copy using CSS container queries and `clamp()` to guarantee elegant line wrapping on devices <= 360px. | 8.0 | 6.0 | 5.0 | 8.5 | **27.5** | Pending |
| **TJ-23** | **Mobile Touch Targets & Swipe gesture Drawer**<br>Implement left/right swipe gestures to open/close the mobile trends sidebar and ensure all buttons meet WCAG 48x48px target minimums. | 8.5 | 7.0 | 6.0 | 8.0 | **29.5** | Pending |

---

## 🚀 Selected Task Details: TJ-21 — Mobile Layout and Responsiveness Overhaul

### 1. Objective
Identify and fix the critical mobile-view layout issues reported by the user:
1. **Debate Bubble Layout Collapse**: The debate messages shrink-wrap to `min-content` width on narrow mobile viewports, displaying arguments as a single vertical column of individual words.
2. **Horizontal Viewport Overflow**: The trend header's metadata row (`.trend-meta-row`) contains multiple elements (traffic-pill, velocity-gauge-container with sparkline, and share buttons) that do not wrap on mobile. This pushes the page width beyond 100vw, causing massive horizontal overflow and cutting off text on the left/right.

### 2. Why (Business Value & Rationale)
*   **UX & Retention (9.5/10)**: Readable debates and a perfectly bounded page are non-negotiable for mobile user retention. Users leaving due to a broken layout is a high-risk drop-off path.
*   **SEO & Mobile Friendliness (7.5/10)**: Google penalizes pages that overflow horizontally or have text elements overlapping or too close to each other.
*   **Feasibility (9.5/10)**: This task requires pure CSS layout corrections (e.g., using `width: fit-content;` and `flex-wrap: wrap;`) without introducing extra frameworks or libraries.

### 3. Execution Plan

#### Step 1: Fix Debate and Chat Bubble Collapse
*   Identify CSS selectors `.debate-bubble-wrap` and `.chat-bubble`.
*   Change their width properties to `width: fit-content;` combined with `max-width: 90%;` (or `85%` for desktop/mobile consistency) to ensure they shrink-wrap short messages but stretch correctly up to their bounds for longer paragraphs instead of collapsing to single-word column widths.

#### Step 2: Fix Horizontal Overflow on Metadata Row
*   Target `.trend-meta-row` inside the `@media (max-width: 768px)` media query in `public/styles.css`.
*   Set `.trend-meta-row` to `flex-wrap: wrap;` and configure appropriate spacing and gap rules so that the velocity speedometer, sparkline, traffic pill, and sharing buttons stack beautifully on narrow viewports rather than overflowing the page.
*   Apply general cleanups (e.g. `box-sizing: border-box`, `max-width: 100%`) on components inside `.main-panel` to guarantee viewport safety.

#### Step 3: End-to-End Visual Verification
*   Add E2E tests in Playwright (e.g., in `tests/responsive.spec.js` or `tests/e2e.spec.js`) to verify mobile viewport widths (e.g. `360px`, `375px`).
*   Assert that there is no horizontal page overflow (i.e. `window.innerWidth` matches the scrollable content width).
*   Verify that debate text wraps normally and is fully readable on mobile.
