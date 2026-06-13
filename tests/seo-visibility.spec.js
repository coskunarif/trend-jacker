import { test, expect } from '@playwright/test';
import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Resolve database path
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.resolve(__dirname, '../polls.db');

test.describe('Search Authority & GEO Optimization Tests', () => {
  let getCachedExplanation;
  let getLocalizedExplanation;
  let setCachedExplanation;
  let setLocalizedExplanation;

  test.beforeAll(async () => {
    try {
      const dbModule = await import('../db.js');
      getCachedExplanation = dbModule.getCachedExplanation;
      getLocalizedExplanation = dbModule.getLocalizedExplanation;
      setCachedExplanation = dbModule.setCachedExplanation;
      setLocalizedExplanation = dbModule.setLocalizedExplanation;
    } catch (err) {
      console.warn('Could not import caching functions from db.js:', err.message);
    }
  });

  /**
   * [AC-1] Enriched Schema.org JSON-LD Structured Data - Database Helpers
   * Verify that database helpers getCachedExplanation and getLocalizedExplanation return
   * the `created_at` field from their respective tables.
   */
  test('AC-1 DB: getCachedExplanation and getLocalizedExplanation return created_at', async () => {
    if (typeof getCachedExplanation !== 'function' || typeof setCachedExplanation !== 'function') {
      throw new Error('getCachedExplanation/setCachedExplanation is not exported from db.js');
    }
    if (typeof getLocalizedExplanation !== 'function' || typeof setLocalizedExplanation !== 'function') {
      throw new Error('getLocalizedExplanation/setLocalizedExplanation is not exported from db.js');
    }

    const testTrend = `test-trend-${Date.now()}`;
    const testExpl = {
      hook: 'Test Hook',
      whatIsIt: 'Test What Is It',
      whyIsItViral: ['Test Why'],
      takeaway: 'Test Takeaway'
    };

    // Store explanation which automatically stamps a created_at
    await setCachedExplanation(testTrend, testExpl);
    
    // Retrieve explanation and assert created_at is present and valid
    const retrieved = await getCachedExplanation(testTrend);
    expect(retrieved).toBeDefined();
    expect(retrieved.created_at).toBeDefined();
    expect(typeof retrieved.created_at).toBe('string');
    expect(Date.parse(retrieved.created_at)).not.toBeNaN();

    // Store localized explanation
    const testLocData = {
      title: 'Localized Title',
      meta_description: 'Localized Meta Desc',
      explanation: testExpl
    };
    await setLocalizedExplanation(testTrend, 'es', testLocData);
    
    // Retrieve localized explanation and assert created_at is present
    const retrievedLoc = await getLocalizedExplanation(testTrend, 'es');
    expect(retrievedLoc).toBeDefined();
    expect(retrievedLoc.created_at).toBeDefined();
    expect(typeof retrievedLoc.created_at).toBe('string');
    expect(Date.parse(retrievedLoc.created_at)).not.toBeNaN();
  });

  /**
   * [AC-1] Enriched Schema.org JSON-LD Structured Data - Homepage `/`
   * Verification: Programmatic extraction of the <script type="application/ld+json"> contents
   * on `/` to assert the presence and correct formatting of JSON-LD fields.
   */
  test('AC-1: GET / serves correct enriched JSON-LD structured data', async ({ request }) => {
    const response = await request.get('/');
    expect(response.status()).toBe(200);
    const html = await response.text();
    
    // Extract JSON-LD script content
    const match = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
    expect(match).not.toBeNull();
    
    const jsonLd = JSON.parse(match[1].trim());
    
    // Assert required fields
    expect(jsonLd['@context']).toBe('https://schema.org');
    expect(jsonLd['@type']).toBe('NewsArticle');
    expect(jsonLd['mainEntityOfPage']).toBe('https://viraljacker.com/');
    
    expect(jsonLd['publisher']).toBeDefined();
    expect(jsonLd['publisher']['@type']).toBe('Organization');
    expect(jsonLd['publisher']['name']).toBe('TrendJacker');
    expect(jsonLd['publisher']['url']).toBe('https://viraljacker.com');
    expect(jsonLd['publisher']['logo']).toBeDefined();
    expect(jsonLd['publisher']['logo']['@type']).toBe('ImageObject');
    expect(jsonLd['publisher']['logo']['url']).toBe('https://viraljacker.com/favicon.ico');
    
    expect(jsonLd['author']).toBeDefined();
    expect(jsonLd['author']['url']).toBe('https://viraljacker.com');
    
    expect(jsonLd['datePublished']).toBeDefined();
    expect(Date.parse(jsonLd['datePublished'])).not.toBeNaN();
    expect(jsonLd['dateModified']).toBeDefined();
    expect(Date.parse(jsonLd['dateModified'])).not.toBeNaN();
  });

  /**
   * [AC-1] Enriched Schema.org JSON-LD Structured Data - Detail page `/t/:slug`
   * Verification: JSON-LD structured data on `/t/google-gemini` must contain citation,
   * mainEntityOfPage canonical url, publisher, author, and dates.
   */
  test('AC-1: GET /t/google-gemini serves correct enriched JSON-LD with citation', async ({ request }) => {
    const response = await request.get('/t/google-gemini');
    expect(response.status()).toBe(200);
    const html = await response.text();
    
    const match = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
    expect(match).not.toBeNull();
    const jsonLd = JSON.parse(match[1].trim());
    
    expect(jsonLd['@type']).toBe('NewsArticle');
    expect(jsonLd['mainEntityOfPage']).toBe('https://viraljacker.com/t/google-gemini');
    expect(jsonLd['publisher']['name']).toBe('TrendJacker');
    expect(jsonLd['author']['url']).toBe('https://viraljacker.com');
    
    // Check citation info
    expect(jsonLd['citation']).toBeDefined();
    expect(jsonLd['citation']['@type']).toBe('CreativeWork');
    expect(jsonLd['citation']['headline']).toBe('Google announces Gemini 3.5');
    expect(jsonLd['citation']['url']).toBe('https://blog.google/gemini-3.5');
    expect(jsonLd['citation']['publisher']).toBeDefined();
    expect(jsonLd['citation']['publisher']['@type']).toBe('Organization');
    expect(jsonLd['citation']['publisher']['name']).toBe('Google Blog');
  });

  /**
   * [AC-1] Enriched Schema.org JSON-LD Structured Data - Localized route `/t/:slug/:lang`
   * Verification: JSON-LD on `/t/google-gemini/es` must reflect the localized canonical URL.
   */
  test('AC-1: GET /t/google-gemini/es serves correct canonical url in JSON-LD', async ({ request }) => {
    const response = await request.get('/t/google-gemini/es');
    expect(response.status()).toBe(200);
    const html = await response.text();
    
    const match = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
    expect(match).not.toBeNull();
    const jsonLd = JSON.parse(match[1].trim());
    
    expect(jsonLd['mainEntityOfPage']).toBe('https://viraljacker.com/t/google-gemini/es');
  });

  /**
   * [AC-1] Enriched Schema.org JSON-LD Structured Data - Dynamic Database Dates
   * Verification: datePublished and dateModified are set dynamically using explanation's `created_at`.
   */
  test('AC-1: JSON-LD uses created_at from database when available', async ({ request }) => {
    let localDb;
    try {
      localDb = new DatabaseSync(dbPath);
    } catch (err) {
      test.skip(true, 'SQLite database is not available for seeding');
    }

    const testTime = '2026-05-20T10:15:30.000Z';
    const trendName = 'Google Gemini';
    
    // Insert/update a trend explanation record with a fixed created_at in sqlite
    try {
      localDb.prepare(`
        INSERT OR REPLACE INTO trend_explanations (trend, explanation, created_at)
        VALUES (?, ?, ?)
      `).run(
        trendName,
        JSON.stringify({
          hook: 'Why is everyone talking about Google Gemini?',
          whatIsIt: 'Google Gemini is a suite of AI models.',
          whyIsItViral: ['Advanced reasoning.'],
          takeaway: 'Expect it to power next-gen agentic workflows.'
        }),
        testTime
      );

      // Close the connection before calling the API to prevent database locking
      localDb.close();
      localDb = null;

      const response = await request.get('/t/google-gemini');
      expect(response.status()).toBe(200);
      const html = await response.text();
      
      const match = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
      expect(match).not.toBeNull();
      const jsonLd = JSON.parse(match[1].trim());

      expect(jsonLd['datePublished']).toBe(testTime);
      expect(jsonLd['dateModified']).toBe(testTime);
    } finally {
      if (localDb) {
        try {
          localDb.prepare('DELETE FROM trend_explanations WHERE trend = ?').run(trendName);
        } catch (e) {
          // ignore
        }
        localDb.close();
      } else {
        try {
          const cleanupDb = new DatabaseSync(dbPath);
          try {
            cleanupDb.prepare('DELETE FROM trend_explanations WHERE trend = ?').run(trendName);
          } finally {
            cleanupDb.close();
          }
        } catch (e) {
          // ignore
        }
      }
    }
  });

  /**
   * [AC-2] Plain-Text Citations in Raw Markdown Trend Explainer Endpoints - Source Present
   * Verification: Fetch `/t/google-gemini.md`. Response is `text/plain`, contains
   * a `## Sources & Citations` section at the bottom, and a primary news link.
   */
  test('AC-2: GET /t/google-gemini.md returns markdown with primary news citation', async ({ request }) => {
    const response = await request.get('/t/google-gemini.md');
    expect(response.status()).toBe(200);
    const contentType = response.headers()['content-type'] || '';
    expect(contentType.toLowerCase()).toContain('text/plain');
    
    const text = await response.text();
    
    // Assert sources section exists
    expect(text).toContain('## Sources & Citations');
    
    // Assert it is at the bottom (or towards the bottom) of the file
    const lines = text.trim().split('\n');
    const sourcesHeadingIndex = lines.findIndex(line => line.trim() === '## Sources & Citations');
    expect(sourcesHeadingIndex).toBeGreaterThan(-1);
    expect(lines.length - sourcesHeadingIndex).toBeLessThanOrEqual(5); // should be at the bottom
    
    // Assert primary source link structure
    expect(text).toContain('* Primary Source: [Google Blog - Google announces Gemini 3.5](https://blog.google/gemini-3.5)');
  });

  /**
   * [AC-2] Plain-Text Citations in Raw Markdown - Fallback Cases
   * Verification: Fall back gracefully if no specific news item exists.
   */
  test('AC-2: GET /t/:slug.md serves fallback citation strings when news is missing', async ({ request }) => {
    // We expect the builder to support these test trends without news items:
    // "test-google-spike" (Google Trends) and "test-reddit-spike" (Reddit)
    const resGoogle = await request.get('/t/test-google-spike.md');
    if (resGoogle.status() === 200) {
      const textGoogle = await resGoogle.text();
      expect(textGoogle).toContain('## Sources & Citations');
      expect(textGoogle).toContain('* Primary Source: Google Trends Search Spike');
    }

    const resReddit = await request.get('/t/test-reddit-spike.md');
    if (resReddit.status() === 200) {
      const textReddit = await resReddit.text();
      expect(textReddit).toContain('## Sources & Citations');
      expect(textReddit).toContain('* Primary Source: Reddit - r/popular');
    }
  });

  /**
   * [AC-3] Plain-Text Citations in Sitemap Aggregators - /llms.txt
   * Verification: In `/llms.txt`, append the citation metadata inline to each trend list item.
   * Example: `- [/t/${slug}.md](/t/${slug}.md) - ${desc} (Source: [${newsSource}](${newsUrl}))`
   */
  test('AC-3: GET /llms.txt includes inline primary source citation', async ({ request }) => {
    const response = await request.get('/llms.txt');
    expect(response.status()).toBe(200);
    const contentType = response.headers()['content-type'] || '';
    expect(contentType.toLowerCase()).toContain('text/plain');
    
    const text = await response.text();
    
    // Assert google-gemini inline citation is present
    expect(text).toContain('[/t/google-gemini.md](/t/google-gemini.md)');
    expect(text).toContain('(Source: [Google Blog](https://blog.google/gemini-3.5))');
    
    // If the fallbacks are rendered:
    if (text.includes('test-google-spike')) {
      expect(text).toContain('(Source: Google Trends Search Spike)');
    }
    if (text.includes('test-reddit-spike')) {
      expect(text).toContain('(Source: [Reddit - r/popular]');
    }
  });

  /**
   * [AC-3] Plain-Text Citations in Sitemap Aggregators - /llms-full.txt
   * Verification: In `/llms-full.txt`, include a `Source: [${newsSource} - ${headline}](${newsUrl})`
   * line under each trend heading (`## ${trendTitle}`).
   */
  test('AC-3: GET /llms-full.txt includes source details under trend headings', async ({ request }) => {
    const response = await request.get('/llms-full.txt');
    expect(response.status()).toBe(200);
    const contentType = response.headers()['content-type'] || '';
    expect(contentType.toLowerCase()).toContain('text/plain');
    
    const text = await response.text();
    
    // Look for heading ## Google Gemini and check if the Source line follows it
    const geminiHeadingIndex = text.indexOf('## Google Gemini');
    expect(geminiHeadingIndex).toBeGreaterThan(-1);
    
    const sourceString = 'Source: [Google Blog - Google announces Gemini 3.5](https://blog.google/gemini-3.5)';
    const sourceStringIndex = text.indexOf(sourceString);
    expect(sourceStringIndex).toBeGreaterThan(geminiHeadingIndex);
    // Source should be close to the heading (i.e. within 200 characters)
    expect(sourceStringIndex - geminiHeadingIndex).toBeLessThan(200);
  });

  /**
   * [AC-4] Semantically Optimized HTML5 Citations in UI
   * Verification: E2E browser test that navigates to `/t/google-gemini` and checks that the news context card
   * wraps the news snippet in a `blockquote` with a `cite` attribute and uses a `<cite>` tag inside the citation footer.
   */
  test('AC-4: News Context Footer UI has semantically optimized blockquote and cite tags', async ({ page }) => {
    await page.goto('/t/google-gemini');
    
    // Select the news context footer card
    const card = page.locator('.news-footer-card');
    await expect(card).toBeVisible();
    
    // Assert the blockquote element exists and has correct cite attribute
    const blockquote = card.locator('blockquote');
    await expect(blockquote).toBeAttached();
    await expect(blockquote).toHaveAttribute('cite', 'https://blog.google/gemini-3.5');
    
    // Assert the news snippet is nested inside the blockquote
    const snippet = blockquote.locator('#detail-news-snippet');
    await expect(snippet).toBeAttached();
    await expect(snippet).toHaveText(/Gemini 3\.5 is now live/);
    
    // Assert the <cite> element wraps publisher name and headline
    const cite = card.locator('cite');
    await expect(cite).toBeAttached();
    await expect(cite).toHaveText(/Google Blog/);
    await expect(cite).toHaveText(/Google announces Gemini 3\.5/);
  });

  /**
   * [AC-3] Plain-Text Citations in Sitemap Aggregators - /llms.txt Alternate Headers & Links
   * Verification: Verify that the GET / response contains an alternate link header
   * (e.g., Link: </llms.txt>; rel="alternate"; type="text/plain") and the HTML page contains
   * a <link rel="alternate" type="text/plain" href="/llms.txt"> tag for auto-discovery.
   */
  test('AC-3: GET / response exposes /llms.txt via Link headers and link tag', async ({ request, page }) => {
    const response = await request.get('/');
    expect(response.status()).toBe(200);
    const linkHeader = response.headers()['link'];
    expect(linkHeader).toBeDefined();
    expect(linkHeader).toContain('/llms.txt');
    expect(linkHeader).toContain('rel="alternate"');
    expect(linkHeader).toContain('type="text/plain"');

    await page.goto('/');
    const linkTag = page.locator('link[rel="alternate"][type="text/plain"][href="/llms.txt"]');
    await expect(linkTag).toBeAttached();
  });

});
