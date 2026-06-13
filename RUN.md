task: Resolve the news footer test suite failure to restore baseline test suite verification to 100% success.              tier: T2   creativity: 0.5
state: verify              budget: repairs 0/3
branch: asf/20260613-news-footer          checkpoint: none
caps: agents,ui,web,human

## Log
- 2026-06-13: Conductor starting fresh run with T2 (Scout trigger). Starting Scout phase.
- 2026-06-13: Scout completed. Conductor starting Architect phase.
- 2026-06-13: Architect completed SPEC.md. Conductor starting Tester phase.
- 2026-06-13: Tester completed test suite. Observed state: red. Conductor starting Builder phase.
- 2026-06-13: Builder completed all slices. Observed state: green. Conductor starting Verifier phase.

## Task
- **Objective**: Resolve the news footer test suite failure to restore baseline test suite verification to 100% success.
- **Metric**: Baseline test suite success rate.
- **Why now**: The baseline test suite is currently red, which preempts other feature work under the Scout playbook.
- **Runner-up**: Optimize LLM caching and costs by normalizing lookup keys and enforcing JSON schema response shapes.

## Verdict
- **Check 1: Full Test Suite Execution**: PASS. Ran full suite of 168 tests; all passed successfully.
- **Check 2: Repetitive Target Verification**: PASS. Ran `tests/og-favicon.spec.js` with `--repeat-each 5` (25 total runs); all passed without flakiness.
- **Check 3: Visual and Behavioral Dogfooding**: PASS. Verified desktop and mobile viewports. News footer elements are populated synchronously and atomically without event loop yields.
- **Evidence**:
  - Desktop screenshots:
    - [desktop-home.png](file:///home/ubuntuadmin/projects/trend-jacker/dogfood-output/20260613-news-footer/screenshots/desktop-home.png)
    - [desktop-austin-riley-loaded.png](file:///home/ubuntuadmin/projects/trend-jacker/dogfood-output/20260613-news-footer/screenshots/desktop-austin-riley-loaded.png)
    - [desktop-austin-riley-footer-visible.png](file:///home/ubuntuadmin/projects/trend-jacker/dogfood-output/20260613-news-footer/screenshots/desktop-austin-riley-footer-visible.png)
  - Mobile screenshots:
    - [mobile-home.png](file:///home/ubuntuadmin/projects/trend-jacker/dogfood-output/20260613-news-footer/screenshots/mobile-home.png)
    - [mobile-detail.png](file:///home/ubuntuadmin/projects/trend-jacker/dogfood-output/20260613-news-footer/screenshots/mobile-detail.png)
    - [mobile-detail-footer.png](file:///home/ubuntuadmin/projects/trend-jacker/dogfood-output/20260613-news-footer/screenshots/mobile-detail-footer.png)

## Done
