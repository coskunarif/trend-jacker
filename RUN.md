task: Maximize crawl speed of newly generated trend pages to capture viral search engine traffic  tier: T2   creativity: 0.5
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

## Verdict

### Deterministic Checks
- **Lint**: Skipped (no lint configuration or script in package.json).
- **Types**: Skipped (no typecheck configuration or script in package.json).
- **Build**: Skipped (no build script in package.json).
- **Test Suite**: **FAIL**
  - Ran `npx playwright test`. 309 of 311 tests passed.
  - 2 failures in `tests/google-indexing.spec.js`.

#### Failures:
1. **[AC-1] Local Development Bypass when no credentials exist and not in test mode**
   - **AC Broken**: `[AC-1]`
   - **Evidence**:
     ```
     Error: expect(received).toBeDefined()
     Received: undefined
     at /home/ubuntuadmin/projects/trend-jacker/tests/google-indexing.spec.js:199:26
     ```
   - **Suspected Cause**: **Test bug**. The generated test helper script `temp-dev-test.js` outputs its result using `console.error()`, but `tests/google-indexing.spec.js` executes it with `execSync()` and inspects `stdout`, which does not capture standard error output.
2. **[AC-2] Standalone CLI Script filters and caps URLs to 15 most recent trends in production mode**
   - **AC Broken**: `[AC-2]`
   - **Evidence**:
     ```
     Error: Command failed: node temp-cli-test.js
     SyntaxError: Invalid or unexpected token
     at /home/ubuntuadmin/projects/trend-jacker/tests/google-indexing.spec.js:286:22
     ```
   - **Suspected Cause**: **Test bug**. The template literal generating `temp-cli-test.js` evaluates to code containing an escaped backtick and references `mockSitemap` which is not defined in the scope of the generated script.

### Behavioral Checks
- **Web UI Dogfooding**: Skipped (no user-facing frontend change; functionality is backend/cron script indexing execution).
- **Non-web CLI Script Execution**: **PASS**
  - Manually executed `node scripts/ping-sitemap.js` which correctly fetched the sitemap, filtered non-trend static URLs, capped submissions at 15 trends (60 localized URL variants), and gracefully fell back under local-dev mode to mock Google Indexing.

### Visual Checks
- **Layout & Visual Regression**: Skipped (no frontend or styling changes).
