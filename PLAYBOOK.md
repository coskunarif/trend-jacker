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

---

## 🚀 Selected Task Details: TJ-25 — AI-Powered Viral Social Post Generator

### 1. Objective
Build an interactive, AI-driven social post generator inside TrendJacker that creates context-aware, viral-ready, and SEO/GEO-optimized posts for various platforms:
1. **Multi-Platform Support**: Generate posts tailored for X (Twitter), Facebook, Instagram, LinkedIn, and Reddit.
2. **Context-Aware Templates**: Allow generating a post based on three different contexts:
   - **General Trend**: An engaging overview of why the topic is trending.
   - **Poll / Verdict**: Highlighting user sentiment, voting statistics, and public consensus.
   - **AI Debate Summary**: Highlighting the clash between the Optimist and Skeptic bots with key highlights.
3. **AI Generation Backend**: Create an API endpoint `/api/generate-post` that prompts Gemini with the trend data and outputs a tailored response containing a catchy hook, platform-specific tone, hashtags, and relevant keywords.
4. **Copy & Share Integration**: Implement copy-to-clipboard functionality and direct link opening for each platform.

### 2. Why (Business Value & Rationale)
*   **UX & Retention (9.5/10)**: Lets users easily interact and create high-quality content without leaving the application.
*   **SEO & GEO Optimization (8.5/10)**: Embeds targeted hashtags, trending keywords, and backlinks, driving organic traffic back to TrendJacker.
*   **Viral Potential (10.0/10)**: AI-optimized hooks and tailored messaging drastically increase click-through and sharing rates.
*   **Feasibility (9.0/10)**: Extends existing Gemini API backend structure and uses standard vanilla web integrations.

### 3. Execution Plan

#### Step 1: Create the Backend API Endpoint
*   In [server.js](file:///home/ubuntuadmin/projects/trend-jacker/server.js), add a `POST /api/generate-post` route.
*   The route should accept `trendTitle`, `platform` (X, Facebook, Instagram, LinkedIn, Reddit), and `contextType` (general, poll, debate).
*   Formulate a robust system prompt for Gemini (`gemini-3.5-flash`) that specifies rules for each platform:
    - **X**: Short, snappy, hook-first, max 280 chars, 2-3 hashtags.
    - **LinkedIn**: Professional, analytical, structured, bullet points, question at the end, relevant tags.
    - **Facebook**: Conversational, engaging hook, emoji-rich, call to action.
    - **Instagram**: Bold headline, visual-centric caption structure, rich block of 10+ relevant hashtags.
    - **Reddit**: Informative, community-oriented, self-post style with title + body, no excessive emoji.
*   Incorporate trend facts (the hook, summary, poll stats, or debate turns) into the prompt context to ground the generation.

#### Step 2: Implement the Frontend UI (Modal & Panel)
*   In [index.html](file:///home/ubuntuadmin/projects/trend-jacker/public/index.html), add a dialog markup/modal representing the "AI Viral Post Generator".
*   Provide dropdowns/pill selectors for Platform and Context Type.
*   Add a prominent text area displaying the generated post preview with a loading spinner.
*   Include buttons for:
    - **Generate / Regenerate**: Triggers the API call.
    - **Copy to Clipboard**: Copies the generated text.
    - **Share / Open**: Redirects to the native posting intent if supported (e.g., `https://x.com/intent/tweet?text=...`).

#### Step 3: Connect Frontend Logic
*   In [app.js](file:///home/ubuntuadmin/projects/trend-jacker/public/app.js), handle modal open/close states.
*   Wire up event listeners for platform selection and regenerate actions to perform the fetch request to `/api/generate-post`.
*   Connect the copy and sharing behaviors.

#### Step 4: Verification and Testing
*   Write Playwright integration tests under `tests/viral-generator.spec.js` to ensure the modal opens, calls the API successfully, and handles responses/copy correctly.


