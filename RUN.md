task: Prevent visual text overlapping and clipping on dynamically generated infographic sharing cards to increase social share rate. (Moves: Infographic share card download and sharing rate. Why now: Current implementation uses static vertical offsets for custom text and hooks which causes layout collision when text is long. Runner-up: Progressive Enhancement for Web Share API and Download Feedback.) tier: T2   creativity: 0.5
state: SHIPPER
branch: asf/20260612-canvas-overflow          checkpoint: none
caps: agents,ui,web,human

## Log
- 2026-06-12: Conductor starting fresh run with Scout phase.
- 2026-06-12: Scout running local dev server on port 3080.
- 2026-06-12: Scout phase completed. Selected Dynamic Canvas Positioning & Layout Overflow Prevention as the task winner.
- 2026-06-12: Conductor starting Architect phase.
- 2026-06-12: Architect completed SPEC.md.
- 2026-06-12: Conductor starting Tester phase.
- 2026-06-12: Tester completed tests. Observed state: red.
- 2026-06-12: Conductor starting Builder phase.
- 2026-06-12: Builder completed all slices. Observed state: green.
- 2026-06-12: Conductor starting Verifier phase.
- 2026-06-12: Verifier completed validation checks successfully. All checks passed.
- 2026-06-12: Conductor starting Shipper phase.
## Verdict
- **[AC-1] Dynamic Subtitle & Header Positioning (Infographic)**: PASS. Layout shifts dynamically when custom subtitle exists (+65px spacing). Default y-coordinate 275 when absent. Verified via telemetry.
- **[AC-2] Enhanced wrapText Helper**: PASS. Accepts `dryRun` flag, returns final y-coordinate, does not draw if `dryRun: true`. Verified via programmatic test assertions.
- **[AC-3] Dynamic Hook Box Sizing (Infographic)**: PASS. RoundRect box scales dynamically to `(lastHookTextY - hookTextStartY) + 80` (min 120px). Verified via telemetry.
- **[AC-4] Dynamic Font Scaling & Footer Boundary Constraint (Infographic)**: PASS. Constrained to y=540 by loop reduction of font size (18px -> 12px) and line height (28px -> 19px) and capped if still exceeding at 12px. Verified via E2E test.
- **[AC-5] Dynamic Positioning & Sizing on Standard Share Card**: PASS. Sizes hook box, shifts subsequent sections down, applies font-scaling loop. Verified via telemetry.
- **[AC-6] Global Layout Telemetry**: PASS. Telemetry values written to `window.__canvasLayouts.infographic` and `window.__canvasLayouts.trendCard`. Verified in Playwright.
- **[AC-7] E2E Layout & Overlay Validation**: PASS. `tests/infographic-overlays.spec.js` covers no subtitle, normal subtitle, and long subtitle + long hook scenarios. All 114 suite tests pass.
- **Visual & Behavioral Dogfooding**: PASS. Executed browser automation using `agent-browser` on local dev server. Captured screenshots, checked layout, and verified zero console errors.

## Done
