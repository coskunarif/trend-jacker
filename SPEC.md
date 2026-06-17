# SPEC: Historical Trend Content Discovery Directory

## Problem Statement
Historical trend content exists in the database but lacks internal links or persistent sitemap representation, rendering it inaccessible to search crawlers and AI search engine discovery mechanisms. We need to implement a content discovery directory to index historical trend explanations and increase search crawler coverage.

## Test Strategy
- **Strategy Type**: Additive.
- **Process**: The Tester will write tests first (e.g., in `tests/directory.spec.js`) to assert the behavior of the new endpoints, redirects, SEO markup, JSON-LD structure, sitemap consolidation, and translation hydration. Once tests are in place, the Builder will implement the code slices to pass the test suite.

---

## Acceptance Criteria

### `[AC-1]` Database helper for historical trend list
- A new function `getAllCachedExplanations()` must be exported from `db.js`.
- It must fetch all cached explanations from the database:
  - If `firestore` is active, query the Firestore `trend_explanations` collection and return all documents.
  - If `sqliteDb` is active, query the `trend_explanations` table (columns: `trend`, `explanation`, `created_at`) ordered by `created_at DESC` and parse the explanation JSON string.
  - If using in-memory fallback, return a copy of all entries in `inMemoryExplanations` sorted by `created_at` DESC.
- The returned array must consist of objects matching the structure: `{ trend: string, created_at: string, explanation: object }`.
- **How to test**: Import `getAllCachedExplanations` in a Node environment or test script, seed the database with mock trends, and assert that the returned array contains all seeded trends.

### `[AC-2]` Directory Page Routes and Lowercase Path Normalization
- The server must handle requests to `/directory` and `/directory/:lang`.
- Route matching and redirection must enforce lowercase casing normalization. Any uppercase letters in path parameters (e.g. `/Directory`, `/directory/ES`, `/directory/Fr`) must trigger a 301 redirect to the fully lowercased path (e.g., `/directory`, `/directory/es`, `/directory/fr`).
- If the `lang` parameter is passed but is not in the supported list `['es', 'fr', 'ja']` (e.g., `en`, `de`), the server must 301 redirect the request to `/directory`.
- The directory page must render as a server-side generated semantic HTML document. It must merge trends from the database (`getAllCachedExplanations()`) with live trends (`latestTrends`), deduplicate them by their slug (lowercased, formatted via `titleToSlug`), and render a clean list of hyperlinks.
  - On `/directory` (English/default), links must point to `/t/:slug`.
  - On `/directory/:lang`, links must point to `/t/:slug/:lang`.
- **How to test**: Send GET requests to mixed-case, unsupported lang, and canonical directory URLs, asserting 301 status, redirect locations, 200 status, and link structures.

### `[AC-3]` Directory SEO, Alternate Links, and JSON-LD
- The directory HTML response must contain the following tags in the `<head>`:
  - `<title>` tag with localized title (e.g. "Historical Trends Directory | TrendJacker" for `en`, "Directorio de Tendencias Históricas | TrendJacker" for `es`, "Annuaire des Tendances Historiques | TrendJacker" for `fr`, "歴史的トレンドディレクトリ | TrendJacker" for `ja`).
  - `<meta name="description">` with localized content.
  - Canonical tag: `<link rel="canonical" href="https://viraljacker.com/directory[/:lang]" />` (correct host and lowercased).
  - Alternate hreflangs for auto-discovery:
    - `<link rel="alternate" hreflang="x-default" href="https://viraljacker.com/directory" />`
    - `<link rel="alternate" hreflang="en" href="https://viraljacker.com/directory" />`
    - `<link rel="alternate" hreflang="es" href="https://viraljacker.com/directory/es" />`
    - `<link rel="alternate" hreflang="fr" href="https://viraljacker.com/directory/fr" />`
    - `<link rel="alternate" hreflang="ja" href="https://viraljacker.com/directory/ja" />`
  - A script tag containing Schema.org JSON-LD structured data of type `CollectionPage` or `ItemList` listing the directory name, description, canonical url, and the list of item links.
  - Response headers must include a `Link` header containing the canonical URL as `rel="canonical"` and alternate link headers for the language variants.
- **How to test**: Use Playwright/request assertions to fetch `/directory` and `/directory/:lang`, parse the HTML, verify tags and alternate link structures, and parse/validate the script tag's JSON-LD properties.

### `[AC-4]` Comprehensive sitemap.xml Integration
- The `/sitemap.xml` endpoint must fetch all historical trends from the database using `getAllCachedExplanations()`, blend them with `latestTrends`, deduplicate by slug, and include every unique trend slug in the sitemap.
- For each unique trend, the sitemap must include elements for all supported language variants:
  - English at `/t/:slug` (with `xhtml:link` pointing to alternates for `x-default`, `en`, `es`, `fr`, `ja`).
  - Spanish at `/t/:slug/es` (with corresponding alternates).
  - French at `/t/:slug/fr` (with corresponding alternates).
  - Japanese at `/t/:slug/ja` (with corresponding alternates).
