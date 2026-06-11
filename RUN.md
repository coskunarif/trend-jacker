task: Fix Test Flakiness (Responsive Grid & Tooltip)     tier: T2   creativity: 0.5
state: builder                 budget: repairs 0/3
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

