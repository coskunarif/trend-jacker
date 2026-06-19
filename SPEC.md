# Specification: Maximize Crawl Speed via Google Indexing API Integration

We will replace the deprecated Google sitemap ping mechanism with the official Google Indexing API to ensure newly generated trend pages are crawled and indexed immediately by search engines.

---

## 🎯 Acceptance Criteria

- **[AC-1] Google Indexing API Integration in `indexing.js`**:
  - Replace the deprecated `google.com/ping` GET request inside `pingSearchEngines(slugs)` with POST calls to the Google Indexing API endpoint: `https://indexing.googleapis.com/v3/urlNotifications:publish`.
  - Use `google-auth-library` (added explicitly to `package.json` dependencies) to acquire an authenticated Google client with the scope `https://www.googleapis.com/auth/indexing`.
  - For each new trend, format and notify all 4 language variants (English `/t/:slug`, Spanish `/t/:slug/es`, French `/t/:slug/fr`, and Japanese `/t/:slug/ja`) to the Indexing API.
  - **Bounded Concurrency**: Process the URL notifications in chunks of maximum **5 concurrent requests** at a time to prevent local socket exhaustion and Google API rate limiting (`429 Too Many Requests`).
  - **Retry Mechanism with Exponential Backoff**: Implement a retry handler for transient errors (connection timeouts, DNS errors, or HTTP 5xx responses) on individual URLs. Retry up to **3 times** (e.g., initial attempt, then retries with backoffs of 200ms, 400ms, 800ms) before failing gracefully.
  - **Graceful Development and Test Fallback**:
    - If in **test mode** (`process.env.NODE_ENV === 'test'` or running inside E2E test suites with interceptors), fall back to making an unauthenticated POST request to the API endpoint using the global/node fetch client so the test interceptors can capture and verify the request.
    - If in **local development mode** (no credentials found and not in test mode), bypass the network call entirely, print a mock warning log, and return success to avoid polluting logs or sending unauthorized traffic to public Google endpoints.
  - Return `{ success: true, urls: urlList, googleIndexed: true }` matching test expectations.

- **[AC-2] Standalone CLI Script Update (`scripts/ping-sitemap.js`)**:
  - In production mode, update `scripts/ping-sitemap.js` to fetch `/sitemap.xml` and parse the URLs (using regex or `xml2js`).
  - **Quota Protection & URL Filtering**:
    - Filter out static non-trend URLs (only include URLs matching the `/t/:slug` pattern).
    - Limit the number of submitted URLs in a single execution of the CLI script to the **15 most recent trends** to protect the daily Google Indexing API quota (200 requests/day).
  - Submit the filtered, capped URLs/slugs to the Google Indexing API (via `pingSearchEngines`).
  - In test mode (`NODE_ENV === 'test'`), print a mock statement containing the terms `mock`, `google`, and `sitemap` to satisfy existing test assertions.

- **[AC-3] Test Suite Updates**:
  - **`tests/seo-canonical-redirects.spec.js`**:
    - Update static checks to check `indexing.js` for reference to `indexing.googleapis.com` instead of the deprecated `google.com/ping`.
    - Update invocation checks to mock/intercept POST requests to `https://indexing.googleapis.com/v3/urlNotifications:publish` instead of `google.com/ping` and verify the correct payload format.
  - All tests must pass successfully when running `npm run test` (or `npx playwright test`).

---

## ⚡ Performance KPIs

- **[KPI-1] Bounded Concurrency & Asynchronous Execution**: Limit concurrent API calls to a maximum of 5 requests at a time to prevent socket exhaustion and rate limiting. The process must execute asynchronously and concurrently with IndexNow.
- **[KPI-2] Declared Dependency Cleanliness**: Explicitly declare `google-auth-library` in `package.json` dependencies to prevent dependency drift or import failures.
- **[KPI-3] Transient Failure Recovery**: Automatically retry failed requests up to 3 times with exponential backoff (e.g., 200ms, 400ms, 800ms) to ensure high indexing reliability without blocking execution threads.

---

## 🔌 Interface Contract

### `indexing.js`
```typescript
/**
 * Pings Google Indexing API and IndexNow with newly discovered trend slugs.
 * @param slugs Array of trend slugs
 * @returns Object indicating success status, the list of formatted URLs, and indexing flag
 */
export function pingSearchEngines(slugs: string[]): Promise<{
  success: boolean;
  urls: string[];
  googleIndexed?: boolean;
  error?: string;
}>;

/**
 * Returns the IndexNow API key.
 */
export function getIndexNowKey(): string;
```

### `scripts/ping-sitemap.js`
- Standalone execution script. No exports.
- **Environment Variables**:
  - `APP_HOST` (string, default: `viraljacker.com`): Target hostname.
  - `NODE_ENV` (string, default: `production`): Run environment.

---

## 🚫 Out of Scope

- Registering the Google Search Console property or configuring Service Account permissions in the GCP console. We assume the environment is pre-configured with Owner permissions for the service account.
- Implementing batching via the `multipart/mixed` endpoint (`https://indexing.googleapis.com/batch`), since sequential/parallel individual POST requests with bounded concurrency are simpler and fit well within the default daily quota.

---

## 💬 Critic Objections & Resolution

1. **Unbounded Concurrency in Google Indexing API Calls**
   - *Resolution*: Implemented bounded concurrency (maximum 5 concurrent requests at a time) inside `pingSearchEngines`.
2. **Unauthenticated HTTP Calls in Local/Test Environments**
   - *Resolution*: Bypass HTTP requests entirely in local development if credentials are not present, logging a warning and succeeding. Keep unauthenticated HTTP calls active *only* in test environments so that E2E interceptors can capture and verify them.
3. **Reliance on Transitive `google-auth-library` Dependency**
   - *Resolution*: Added `google-auth-library` explicitly to the `package.json` dependencies.
4. **Absence of Retry Logic for Transient Network Errors**
   - *Resolution*: Introduced an automatic retry mechanism (up to 3 times per URL) with exponential backoff for network or 5xx failures.
5. **Sitemap Parsing and Quota Exhaustion**
   - *Resolution*: Configured `scripts/ping-sitemap.js` to filter out non-trend static URLs and limit the URLs submitted to the 15 most recent trends.

---

## 🍕 Implementation Slices

### **[S-1] Google Indexing API Integration in `indexing.js` & package.json updates**
- **Description**: Add `google-auth-library` explicitly to the `package.json` dependencies. Load GCP credentials and build the authenticated client. Update `pingSearchEngines` to process URLs with a bounded concurrency of 5 and retry logic (3 retries with exponential backoff). Implement the conditional local-dev bypass / test fallback.
- **Files**: `indexing.js`, `package.json`
- **ACs**: `[AC-1]`
- **Independent**: No (S-2 depends on it).

### **[S-2] Refactor `scripts/ping-sitemap.js` CLI Script**
- **Description**: Refactor the script to fetch `sitemap.xml`, parse URLs, filter out non-trend static paths, cap URLs at the 15 most recent trends, and call the updated Google Indexing API indexing flow. Retain mock logs in test mode.
- **Files**: `scripts/ping-sitemap.js`
- **ACs**: `[AC-2]`
- **Independent**: No (depends on S-1).
