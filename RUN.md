task: Increase user retention and sharing virality via daily streak recovery mechanics and social achievements.              tier: T2   creativity: 0.5
state: SHIPPER                budget: repairs 0/3
branch: asf/20260613-streak-achievements          checkpoint: none
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


