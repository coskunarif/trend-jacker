task: Consolidate duplicate search index entries and inject canonical path attributes to improve search engine indexing coverage. Metric: Organic search indexing and rank. Why now: Google divides page authority between host variants without canonical headers, blocking first-page rankings. Runner-up: Gamify trend predictions with real-world RSS continuation checks and return streak capacity rewards to boost user retention.              tier: T2   creativity: 0.5
state: complete               budget: repairs 0/3
branch: asf/20260614-search-index          checkpoint: none
caps: agents,ui,web,human

## Log
- 2026-06-14: Scout completed. Conductor starting Architect phase.
- 2026-06-14: Architect completed SPEC.md. Conductor starting Tester phase.
- 2026-06-14: Tester completed. Observed state: red. Conductor starting Builder phase.
- 2026-06-14: Builder completed. Conductor starting Verifier phase.
- 2026-06-14: Verifier started dev server on port 3002 (task-67)
- 2026-06-14: Verifier completed. Conductor starting Shipper phase.
- 2026-06-14: Shipper completed run verification, tagged green, opened and merged PR.

## Verdict
- [AC-1] HTML Head Canonical Tags: PASS
- [AC-2] HTTP Link Canonical Response Headers: PASS
- [AC-3] Path Casing Normalization & 301 Redirects: PASS
- [AC-4] /index.html Redirect: PASS
- [AC-5] Sitemap /sitemap.xml Deduplication: PASS
- [AC-6] IndexNow API Slugs and URL Deduplication: PASS
- [AC-7] /llms.txt and /llms-full.txt Deduplication: PASS

All 260 unit and E2E tests passed successfully. Visual checks confirm excellent responsive behavior on desktop and mobile layout viewports with no regressions or overflows.

## Done

### What Shipped
We consolidated duplicate search index entries across the sitemap, IndexNow submissions, and LLM text indices. We also implemented canonical path attributes using HTML `<link rel="canonical">` tags and HTTP `Link` headers, normalized URL casing with 301 redirects, and redirected direct `/index.html` requests to the homepage to maximize search engine indexing coverage.

### Acceptance Criteria vs Evidence
| Acceptance Criterion | Requirement | Verification Method / Evidence | Status |
|---|---|---|---|
| **[AC-1] HTML Head Canonical Tags** | Render `<link rel="canonical">` on `/`, `/t/:slug`, `/t/:slug/:lang`. | Playwright assertions confirm the correct lowercased link tags are injected in `<head>` templates. | PASS |
| **[AC-2] HTTP Link Canonical Response Headers** | Return a `Link` header with `rel="canonical"`. | Asserts HTTP response headers contain matching canonical values, coexisting with alternate link relations. | PASS |
| **[AC-3] Path Casing Normalization & 301 Redirects** | Mixed-case URLs trigger 301 redirects to lowercased canonical paths. | Request tests return 301 redirect status and correct target `Location` headers. | PASS |
| **[AC-4] /index.html Redirect** | Accessing `/index.html` directly triggers 301 to `/`. | Verifies HTTP GET to `/index.html` triggers 301 redirect to `/`. | PASS |
| **[AC-5] Sitemap /sitemap.xml Deduplication** | `/sitemap.xml` has unique `<loc>` entries and alternate links. | XML parser validates that all location links are unique and have no duplicates. | PASS |
| **[AC-6] IndexNow API Slugs and URL Deduplication** | Normalize and deduplicate slug payload for IndexNow. | Unit tests on `pingSearchEngines` verify that duplicates and casing variations are normalized. | PASS |
| **[AC-7] /llms.txt and /llms-full.txt Deduplication** | Display deduplicated trend lists. | Fetches `/llms.txt` and `/llms-full.txt` and checks for unique occurrences of each trend. | PASS |

### Integration Details
- **Pull Request**: [PR #50](https://github.com/coskunarif/trend-jacker/pull/50)
- **Integration Method**: Squashed and merged via GitHub PR merge.
- **Release Tag**: `asf/20260614-search-index/green-1`



