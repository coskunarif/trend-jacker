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
| **TJ-07** | **AI-Driven Sentiment Debate Arena** (Optimist vs Pessimist bot agents debating the trend). | 9 | 6 | 9 | 8 | **32** | **[/] Active** |
| **TJ-08** | **Automatic Search Engine Indexing Pinger** (pinging IndexNow / Google Indexing API on trend discovery). | 4 | 10 | 5 | 9 | **28** | `[ ]` Proposed |

---

## 🛠️ Active Task Details: TJ-07
- **Objective**: Implement an AI-driven "Sentiment Debate Arena" that generates simulated real-time debates between two distinct bot personas ("Optimist Bot" arguing why the trend is genius vs "Skeptic Bot" arguing why it is overrated).
- **Why**: Keeps users highly engaged and on the page longer (retention), creates shareable conversational snippets (virality), and provides structured, citation-friendly debate text for AI search bots to index (GEO).
- **Execution Plan**:
  1. Add a visual "Debate Arena" card in the center panel layout below the explanation grid.
  2. Implement an endpoint `/api/debate` that triggers Gemini to produce a back-and-forth 3-turn debate on the active trend topic.
  3. Load and render the debate with unique bot avatars, styled bubble layouts, and micro-animations.
  4. Allow the user to "judge" the debate by voting who won (updating Firestore state).
