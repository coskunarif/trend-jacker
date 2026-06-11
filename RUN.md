task: Fix Test Flakiness (Responsive Grid & Tooltip)     tier: T2   creativity: 0.5
state: shipper                 budget: repairs 0/3
branch: asf/20260611-test-fix-flakiness    checkpoint: none
caps: agents,ui,web,human

## Task
- **Objective**: Fix the failing responsive card grid layout checks and timeline hover tooltip test flakiness to ensure green CI/CD status.
- **Metric**: Build reliability and layout accuracy.
- **Why now**: Parallel CPU loads and View Transition timings are causing layout assertions and hover tooltip visibility checks to flake/fail.
- **Runner-up**: TJ-26 (Unified Share and Social Modal UI)

## Log
- 2026-06-11: Conductor initialized Scout phase.
- 2026-06-11: Scout selected "Fix Test Flakiness (Responsive Grid & Tooltip)" as the next high-ROI task.
- 2026-06-11: Conductor initialized Architect phase.
- 2026-06-11: Architect completed SPEC.md. Conductor initialized Tester phase.
- 2026-06-11: Tester updated tests and verified state. Conductor initialized Builder phase.
- 2026-06-11: Builder verified tests green on branch and committed changes. Conductor initialized Verifier phase.
- 2026-06-11: Verifier completed validation of E2E tests, captured screenshots, and verified resolution of test flakiness.
- 2026-06-11: Conductor initialized Shipper phase.

## Verdict

### Checks:
- **Test Suite**: PASS (All 50 E2E tests passed cleanly in 32.2s)
- **AC-1 (Responsive Grid Layout Checks)**: PASS (Verified that transitions settle, coordinates check out perfectly on desktop [side-by-side] and mobile [stacked])
- **AC-2 (Timeline Hover Tooltip Checks)**: PASS (Verified explicit network response waiting for history endpoints, and auto-retrying style checks/visibility assertions)

### Evidence:
- Run logs and test results: `50 passed`
- Desktop Grid Layout: [desktop-grid.png](file:///home/ubuntuadmin/projects/trend-jacker/dogfood-output/20260611-test-fix-flakiness/screenshots/desktop-grid.png)
- Mobile Grid Layout: [mobile-grid.png](file:///home/ubuntuadmin/projects/trend-jacker/dogfood-output/20260611-test-fix-flakiness/screenshots/mobile-grid.png)
- Hover Tooltip: [hover-tooltip.png](file:///home/ubuntuadmin/projects/trend-jacker/dogfood-output/20260611-test-fix-flakiness/screenshots/hover-tooltip.png)

