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
| **TJ-25** | **AI-Powered Viral Social Post Generator**<br>Build an interactive viral post generator using the Gemini API. Users select their platform (X/Twitter, LinkedIn, Facebook, Instagram, Reddit) and post type (general trend explainer, poll results, or debate highlight). The AI generates a tailored, SEO/GEO-optimized post with catchy hooks, hashtags, and formatting. | **9.5** | **8.5** | **10.0** | **9.0** | **37.0** | `[x]` Completed |
| **TJ-26** | **Unified Share and Social Modal UI**<br>Refactor the fragmented static sharing buttons into a single high-fidelity modal dialog. It displays a live preview of the AI-generated post, platform selectors, and quick actions to copy to clipboard or open native share links. | **9.0** | **7.0** | **8.5** | **9.5** | **34.0** | Pending |
| **TJ-27** | **Static Social Share Logic Subtraction**<br>Remove the old hardcoded static tweet generation logic from the client-side JavaScript (`app.js`) and clear out the redundant individual share buttons from various sections of the UI, consolidating everything into the new generator. | **7.5** | **6.0** | **5.0** | **10.0** | **28.5** | Pending |
| **TJ-28** | **AI Post Generator Consistency & Virality Polish**<br>Refactor the post generator prompt and backend routing to consistently embed relevant hashtags and the dynamic app URL (`viraljacker.com/t/<slug>`). Tune the content output to be highly concise, catchy, creative, and human-sounding, matching the reference designs. | **9.5** | **9.0** | **10.0** | **9.5** | **38.0** | In Progress (TDD Tests Failing) |

---

## 🚀 Selected Task Details: TJ-28 — AI Post Generator Consistency & Virality Polish

### 1. Objective
Refactor and optimize the AI post generation system to fix inconsistencies in output formatting, particularly hashtags and URL inclusion:
1. **Dynamic URL Integration**: Pass or compute the correct trend detail page URL (`https://viraljacker.com/t/<slug>`) on the backend and enforce its inclusion in the generated social post.
2. **Consistent Hashtags**: Define precise guidelines for the number and context of hashtags for each platform (X, LinkedIn, Facebook, Reddit).
3. **High-Virality & Human Tone**: Instruct Gemini to output concise, catchy, creative, and human-sounding posts that avoid typical AI genericisms and robotic structures, drawing inspiration from the reference screenshot.

### 2. Why (Business Value & Rationale)
*   **UX & Retention (9.5/10)**: Clearer, more engaging posts encourage users to share their discoveries, raising viral loops.
*   **SEO & GEO Optimization (9.0/10)**: Consistent backlinks (`viraljacker.com/t/<slug>`) direct post readers back to specific trend landing pages, driving organic crawlers and traffic.
*   **Viral Potential (10.0/10)**: Punchy, human-sounding, high-emotion hooks significantly outperform dry, robotic summaries.
*   **Feasibility (9.5/10)**: Purely backend changes in `server.js` (prompt engineering and URL mapping) with high-impact outcomes.

### 3. Execution Plan

#### Step 1: Update backend `/api/generate-post` endpoint
*   In `server.js`, compute the trend slug using `titleToSlug(trendTitle)` inside the route.
*   Construct the reference URL: `https://viraljacker.com/t/${slug}`.
*   Enhance the system prompt for Gemini (`gemini-3.5-flash`) with strict requirements:
    - Include the target URL `https://viraljacker.com/t/${slug}` in the output naturally.
    - Generate 2-3 highly relevant, trending hashtags (e.g., `#CricketTwitter` if the topic is about Cricket/India/England match) based on the title.
    - Dictate a concise, human, creative, and catchy tone: avoid generic phrases like "In a surprising turn of events", "Furthermore", "Delve into", "Revolutionize", etc. Use punchy sentences, hooks, and natural human styling (e.g., questions, friendly emojis).
    - Ensure character limits are strictly followed (especially for X/Twitter: under 280 characters, including the URL).

#### Step 2: Implement and Verify Code Changes
*   Verify the prompt returns beautiful posts with the URL and hashtags.
*   Run the test suite using `npx playwright test` to ensure there are no regressions on the endpoints or UI.



