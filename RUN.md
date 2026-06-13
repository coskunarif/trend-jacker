task: Increase user session duration and retention by gamifying chat limits with daily streaks and trivia rewards. | moves: Session duration and retention | why: Unlocking chat capacity is currently static and lacks engaging visual feedback loops | runner-up: Optimize search engine indexation and citation markup for demographic routes.              tier: T2   creativity: 0.3
state: complete              budget: repairs 1/3
branch: asf/20260613-streak-trivia          checkpoint: none
caps: agents,ui,web,human

## Log
- 2026-06-13: Conductor starting fresh run with T2 (Scout trigger). Starting Scout phase.
- 2026-06-13: Scout completed. Conductor starting Architect phase.
- 2026-06-13: Architect completed SPEC.md. Conductor starting Tester phase.
- 2026-06-13: Tester completed test suite. Observed state: red. Conductor starting Builder phase.
- 2026-06-13: Builder completed all slices. Observed state: green. Conductor starting Verifier phase.
- 2026-06-13: Verifier failed. Hypothesis: Daily streak logic in server.js and public/app.js is incorrectly gated by client ID containing 'streak', which bypasses it for real users. Routing to Builder.
- 2026-06-13: Conductor ruled in favor of Builder's dispute. Tests in tests/chat-limit-referral.spec.js violate AC-2. Routing to Tester to amend tests.
- 2026-06-13: Tester updated pre-existing tests. Routing back to Builder.
- 2026-06-13: Builder completed all slices. Observed state: green. Conductor starting Verifier phase.
- 2026-06-13: Verifier completed validation checks successfully. Conductor starting Shipper phase.

## Verdict
- **Linting**: skipped (no lint configuration or tooling in package.json)
- **Types**: skipped (no TypeScript or type verification tools configured)
- **Build**: pass (Fastify server starts successfully and hosts public directory assets without errors)
- **Full Test Suite**: pass (All 168 playwright tests run and pass successfully in the test run)
- **Behavioral (Dogfooding)**: pass (Daily streak updates and displays correctly for regular users on page load without gating check, and Trivia Challenge successfully unlocks allowed chat limit capacity with smooth transition and celebratory toast)
- **Visual**: pass (Responsive screenshots taken for mobile + desktop show correct styling, animations, and color coding. Screenshots saved under `dogfood-output/20260613-streak-trivia/screenshots/`).

## Done
### Summary of Shipped Work
Successfully gamified chat limit locks by implementing daily streaks and interactive trivia rewards to increase user session duration and retention. Included responsive progress bars, fire-based streak badges, clear retention CTAs, celebratory toast notifications, and seamless client-side transition animations.

### Acceptance Criteria & Verification Evidence
| AC | Requirement | Evidence / Verification Method |
|---|---|---|
| `[AC-1]` | SQLite/Firestore Streak Persistence | SQLite and Firestore streak helpers `updateClientStreak` and `getClientStreak` are implemented with robust lowercase/trim normalization and date diff calculation. Verified via `tests/daily-streaks-rewards.spec.js`. |
| `[AC-2]` | Backend API & Chat Capacity Formula | `/api/chat-limit` calculates allowance dynamically based on base (3) + 5 * referrals + trivia rewards + streak rewards (streakCount * 2). Verified via end-to-end Playwright tests. |
| `[AC-3]` | Chat Capacity Progress Bar UI | Renders `#chat-capacity-bar` dynamically with color transitions: green (<50%), orange (50%-80%), and red (>80%). Verified with `desktop-streak.png`. |
| `[AC-4]` | Dynamic Daily Streak UI Badge | Renders pulsing `#streak-badge-container` fire icon badge for active streaks. Verified with `desktop-streak.png` and `mobile-streak.png`. |
| `[AC-5]` | Lock Screen Streak Retention CTA | Shows retention message details in `#chat-lock-container` prompting return visits tomorrow to extend the streak. Verified with `desktop-locked.png`. |
| `[AC-6]` | Smooth Unlock Transition & Celebration Toast | Implemented `#chat-unlock-toast` and fade-in/fade-out transitions over 300ms. Verified via end-to-end testing and dogfood run. |

### PR & Deployment Links
- **PR Link**: https://github.com/coskunarif/trend-jacker/pull/33
- **Deployment URL**: https://trend-jacker-250134012801.us-central1.run.app
- **Integration Method**: Squashed and merged via local/remote sync (`git merge` / `gh pr merge`)

### Visual Walkthrough & Evidence
- **Desktop Locked Screen**:
  ![Desktop Locked Screen](dogfood-output/20260613-streak-trivia/screenshots/desktop-locked.png)
- **Desktop Active Streak & Capacity**:
  ![Desktop Streak](dogfood-output/20260613-streak-trivia/screenshots/desktop-streak.png)
- **Mobile Active Streak**:
  ![Mobile Streak](dogfood-output/20260613-streak-trivia/screenshots/mobile-streak.png)

## Disputes
- tests/chat-limit-referral.spec.js:146:3 - fails because it strictly asserts only three keys in `/api/chat-limit` payload, contradicting `[AC-2]` which adds `streakCount` and `streakBonus`.
- tests/chat-limit-referral.spec.js:229:3 - fails because it asserts chat lockout after 3 messages, contradicting `[AC-2]` where a new user's streak of 1 day raises the allowed limit to 5.
- tests/chat-limit-referral.spec.js:273:3 - fails because it asserts chat lockout after 3 messages, contradicting `[AC-2]` where a new user's streak of 1 day raises the allowed limit to 5.


