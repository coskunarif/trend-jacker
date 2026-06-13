task: Redesign dashboard, remove Global Sentiment Feed, make main dashboard bigger, use modern UI/UX practices              tier: T2   creativity: 0.5
state: SHIPPER                budget: repairs 0/3
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
- 2026-06-13: Tester completed test race condition fix. Conductor starting Verifier phase.
- 2026-06-13: Verifier spawned background dev server on port 3005 (task-63) to dogfood the UI.
- 2026-06-13: Verifier completed validation checks successfully. Conductor starting Shipper phase.
## Verdict
All checks passed. No failures observed.

### Acceptance Criteria Results
- **[AC-1] Global Sentiment Feed Removal**: PASS (Verified DOM absence of `#live-sentiment-feed` and `.live-feed-section`).
- **[AC-2] Sidebar Tab Bar Removal**: PASS (Verified DOM absence of `.sidebar-tabs` and its buttons).
- **[AC-3] Expanded Desktop Grid Layout**: PASS (Verified `320px 1fr` layout grid columns on desktop viewports).
- **[AC-4] Sidebar Mobile Drawer Width Preservation**: PASS (Verified mobile `.sidebar-panel` width remains `290px` with no tabs or live feed inside).
- **[AC-5] SSE Stream Resilience**: PASS (Verified `api/sentiment-stream` SSE event updates poll stats without throwing errors when `#live-sentiment-feed` is absent).
- **[AC-6] Redesigned Welcome Screen**: PASS (Verified styled glassmorphism welcome container formatting and typography).
- **[AC-7] Modern Card & Border Aesthetics**: PASS (Verified fine, low-opacity borders `rgba(255, 255, 255, 0.08)` and subtle transitions on `.glass-card` elements).

### Test Suite Results
- Playwright E2E and visual tests: PASS (121/121 tests passed).

## Done

