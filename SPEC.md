# Specification: Gemini AI Multi-Language Localization Engine

## Background & Objective
TrendJacker is a dynamic viral trend explainer platform. To maximize international SEO and GEO search visibility, we are introducing a dynamic localization engine powered by Google Gemini AI. This engine will support translation of viral explainer content and metadata on the fly, implement localized routing, generate localized JSON-LD schemas and page copy, and cache outputs.

---

## Acceptance Criteria

### [AC-1] Locale Route & Query Handling
- **Description**: The server must resolve localized trend requests via both:
  1. Route parameter: `/t/:slug/:lang` (e.g. `/t/google-gemini/es`)
  2. Query parameter: `/t/:slug?lang=:lang` (e.g. `/t/google-gemini?lang=es`)
- **Fallback**: If no language is requested or if the requested language is unsupported/empty, fallback to English (`en`).
- **Markdown Support**: The server must support localized markdown requests:
  - `/t/:slug/:lang.md`
  - `/t/:slug.md?lang=:lang`
  These must return HTTP 200 with `Content-Type: text/plain` containing the translated trend explanation in markdown.
- **Verification**: GET requests to `/t/google-gemini/es` or `/t/google-gemini?lang=es` return HTML with HTTP 200. GET requests to `/t/google-gemini/es.md` return raw markdown in Spanish with HTTP 200. Invalid slugs must return 404.

### [AC-2] Gemini AI Localized Translation Engine
- **Description**: Under production (live API), the server uses `gemini-3.5-flash` with a JSON schema to translate the explanation (`hook`, `whatIsIt`, `whyIsItViral` array, `takeaway`), page title, and meta description in a single call.
- **Mock mode (Tests)**: In test mode (`process.env.NODE_ENV === 'test'`), the engine must intercept calls to Gemini and return predefined mock translations for supported locales:
  - `es` (Spanish): Appends/translates content and adds `(en español)` suffixes.
  - `fr` (French): Appends/translates content and adds `(en français)` suffixes.
  - `ja` (Japanese): Appends/translates content and adds `(日本語訳)` suffixes.
- **Verification**: Check that requesting `/t/google-gemini/es` under mock mode renders text containing `(en español)` in the preloaded script and page copy.

### [AC-3] Database Caching of Localized Explanations
- **Description**: Caching must prevent duplicate Gemini API translation calls.
- **SQLite Schema**: A new table `localized_explanations` must be created with:
  - `trend TEXT`
  - `lang TEXT`
  - `title TEXT`
  - `meta_description TEXT`
  - `explanation TEXT` (JSON text containing hook, whatIsIt, whyIsItViral, takeaway)
  - `created_at TEXT`
  - Primary Key: `(trend, lang)`
- **Firestore Collection**: An equivalent collection `localized_explanations` with document ID format `${trend}_${lang}`.
- **Verification**: Querying the database or cache check function after the first fetch returns the cached translation without calling Gemini again.

### [AC-4] Dynamic Localized SEO & Schema.org JSON-LD (SSR)
- **Description**: The server-rendered HTML must reflect the localized metadata.
- **HTML tags updated**:
  - `<html lang=":lang">` where `:lang` is the requested language code.
  - `<title>` set to the translated page title.
  - `<meta name="description" content="...">` set to the translated hook.
  - Open Graph (`og:title`, `og:description`, `og:url` updated to match locale).
  - Twitter Cards (`twitter:title`, `twitter:description`).
  - Structured data script `<script type="application/ld+json">` contains localized `headline`, `description`, and `articleBody` (`${whatIsIt} Takeaway: ${takeaway}`).
- **Verification**: Inspecting the HTML response of `/t/google-gemini/es` confirms these elements are translated and correct.

### [AC-5] Alternate Link Tags & Localized Sitemap
- **Description**: Standard SEO alternate linkage.
- **Alternate links in `<head>`**: Inject alternate links in page headers:
  ```html
  <link rel="alternate" hreflang="x-default" href="https://viraljacker.com/t/:slug" />
  <link rel="alternate" hreflang="en" href="https://viraljacker.com/t/:slug" />
  <link rel="alternate" hreflang="es" href="https://viraljacker.com/t/:slug/es" />
  <link rel="alternate" hreflang="fr" href="https://viraljacker.com/t/:slug/fr" />
  <link rel="alternate" hreflang="ja" href="https://viraljacker.com/t/:slug/ja" />
  ```
