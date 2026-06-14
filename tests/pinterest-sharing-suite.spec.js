import { test, expect } from '@playwright/test';

// [AC-3] Pinterest Post Generation Mock Logic Test
test.describe('Pinterest Integration & Scheduled Viral Poster Suite', () => {
  const mockTrends = [
    {
      id: 1,
      title: 'Google Gemini',
      traffic: '100K+',
      description: 'The latest AI models from Google.',
      source: 'google',
      news: {
        headline: 'Google announces Gemini 3.5',
        snippet: 'Gemini 3.5 is now live with advanced reasoning capabilities.',
        url: 'https://blog.google/gemini-3.5',
        source: 'Google Blog'
      }
    }
  ];

  const mockExplanation = {
    hook: 'Gemini is capturing developer mindshare with low latency and long context.',
    whatIsIt: 'Google Gemini is a suite of multimodal generative AI models.',
    whyIsItViral: ['Long context window', 'Low latency API', 'Reasoning capability'],
    takeaway: 'Expect Gemini to power next-gen agentic workflows.',
    polls: { overrated: 5, genius: 15 }
  };

  test.beforeEach(async ({ page }) => {
    // Intercept standard APIs
    await page.route('**/api/trends', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockTrends),
      });
    });

    await page.route('**/api/explain', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockExplanation),
      });
    });
  });

  // [AC-1] Pinterest Share Pill & Intent in UI
  test('Verify Pinterest Share Pill and UI selection', async ({ page }) => {
    await page.goto('/');
    const shareBtn = page.locator('#btn-share-trend');
    await expect(shareBtn).toBeVisible();
    await shareBtn.click();

    // Verify Pinterest pill is present and styled correctly
    const pinterestPill = page.locator('.platform-pill[data-platform="pinterest"]');
    await expect(pinterestPill).toBeVisible();
    await expect(pinterestPill).toHaveText('Pinterest');

    // Click Pinterest pill and verify it triggers generation
    let lastPostPayload = null;
    await page.route('**/api/generate-post', async (route) => {
      lastPostPayload = route.request().postDataJSON();
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          postText: 'Pin Title: Google Gemini\n\nPin Description: The latest AI models from Google.. Explore live sentiment: https://viraljacker.com/t/google-gemini #GoogleGemini #Tech'
        }),
      });
    });

    await pinterestPill.click();
    await expect.poll(() => lastPostPayload).not.toBeNull();
    expect(lastPostPayload.platform).toBe('pinterest');

    const previewTextarea = page.locator('#share-preview-text');
    await expect(previewTextarea).toHaveValue(/Pin Title: Google Gemini/);
  });

  // [AC-1] [AC-3] Outbound Link Intent for Pinterest
  test('Verify Pinterest Outbound Intent Link Formatting', async ({ page, context }) => {
    await page.goto('/');
    await page.locator('#btn-share-trend').click();

    await page.route('**/api/generate-post', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          postText: 'Pin Title: Google Gemini\n\nPin Description: description text'
        }),
      });
    });

    const pinterestPill = page.locator('.platform-pill[data-platform="pinterest"]');
    await pinterestPill.click();
    await expect(page.locator('#share-preview-text')).toHaveValue(/Pin Title: Google Gemini/);

    // Click Post/Share and intercept window.open redirecting to Pinterest button url
    const [newPage] = await Promise.all([
      context.waitForEvent('page'),
      page.locator('#btn-post-share').click()
    ]);

    await expect(async () => {
      const url = newPage.url();
      expect(url).toContain('https://www.pinterest.com/pin/create/button/');
      expect(url).toContain('url=https%3A%2F%2Fviraljacker.com%2Ft%2Fgoogle-gemini');
      expect(url).toContain('media=https%3A%2F%2Fviraljacker.com%2Fapi%2Fog%2Fgoogle-gemini');
      expect(url).toContain('description=Pin%20Title%3A%20Google%20Gemini');
    }).toPass();
  });

  // [AC-2] Dynamic OpenGraph Image Route
  test('Verify GET /api/og/:slug returns valid PNG preview image', async ({ request }) => {
    const response = await request.get('/api/og/google-gemini');
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toBe('image/png');

    const body = await response.body();
    const pngSignature = body.slice(0, 8).toString('hex');
    expect(pngSignature).toBe('89504e470d0a1a0a');

    const width = body.readUInt32BE(16);
    const height = body.readUInt32BE(20);
    expect(width).toBe(1200);
    expect(height).toBe(630);
  });

  // [AC-2] Meta Tags Injection for Pinterest Rich Pins
  test('Verify Meta Tags Injection on trend pages', async ({ page }) => {
    await page.goto('/t/google-gemini');

    const ogImage = page.locator('meta[property="og:image"]');
    await expect(ogImage).toHaveAttribute('content', 'https://viraljacker.com/api/og/google-gemini');

    const ogImageWidth = page.locator('meta[property="og:image:width"]');
    await expect(ogImageWidth).toHaveAttribute('content', '1200');

    const ogImageHeight = page.locator('meta[property="og:image:height"]');
    await expect(ogImageHeight).toHaveAttribute('content', '630');

    const twitterImage = page.locator('meta[name="twitter:image"]');
    await expect(twitterImage).toHaveAttribute('content', 'https://viraljacker.com/api/og/google-gemini');
  });

  // [AC-3] Pinterest Post Generation Logic Endpoint
  test('Verify /api/generate-post supports platform pinterest with mock fallback format', async ({ request }) => {
    const response = await request.post('/api/generate-post', {
      data: {
        trendTitle: 'Google Gemini',
        platform: 'pinterest',
        contextType: 'general'
      }
    });
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.postText).toContain('Pin Title: Google Gemini');
    expect(body.postText).toContain('Pin Description:');
    expect(body.postText).toContain('Explore live sentiment: https://viraljacker.com/t/google-gemini');
    expect(body.postText).toContain('#');
  });

  // [AC-4] Scheduled Viral Poster Backend and Log Persistence
  test('Verify POST /api/cron/viral-poster schedules posts and GET /api/viral-poster/history retrieves them', async ({ request }) => {
    // 1. Run the Cron Endpoint
    const runResponse = await request.post('/api/cron/viral-poster');
    expect(runResponse.status()).toBe(200);
    const runBody = await runResponse.json();
    expect(runBody.success).toBe(true);
    expect(Array.isArray(runBody.posted)).toBe(true);
    expect(runBody.posted.length).toBeGreaterThan(0);

    // Verify all major platforms are represented
    const platforms = runBody.posted.map(p => p.platform);
    expect(platforms).toContain('x');
    expect(platforms).toContain('linkedin');
    expect(platforms).toContain('facebook');
    expect(platforms).toContain('pinterest');

    // 2. Fetch history and verify descending order
    const historyResponse = await request.get('/api/viral-poster/history');
    expect(historyResponse.status()).toBe(200);
    const history = await historyResponse.json();
    expect(history.length).toBeGreaterThanOrEqual(runBody.posted.length);

    // Assert descending order of ids or created_at
    for (let i = 1; i < history.length; i++) {
      const prevTime = new Date(history[i - 1].created_at).getTime();
      const currTime = new Date(history[i].created_at).getTime();
      expect(prevTime).toBeGreaterThanOrEqual(currTime);
    }
  });

  // [AC-5] Scheduled Poster Dashboard UI
  test('Verify dashboard renders the Viral Poster Log collapsible panel and history feed', async ({ page }) => {
    // Intercept history endpoint to return mock records
    await page.route('**/api/viral-poster/history', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 1,
            trend: 'Google Gemini',
            platform: 'pinterest',
            post_text: 'Pin Title: Google Gemini\n\nPin Description: description text',
            created_at: new Date().toISOString()
          },
          {
            id: 2,
            trend: 'Google Gemini',
            platform: 'x',
            post_text: 'X post text',
            created_at: new Date(Date.now() - 60000).toISOString()
          }
        ])
      });
    });

    await page.goto('/');

    // Verify presence of the dashboard section/panel
    const posterLogPanel = page.locator('#viral-poster-log, .viral-poster-log, #viral-poster-panel');
    await expect(posterLogPanel).toBeVisible();

    // Verify rendered feed items
    const logItems = posterLogPanel.locator('.log-item, .history-card, .viral-post-card');
    await expect(logItems).toHaveCount(2);

    // Verify details on the first card
    const firstCard = logItems.nth(0);
    await expect(firstCard.locator('.platform-badge')).toHaveText(/pinterest/i);
    await expect(firstCard.locator('.post-text')).toHaveText(/Pin Title: Google Gemini/);
    await expect(firstCard.locator('.timestamp, .post-time')).toBeVisible();
  });
});
