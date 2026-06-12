# Specification — Search Authority & Generative Engine Optimization (GEO)

This specification defines the requirements for improving search engine authority and AI search engine citation rates (Generative engine citation rate) for TrendJacker.

---

## 🎯 Acceptance Criteria

### [AC-1] Enriched Schema.org JSON-LD Structured Data
- **Description**: The server-side generated JSON-LD structured data block on the homepage `/` and trend detail pages `/t/:slug` (and localized routes `/t/:slug/:lang`) must be enriched with metadata that enhances authority and search/AI crawlers' citation confidence.
- **JSON-LD Schema Requirements**:
  - Keep the base `@type` as `"NewsArticle"`.
  - Add `mainEntityOfPage` pointing to the canonical URL of the page (e.g. `https://viraljacker.com/t/${slug}` or the localized route, and `https://viraljacker.com/` for homepage).
  - Add `publisher` block representing the hosting organization:
    ```json
    "publisher": {
      "@type": "Organization",
      "name": "TrendJacker",
      "url": "https://viraljacker.com",
      "logo": {
        "@type": "ImageObject",
        "url": "https://viraljacker.com/favicon.ico"
      }
    }
    ```
  - Add `author` url pointing to `https://viraljacker.com`.
  - Add `datePublished` and `dateModified` in ISO 8601 format (UTC), dynamically set to the explanation's `created_at` timestamp if available in the database, falling back to the current server timestamp.
  - If a primary news source is present in the trend data (`news.url`), add a `citation` property pointing to the source:
    ```json
    "citation": {
      "@type": "CreativeWork",
      "headline": "[News Headline]",
      "url": "[News Source URL]",
      "publisher": {
        "@type": "Organization",
        "name": "[News Source Publisher]"
      }
    }
    ```
    If no headline or publisher is available, fall back gracefully to a simpler text/URL string or omitting the field.
- **Verification**: Programmatic extraction of the `<script type="application/ld+json">` contents on `/` and `/t/:slug` to assert the presence and correct formatting of `mainEntityOfPage`, `publisher`, `datePublished`, `dateModified`, and `citation` fields.

### [AC-2] Plain-Text Citations in Raw Markdown Trend Explainer Endpoints
- **Description**: The individual trend markdown pages served at `/t/:slug.md` must append citation metadata so that LLMs crawling plain-text explainers can easily ingest and attribute primary sources.
- **Format Requirements**:
  - Add a new section heading `## Sources & Citations` at the bottom of the page.
  - Include a markdown link pointing to the primary news article source: `* Primary Source: [${sourceName} - ${headline}](${newsUrl})`.
  - Fall back gracefully to `* Primary Source: Google Trends Search Spike` or `* Primary Source: Reddit - r/popular` (with URL if available) if no specific news item exists.
- **Verification**: Fetch `/t/google-gemini.md` (and other trends) via HTTP GET. Confirm that the response is `text/plain` and contains a `## Sources & Citations` section with valid markdown references.

### [AC-3] Plain-Text Citations in Sitemap Aggregators (`/llms.txt`, `/llms-full.txt`)
- **Description**: The `/llms.txt` and `/llms-full.txt` plain-text endpoints must include primary source citations for all listed trends.
- **Format Requirements**:
  - In `/llms.txt`, append the citation metadata inline to each trend list item. Example:
    `- [/t/${slug}.md](/t/${slug}.md) - ${desc} (Source: [${newsSource}](${newsUrl}))`
  - In `/llms-full.txt`, include a `Source: [${newsSource} - ${headline}](${newsUrl})` line under each trend heading (`## ${trendTitle}`).
- **Verification**: HTTP GET `/llms.txt` and `/llms-full.txt` return responses containing inline links referencing the primary source URL (e.g. `blog.google` or `reddit.com`).

### [AC-4] Semantically Optimized HTML5 Citations in UI
- **Description**: The News Context Footer card at the bottom of the trend view must use standard, semantically correct HTML tags to declare the source relation.
- **HTML Layout Requirements**:
  - Wrap the news snippet in a `<blockquote>` element with a `cite` attribute dynamically populated with the primary news source URL (`newsUrl`).
  - Use a `<cite>` tag inside the citation footer to wrap the source publisher name and headline.
  - Modify `public/index.html` to reflect this structure.
  - Update `public/app.js` to dynamically bind the `cite` attribute on the `blockquote` element and update the child elements when rendering trend details.
- **Verification**: E2E browser test that navigates to `/t/google-gemini` and checks the DOM structure of the news footer, verifying that the snippet is nested in a `blockquote` with the correct `cite` attribute and that the publisher reference is wrapped in a `<cite>` element.

---

## 🚫 Out of Scope
- Creating new API scrapers to fetch supplementary sources.
- Adding third-party SEO or GEO metrics dashboards to the UI.
- Rewriting or altering client-side routing and existing layout styling apart from semantic HTML tags in the News Context Footer.

---

## 🥞 Implementation Slices

### [S-1] Test Suite Expansion & DB Retrieval Preparation
- **Goal**: Write E2E and unit assertions verifying the new JSON-LD and plain-text citation requirements. Modify the database helpers in `db.js` to include the `created_at` timestamp in returned explanation payloads.
- **Implied ACs**: [AC-1], [AC-2], [AC-3], [AC-4]
- **Target Files**:
  - `db.js`
  - `tests/seo-visibility.spec.js`
- **Test Strategy**: Additive. Introduce failing Playwright tests mapping exactly to the acceptance criteria (asserting JSON-LD keys, markdown citations, and HTML blockquote/cite semantics). Ensure concurrency limits are respected (`--workers=1`) per `LESSONS.md`.

### [S-2] Structured JSON-LD Data Enrichment
- **Goal**: Update server routes (`/` and `/t/:slug`) in `server.js` to construct and inject the enriched JSON-LD structured data block with `citation`, `datePublished`, `dateModified`, `mainEntityOfPage`, and `publisher` info.
- **Implied ACs**: [AC-1]
- **Target Files**:
  - `server.js`
- **Test Strategy**: Run `npx playwright test` to verify that the newly added JSON-LD schema assertions pass.

### [S-3] Plain-Text Citations (LLM Sitemaps and Markdown Pages)
- **Goal**: Enhance the markdown compiler for `/t/:slug.md` and sitemap generators for `/llms.txt` and `/llms-full.txt` to inject references and links to primary sources.
- **Implied ACs**: [AC-2], [AC-3]
- **Target Files**:
  - `server.js`
- **Test Strategy**: Verify that `/llms.txt`, `/llms-full.txt`, and `/t/:slug.md` endpoints return the expected citation formats in test assertions.

### [S-4] Semantic HTML News Context Footer UI
- **Goal**: Restructure the template for the News Context Footer card in `public/index.html` using a `<blockquote>` tag with `cite` attribute and `<cite>` tag. Update `public/app.js` to dynamically bind these attributes when rendering trend details.
- **Implied ACs**: [AC-4]
- **Target Files**:
  - `public/index.html`
  - `public/app.js`
- **Test Strategy**: Verify via Playwright E2E that the DOM structure changes correctly hydrate on selection and reflect proper semantics.
