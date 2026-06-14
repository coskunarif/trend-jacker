task: Eliminate localization test flakiness to guarantee E2E build reliability.              tier: T2   creativity: 0.5
state: plan                budget: repairs 0/3
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
## Verdict
## Done
