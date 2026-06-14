import { test, expect } from '@playwright/test';
import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Resolve database path
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.resolve(__dirname, '../polls.db');

test.describe('SPEC T2: Multi-lingual SEO, Trend Continuation Probability & Feed Polish Tests', () => {

  // =========================================================================
  // [AC-1] Multi-lingual Canonical & Hreflang Link Injection
  // =========================================================================
  test('AC-1: GET / and detail pages render lowercase canonical and alternate hreflang links', async ({ page }) => {
    // 1. Check Homepage Canonical (normalized to lowercase)
    await page.goto('/');
    const canonicalHome = page.locator('head link[rel="canonical"]');
    await expect(canonicalHome).toHaveAttribute('href', 'https://viraljacker.com/');

    // 2. Check Detail Page Canonical
    await page.goto('/t/google-gemini');
    const canonicalDetail = page.locator('head link[rel="canonical"]');
    await expect(canonicalDetail).toHaveAttribute('href', 'https://viraljacker.com/t/google-gemini');

    // 3. Check Alternate Hreflang Tags on detail pages (en, es, fr, ja, x-default)
    const alternateLanguages = ['x-default', 'en', 'es', 'fr', 'ja'];
    for (const lang of alternateLanguages) {
      const selector = `head link[rel="alternate"][hreflang="${lang}"]`;
      const altLink = page.locator(selector);
      await expect(altLink).toBeAttached();
      
      const expectedHref = (lang === 'x-default' || lang === 'en')
        ? 'https://viraljacker.com/t/google-gemini'
        : `https://viraljacker.com/t/google-gemini/${lang}`;
      await expect(altLink).toHaveAttribute('href', expectedHref);
    }

    // 4. Check Localized Detail Page Canonical
    await page.goto('/t/google-gemini/es');
    const canonicalLoc = page.locator('head link[rel="canonical"]');
    await expect(canonicalLoc).toHaveAttribute('href', 'https://viraljacker.com/t/google-gemini/es');

    // 5. Mixed case URL triggers redirection and serves normalized canonical URL
    await page.goto('/t/Google-Gemini');
    await expect(page).toHaveURL(/\/t\/google-gemini$/);
    const canonicalMixed = page.locator('head link[rel="canonical"]');
    await expect(canonicalMixed).toHaveAttribute('href', 'https://viraljacker.com/t/google-gemini');
  });

  test('AC-1: Detail and localized views serve enriched JSON-LD NewsArticle with db created_at timestamps and source citation', async ({ page }) => {
    const db = new DatabaseSync(dbPath);
    db.exec('PRAGMA busy_timeout = 5000;');
    db.exec('PRAGMA journal_mode = WAL;');
    const trendName = 'Json Ld Test Trend';
    const slug = 'json-ld-test-trend';
    const customCreatedAt = '2026-06-12T08:00:00.000Z';
    
    try {
      db.prepare(`
        INSERT OR REPLACE INTO trend_explanations (trend, explanation, created_at)
        VALUES (?, ?, ?)
      `).run(
        trendName,
        JSON.stringify({
          hook: 'Testing JSON-LD fields',
          whatIsIt: 'A test trend for schema verification',
          whyIsItViral: ['Automated tests running'],
          takeaway: 'Confirming it works',
          continuationProbability: 80,
          continuationRationale: 'Mocked continuation rationale based on test parameters.'
        }),
        customCreatedAt
      );
    } finally {
      db.close();
    }

    try {
      // Navigate to newly seeded detail page
      await page.goto(`/t/${slug}`);
      
      // Extract and parse JSON-LD
      const scriptContent = await page.locator('script[type="application/ld+json"]').first().textContent();
      const jsonLd = JSON.parse(scriptContent.trim());

      expect(jsonLd['@context']).toBe('https://schema.org');
      expect(jsonLd['@type']).toBe('NewsArticle');
      expect(jsonLd['mainEntityOfPage']).toBe(`https://viraljacker.com/t/${slug}`);
      expect(jsonLd['datePublished']).toBe(customCreatedAt);
      expect(jsonLd['dateModified']).toBe(customCreatedAt);
    } finally {
      // Cleanup seeded DB entry
      const cleanupDb = new DatabaseSync(dbPath);
      cleanupDb.exec('PRAGMA busy_timeout = 5000;');
      cleanupDb.exec('PRAGMA journal_mode = WAL;');
      try {
        cleanupDb.prepare('DELETE FROM trend_explanations WHERE trend = ?').run(trendName);
      } finally {
        cleanupDb.close();
      }
    }
  });


  // =========================================================================
  // [AC-2] Multi-lingual IndexNow Submission
  // =========================================================================
  test('AC-2: IndexNow submissions include English and localized variant URLs in lowercase, trimmed and deduplicated', async () => {
    const { pingSearchEngines } = await import('../indexing.js');
    // Run under test mode, which returns the urls without calling global fetch or node-fetch
    const result = await pingSearchEngines(['  Google-Gemini  ', 'google-gemini']);
    expect(result.success).toBe(true);
    expect(result.urls).toBeDefined();
    
    // Exactly 4 URLs should be in the list, fully lowercased and deduplicated
    const urls = result.urls;
    expect(urls).toHaveLength(4);
    expect(urls).toContain('https://viraljacker.com/t/google-gemini');
    expect(urls).toContain('https://viraljacker.com/t/google-gemini/es');
    expect(urls).toContain('https://viraljacker.com/t/google-gemini/fr');
    expect(urls).toContain('https://viraljacker.com/t/google-gemini/ja');
  });


  // =========================================================================
  // [AC-3] Trend Continuation Probability Engine
  // =========================================================================
  test('AC-3: Trend explain endpoint returns continuation fields, preserves them in translations, and database cache supports them', async ({ request }) => {
    // 1. Verify default values in test environment
    const res = await request.post('/api/explain', {
      data: { trend: 'google-gemini' }
    });
    expect(res.ok()).toBe(true);
    const data = await res.json();
    
    expect(data.continuationProbability).toBe(75);
    expect(data.continuationRationale).toBe('Mocked continuation rationale based on test parameters.');

    // 2. Localized path translates rationale and preserves probability
    const resEs = await request.post('/api/explain', {
      data: { trend: 'google-gemini', lang: 'es' }
    });
    expect(resEs.ok()).toBe(true);
    const dataEs = await resEs.json();
    expect(dataEs.continuationProbability).toBe(75);
    expect(dataEs.continuationRationale).toBe('Mocked continuation rationale based on test parameters. (en español)');

    // 3. Database caching persistence unit test
    const dbModule = await import('../db.js');
    const testTrend = `db-continuation-test-${Date.now()}`;
    const testExpl = {
      hook: 'Continuation Caching Hook',
      whatIsIt: 'Testing caching structure',
      whyIsItViral: ['testing'],
      takeaway: 'works',
      continuationProbability: 88,
      continuationRationale: 'Database cache works.'
    };

    await dbModule.setCachedExplanation(testTrend, testExpl);
    const cached = await dbModule.getCachedExplanation(testTrend);
    expect(cached).toBeDefined();
    expect(cached.continuationProbability).toBe(88);
    expect(cached.continuationRationale).toBe('Database cache works.');

    // Clean up
    const db = new DatabaseSync(dbPath);
    db.exec('PRAGMA busy_timeout = 5000;');
    db.exec('PRAGMA journal_mode = WAL;');
    try {
      db.prepare('DELETE FROM trend_explanations WHERE trend = ?').run(testTrend);
    } finally {
      db.close();
    }
  });


  // =========================================================================
  // [AC-4] Trend Continuation Probability UI Integration
  // =========================================================================
  test('AC-4: UI displays trend continuation probability score and rationale tooltip', async ({ page }) => {
    await page.goto('/t/google-gemini');

    const predictionCard = page.locator('#prediction-card-container');
    await expect(predictionCard).toBeVisible();

    // Verify presence of probability percentage pill / indicator
    const probIndicator = predictionCard.locator('.continuation-probability-score, .probability-indicator');
    await expect(probIndicator).toBeVisible();
    await expect(probIndicator).toHaveText(/75%/);

    // Verify hoverable tooltip or explanation text directly under the score
    const rationaleText = predictionCard.locator('.continuation-rationale-text, .rationale-tooltip');
    await expect(rationaleText).toBeVisible();
    await expect(rationaleText).toContainText('Mocked continuation rationale based on test parameters.');
  });


  // =========================================================================
  // [AC-5] Cost-Saving Caching & Schema Enforcement
  // =========================================================================
  test('AC-5: sessionStorage chat cache uses lowercased keys, prevents duplicate network calls, and database cache is normalized', async ({ page }) => {
    await page.goto('/t/google-gemini');
    await page.evaluate(() => sessionStorage.clear());

    let chatRequests = 0;
    await page.route('**/api/chat', async (route) => {
      chatRequests++;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ reply: 'Stub response' })
      });
    });

    const chatInput = page.locator('#chat-input');
    const chatSubmitBtn = page.locator('#chat-submit-btn');

    // First request
    const query = 'Is Gemini better than GPT?';
    await chatInput.fill(query);
    await chatSubmitBtn.click();

    await expect(page.locator('.chat-bubble.bot').first()).toBeVisible();
    expect(chatRequests).toBe(1);

    // Check sessionStorage contains lowercased key
    const sessionKeys = await page.evaluate(() => Object.keys(sessionStorage));
    const cacheKey = sessionKeys.find(k => k.startsWith('chat_cache:'));
    expect(cacheKey).toBeDefined();
    expect(cacheKey).toBe(cacheKey.toLowerCase());

    // Send duplicate request with different casing
    chatRequests = 0;
    await chatInput.fill(query.toUpperCase());
    await chatSubmitBtn.click();

    // Served from sessionStorage without network call
    await page.waitForTimeout(300);
    expect(chatRequests).toBe(0);

    // Verify database keys are normalized to lowercase on setCachedChatResponse
    const dbModule = await import('../db.js');
    const testTrend = 'Google Gemini';
    const testQuery = 'Is GEMINI Fast?';
    await dbModule.setCachedChatResponse(testTrend, testQuery, [], 'Cache value');

    const db = new DatabaseSync(dbPath);
    db.exec('PRAGMA busy_timeout = 5000;');
    db.exec('PRAGMA journal_mode = WAL;');
    try {
      const row = db.prepare('SELECT key FROM chat_cache WHERE key LIKE ?').get('%is gemini fast%');
      expect(row).toBeDefined();
      expect(row.key).toBe(row.key.toLowerCase());
    } finally {
      db.close();
    }
  });


  // =========================================================================
  // [AC-6] Feed Refresh Button and Post Optimization
  // =========================================================================
  test('AC-6: Refresh trends button updates feed in-place; social posts meet length and domain host requirements', async ({ page, request }) => {
    await page.goto('/');

    // 1. Sidebar refresh button
    const refreshBtn = page.locator('#btn-refresh-trends, .refresh-trends-btn');
    await expect(refreshBtn).toBeVisible();

    let refreshRequests = 0;
    await page.route('**/api/trends', async (route) => {
      refreshRequests++;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { title: 'Refreshed Trend 1', description: 'Updated desc 1', source: 'google' },
          { title: 'Refreshed Trend 2', description: 'Updated desc 2', source: 'google' }
        ])
      });
    });

    await refreshBtn.click();
    await expect.poll(() => refreshRequests).toBeGreaterThan(0);

    // Sidebar items should render the refreshed data in-place
    await expect(page.locator('.trend-item').first()).toContainText('Refreshed Trend 1');

    // 2. Social post character limits & target link formatting
    const resPost = await request.post('/api/generate-post', {
      data: {
        trendTitle: 'Google Gemini',
        platform: 'x',
        contextType: 'general'
      }
    });
    expect(resPost.ok()).toBe(true);
    const postData = await resPost.json();
    
    // Character limit constraint: under 280 characters for Twitter/X
    expect(postData.postText.length).toBeLessThan(280);
    // Link format check: uses production viraljacker.com/t/<slug> host
    expect(postData.postText).toContain('https://viraljacker.com/t/google-gemini');
  });

});
