task: Prevent visual text overlapping and clipping on dynamically generated infographic sharing cards to increase social share rate. (Moves: Infographic share card download and sharing rate. Why now: Current implementation uses static vertical offsets for custom text and hooks which causes layout collision when text is long. Runner-up: Progressive Enhancement for Web Share API and Download Feedback.) tier: T2   creativity: 0.5
state: complete
branch: asf/20260612-canvas-overflow          checkpoint: asf/20260612-canvas-overflow/green-1
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
- 2026-06-12: Shipper completed final tagging, verification, PR creation, and integration.

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

### Summary of Shipped Work
We successfully resolved visual text overlapping and clipping on dynamically generated infographic and standard sharing cards. By enhancing the text wrapping utility with a `dryRun` execution option, the canvas generators dynamically measure text blocks and calculate coordinate offsets. Spacing updates dynamically based on subtitle wraps (+65px spacing), and the background hook box scales dynamically. A boundary-fitting loop reduces the hook text's font size (from 18px down to 12px) and line-height if the layout exceeds y=540. If the text still exceeds limits at the minimum font size, the box height is constrained, preventing overlap with the footer.

### Acceptance Criteria & Verification Evidence

| Acceptance Criterion | Verification Evidence / Pass State |
|----------------------|------------------------------------|
| **[AC-1] Dynamic Subtitle & Header Positioning** | Passed. Telemetry checks confirm "THE AI HOOK" header shifts dynamically to subtitle bottom plus 65px (defaults to 275px). |
| **[AC-2] Enhanced wrapText Helper** | Passed. Supports `dryRun: true` and calculates wrapped layout height without executing `ctx.fillText`. |
| **[AC-3] Dynamic Hook Box Sizing** | Passed. Canvas roundRect hook box height dynamically matches `(lastHookTextY - hookTextStartY) + 80`, min 120px. |
| **[AC-4] Footer Boundary Constraint** | Passed. Limits layout to y=540 using recursive scale reduction on font sizes (18px -> 12px) and line heights (28px -> 19px). |
| **[AC-5] Standard Share Card Dynamic Sizing** | Passed. Sizes hook box, shifts community sentiment and poll down, and applies scale loop to fit under y=540. |
| **[AC-6] Global Layout Telemetry** | Passed. Card generators populate layout data on `window.__canvasLayouts.infographic` and `window.__canvasLayouts.trendCard`. |
| **[AC-7] E2E Layout & Overlay Validation** | Passed. Checked three distinct scenarios: no subtitle, 1-line subtitle, and multi-line subtitle with long hook text. All 114 tests passed. |

### Pull Request & Integration Details
- **Pull Request Link**: [PR #23](https://github.com/coskunarif/trend-jacker/pull/23)
- **Integration Method**: `gh pr merge --merge` to merge the branch `asf/20260612-canvas-overflow` into `main`.
- **Production URL**: Local production server.
