task: Fix bad UI split screen trend/sentiment layout based on user feedback.              tier: T2   creativity: 0.5
state: Shipper              budget: repairs 0/3
branch: asf/20260611-bad-ui          checkpoint: asf/20260611-bad-ui/green-1
caps: agents,ui,web,human

## Task
- **Objective**: Fix the bad UI/UX split screen issue by hiding the mobile tab switcher (`.sidebar-tabs`) on desktop screens (>768px) and removing the desktop override CSS rules that hide the trends or sentiment feed when toggled. This ensures a clean, consistent vertical stack layout on desktop without broken interactive states.
- **Metric it moves**: UX Clarity / Usability (reduces confusion of redundant tabs on desktop and prevents empty states).
- **Why now**: The current layout shows redundant tab buttons on desktop that hide critical parts of the feed and result in a broken, half-empty sidebar layout.
- **Runner-up**: Introduce a true three-column layout (Trends, Sentiment, Explainer) on desktop to show both columns side-by-side.

## Log
- 2026-06-11: Conductor initialized Scout phase.
- 2026-06-11: Scout completed phase and wrote task into RUN.md. Conductor initialized Architect phase.
- 2026-06-11: Architect completed SPEC.md. Conductor initialized Tester phase.
- 2026-06-11: Tester updated tests and verified RED state. Conductor initialized Builder phase.
- 2026-06-11: Builder implemented slice [S-2], verified tests green, and committed. Conductor initialized Verifier phase.
- 2026-06-11: Verifier successfully verified all ACs passing. Conductor initialized Shipper phase.
## Verdict
- **[AC-1] Hide Mobile Tab Switcher on Desktop**: PASS. verified `.sidebar-tabs` is hidden (`display: none;`) on viewport >768px.
- **[AC-2] Display Both Panels on Desktop**: PASS. Verified both `#trends-list` and `.live-feed-section` panels are visible concurrently on viewport >768px, even with interactive/toggle classes active.
- **[AC-3] Retain Mobile Tab Switcher Functionality on Mobile**: PASS. Verified `.sidebar-tabs` is visible (`display: flex;`) on <=768px, and toggling active tabs correctly switches visible panels.
- **[AC-4] Enable View Transitions in All Environments**: PASS. Client-side checks on `navigator.webdriver` and overrides disabled.
- **Test Suite**: PASS. Full test suite (46/46 tests) passes successfully.
## Done





