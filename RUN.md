task: still some images are not shown/broken regarding topic. and make sure we generate one image per topic, and cache it to avoid llm costs.              tier: T2   creativity: 0.3
state: verifier                 budget: repairs 1/3
branch: asf/20260613-cache-images          checkpoint: none
caps: agents,ui,web,human

## Log
- 2026-06-13: Conductor starting fresh run with T2. Starting Architect phase.
- 2026-06-13: Architect completed SPEC.md. Conductor starting Tester phase.
- 2026-06-13: Tester completed test suite adaptation. Observed state: red. Conductor starting Builder phase.
- 2026-06-13: Builder completed all slices. Observed state: green. Conductor starting Verifier phase.
- 2026-06-13: Verifier reported failing cache hit due to case-sensitive slug mismatch. Conductor ruled code wrong, reduced budget (repairs 1/3), decreased creativity to 0.3. Dispatching hypothesis to Builder: Normalize all topic-image cache trend lookup keys to lowercase in db.js and server.js.
- 2026-06-13: Builder completed repair. Observed state: green. Conductor starting Verifier phase.
## Verdict
### Check 1: Database Caching Schema & Helpers [AC-1] - PASS
- Table `topic_images` exists in SQLite with correct schema. Caching helpers are exported and function properly.

### Check 2: Dynamic SVG Image Generation Endpoint [AC-2] - FAIL
- **AC Broken**: AC-2 (Avoid redundant LLM generation costs by caching one image per topic).
- **Reproduction / Evidence**:
  1. A trend title is fetched as lowercase or mixed case (e.g., `ind vs afg`).
  2. The first request to `/api/topic-image/ind-vs-afg` hits while the trend is in `latestTrends`, caching it under `ind vs afg`.
  3. When `latestTrends` is later refreshed or cleared, a subsequent request to `/api/topic-image/ind-vs-afg` falls back to generating the title via slug splitting/capping: `Ind Vs Afg`.
  4. The SQLite SELECT queries `topic_images` with `trend = 'Ind Vs Afg'`. Because SQLite string lookup is case-sensitive, this queries a cache miss and calls Gemini again, incurring extra cost.
- **Suspected Cause**: Code. The cache keys in `db.js` and `server.js` are not normalized (e.g., using lowercase slugs as primary keys), allowing casing discrepancies to bypass the cache.

### Check 3: Client-Side Image Integration & Fallback [AC-3] - PASS
- Client-side code in `public/app.js` correctly falls back to `/api/topic-image/:slug` for both thumbnails and detail view hero image when the primary `ogImage` is absent or fails to load.

## Done
