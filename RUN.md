task: Eliminate localization test flakiness to guarantee E2E build reliability.              tier: T2   creativity: 0.5
state: ship                budget: repairs 0/3
branch: asf/20260614-localization-flakiness          checkpoint: none
caps: agents,ui,web,human

## Task
- **Objective**: Eliminate localization test flakiness to guarantee E2E build reliability.
- **Metric**: E2E build reliability.
- **Why Now**: The E2E localization test suite has intermittent race conditions when selecting languages on page load, causing parallel test execution to flake and block developer velocity.
- **Runner-up**: Implement client-side sessionStorage caching for chat queries to minimize redundant API calls and reduce infrastructure costs.

## Log
- 2026-06-14: Conductor starting Scout phase.
- 2026-06-14: Scout identified flaky test in localization.spec.js and selected repair task.
- 2026-06-14: Conductor starting Architect phase.
- 2026-06-14: Architect completed SPEC.md. Conductor starting Tester phase.
- 2026-06-14: Tester completed test suite. Observed state: green. Conductor starting Verifier phase.
- 2026-06-14: Verifier completed. Conductor starting Shipper phase.
## Verdict
- **Check E2E Test Suite Run**: PASS
  - Executed all 227 tests in the Playwright suite. Status: green (all passed).
- **Check Flakiness Repetitive Run**: PASS
  - Executed `tests/localization.spec.js` 10 times repeatedly using `--repeat-each 10`. Status: 140/140 passed successfully. Zero flakiness or SQLite locked errors observed.
- **Check [AC-1] Playwright Configuration**: PASS
  - Confirmed `workers: 1` is explicitly set in `playwright.config.js` to ensure sequential execution and avoid SQLite database locking.
- **Check [AC-2] Async Request Await**: PASS
  - Confirmed `tests/localization.spec.js` utilizes `page.waitForResponse(...)` before asserting API details.
- **Check [AC-3] Polling Assertions**: PASS
  - Confirmed `tests/localization.spec.js` uses retry/polling assertions like `expect().toContainText()` and `expect().toPass()`.
- **Dogfooding & Screenshots**: PASS
  - Manually started server and automated language selection (en, es, fr, ja) on both desktop and mobile viewports.
  - Visual verification confirms no layout overflow, text clipping, or broken layout.
  - Screenshots saved to:
    - [desktop_en.png](file:///home/ubuntuadmin/projects/trend-jacker/dogfood-output/20260614-localization-flakiness/screenshots/desktop_en.png)
    - [desktop_es.png](file:///home/ubuntuadmin/projects/trend-jacker/dogfood-output/20260614-localization-flakiness/screenshots/desktop_es.png)
    - [desktop_fr.png](file:///home/ubuntuadmin/projects/trend-jacker/dogfood-output/20260614-localization-flakiness/screenshots/desktop_fr.png)
    - [desktop_ja.png](file:///home/ubuntuadmin/projects/trend-jacker/dogfood-output/20260614-localization-flakiness/screenshots/desktop_ja.png)
    - [mobile_en.png](file:///home/ubuntuadmin/projects/trend-jacker/dogfood-output/20260614-localization-flakiness/screenshots/mobile_en.png)
    - [mobile_es.png](file:///home/ubuntuadmin/projects/trend-jacker/dogfood-output/20260614-localization-flakiness/screenshots/mobile_es.png)
    - [mobile_fr.png](file:///home/ubuntuadmin/projects/trend-jacker/dogfood-output/20260614-localization-flakiness/screenshots/mobile_fr.png)
    - [mobile_ja.png](file:///home/ubuntuadmin/projects/trend-jacker/dogfood-output/20260614-localization-flakiness/screenshots/mobile_ja.png)

## Done

