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
| **TJ-14** | **Main Explainer Panel Loading Skeleton & Fetch Feedback**<br>Add an animated CSS skeleton loader to replace the blank main screen while `/api/explain` is fetching, and add loading feedback on selected items. | 9.0 | 4.0 | 5.0 | 9.5 | **27.5** | `[x]` Completed |
| **TJ-15** | **Mobile Sidebar Drawer Refactor & Accessibility Fixes**<br>Add mobile close button, fix invalid `aria-controls` reference, and refactor dual nested scroll pane into a single scroll. | 8.0 | 6.5 | 4.0 | 9.0 | **27.5** | `[x]` Completed |
| **TJ-16** | **View Scroll Reset & Narrow Screen Header Polish**<br>Reset viewport scroll position to y=0 on trend load, and resolve header wrapping on devices <= 360px wide. | 8.5 | 4.0 | 4.0 | 10.0 | **26.5** | `[x]` Completed |
| **TJ-17** | **Mobile-Native Web Share API Integration for Cards & Links**<br>Replace desktop-focused file downloads with native device share sheets (`navigator.share`) on mobile. Converts canvas explainers/meme cards to Blobs/Files for native sharing to apps like X/Twitter, WhatsApp, Slack, or iOS/Android clipboard. | **9.5** | **6.0** | **10.0** | **9.0** | **34.5** | 🚀 **Selected** |
| **TJ-18** | **Mobile Explainer Content Accordion & Sub-Tabbing**<br>Group the long vertical stack of details into tabbed segments on mobile ("Overview", "Debate", "Interact") to avoid scroll fatigue. | 9.0 | 5.5 | 7.0 | 9.0 | **30.5** | Pending |
| **TJ-19** | **Sticky Bottom Quick-Action Toolbar**<br>Provide a persistent bottom navigation/action bar on mobile for instant voting, opening the debate arena, or starting an AI chat. | 8.5 | 5.0 | 8.5 | 8.5 | **30.5** | Pending |
| **TJ-20** | **High-DPI Retina Scaling for Canvas Analytics**<br>Implement device pixel ratio scaling (`window.devicePixelRatio`) to ensure crystal-clear sparklines and speedometers on modern mobile viewports. | 8.5 | 5.0 | 5.0 | 9.5 | **28.0** | Pending |

---

## 🚀 Selected Task Details: TJ-17 — Mobile-Native Web Share API Integration

### 1. Objective
Transform TrendJacker's share and export loop on mobile devices to behave like a native mobile app. Currently, clicking "Download Card" or "Download Debate Meme" triggers a browser file download of a `1200x630` PNG image. On mobile viewports (iOS Safari, Android Chrome), file downloads are clunky, hidden in system directories, or blocked by default popup blockers. 

By integrating the HTML5 **Web Share API**, the app will convert canvas elements directly into `File` objects and invoke the native device sharing drawer. This allows users to share the actual visual cards directly into X/Twitter, WhatsApp, Messages, or copy them to their native system clipboard in a single tap.

### 2. Why (Business Value & Rationale)
*   **Virality (10/10)**: TrendJacker is a viral news-jacking tool. Sharing an image directly to social networks is a 10x lower friction path than forcing a file download and manual upload.
*   **UX & Native Feel (9.5/10)**: Invoking the native OS share sheet makes the web application feel like a premium, native mobile app, boosting user trust and retention.
*   **SEO & Citations (6.0/10)**: Direct image-backed shares to social networks increase backlinks and search indexing signals for dynamically generated routes (`/t/:slug`).

### 3. Execution Plan

#### Step 1: Feature Detection & Web Share API Support Check
*   Implement feature detection in `public/app.js` to check if `navigator.share` and `navigator.canShare` are available and support file sharing.
*   Update the sharing button text and icon on mobile viewports if native sharing is supported (e.g., changing "Download Card" label to "Share Card").

#### Step 2: Canvas-to-Blob Conversion & File API Wrapping
*   Update `generateTrendCardImage` and `generateDebateMemeCard` in `public/app.js` to convert the generated `<canvas>` to a PNG Blob via `canvas.toBlob()`.
*   Wrap the resulting Blob in a standard `File` object:
    ```javascript
    const file = new File([blob], `trend-card-${slug}.png`, { type: 'image/png' });
    ```

#### Step 3: Trigger Native Share Sheet
*   Invoke `navigator.share` with the constructed `File` object, a title, and the trend page URL (`/t/:slug` or current absolute URL):
    ```javascript
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({
        files: [file],
        title: `TrendJacker Explainer: ${trendTitle}`,
        text: `Check out why ${trendTitle} is viral right now!`,
        url: window.location.href
      });
    }
    ```
*   Fall back gracefully to the standard link-based browser download for desktop devices or unsupported browsers.

#### Step 4: Verification & Automated E2E Testing
*   Write Playwright test assertions in `tests/e2e.spec.js` to verify fallback behavior on non-supporting desktop browsers.
*   Simulate Web Share API supports on simulated mobile viewports if possible, or verify fallback download triggers.
