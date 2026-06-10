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
| **TJ-06** | **Playwright E2E testing in CI/CD pipeline** (verifying stability before deploys). | 5 | 5 | 4 | 9 | **23** | **[/] Active** |
| **TJ-04** | **Real-Time Global Sentiment Live Feed** (simulating active votes across regions). | 8 | 4 | 8 | 7 | **27** | `[x]` Completed |

---

## 🛠️ Active Task Details: TJ-06
- **Objective**: Integrate Playwright E2E testing in the CI/CD pipeline to verify application stability, API endpoints, dynamic routes, and frontend functionality automatically before deploying to production.
- **Why**: Ensures code reliability and prevents regressions during deployment cycles, allowing future agents to deploy verified changes autonomously with confidence.
- **Execution Plan**:
  1. Add `@playwright/test` to devDependencies.
  2. Write automated E2E tests for verification (e.g. validating sidebar trend selection, dynamic explainer card rendering, community sentiment polling, follow-up Q&A chat, and live sentiment stream).
  3. Configure GitHub Actions workflow to run E2E test suites prior to the deployment stage.