- **Sitemap.xml**: `/sitemap.xml` must map all trend slugs for each locale (`en`, `es`, `fr`, `ja`) as distinct `<url>` items, with each containing the `<xhtml:link rel="alternate" ... />` references.
- **Verification**: Fetch `/sitemap.xml` and verify it contains all localized routes and alternate hreflang link nodes.

### [AC-6] Client UI Translation & Interactive Switcher
- **Description**: Add a language selection dropdown (`#lang-select`) in the navbar.
- **Client-side UI localizer**: Map a dictionary of static UI strings (`whatIsIt`, `takeaway`, `whyViral`, `sentiment`, `pollPrompt`, `digDeeper`, `chatPlaceholder`, etc.) for `en`, `es`, `fr`, `ja`.
- **Navigation Flow**: Changing `#lang-select` updates the URL state via `pushState` (e.g. `/t/:slug/:lang`), translates static UI text elements on the page, and requests the localized explanation from `/api/explain` using `{ lang }` in the POST body to hydrate the page.
- **Verification**: Selecting "Español" in the dropdown updates the URL to `/t/google-gemini/es` and translates the UI labels to Spanish instantly without a page reload.

---

## Out of Scope
- Translating the live sentiment feed location flags and cities (these remain dynamic per their raw values).
- Localizing the social media generator platforms (e.g. X, LinkedIn) or their raw option structures beyond the prompt inputs.
- Translating external news article snippets and headlines (only explainer contents, titles, metadata, and UI labels are localized).

---

## Slices

### [S-1] Database Schema & Caching Helpers
- **ACs mapped**: `[AC-3]`
- **Files**: `db.js`
- **Dependency**: None (Base DB file).
- **Test Strategy (Additive)**: Write unit tests in `tests/caching.spec.js` or a new `tests/localization.spec.js` first, checking that `getLocalizedExplanation` and `setLocalizedExplanation` store and retrieve entries in SQLite and in-memory Map mock.
- **Implementation**:
  - Add `localized_explanations` table initialization to `db.js`.
  - Add Firestore collection helper operations in `db.js` matching standard patterns.

### [S-2] Server Route Handling & Mock Translation Logic
- **ACs mapped**: `[AC-1]`, `[AC-2]`
- **Files**: `server.js`
- **Dependency**: `[S-1]`
- **Test Strategy (Additive)**: Write integration tests verifying requests to `/t/:slug/:lang`, `/t/:slug?lang=...` and markdown variations. Assert mock responses under test mode.
- **Implementation**:
  - Register `/t/:slug/:lang` route in Fastify.
  - Update route parameters extraction to handle `.md` extensions on slugs/languages.
  - Implement translation handler with mock logic and production Gemini JSON-schema integration.
  - Extend `/api/explain` endpoint to accept `lang` parameter and return translated explanation.

### [S-3] SEO/GEO Metadata SSR & Sitemap alternate tags
- **ACs mapped**: `[AC-4]`, `[AC-5]`
- **Files**: `server.js`
- **Dependency**: `[S-2]`
- **Test Strategy (Additive)**: Add assertions verifying html attributes and metadata in SSR responses and alternate tag existence in sitemap.xml.
- **Implementation**:
  - Modify HTML generation for `/t/:slug` and `/t/:slug/:lang` to dynamically replace `<html lang="en">` with correct locale.
  - Dynamically generate Open Graph, Twitter cards, and JSON-LD structured data in correct locale.
  - Inject alternate hreflang link tags into `<head>`.
  - Update `/sitemap.xml` route handler to output `xhtml:link` alternates.

### [S-4] Client-Side Language Dropdown & Dictionary Hydration
- **ACs mapped**: `[AC-6]`
- **Files**: `public/index.html`, `public/app.js`, `public/styles.css`
- **Dependency**: `[S-3]`
- **Test Strategy (Additive)**: Playwright E2E browser tests mimicking dropdown selection, verifying single-page navigation and text content updates.
- **Implementation**:
  - Inject `#lang-select` into the HTML navbar.
  - Update `public/app.js` to parse locale on initialization.
  - Add UI localization dictionary and DOM helper to translate labeled fields.
  - Wire dropdown change event to update URL with `pushState` and perform ajax fetch to `/api/explain` with target `lang`.

---

## Test & Concurrency Guidelines

### Playwright Retrying Assertions
- The correct syntax for polling assertions in Playwright is `expect(async () => { ... }).toPass();` to prevent flaky failures under heavy runner load. Do NOT use `expect().toPass(...)`.

### SQLite & Playwright Concurrency
- Run Playwright tests with a single worker (`--workers=1`) or enable SQLite WAL mode to prevent transient "database is locked" errors caused by concurrent writes on a shared DB file.
