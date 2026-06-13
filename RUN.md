task: Redesign dashboard, remove Global Sentiment Feed, make main dashboard bigger, use modern UI/UX practices              tier: T2   creativity: 0.5
state: TESTER                budget: repairs 0/3
branch: asf/20260613-expand-dashboard          checkpoint: none
caps: agents,ui,web,human

## Task
- **Objective**: Remove visual clutter from the dashboard layout to increase the primary content screen space and improve user engagement.
- **Metric**: User Engagement (UX Retention)
- **Why Now**: Direct user request to eliminate visual noise and expand the main dashboard panel.
- **Runner-up**: Redesign card layouts inside the main explainer panel to improve mobile/desktop visual consistency.

## Log
- 2026-06-13: Conductor starting fresh run with T2. Starting Scout phase.
- 2026-06-13: Scout spawned background dev server on port 3005 (task-81) to dogfood the UI.
- 2026-06-13: Scout completed task selection. Conductor starting Architect phase.
- 2026-06-13: Architect completed SPEC.md. Conductor starting Tester phase.
- 2026-06-13: Tester completed test suite adaptation. Observed state: red. Conductor starting Builder phase.
- 2026-06-13: Builder disputed obsolete tab transition test. Conductor ruled in favor. Conductor recalling Tester to amend.
- 2026-06-13: Tester completed test amendment. Conductor starting Verifier phase.
- 2026-06-13: Verifier reported failing timeline test due to race condition. Conductor ruled test wrong. Tester recalling to fix test race condition.
## Verdict
- **Disputed Test**: `tests/view-transitions.spec.js:102:3` ("should trigger startViewTransition when switching mobile tabs") contradicts **[AC-2] Sidebar Tab Bar Removal** and **[AC-1] Global Sentiment Feed Removal**, as mobile tab switcher elements are removed.
- **Verification Results**:
  - `[AC-1] Global Sentiment Feed Removal`: PASS. `#live-sentiment-feed` element and indicators are removed.
  - `[AC-2] Sidebar Tab Bar Removal`: PASS. `.sidebar-tabs` and related tab buttons are removed.
  - `[AC-3] Expanded Desktop Grid Layout`: PASS. Desktop layout uses `320px 1fr` grid.
  - `[AC-4] Sidebar Mobile Drawer Width Preservation`: PASS. Sidebar is `290px` on mobile, no tabs/live feed elements inside.
  - `[AC-5] SSE Stream Resilience`: PASS. Dynamic sentiment simulation works without errors.
  - `[AC-6] Redesigned Welcome Screen`: PASS. Welcome view uses refined glassmorphism and modern transition styling.
  - `[AC-7] Modern Card & Border Aesthetics`: PASS. Glass cards have low-opacity borders and glowing hover transitions.
- **Failures / Flaky Tests**:
  - **Test**: `tests/sentiment-timeline.spec.js:141:3` (`AC-3: Canvas updates timeline data and fetches fresh history upon voting`)
  - **Evidence**: `page.waitForResponse` timed out after 30000ms.
  - **Suspected Cause**: Test race condition. The test waits for the initial `/api/poll/history` response after calling `page.goto('/')`, but the request is triggered synchronously on page load and often completes before the test registers `waitForResponse`. In isolation, this test passes successfully.

## Done

