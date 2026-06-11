# SPEC.md - Dynamic SEO/GEO Optimization (`/llms.txt`, `/llms-full.txt`, `/robots.txt`)

This specification outlines the implementation of dynamic `/llms.txt`, `/llms-full.txt`, `/t/:slug.md`, and `/robots.txt` endpoints to optimize TrendJacker for AI engine ingestion, citations (GEO), and crawl visibility.

## Test Strategy (Additive)
Since this task introduces new routes, we follow a **tests-first** strategy. All test cases verifying correct status codes, Content-Type, and dynamic Markdown rendering structure must be written in the test suite before the server routes are fully implemented.

---

## Acceptance Criteria

### `[AC-1]` - Dynamic robots.txt
- **Description**: The `/robots.txt` endpoint must return standard crawl instructions in plaintext format.
- **Verification**: Sending a GET request to `/robots.txt` returns `HTTP 200` with header `Content-Type: text/plain` (optionally with charset) and contains:
  ```text
  User-agent: *
  Allow: /
  Sitemap: https://viraljacker.com/sitemap.xml
  ```

### `[AC-2]` - Dynamic llms.txt
- **Description**: The `/llms.txt` endpoint must return an LLM-friendly Markdown site map of all trending topics.
- **Verification**: Sending a GET request to `/llms.txt` returns `HTTP 200` with `Content-Type: text/plain` and renders the following Markdown structure dynamically using `latestTrends`:
  - A main `# TrendJacker` title.
  - A blockquote brief description of the site.
  - A list of links under `## Trends` pointing to dynamic Markdown representations `/t/:slug.md` with descriptions.

### `[AC-3]` - Dynamic llms-full.txt
- **Description**: The `/llms-full.txt` endpoint compiles the full content of all trending topics into a single document for single-request ingestion.
- **Verification**: Sending a GET request to `/llms-full.txt` returns `HTTP 200` with `Content-Type: text/plain`. The response contains all trend headers, snippets, explanations, and takeaways dynamically rendered in Markdown.

### `[AC-4]` - Individual Markdown Trend Explainer `/t/:slug.md`
- **Description**: The `/t/:slug.md` endpoint serves the raw Markdown explainer page for a single trend matching the given slug.
- **Verification**: Sending a GET request to `/t/:slug.md` returns `HTTP 200` with `Content-Type: text/plain` and provides details including the trend title, hook, detailed explanation, why it is viral, and dynamic polling statistics in Markdown.

### `[AC-5]` - Auto-Discovery Meta Link Tag
- **Description**: The homepage (`/`) and trend pages (`/t/:slug`) must inject a `<link>` alternate tag pointing to `/llms.txt` so AI agents can discover the endpoint.
- **Verification**: Fetching `/` or `/t/:slug` and parsing the HTML head confirms the presence of `<link rel="alternate" type="text/markdown" href="/llms.txt">`.

### `[AC-6]` - E2E Integration Tests
- **Description**: Playwright tests cover request validation, content type checks, and dynamic caching behavior for the new routes.
- **Verification**: Running `npm test` executes the newly added tests, confirming they pass successfully.

---

## Out of Scope
- Implementing the Scout's runner-up task (enhancing NewsArticle JSON-LD schema with Breadcrumbs and dynamic FAQs).
- Creating CSS stylesheets or visual HTML pages for `/llms.txt` or `/robots.txt`.

---

## Slices

### `[S-1]` - Test Suite Setup and Route Skeleton
- **Goal**: Write tests first (tests-first strategy) for all new endpoints. Expose basic Fastify mock route definitions that return placeholder text.
- **Verification**: Run tests (some might fail or pass depending on placeholder structure).
- **Files**:
  - `server.js` (route skeleton)
  - `tests/seo-visibility.spec.js` (new test suite)
- **ACs**: `[AC-1]`, `[AC-2]`, `[AC-3]`, `[AC-4]`, `[AC-6]`
- **Status**: Ready for Tester / Builder

### `[S-2]` - Dynamic Markdown Logic and Link Injection
- **Goal**: Build dynamic generators for `/llms.txt`, `/llms-full.txt`, and `/t/:slug.md` extracting data from the existing `latestTrends` cache. Inject the discoverability alternate link tag in the HTML header builder of `server.js`.
- **Verification**: Run the full Playwright suite; endpoints render exact live/cached trends.
- **Files**:
  - `server.js`
- **ACs**: `[AC-2]`, `[AC-3]`, `[AC-4]`, `[AC-5]`, `[AC-6]`
- **Status**: Dependent on `[S-1]`
