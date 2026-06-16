task: Consolidate search authority and eliminate duplicate listings | moves Google Search Console indexation | split GSC impressions across HTTP/HTTPS/WWW dilute ranking | runner-up: Structure content for AI search engine citations
state: complete                 budget: repairs 0/3
branch: asf/20260616-consolidate-authority          checkpoint: none
caps: agents,ui,web,human

## Log
- 2026-06-16: Conductor starting fresh. Invoking Scout to investigate Google Search Console statistics for viraljacker.com and identify SEO/GEO candidate tasks.
- 2026-06-16: Scout completed. Selected "Consolidate search authority and eliminate duplicate listings" as winner. Conductor starting Architect phase.
- 2026-06-16: Architect completed SPEC.md. Conductor starting Tester phase.
- 2026-06-16: Tester completed. Observed state: red. Conductor starting Builder phase.
- 2026-06-16: Builder completed. Implemented independent slices [S-1] and [S-2] in parallel. All tests passed.
- 2026-06-16: Conductor starting Verifier phase.
- 2026-06-16: Verifier completed. Conductor starting Shipper phase.

## Verdict
- [AC-1] Protocol Redirect (HTTP to HTTPS): PASS
  - Verified that HTTP requests to `/` or `/t/google-gemini` redirect permanently (301) to the HTTPS counterparts.
- [AC-2] Hostname Redirect (WWW to non-WWW): PASS
  - Verified that requests with Host `www.viraljacker.com` redirect permanently (301) to `https://viraljacker.com/`.
- [AC-3] Combined Redirect: PASS
  - Verified that HTTP + WWW requests correctly redirect permanently (301) to canonical `https://viraljacker.com/` preserving path and query.
- [AC-4] Local Development Bypass: PASS
  - Verified that requests with `localhost` or `127.0.0.1` in the Host header bypass the redirect logic (returning 200 OK) for local development and E2E testing.
- [AC-5] Google Sitemap Ping Removal: PASS
  - Checked `indexing.js` static structure and verified no references to `google.com/ping` exist, and that calls to `pingSearchEngines` do not ping Google or log Google sitemap pings.
- **Dogfooding & E2E Suite**: PASS
  - All 277 Playwright E2E and unit tests passed cleanly. Automated dogfooding verification with `agent-browser` confirmed localhost bypasses redirects successfully. Dogfood report compiled and saved to `dogfood-output/20260616-consolidate-authority/report.md`.

## Done
### Shipped Features
Implemented application-level SEO canonicalization redirects (HTTP to HTTPS, WWW to non-WWW) with query/path preservation and local development/testing bypass, and removed deprecated Google sitemap ping code blocks.

### Acceptance Criteria & Verification Evidence

| Acceptance Criteria (AC) | Verification Method | Evidence (Relative Link / Result) |
|---|---|---|
| `[AC-1]` Protocol Redirect (HTTP to HTTPS) | Request header validation testing that HTTP protocol triggers a 301 redirect to the HTTPS equivalent. | [tests/seo-canonical-redirects.spec.js#L17-L43](file:///home/ubuntuadmin/projects/trend-jacker/tests/seo-canonical-redirects.spec.js#L17-L43) |
| `[AC-2]` Hostname Redirect (WWW to non-WWW) | Request header validation testing that requests to `www.viraljacker.com` trigger a 301 redirect to `viraljacker.com`. | [tests/seo-canonical-redirects.spec.js#L50-L74](file:///home/ubuntuadmin/projects/trend-jacker/tests/seo-canonical-redirects.spec.js#L50-L74) |
| `[AC-3]` Combined Redirect with Path/Query | Validation that combining protocol and hostname redirects correctly redirects to canonical URL while preserving path and query. | [tests/seo-canonical-redirects.spec.js#L81-L91](file:///home/ubuntuadmin/projects/trend-jacker/tests/seo-canonical-redirects.spec.js#L81-L91) |
| `[AC-4]` Local Development Bypass | Request validation checking that `localhost` and `127.0.0.1` bypass redirects for local testing and E2E suites. | [tests/seo-canonical-redirects.spec.js#L97-L126](file:///home/ubuntuadmin/projects/trend-jacker/tests/seo-canonical-redirects.spec.js#L97-L126) |
| `[AC-5]` Google Sitemap Ping Removal | Static and child process mock invocation check verifying that `indexing.js` contains no Google sitemap ping reference or request/logs, keeping IndexNow intact. | [tests/seo-canonical-redirects.spec.js#L132-L283](file:///home/ubuntuadmin/projects/trend-jacker/tests/seo-canonical-redirects.spec.js#L132-L283) |

### Pull Request & Integration Details
- **Pull Request**: [coskunarif/trend-jacker/pull/52](https://github.com/coskunarif/trend-jacker/pull/52)
- **Integration Method**: Standard Merge (via `gh pr merge --merge`)
- **Deployment Pipeline**: GitHub Actions deploy run triggered by merge on `main` branch.
- **Visual Evidence**:
  - Desktop Viewport: ![Desktop Layout](dogfood-output/20260616-consolidate-authority/screenshots/desktop_layout.png)
  - Mobile Viewport: ![Mobile Layout](dogfood-output/20260616-consolidate-authority/screenshots/mobile_layout.png)
