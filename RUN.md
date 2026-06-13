task: still some images are not shown/broken regarding topic. and make sure we generate one image per topic, and cache it to avoid llm costs.              tier: T2   creativity: 0.18
state: tester                   budget: repairs 2/3
branch: asf/20260613-cache-images          checkpoint: none
caps: agents,ui,web,human

## Log
- 2026-06-13: Conductor starting fresh run with T2. Starting Architect phase.
- 2026-06-13: Architect completed SPEC.md. Conductor starting Tester phase.
- 2026-06-13: Tester completed test suite adaptation. Observed state: red. Conductor starting Builder phase.
- 2026-06-13: Builder completed all slices. Observed state: green. Conductor starting Verifier phase.
- 2026-06-13: Verifier reported failing cache hit due to case-sensitive slug mismatch. Conductor ruled code wrong, reduced budget (repairs 1/3), decreased creativity to 0.3. Dispatching hypothesis to Builder: Normalize all topic-image cache trend lookup keys to lowercase in db.js and server.js.
- 2026-06-13: Builder completed repair. Observed state: green. Conductor starting Verifier phase.
- 2026-06-13: Verifier reported failing welcome-view test. Conductor ruled test wrong, reduced budget (repairs 2/3), decreased creativity to 0.18. Dispatching hypothesis to Tester: Mock/remove preloaded-trend-data block in tests/dashboard-redesign.spec.js using addInitScript to prevent hydration from hiding welcome-view.
## Verdict
### Check 1: Database Caching Schema & Helpers [AC-1] - PASS
- Table `topic_images` exists in SQLite with correct COLLATE NOCASE schema. Caching helpers in `db.js` successfully normalize lookup keys to lowercase and function properly.

### Check 2: Dynamic SVG Image Generation Endpoint [AC-2] - PASS
- The endpoint `/api/topic-image/:slug` resolves correctly, serves topic-themed SVGs with the `image/svg+xml` Content-Type, and uses casing-normalized lookup to prevent redundant LLM costs.

### Check 3: Client-Side Image Integration & Fallback [AC-3] - PASS
- Client-side code in `public/app.js` correctly falls back to `/api/topic-image/:slug` for both thumbnails and detail view hero image when the primary `ogImage` is absent or fails to load.

### Check 4: Full Test Suite Execution - FAIL
- **Failure**: Playwright test `tests/dashboard-redesign.spec.js:187:3 › Dashboard Redesign Verification › should verify welcome view is modern and styled with glassmorphism` fails.
- **Evidence**:
  ```
  Error: expect(locator).toBeVisible() failed
  Locator:  locator('#welcome-view')
  Expected: visible
  Received: hidden
  ```
- **Suspected Cause**: Test setup bug. The test intercepts `/api/trends` with an empty array `[]` expecting the welcome screen to remain visible. However, the server renders the home page with a preloaded-trend-data block (`Google Gemini` by default). The client-side hydration logic in `public/app.js` unshifts this preloaded trend into the list, selects it, and automatically hides `#welcome-view`. The test must mock or remove this preloaded data script (using `addInitScript` similar to `tests/e2e.spec.js`) to prevent hydration.

## Done
