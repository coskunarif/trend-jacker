# Specification: Search Index Consolidation and Canonicalization

Improve search engine indexing coverage and rank by consolidating duplicate entries in the sitemap and indexing modules, and injecting canonical link tags and HTTP headers to prevent page authority division across host variants.

## Acceptance Criteria

### [AC-1] HTML Head Canonical Tags
- **Requirement**: The homepage `/` must render `<link rel="canonical" href="https://viraljacker.com/" />` (or the configured host variant from `process.env.APP_HOST`) in its HTML `<head>`.
- **Requirement**: The trend page `/t/:slug` must render `<link rel="canonical" href="https://viraljacker.com/t/:slug" />` (using lowercase slug) in its HTML `<head>`.
- **Requirement**: The localized trend page `/t/:slug/:lang` must render `<link rel="canonical" href="https://viraljacker.com/t/:slug/:lang" />` (using lowercase slug and lang) in its HTML `<head>`.
- **Verification**: Use Playwright to fetch `/`, `/t/google-gemini`, and `/t/google-gemini/es`, parse the HTML, and assert that the `<link rel="canonical">` tag is present in the `<head>` with the correct `href` values.

### [AC-2] HTTP Link Canonical Response Headers
- **Requirement**: GET requests to `/`, `/t/:slug`, and `/t/:slug/:lang` must return a response with a `Link` header containing `<canonicalUrl>; rel="canonical"`.
- **Requirement**: This canonical relation must coexist alongside other link relations, such as alternate links for `/llms.txt`.
- **Verification**: Send HTTP requests to `/`, `/t/google-gemini`, and `/t/google-gemini/es`, and assert that the response headers contain `Link` containing `rel="canonical"` pointing to the correct canonical URL.

### [AC-3] Path Casing Normalization & 301 Redirects
- **Requirement**: Accessing `/t/:slug` or `/t/:slug/:lang` with mixed-case parameters (e.g., `/t/Google-Gemini` or `/t/google-gemini/ES`) must trigger a 301 permanent redirect to the fully lowercased canonical route path.
- **Verification**: Send HTTP requests to `/t/Google-Gemini` and `/t/google-gemini/ES` and assert that the status is 301, and the `Location` header is `/t/google-gemini` and `/t/google-gemini/es` respectively.

### [AC-4] /index.html Redirect
- **Requirement**: Accessing `/index.html` directly must trigger a 301 permanent redirect to `/`.
- **Verification**: Send an HTTP request to `/index.html` and assert that the status is 301, and the `Location` header is `/`.

### [AC-5] Sitemap /sitemap.xml Deduplication
- **Requirement**: The generated `/sitemap.xml` must not contain any duplicate `<loc>` entries or duplicate localized alternate link definitions for the same trend slug, regardless of duplicates in cached trends.
- **Verification**: Retrieve `/sitemap.xml`, parse the XML structure, and assert that all `<loc>` elements are unique.

### [AC-6] IndexNow API Slugs and URL Deduplication
- **Requirement**: The `pingSearchEngines` function in `indexing.js` must normalize incoming slugs (lowercased, trimmed) and deduplicate the list before formatting URLs for the IndexNow payload.
- **Verification**: Unit test `pingSearchEngines` by passing duplicate, mixed-case, and whitespace-padded slugs (e.g., `['openai-gpt', ' OpenAI-GPT ', 'fastify']`) and assert that the returned `urls` array contains only unique, normalized URLs.

### [AC-7] /llms.txt and /llms-full.txt Deduplication
- **Requirement**: The `/llms.txt` and `/llms-full.txt` sitemap endpoints must display deduplicated trend lists.
- **Verification**: Fetch `/llms.txt` and `/llms-full.txt` and assert that each trend slug appears exactly once.

## Out of Scope
- Creating or editing client-side UI visual elements, sidebar views, or actual trend fetch schedules.
- Setting up external IndexNow API keys or configuring external production DNS/SSL.

## Slices

### [S-1] Casing & /index.html Permanent Redirects
- **Description**: Add a 301 redirect handler for `/index.html` to `/` in `server.js`. Update `handleTrendRequest` in `server.js` to normalize request path casing and return a 301 redirect if the requested slug or language is not fully lowercased.
- **ACs**: `[AC-3]`, `[AC-4]`
- **Files**: `server.js`
- **Dependency**: None (Independent)

### [S-2] Canonical Link Tags & Response Headers
- **Description**: Configure dynamic canonical hostname base in `server.js` using `process.env.APP_HOST`. Add canonical `<link>` tags to the rendered `<head>` templates and set HTTP response `Link` headers containing `rel="canonical"` for `/`, `/t/:slug`, and `/t/:slug/:lang`.
- **ACs**: `[AC-1]`, `[AC-2]`
- **Files**: `server.js`
- **Dependency**: None (Independent)

### [S-3] Sitemap, LLM Index, and IndexNow Deduplication
- **Description**: Refactor `/sitemap.xml`, `/llms.txt`, and `/llms-full.txt` routes to deduplicate latest trend slugs before rendering. Update `pingSearchEngines` in `indexing.js` to normalize and deduplicate input slugs and the constructed `urlList` before dispatching.
- **ACs**: `[AC-5]`, `[AC-6]`, `[AC-7]`
- **Files**: `server.js`, `indexing.js`
- **Dependency**: None (Independent)

## Test Strategy
- **Task Type**: Refinement
- **Strategy**: Refinement/Update/Snapshot tests. The Tester must write new/updated E2E tests for these criteria and run them before implementation. Slices represent implementation only.
