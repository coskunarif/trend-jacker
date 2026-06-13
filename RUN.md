task: Redesign dashboard, remove Global Sentiment Feed, make main dashboard bigger, use modern UI/UX practices              tier: T2   creativity: 0.5
state: VERIFIER                budget: repairs 0/3
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
## Verdict
- **Disputed Test**: `tests/view-transitions.spec.js:102:3` ("should trigger startViewTransition when switching mobile tabs") contradicts **[AC-2] Sidebar Tab Bar Removal** and **[AC-1] Global Sentiment Feed Removal**, as mobile tab switcher elements are removed.

## Done