- The `/sitemap.xml` must also include entries for the new `/directory` and `/directory/:lang` routes (for all 4 language variants).
- All entries must be deduplicated (no duplicate `<loc>` elements or duplicate alternate links).
- **How to test**: Fetch `/sitemap.xml`, parse the XML using an XML parser, and assert presence of historical trend paths and unique alternate elements.

### `[AC-5]` llms.txt and llms-full.txt Sitemap Consolidation
- The `/llms.txt` and `/llms-full.txt` endpoints must incorporate all historical trend explanations from the database combined with `latestTrends`.
- Both lists must be deduplicated by slug to prevent duplicate records.
- `/llms.txt` must format links as `- [/t/${slug}.md](/t/${slug}.md) - ${desc} (Source: ...)` for all combined trends.
- `/llms-full.txt` must compile the full markdown representation of all trends in the combined list.
- **How to test**: Send requests to `/llms.txt` and `/llms-full.txt`, asserting the presence of historical trends and the absence of duplicate titles/headings.

### `[AC-6]` Global Footer Links and Client Translation Hydration
- A footer section must be appended to the root layout in `public/index.html` containing a link to `/directory` with `id="directory-link"`.
- In `public/app.js`, the `UI_DICTIONARY` must be updated with `directoryLinkText` translation strings for `en`, `es`, `fr`, and `ja`.
- The `translateUI` function must select `#directory-link`, update its text content with the translated string, and dynamically rewrite its `href` attribute to match the active language: `/directory` for English, and `/directory/:lang` for `es`, `fr`, `ja`.
- **How to test**: Load the root page `/` in Playwright, select different languages from the language selector, and verify that `#directory-link` text and `href` reflect the selection.

---

## Interface Contract

1. **Database Export (`db.js`)**:
   - `export async function getAllCachedExplanations(): Promise<Array<{ trend: string, created_at: string, explanation: object }>>`

2. **Routes/Paths (`server.js` & `public/app.js`)**:
   - Directory paths: `/directory` (English), `/directory/es` (Spanish), `/directory/fr` (French), `/directory/ja` (Japanese)
   - Dynamic parameters casing: Case-insensitive match, 301 redirect to lowercase version.
   - Root Footer link ID: `#directory-link`
   - UI translation dictionary keys under `UI_DICTIONARY`: `directoryLinkText` (Type: string)

---

## Out of Scope
- Scraping or generating explanations for new trends within the directory route.
- Interactive user voting or chat controls inside the directory list view.
- CSS/style themes other than matching the current dashboard stylesheet.

---

## Slices

### `[S-1]` Database helper: `getAllCachedExplanations()`
- Add `getAllCachedExplanations` to `db.js`.
- Implements Firestore query, SQLite query, and memory fallback.
- **Files**: `db.js`
- **AC Mapped**: `[AC-1]`
- **Dependencies**: None. (Independent)

### `[S-2]` Server-side Directory route implementation & lowercasing redirects
- Add `/directory` and `/directory/:lang` route handlers to `server.js`.
- Add mixed-case 301 redirection logic to lowercase canonical route.
- Serve HTML with merged `latestTrends` and historical explanations, deduplicated.
- **Files**: `server.js`
- **AC Mapped**: `[AC-2]`
- **Dependencies**: `[S-1]`

### `[S-3]` Directory SEO, alternates, and JSON-LD structured data
- Inject meta tags, canonical, hreflang links, `Link` header, and JSON-LD script into the directory HTML page response.
- **Files**: `server.js`
- **AC Mapped**: `[AC-3]`
- **Dependencies**: `[S-2]`

### `[S-4]` Sitemap.xml historical index updates
- Update `/sitemap.xml` to fetch database trends, merge with `latestTrends`, deduplicate, and list all locales and directory URLs.
- **Files**: `server.js`
- **AC Mapped**: `[AC-4]`
- **Dependencies**: `[S-1]`

### `[S-5]` llms.txt & llms-full.txt historical sitemap consolidation
- Update `/llms.txt` and `/llms-full.txt` routes in `server.js` to merge database trends and format output.
- **Files**: `server.js`
- **AC Mapped**: `[AC-5]`
- **Dependencies**: `[S-1]`

### `[S-6]` Footer layout link and client-side translation hydration
- Update `public/index.html` to add the footer element with `#directory-link`.
- Update `public/app.js` UI_DICTIONARY translations and `translateUI` logic to dynamically target and rewrite `#directory-link`.
- **Files**: `public/index.html`, `public/app.js`
- **AC Mapped**: `[AC-6]`
- **Dependencies**: None. (Independent)
