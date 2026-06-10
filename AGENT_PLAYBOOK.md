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
| **TJ-09** | **Mobile-First Responsiveness & Premium Touch Interactions** (optimized typography, flex column stack, >=48px touch targets, zero overflow scroll). | 9 | 7 | 5 | 10 | **31** | `[x]` Completed |
| **TJ-10** | **One-Click Share-to-X & Native Web Share API Integration** (allowing users to share trend analysis and debate outcomes). | 8 | 5 | 10 | 9 | **32** | `[x]` Completed |
| **TJ-11** | **Multi-Source Ingestion: Early Reddit Popular RSS Feed Parser** (merging early interest spikes from Reddit into trends feed). | 7 | 6 | 9 | 8 | **30** | **[/] Active** |
| **TJ-12** | **Visual Meme Card Generator** (HTML canvas rendering custom visual shareable meme assets). | 9 | 5 | 10 | 7 | **31** | `[ ]` Proposed |

---

## 🛠️ Active Task Details: TJ-11
- **Objective**: Expand trend discovery beyond Google Trends by adding support for parsed Reddit hot/popular RSS feeds (e.g. `/r/popular` or `/r/all` RSS summaries). Merge these raw, early-stage velocity signals into the main cached trends list, deduplicate by topic title, and tag them as "Reddit Spike" vs "Google Search Spike" in the sidebar list.
- **Why**: Allows TrendJacker to capture hot topics and cultural conversations hours before they register as massive search volume spikes, positioning us as the absolute first JIT explainer for viral spikes.
- **Execution Plan**:
  1. Add Reddit popular feed parser helper in `server.js` (fetching `https://www.reddit.com/r/popular.rss` or JSON representation `https://www.reddit.com/r/popular.json` with a customized User-Agent to avoid rate limiting).
  2. Parse the titles, extract keywords, deduplicate with Google Trends items, and build a unified feeds array.
  3. Include a `source` tag (`google` vs `reddit`) in each trend item object.
  4. Modify the sidebar rendering in `public/app.js` and `public/index.html` to render a source indicator badge next to each trend (e.g. Google icon/color vs Reddit icon/color).
  5. Add E2E tests validating the blended RSS feed parsing and render indicators.
