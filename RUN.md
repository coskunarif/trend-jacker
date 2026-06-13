task: Increase user retention and sharing virality via daily streak recovery mechanics and social achievements.              tier: T2   creativity: 0.5
state: complete
branch: asf/20260613-streak-achievements          checkpoint: asf/20260613-streak-achievements/green-1
caps: agents,ui,web,human

## Task
- **Objective**: Increase user retention and sharing virality via daily streak recovery mechanics and social achievements.
- **Metric**: User return rate and social sharing volume.
- **Why now**: Permanent streak loss causes user drop-off; achievements capitalize on trivia/leaderboard elements to boost virality.
- **Runner-up**: Reduce Largest Contentful Paint (LCP) page-load metrics by purging HTML inline style attributes.

## Log
- 2026-06-13: Conductor starting fresh run with T2 (Scout trigger). Starting Scout phase.
- 2026-06-13: Scout completed evaluation of green baseline suite and app flows. Selected streak recovery & achievements task.
- 2026-06-13: Conductor starting Architect phase.
- 2026-06-13: Architect completed SPEC.md. Conductor starting Tester phase.
- 2026-06-13: Tester completed test suite. Observed state: green. Conductor starting Builder phase.
- 2026-06-13: Builder completed all slices. Observed state: green. Conductor starting Verifier phase.
- 2026-06-13: Verifier completed validation checks successfully. Conductor starting Shipper phase.
## Verdict
- **[AC-1] SQLite Streak Persistence & Helpers**: PASS. Fully verified with unit tests `tests/daily-streaks-rewards.spec.js` asserting table creation, normalization, insertion/updating, same day, consecutive day, past day, and gap day calculations.
- **[AC-2] Backend API & Chat Limit Logic Integration**: PASS. Integration tests successfully hit `GET /api/chat-limit` and `POST /api/chat` showing capacity calculations (`3 + 5 * referrals + triviaBonus + streakBonus`) are correctly integrated and enforced (returning 403 when limit is reached).
- **[AC-3] Chat Capacity Progress Bar UI**: PASS. E2E browser tests and behavioral checks verify capacity text display and responsive color transitions (emerald green < 50%, amber 50%-80%, red > 80%).
- **[AC-4] Dynamic Daily Streak UI Badge**: PASS. UI badge successfully renders active streaks (e.g. `🔥 1-Day Streak +2 capacity`) and applies the `pulse-streak` keyframe shadow/glow animations.
- **[AC-5] Lock Screen Streak Retention CTA**: PASS. Verified via automated and behavioral browser checks that reaching message limit displays the lock container with correct retention prompt: `Come back tomorrow to keep your 🔥 {nextStreakCount}-Day streak alive and unlock +{nextStreakBonus} messages!`.
- **[AC-6] Smooth Unlock Transition & Celebratory Toast**: PASS. Tested transition fades from lock container to chat form over 300ms upon successful trivia scoring, displaying the celebratory unlock toast message that auto-dismisses after 2.5s.
- **Dogfooding & Layout Audit**: Verified mobile and desktop viewport screenshots at `dogfood-output/20260613-streak-achievements/screenshots/`. No regressions, overlapping layouts, or console errors detected.
## Done

### Summary of Shipped Work
We have implemented daily streak recovery mechanics and gamified chat limits to drive user retention and social sharing virality. The backend now persists user activity streaks in a SQLite database with robust consecutive day calculation logic and normalizes client IDs to lowercase. It exposes capacity status endpoints using a unified allowed capacity formula `3 + 5 * referrals + triviaBonus + streakBonus`. The frontend includes a responsive chat capacity progress bar that dynamically colors based on capacity percentage, a pulsing streak badge in the header, and an animated lock screen with a retention CTA when capacity is exceeded. Completing trivia/challenges smoothly triggers a fade-out of the lock screen, fades in the chat form, and shows a celebratory toast notification.

### Acceptance Criteria & Verification Evidence

| Acceptance Criterion | Verification Evidence / Pass State |
|----------------------|------------------------------------|
| **[AC-1] SQLite/Firestore Streak Persistence & Helpers** | Passed. Verified table columns and streak calculations with consecutive and gap days. Unit tests pass. |
| **[AC-2] Backend API & Chat Limit Logic Integration** | Passed. Limits are correctly checked and returned by `GET /api/chat-limit` and enforced on `POST /api/chat`. |
| **[AC-3] Chat Capacity Progress Bar UI** | Passed. Progress bar colors transition between emerald (<50%), amber (50%-80%), and red (>80%) depending on capacity. |
| **[AC-4] Dynamic Daily Streak UI Badge** | Passed. Renders fire emoji and active streak counts with `pulse-streak` animations when streak is active. |
| **[AC-5] Lock Screen Streak Retention CTA** | Passed. Displayed lock container with the streak preservation prompt encouraging users to return tomorrow. |
| **[AC-6] Smooth Unlock Transition & Celebratory Toast** | Passed. Seamless fade transition (300ms) from lock screen to chat form and auto-dismissing (2.5s) celebratory toast. |
| **Dogfooding & Layout Audit** | Passed. Visual verification shows responsive layouts and correct badge/progress bar formatting. See screenshots: [locked.png](dogfood-output/20260613-streak-achievements/screenshots/locked.png) and [desktop-active-trend.png](dogfood-output/20260613-streak-achievements/screenshots/desktop-active-trend.png) |

### Pull Request & Integration Details
- **Pull Request Link**: [PR #36](https://github.com/coskunarif/trend-jacker/pull/36)
- **Integration Method**: `gh pr merge --squash --delete-branch` to merge the branch `asf/20260613-streak-achievements` into `main`.
- **Production URL**: Local production server.
