task: Implement dynamic /llms.txt, /llms-full.txt, and /robots.txt endpoints to optimize for AI engine citations (GEO) and crawl search indexability. Runner-up: Enhance NewsArticle JSON-LD schema with Breadcrumbs and dynamic FAQs. tier: T2   creativity: 0.5
state: complete                budget: repairs 0/3
branch: asf/20260611-seo-visibility          checkpoint: asf/20260611-seo-visibility/green-1
caps: agents,ui,web,human

## Log
- 2026-06-11: Conductor initialized fresh run. Scout phase started.
- 2026-06-11: Scout reported selected task. Branch asf/20260611-seo-visibility created. Conductor initialized Architect phase.
- 2026-06-11: Architect completed SPEC.md. Conductor initialized Tester phase.
- 2026-06-11: Tester wrote 6 tests in tests/seo-visibility.spec.js. Observed state: red. Conductor initialized Builder phase.
- 2026-06-11: Builder implemented the routes and tags. All 56 tests passed. Conductor initialized Verifier phase.
- 2026-06-11: Verifier verified PASS. Tagged verified commit with asf/20260611-seo-visibility/green-1. Conductor initialized Shipper phase.
## Verdict
- **[AC-1] Dynamic robots.txt**: PASS. Verified HTTP 200, Content-Type: `text/plain`, and the presence of `User-agent: *`, `Allow: /`, and `Sitemap: https://viraljacker.com/sitemap.xml`.
- **[AC-2] Dynamic llms.txt**: PASS. Verified HTTP 200, Content-Type: `text/plain`, and the correct Markdown format containing the `# TrendJacker` title, brief description blockquote, and list of links under `## Trends`.
- **[AC-3] Dynamic llms-full.txt**: PASS. Verified HTTP 200, Content-Type: `text/plain`, and the presence of compilation headers, snippets, explanations, and takeaways for cached trends.
- **[AC-4] Individual Markdown Trend Explainer (/t/:slug.md)**: PASS. Verified HTTP 200, Content-Type: `text/plain`, correct Markdown fields (Title, Hook, Explanation, Why it is viral, Takeaway, Poll Statistics), and returning 404 on invalid slugs.
- **[AC-5] Auto-Discovery Meta Link Tag**: PASS. Verified that `<link rel="alternate" type="text/markdown" href="/llms.txt">` is injected in the `<head>` of `/` and `/t/:slug`.
- **[AC-6] E2E Integration Tests**: PASS. Verified that `npm test` runs all 56 tests successfully.

## Done
### Shipped Features
- Dynamic `/robots.txt` for crawl search indexability.
- Dynamic `/llms.txt` and `/llms-full.txt` sitemaps for AI scrapers/agents.
- Dynamic individual trend Markdown explainer endpoints under `/t/:slug.md`.
- HTML Alternate link tags injection into the document heads of homepage and trend details pages for discovery.
- Comprehensive Playwright tests validating response content types, status codes, and structural elements.

### Verification Evidence
| Acceptance Criterion | Verification Method | Result |
| --- | --- | --- |
| `[AC-1]` Dynamic robots.txt | HTTP GET Request Content-Type & Content Check | **PASS** |
| `[AC-2]` Dynamic llms.txt | HTTP GET Request Content-Type & Markdown Structure Check | **PASS** |
| `[AC-3]` Dynamic llms-full.txt | HTTP GET Request Content-Type & Compiled Markdown Content Check | **PASS** |
| `[AC-4]` Trend Explainer /t/:slug.md | HTTP GET Request Content-Type & Explainer Markdown Fields Check | **PASS** |
| `[AC-5] ` Discovery Meta Tag | HTML Parser Verification of `<link rel="alternate">` | **PASS** |
| `[AC-6]` E2E Integration | Full Playwright Test Run (`npm test`) | **PASS** (56/56 passed) |

### Integration
- Merged locally into the default branch `main`.
