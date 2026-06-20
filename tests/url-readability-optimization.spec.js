import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper to extract titleToSlug from file content
function extractTitleToSlug(filePath) {
  const fileContent = fs.readFileSync(filePath, 'utf8');
  const match = fileContent.match(/function titleToSlug\s*\(([^)]*)\)\s*\{([\s\S]*?)\}/);
  if (!match) {
    throw new Error(`titleToSlug function not found in ${path.basename(filePath)}`);
  }
  const args = match[1];
  const body = match[2];
  return new Function(args, body);
}

test.describe('URL Readability and Search Query Alignment Optimization', () => {

  /**
   * [AC-1] Eliminate Hard-coded Character Truncation on Reddit Trend Titles
   * - Ingest or mock a Reddit RSS item with a title longer than 60 characters.
   * - Verify that the ingestion logic uses the full Reddit thread title and does not truncate at 60 characters.
   * - We verify this by ensuring server.js does not contain the old hard-coded truncation expression.
   */
  test('AC-1: Reddit RSS ingestion logic does not truncate titles at 60 characters', () => {
    const serverPath = path.resolve(__dirname, '../server.js');
    const serverCode = fs.readFileSync(serverPath, 'utf8');
    
    // The previous code had: title: title.length > 60 ? title.substring(0, 60) + '...' : title
    const containsTruncation = serverCode.includes('title.substring(0, 60)');
    expect(containsTruncation).toBe(false);
  });

  /**
   * [AC-2] Full & Search-friendly Slug Generation for Trend URLs
   * - Verify slug normalization (lowercase, trim, strip diacritics).
   * - Verify word-boundary truncation to at most 100 characters.
   * - Verify fallback deterministic hash trend-${hash} for non-alphanumeric titles.
   */
  test('AC-2: server.js titleToSlug generates search-friendly slugs with all required rules', () => {
    const serverPath = path.resolve(__dirname, '../server.js');
    const titleToSlug = extractTitleToSlug(serverPath);

    // 1. Check basic conversion & diacritics stripping
    expect(titleToSlug("World Cup tourists: what's your honest feedback on the USA's stadiums"))
      .toBe("world-cup-tourists-whats-your-honest-feedback-on-the-usas-stadiums");

    expect(titleToSlug("Café & Crème - Delights!"))
      .toBe("cafe-creme-delights");

    // 2. Check maximum 100 characters truncation at the last "-" word boundary
    // Create a title that generates a slug of length ~120 characters:
    // "a-b-c-...-z"
    const longWords = Array.from({ length: 25 }, (_, i) => `word${i}`).join(' ');
    const rawSlug = longWords.toLowerCase().replace(/\s+/g, '-');
    expect(rawSlug.length).toBeGreaterThan(100);

    const slug = titleToSlug(longWords);
    expect(slug.length).toBeLessThanOrEqual(100);
    expect(slug[slug.length - 1]).not.toBe('-'); // Should not end with -
    
    // Find the last index of '-' in the raw slug before 100
    const subStr = rawSlug.substring(0, 100);
    const expectedLastDash = subStr.lastIndexOf('-');
    const expectedSlug = subStr.substring(0, expectedLastDash);
    expect(slug).toBe(expectedSlug);

    // 3. Fallback format trend-${hash} for non-alphanumeric titles (e.g. Japanese)
    const japaneseSlug = titleToSlug("世界カップへようこそ");
    expect(japaneseSlug).toMatch(/^trend-[a-z0-9]+$/);
    
    // Determinism check: same title must yield same hash
    expect(titleToSlug("世界カップへようこそ")).toBe(japaneseSlug);
    expect(titleToSlug("異なるタイトル")).not.toBe(japaneseSlug);
  });

  test('AC-2: public/app.js titleToSlug generates identical slugs to server.js', () => {
    const serverPath = path.resolve(__dirname, '../server.js');
    const publicPath = path.resolve(__dirname, '../public/app.js');
    const serverSlug = extractTitleToSlug(serverPath);
    const clientSlug = extractTitleToSlug(publicPath);

    const titles = [
      "World Cup tourists: what's your honest feedback on the USA's stadiums",
      "Café & Crème - Delights!",
      "世界カップへようこそ",
      "Another Extremely Long Title " + "A".repeat(80) + " to force truncation boundary checks"
    ];

    for (const title of titles) {
      expect(clientSlug(title)).toBe(serverSlug(title));
    }
  });

  /**
   * [AC-3] Dynamic Sitemap and Indexing API Synchronization
   * - Sitemap.xml must use the untruncated search-friendly slug.
   * - Indexing ping functions format all 4 localized variants using the untruncated slug.
   */
  test('AC-3: Sitemap and indexing ping payloads use the untruncated slugs', async ({ request }) => {
    // Check if the indexing.js module handles localized variant array correctly
    const indexingPath = path.resolve(__dirname, '../indexing.js');
    const indexingModule = await import(indexingPath);
    
    const longTitleSlug = "world-cup-tourists-whats-your-honest-feedback-on-the-usas-stadiums";
    const result = await indexingModule.pingSearchEngines([longTitleSlug]);
    
    expect(result.success).toBe(true);
    expect(result.urls).toBeDefined();
    
    // Check all 4 localized variant URLs exist and contain the untruncated slug
    const expectedUrls = [
      `https://viraljacker.com/t/${longTitleSlug}`,
      `https://viraljacker.com/t/${longTitleSlug}/es`,
      `https://viraljacker.com/t/${longTitleSlug}/fr`,
      `https://viraljacker.com/t/${longTitleSlug}/ja`
    ];

    for (const url of expectedUrls) {
      expect(result.urls).toContain(url);
    }

    // Hit the live /sitemap.xml endpoint and verify it generates untruncated slugs
    const response = await request.get('/sitemap.xml');
    expect(response.status()).toBe(200);
    const xml = await response.text();
    expect(xml).toContain(`/t/${longTitleSlug}`);
  });

  /**
   * [AC-4] UI Layout and Responsive Presentation of Long Titles
   * - Long titles wrap naturally using word-wrap: break-word & overflow-wrap: break-word.
   * - Ensure no horizontal overflow on mobile (375x667) and desktop (1280x800) viewports.
   */
  test('AC-4: CSS properties wrap long titles and prevent horizontal scrolling', async ({ page }) => {
    const longTitle = "This-is-a-super-long-trend-title-without-spaces-to-enforce-overflow-wrapping-behavior-in-the-dom-and-prevent-horizontal-layout-overflow";
    const longTitleSlug = "this-is-a-super-long-trend-title-without-spaces-to-enforce-overflow-wrapping-behavior-in-the-dom-and-prevent-horizontal-layout-overflow";

    // Intercept trends API to return a trend list including our very long title
    await page.route('**/api/trends', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 99,
            title: longTitle,
            traffic: 'Reddit Spike',
            description: 'Hot post on r/popular',
            source: 'reddit',
            news: {
              headline: longTitle,
              snippet: 'Early interest spike on Reddit.',
              url: 'https://reddit.com/r/popular/comments/123',
              source: 'r/popular'
            }
          }
        ]),
      });
    });

    // 1. Check mobile layout (375x667)
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto(`/t/${longTitleSlug}`);
    
    // Assert no horizontal scrollbar on document
    const scrollWidthMobile = await page.evaluate(() => document.documentElement.scrollWidth);
    const innerWidthMobile = await page.evaluate(() => window.innerWidth);
    expect(scrollWidthMobile).toBeLessThanOrEqual(innerWidthMobile);

    // Verify word-wrap and overflow-wrap CSS styles are applied on title elements
    const itemTitleStyle = await page.evaluate(() => {
      const el = document.querySelector('.trend-item-title');
      if (!el) return null;
      const styles = window.getComputedStyle(el);
      return {
        wordWrap: styles.wordWrap,
        overflowWrap: styles.overflowWrap
      };
    });
    
    if (itemTitleStyle) {
      expect(itemTitleStyle.wordWrap).toBe('break-word');
      expect(itemTitleStyle.overflowWrap).toBe('break-word');
    }

    const detailTitleStyle = await page.evaluate(() => {
      const el = document.querySelector('#detail-title');
      if (!el) return null;
      const styles = window.getComputedStyle(el);
      return {
        wordWrap: styles.wordWrap,
        overflowWrap: styles.overflowWrap
      };
    });
    
    if (detailTitleStyle) {
      expect(detailTitleStyle.wordWrap).toBe('break-word');
      expect(detailTitleStyle.overflowWrap).toBe('break-word');
    }

    // 2. Check desktop layout (1280x800)
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.reload();

    const scrollWidthDesktop = await page.evaluate(() => document.documentElement.scrollWidth);
    const innerWidthDesktop = await page.evaluate(() => window.innerWidth);
    expect(scrollWidthDesktop).toBeLessThanOrEqual(innerWidthDesktop);
  });

  /**
   * [AC-5] Firestore Document ID Hashing/Subcollection Path Collision Avoidance
   * - Saving & retrieving records for polls, trend_explanations, localized_explanations,
   *   topic_images, and client_chat_counts must utilize hashed document IDs (SHA-256).
   * - In getAllCachedExplanations, retrieval must use trend document field instead of doc.id.
   */
  test('AC-5: Database functions hash document IDs and map original trend name correctly', async () => {
    const dbPath = path.resolve(__dirname, '../db.js');
    const dbModule = await import(dbPath);

    // Verify getFirestoreDocId is a valid SHA-256 hex function
    const testKey = "Unsafe/Trend/Title/With/Slashes";
    const hashedId = dbModule.getFirestoreDocId(testKey);
    expect(hashedId).toHaveLength(64); // SHA-256 is 64 hex chars
    expect(hashedId).not.toContain('/');

    // Verify that the retrieved items from getAllCachedExplanations map the raw human-readable trend name
    // instead of returning the hash (docId) as the trend title.
    const cachedExplanations = await dbModule.getAllCachedExplanations();
    for (const item of cachedExplanations) {
      expect(item.trend).toBeDefined();
      // Trend name should be human-readable and not be a 64-character hex SHA-256 hash
      expect(item.trend).not.toMatch(/^[a-f0-9]{64}$/);
    }
  });

  /**
   * [AC-6] Persistent Search Engine Indexing Pings
   * - SQLite isSlugPinged & markSlugAsPinged functions are defined.
   * - Previously processed slugs are not pinged again (survives restart/repeated cache updates).
   */
  test('AC-6: Indexing status persistence and check prevents duplicate search engine pings', async () => {
    const dbPath = path.resolve(__dirname, '../db.js');
    const dbModule = await import(dbPath);

    expect(dbModule.isSlugPinged).toBeDefined();
    expect(dbModule.markSlugAsPinged).toBeDefined();

    const testSlug = `test-slug-${Date.now()}`;
    
    // 1. Initial state must be unpinged
    const initialStatus = await dbModule.isSlugPinged(testSlug);
    expect(initialStatus).toBe(false);

    // 2. Mark as pinged
    await dbModule.markSlugAsPinged(testSlug);
    
    // 3. Status must be updated to true
    const updatedStatus = await dbModule.isSlugPinged(testSlug);
    expect(updatedStatus).toBe(true);
  });

  /**
   * [AC-7] Strict 404 for Arbitrary/Fake Slugs
   * - Requesting a non-existent slug returns 404 and does not attempt Gemini explanation.
   */
  test('AC-7: Requesting a non-existent trend slug returns HTTP 404', async ({ request }) => {
    const randomFakeSlug = `fake-unseen-slug-${Date.now()}`;
    const response = await request.get(`/t/${randomFakeSlug}`);
    expect(response.status()).toBe(404);

    const responseLocalized = await request.get(`/t/${randomFakeSlug}/es`);
    expect(responseLocalized.status()).toBe(404);
  });

});
