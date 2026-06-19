task: Maximize crawl speed of newly generated trend pages to capture viral search engine traffic  tier: T2   creativity: 0.3
state: VERIFIER                budget: repairs 0/3
branch: asf/20260619-fast-indexing          checkpoint: none
caps: agents,ui,web,human

## Task
- Objective: Maximize crawl speed of newly generated trend pages to capture viral search engine traffic.
- Metric: Speed-to-traffic
- Why Now: The current mechanism uses the deprecated Google sitemap ping, which Google disabled in December 2023. This results in zero crawl signals, delaying indexation by days and missing viral breakout traffic windows entirely.
- Runner-up: Implement outbound auto-posting loops to drive immediate referral traffic.

## Log
- 2026-06-19: Conductor starting fresh. Leftover SPEC.md deleted. State set to SCOUT.
- 2026-06-19: Spawned local dev server on port 3005 under task id: 4694d1f3-1096-460c-8fdd-3026d253ea60/task-74
- 2026-06-19: Scout completed dogfooding and proposed task. Terminated local dev server.
- 2026-06-19: Scout proposed winner. Work branch created: asf/20260619-fast-indexing. State set to ARCHITECT.
- 2026-06-19: Architect completed. Output path: SPEC.md. Elapsed time: 3 minutes.
- 2026-06-19: Critic completed. Objections written to dogfood-output/20260619-fast-indexing/redteam-design.md. Elapsed time: 1 minute.
- 2026-06-19: Architect addressed objections, updated SPEC.md, and re-reported. State set to TESTER.
- 2026-06-19: Tester completed. Output path: tests/google-indexing.spec.js. Observed state: red. Elapsed time: 8 minutes.
- 2026-06-19: Builder completed. Slices S-1 and S-2 implemented, tests passed. Elapsed time: 18 minutes.
- 2026-06-19: Verifier completed. Output path: RUN.md. Verdict: FAIL (2 test failures out of 311 tests).
- 2026-06-19: Tester amendment dispatched. Hypothesis: The new test cases in tests/google-indexing.spec.js contain syntax errors and incorrect output channel assertions (inspecting stdout instead of stderr) when executing generated helper scripts. Creativity x0.6 applied. State set to TESTER.
- 2026-06-19: Tester amended tests, tests passed. State set to VERIFIER.
- 2026-06-19: Verifier completed. Output path: RUN.md. Verdict: PASS (all 311 tests passed successfully).

## Verdict

### Deterministic Checks
- **Lint**: Skipped (no lint configuration or script in package.json).
- **Types**: Skipped (no typecheck configuration or script in package.json).
- **Build**: Skipped (no build script in package.json).
- **Test Suite**: **PASS**
  - Ran `npx playwright test`. All 311 tests passed successfully.

### Behavioral Checks
- **Web UI Dogfooding**: Skipped (no user-facing frontend changes; changes are in indexing backend and CLI tools).
- **Non-web CLI Script Execution**: **PASS**
  - Verified `indexing.js` correctly maps slugs to 4 localized URLs, chunks notifications in groups of 5, handles exponential backoffs/retries, and bypasses Google APIs with warning logs in local dev mode.
  - Verified that `scripts/ping-sitemap.js` processes sitemaps correctly, extracts/filters trend paths, limits indexing to 15 recent trends, and respects mock modes.

### Visual Checks
- **Layout & Visual Regression**: Skipped (no layout, frontend, or styling changes).
