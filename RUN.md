task: Optimize search query alignment and URL readability to increase search impressions and CTR. Why now: GSC shows 122 impressions and 0 clicks due to truncated/broken trend URLs mid-word. Runner-up: Consolidate domain authority and eliminate duplicate content indexing to increase keyword rankings.  tier: T2   creativity: 0.3
state: complete             budget: repairs 1/3
branch: asf/20260620-url-readability          checkpoint: asf/20260620-url-readability/green-1
caps: ui,web,human

## Log
- 2026-06-19: Conductor starting fresh. Leftover SPEC.md deleted. State set to SCOUT.
- 2026-06-20: Scout completed. Output path: /home/ubuntuadmin/.gemini/antigravity-cli/brain/ed6d79c2-9207-4ac7-8d1e-fab245b1ce1b/search_console_analysis.md. Elapsed time: 8 minutes. State set to ARCHITECT.
- 2026-06-20: Architect completed. Output path: SPEC.md. Elapsed time: 10 minutes. State set to TESTER.
- 2026-06-20: Tester completed. Output path: tests/url-readability.spec.js. Observed state: red. Elapsed time: 6 minutes. State set to BUILD.
- 2026-06-20: Builder completed. Slices S-1 and S-2 implemented, tests passed. Elapsed time: 12 minutes. State set to VERIFIER.
- 2026-06-20: Verifier completed. Output path: RUN.md. Verdict: FAIL (AC-5 failed due to SQLite explanation JSON mismatch).
- 2026-06-20: Builder repair dispatched. Hypothesis: The builder injected the 'trend' key into the data payload before saving, corrupting explanation JSON serialization in db.js. The trend should be kept outside the explanation payload in SQLite/Firestore. Creativity x0.6 applied. State set to BUILD.
- 2026-06-20: Builder completed. Repair hypothesis implemented, tests passed. Elapsed time: 31 minutes. State set to VERIFIER.
- 2026-06-20: Verifier completed. Output path: RUN.md. Observed state: green. Elapsed time: 11 minutes. State set to SHIP.

## Verdict
- **[AC-1] Eliminate Hard-coded Character Truncation on Reddit Trend Titles**: PASS. Verified that the 60-character truncation is removed from parser logic.
- **[AC-2] Full & Search-friendly Slug Generation for Trend URLs**: PASS. Verified that slugs are generated with normalization, diacritics removal, 100-character boundary truncation, and Japanese/non-alphanumeric hash fallbacks.
- **[AC-3] Dynamic Sitemap and Indexing API Synchronization**: PASS. Verified `/sitemap.xml` generates untruncated slugs, and the indexing pings target all 4 localized variants using the untruncated slug.
- **[AC-4] UI Layout and Responsive Presentation of Long Titles**: PASS. CSS word-wrap and overflow-wrap styles prevent layout issues and horizontal scrolls at both mobile (375px) and desktop (1280px) widths.
- **[AC-5] Firestore Document ID Hashing/Subcollection Path Collision Avoidance**: PASS. Hashing of Firestore document IDs is verified and functional. The Builder's fix successfully keeps the `trend` metadata outside the SQLite `explanation` JSON structure, avoiding unit test failures, while retaining correctness in mapping.
- **[AC-6] Persistent Search Engine Indexing Pings**: PASS. Persistent stores in SQLite/Firestore are correctly updated and checked before pinging to prevent duplicates.
- **[AC-7] Strict 404 for Arbitrary/Fake Slugs**: PASS. Verified that non-existent slugs return a strict 404 status.

- **[KPI-1] Feed Ingestion Latency**: PASS (measured locally at 15.31ms, well below the 500ms threshold).
- **[KPI-2] Pre-Rendered Page Load Latency**: PASS (measured locally at 7.42ms average response time, well below the 50ms threshold).

## Done

### What Shipped
1. **Reddit Ingestion**: Removed the hardcoded 60-character title truncation from the Reddit RSS feed parser, enabling full thread titles to be ingested and indexed.
2. **Robust Slug Generation**: Replaced simple title-to-slug mapping with accent normalization, word-boundary truncation (at 100 characters max), and base36 SHA-256 hash fallback for non-alphanumeric titles (such as Japanese).
3. **Sitemap & Indexing**: Configured sitemap to output untruncated slugs and updated search engine index pinging logic to ping search engines for all 4 localized URL variants using the search-friendly slug.
4. **Layout Wraps**: Added CSS wrap styles (`word-wrap: break-word` and `overflow-wrap: break-word`) to title components, preventing UI clipping and layout overflows.
5. **Firestore Hashing**: Hashed Firestore document IDs via SHA-256, avoiding forward slash path collisions, while preserving raw trend names in the document metadata.
6. **Ping Deduplication**: Persisted ping status in `pinged_slugs` tables/collections to avoid quota exhaustion on server restarts.
7. **Strict 404 Route Gate**: Prevented arbitrary/fake slug exploitation by restricting dynamic explanation generation to valid live/historical cache trends.

### Acceptance Criteria & Verification Evidence
| Criterion | Description | Evidence / Verification Method |
| :--- | :--- | :--- |
| **[AC-1]** Reddit Ingestion | Full Reddit titles stored without 60-character truncation | Playwright unit and integration tests successfully verified long Reddit trends storage. |
| **[AC-2]** Search-Friendly Slugs | Transliteration, max 100-char length truncation at word boundaries, non-alphanumeric hash fallbacks | Tested `titleToSlug` behavior on long sentences, Japanese unicode strings, and verified 200 details view responses. |
| **[AC-3]** Indexing Sync | Sitemap uses untruncated slugs; Indexing API pings all 4 localized routes | Verified sitemap XML response structure and search engine ping trigger logs. |
| **[AC-4]** UI Presentation | Clean layout wraps without overflow or horizontal scroll at 375px/1280px width | Viewport audits passed for both mobile and desktop viewports without scroll leaks. |
| **[AC-5]** Firestore ID Hashing | SHA-256 Firestore document ID hashing to prevent subcollection path collision | Verified document creation and correct deserialization of trend metadata. |
| **[AC-6]** Persistent Pings | Persistent cache storage to prevent duplicate indexing pings | Verified IndexNow/Google Indexing API deduplication after multiple cache updates. |
| **[AC-7]** Strict 404 Route | Non-existent slugs return 404 status immediately | Verified GET `/t/fake-unseen-trend-slug` returns status 404. |

### Integration Details
- **PR Link**: https://github.com/coskunarif/trend-jacker/pull/58
- **Integration Method**: `gh pr merge --squash --delete-branch`

### Visual Screenshots
![Desktop Layout](dogfood-output/20260620-url-readability/screenshots/main_page.png)
![Mobile Layout](dogfood-output/20260620-url-readability/screenshots/mobile_main_page.png)
