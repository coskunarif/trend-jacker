# Specification: Pinterest Integration & Scheduled Viral Poster Suite

This specification details the implementation plan for introducing Pinterest sharing capabilities (including rich pin dynamic image/metadata integration) and a scheduled viral poster system with history tracking.

---

## 🎯 Acceptance Criteria

### [AC-1] Pinterest Share Pill & Intent in UI
- **Pill UI**: The unified share modal must feature a Pinterest pill button styled similarly to other platforms: `<button class="platform-pill" data-platform="pinterest">Pinterest</button>`.
- **Selection & Generation**: Clicking the Pinterest pill calls `/api/generate-post` with `platform: 'pinterest'` and populates the text area preview.
- **Outbound Link Intent**: Clicking the "Post/Share" button (`#btn-post-share`) with Pinterest active redirects the user via `window.open` to:
  `https://www.pinterest.com/pin/create/button/?url=<URL>&media=<MEDIA_URL>&description=<DESCRIPTION>`
  where:
  - `<URL>` is the absolute trend page URL (e.g., `https://viraljacker.com/t/:slug`).
  - `<MEDIA_URL>` is the dynamic OpenGraph image endpoint (e.g., `https://viraljacker.com/api/og/:slug`).
  - `<DESCRIPTION>` is the generated Pinterest pin copy.

### [AC-2] Dynamic OpenGraph Image & Rich Pin Metadata
- **Dynamic Image Route**: A new backend route `GET /api/og/:slug` (and `/api/og/:slug/:lang`) is added, returning a dynamically generated SVG representing the trend. The SVG must contain:
  - The trend's title.
  - The trend's category icon or vibe badge.
  - Visual circular/gauge elements representing the sentiment split (genius vs. overrated).
  - Attributed footer text `"viraljacker.com"`.
  - Served with `Content-Type: image/svg+xml`.
- **Meta Tags Injection**: The SEO header block generated for `/t/:slug` and `/t/:slug/:lang` must include the following tags to support Pinterest Rich Pins:
  - `<meta property="og:image" content="https://viraljacker.com/api/og/:slug">` (or localized version).
  - `<meta property="og:image:width" content="1200">`
  - `<meta property="og:image:height" content="630">`
  - `<meta name="twitter:image" content="https://viraljacker.com/api/og/:slug">`

### [AC-3] Pinterest Post Generation Logic
- **Endpoint Support**: `/api/generate-post` supports `platform: 'pinterest'`.
- **Mock Fallback**: In test/non-production mode, returns:
  `Pin Title: <Trend Title>\n\nPin Description: <Snippet/Description>. Explore live sentiment: <URL> #<Hashtags>`
- **Gemini generation**: In production, utilizes `gemini-3.5-flash` with rules:
  - A highly catching headline/title on the first line.
  - A keyword-rich description under 500 characters highlighting the virality factors.
  - Exactly 2 to 3 relevant hashtags.
  - Embeds the absolute target URL.

### [AC-4] Scheduled Viral Poster (Cron & History Backend)
- **Database Table**: Add a `viral_post_history` table in SQLite/Firestore:
  - `id` (integer, auto-increment primary key).
  - `trend` (text/string).
  - `platform` (text/string).
  - `post_text` (text).
  - `created_at` (text/timestamp).
- **Trigger Endpoint**: Implement `POST /api/cron/viral-poster`. When triggered, it:
  1. Identifies the latest active trend from the database.
  2. Generates sharing text for X, LinkedIn, Facebook, and Pinterest.
  3. Records these simulated posts in `viral_post_history`.
  4. Returns `{ success: true, posted: [...] }`.
- **History Endpoint**: Implement `GET /api/viral-poster/history` returning all simulated posts ordered by creation date descending.

### [AC-5] Scheduled Poster Dashboard UI
- **History Feed**: A new collapsible panel or tab labeled "Viral Poster Log" is added in `public/index.html`.
- **Rendering**: Automatically polls or fetches `/api/viral-poster/history` on page load, rendering the list of previously simulated viral posts, showing platform badges, post texts, and timestamps.

---

## 🚫 Out of Scope
- Actually integrating third-party OAuth APIs or posting real tweets/pins (sharing actions use standard intent links, and cron schedules simulate posting by writing to the history log table).
- Creating background cron tasks inside Node.js; the poster relies on the externally triggered `/api/cron/viral-poster` route.

---

## 📅 Slices

### [S-1] Additive: Pinterest Generation Logic & Caching
- **Description**: Extend `/api/generate-post` to support the `pinterest` platform. Update caching to store Pinterest post types.
- **Files**: `server.js`
- **AC Mapped**: `[AC-3]`
- **Test Strategy**: Additive (write unit tests in `tests/viral-generator.spec.js` asserting Pinterest post formatting first).

### [S-2] Additive: Dynamic OG Image Endpoint & Meta Tags
- **Description**: Implement `GET /api/og/:slug` to serve dynamic SVG and inject metadata into the head of `/t/:slug`.
- **Files**: `server.js`
- **AC Mapped**: `[AC-2]`
- **Test Strategy**: Additive (TDD verification of `/api/og/:slug` returning valid SVG XML and `/t/:slug` returning the correct og:image headers).

### [S-3] Additive: Pinterest UI Share Pill
- **Description**: Add Pinterest button to the modal and update share intent handler.
- **Files**: `public/index.html`, `public/app.js`
- **AC Mapped**: `[AC-1]`
- **Test Strategy**: Additive (Playwright test clicks Pinterest pill, verifies preview generates, and checks Pinterest intent URL).

### [S-4] Additive: Scheduled Poster Cron Backend
- **Description**: Create database table `viral_post_history` and endpoints `POST /api/cron/viral-poster` and `GET /api/viral-poster/history`.
- **Files**: `db.js`, `server.js`
- **AC Mapped**: `[AC-4]`
- **Test Strategy**: Additive (TDD integration test triggering the cron endpoint and checking SQL/memory tables).

### [S-5] Additive: Scheduled Poster History UI
- **Description**: Add dashboard/feed to render the historical logs.
- **Files**: `public/index.html`, `public/app.js`, `public/styles.css`
- **AC Mapped**: `[AC-5]`
- **Test Strategy**: Additive (E2E test verifying historical log cards are rendered with content).
