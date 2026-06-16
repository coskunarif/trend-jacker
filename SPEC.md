# Specification: Consolidate Search Authority and Eliminate Duplicate Listings

Consolidate Search Engine Optimization (SEO) rankings by redirecting all non-canonical hostname and protocol variations to the canonical domain (`https://viraljacker.com/`), and remove deprecated Google sitemap ping code blocks.

## Acceptance Criteria

### [AC-1] Protocol Redirect (HTTP to HTTPS)
- **Criterion**: Accessing the application via HTTP must trigger a 301 permanent redirect to the corresponding HTTPS URL.
- **Verification**: Sending a GET request to `/` or `/t/google-gemini` with `X-Forwarded-Proto: http` or an unencrypted request protocol returns a `301 Moved Permanently` response with the `Location` header pointing to `https://viraljacker.com/` or `https://viraljacker.com/t/google-gemini`.

### [AC-2] Hostname Redirect (WWW to non-WWW)
- **Criterion**: Accessing the application via `www.viraljacker.com` must trigger a 301 permanent redirect to the corresponding canonical root domain (`viraljacker.com`).
- **Verification**: Sending a GET request to `/` or `/t/google-gemini` with the header `Host: www.viraljacker.com` returns a `301 Moved Permanently` response with the `Location` header pointing to `https://viraljacker.com/` or `https://viraljacker.com/t/google-gemini`.

### [AC-3] Combined Protocol and Hostname Redirect preserving Path and Query
- **Criterion**: Incoming requests on non-canonical hostnames (e.g., WWW) and/or non-canonical protocols (HTTP) must be permanently redirected (301) to the canonical root domain while preserving the original request path and any URL query parameters.
- **Verification**: Sending a GET request to `/t/google-gemini?ref=viral` with both `Host: www.viraljacker.com` and `X-Forwarded-Proto: http` returns a `301 Moved Permanently` response with the `Location` header exactly equal to `https://viraljacker.com/t/google-gemini?ref=viral`.

### [AC-4] Local Development and Test Bypass
- **Criterion**: Requests containing `localhost` or `127.0.0.1` in the Host header must bypass redirect logic to ensure local development, manual verification, and local automated test suites run without redirecting to the production domain.
- **Verification**: Sending a GET request with `Host: localhost:3001` or `Host: 127.0.0.1:3001` returns a `200 OK` (or other appropriate status) without a 301 redirect.

### [AC-5] Google Sitemap Ping Removal
- **Criterion**: All deprecated Google sitemap ping requests are removed from the indexing service.
- **Verification**: The file `indexing.js` must not contain any reference to `google.com/ping`, and execution of the `pingSearchEngines` function must not trigger any console logs or external network requests to `google.com/ping`, while preserving IndexNow API submissions.

---

## Interface Contract

The Tester and Builder must share the following files and functions:

### 1. `server.js`
- Fastify server configuration must register a hook/middleware executing early in the request lifecycle (e.g., `onRequest` hook).
- Signature for hook/middleware:
  ```javascript
  fastify.addHook('onRequest', async (request, reply) => {
    // Protocol/Host redirect logic
  });
  ```
- Local dev bypass rule: Checks if `request.headers.host` matches `/localhost|127\.0\.0\.1/`.

### 2. `indexing.js`
- Export signature of `pingSearchEngines` remains unchanged:
  ```typescript
  export async function pingSearchEngines(slugs: string[]): Promise<{ success: boolean, urls: string[] }>
  ```
- Google sitemap ping block is removed.

---

## Out of Scope
- Implementing DNS-level redirects (e.g., Cloudflare page rules) as redirects must be handled at the application server level.
- Redirecting other local testing ports or staging URLs unless they explicitly contain `localhost` or `127.0.0.1`.

---

## Slices

### [S-1] Subtractive: Remove Deprecated Google Sitemap Ping (Independent)
- **Target File**: `indexing.js`
- **AC Mapping**: `[AC-5]`
- **Description**: Delete the Google sitemap ping block from `indexing.js`.

### [S-2] Refinement: Implement HTTPS and WWW Redirects in Fastify (Independent)
- **Target File**: `server.js`
- **AC Mapping**: `[AC-1]`, `[AC-2]`, `[AC-3]`, `[AC-4]`
- **Description**: Add an `onRequest` Fastify hook to redirect non-canonical hostname and protocol variants to `https://viraljacker.com/` while preserving request path and query parameters, and bypassing for local testing on `localhost`/`127.0.0.1`.
