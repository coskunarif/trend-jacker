# TrendJacker Agent Playbook

This playbook is the source of truth for the autonomous development of TrendJacker. Future developer agents must read this file upon startup, brainstorm new ideas, update the backlog, select the highest-scoring task, and execute it.

---

## 🎯 Scoring Rubric
Each brainstormed task is scored out of **10 points** across four key areas:
1. **UX & Retention (UX)**: Does it hook the user in 3 seconds, look beautiful, and keep them engaged?
2. **SEO & GEO (SEO)**: Does it optimize for search engine rankings and AI model citations?
3. **Viral Potential (VIR)**: Does it drive shares, recommendations, and organic loops?
4. **Feasibility (FEAS)**: Can it be built cleanly, minimal dependencies, and under stateless serverless constraints?

**Formula**: `Total = UX + SEO + VIR + FEAS` (Max 40 points)

---

## 📋 Backlog & Roadmap

| Task ID | Description | UX | SEO | VIR | FEAS | Total | Status |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **TJ-01** | **Automated SEO JSON-LD & Dynamic OpenGraph Meta Injection** via dynamic routing (`/t/:slug`). | 5 | 10 | 6 | 9 | **30** | `[x]` Completed |
| **TJ-02** | **Dynamic Trend Card Generator** (HTML canvas / preview layout) for social media sharing. | 8 | 5 | 9 | 7 | **29** | `[x]` Completed |
| **TJ-03** | **Interactive "Viral Velocity" Gauge & Sparkline** on the dashboard. | 9 | 4 | 7 | 8 | **28** | `[x]` Completed |
| **TJ-05** | **Cloud Firestore Persistence** (keyless production auth + local mock fallback). | 6 | 5 | 5 | 9 | **25** | `[x]` Completed |
| **TJ-06** | **Playwright E2E testing in CI/CD pipeline** (verifying stability before deploys). | 5 | 5 | 4 | 9 | **23** | `[x]` Completed |
| **TJ-04** | **Real-Time Global Sentiment Live Feed** (simulating active votes across regions). | 8 | 4 | 8 | 7 | **27** | `[x]` Completed |
| **TJ-07** | **AI-Driven Sentiment Debate Arena** (Optimist vs Pessimist bot agents debating the trend). | 9 | 6 | 9 | 8 | **32** | `[x]` Completed |
| **TJ-08** | **Automatic Search Engine Indexing Pinger** (pinging IndexNow / Google Indexing API on trend discovery). | 4 | 10 | 5 | 9 | **28** | `[x]` Completed |
| **TJ-09** | **Mobile-First Responsiveness & Premium Touch Interactions** (optimized typography, flex column stack, >=48px touch targets, zero overflow scroll). | 9 | 7 | 5 | 10 | **31** | **[/] Active** |
| **TJ-10** | **One-Click Share-to-X & Native Web Share API Integration** (allowing users to share trend analysis and debate outcomes). | 8 | 5 | 10 | 9 | **32** | `[ ]` Proposed |

---

## 🛠️ Active Task Details: TJ-09
- **Objective**: Optimize the layout to be fully responsive and feel like a premium native mobile application on mobile screens, meeting Google Mobile-Friendly standards. Ensure touch targets are at least 48x48px, typography sizes adapt, navigation/sidebar stacks cleanly into a swipeable drawer or collapsible header, and horizontal overflow is strictly zero.
- **Why**: Captures the huge share of traffic originating from mobile search engines, improves Google Mobile Search rankings, and increases mobile user retention.
- **Execution Plan**:
  1. Audit the current mobile layout using browser emulation.
  2. Implement a responsive `@media (max-width: 768px)` stylesheet block in `public/styles.css` that collapses the 3-panel layout (sidebar, main explainer, right info feed) into a clean stacked structure.
  3. Design a responsive navigation bar for mobile that lets users open the trends sidebar or collapse it.
  4. Expand all buttons and interactive items (votes, debate judgment buttons, chat inputs) to have a minimum 48x48px tap target size.
  5. Add E2E tests verifying viewport layout elements scale correctly without overflowing.
