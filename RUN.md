task: Achieve 100% E2E test pass rate. Metric: Test Suite Pass Rate. Why now: Baseline test suite is failing due to a race condition. Runner-up: Consolidate sharing UI to increase viral share conversion. tier: T2   creativity: 0.5
state: Verifier               budget: repairs 0/3
branch: asf/20260612-test-repair         checkpoint: none
caps: agents,ui,web,human

## Log
- 2026-06-12: Conductor starting Scout phase.
- 2026-06-12: Scout completed analysis. Chosen task: Achieve 100% E2E test pass rate (fix race condition).
- 2026-06-12: Conductor starting Architect phase.
- 2026-06-12: Architect completed SPEC.md.
- 2026-06-12: Conductor starting Tester phase.
- 2026-06-12: Tester completed test repair. Observed state: green.
- 2026-06-12: Conductor starting Verifier phase.
## Verdict
- **[AC-1] Prevent SQLite Locks in LLM Caching Tests**: PASS
- **[AC-2] Complete Parallel Pass Rate**: FAIL

### Failure Details:
- **AC Broken**: `[AC-2]`
- **Evidence**:
  ```
  1) [chromium] › tests/caching.spec.js:96:3 › Trend Explanation API Caching [AC-1] › should serve explanation from cache on subsequent API calls (verified via DB modification) 

    Error: database is locked

      119 |     };
      120 |     const updateStmt = db.prepare('UPDATE trend_explanations SET explanation = ? WHERE trend = ?');
    > 121 |     updateStmt.run(JSON.stringify(customExplanation), testTrend);
          |                ^
      122 |     db.close();
  ```
- **Suspected Cause**: The test `tests/caching.spec.js` (and potentially other test files) still maintains persistent SQLite connections (e.g., opened in `beforeAll` and only closed in `afterAll`), or performs un-isolated database operations while parallel test workers or the active webServer are running. These overlapping connection lifetimes cause "database is locked" errors during parallel execution (`--workers=4`).

## Done
