import { test, expect } from '@playwright/test';

test.describe('TrendJacker E2E tests', () => {
  // Mock API data matching the server's test mode defaults
  const mockTrends = [
    {
      id: 1,
      title: 'Google Gemini',
      traffic: '100K+',
      description: 'The latest AI models from Google.',
      news: {
        headline: 'Google announces Gemini 3.5',
        snippet: 'Gemini 3.5 is now live with advanced reasoning capabilities.',
        url: 'https://blog.google/gemini-3.5',
        source: 'Google Blog'
      }
    },
    {
      id: 2,
      title: 'Fastify framework',
      traffic: '20K+',
      description: 'High performance web framework for Node.js.',
      news: {
        headline: 'Fastify v5 released',
        snippet: 'Fastify v5 introduces improved plugin loading and security features.',
        url: 'https://fastify.io/v5-release',
        source: 'Fastify Blog'
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

  test('should load the homepage and render the layout correctly', async ({ page }) => {
    // Intercept trends API to return empty list so the welcome view remains visible
    await page.route('**/api/trends', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    });

    await page.goto('/');

    // Check header/title
    await expect(page).toHaveTitle(/TrendJacker/);
    const logoText = page.locator('.logo-text');
    await expect(logoText).toHaveText('TrendJacker');

    // Welcome view should be visible on load when no trends are selected
    const welcomeView = page.locator('#welcome-view');
    await expect(welcomeView).toBeVisible();

    // Explainer view should be hidden
    const explainerView = page.locator('#explainer-view');
    await expect(explainerView).toHaveClass(/hidden/);
  });

  test('should select a trend and display its explainer details', async ({ page }) => {
    // Intercept trends and explain API (or use server default mocks)
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

    await page.goto('/');

    // By default, the app selects the first trend automatically when a list is returned.
    // So the welcome view should already be hidden.
    const welcomeView = page.locator('#welcome-view');
    await expect(welcomeView).toHaveClass(/hidden/);

    // Explainer view should be visible
    const explainerView = page.locator('#explainer-view');
    await expect(explainerView).toBeVisible();

    // Verify populated explainer contents for the first item
    await expect(page.locator('#detail-title')).toHaveText('Google Gemini');
    await expect(page.locator('#detail-traffic')).toHaveText('100K+ searches');
    await expect(page.locator('#detail-hook')).toHaveText(mockExplanation.hook);
    await expect(page.locator('#detail-what')).toHaveText(mockExplanation.whatIsIt);
    await expect(page.locator('#detail-takeaway')).toHaveText(mockExplanation.takeaway);

    // Verify viral tags
    const tags = page.locator('.viral-tag');
    await expect(tags).toHaveCount(3);
    await expect(tags.nth(0)).toHaveText('Long context window');
    await expect(tags.nth(1)).toHaveText('Low latency API');
    await expect(tags.nth(2)).toHaveText('Reasoning capability');

    // Verify news footer details
    await expect(page.locator('#detail-news-title')).toHaveText(mockTrends[0].news.headline);
    await expect(page.locator('#detail-news-snippet')).toHaveText(mockTrends[0].news.snippet);

    // Mock explain response for the second trend
    await page.route('**/api/explain', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          hook: 'Fastify v5 is out with better performance.',
          whatIsIt: 'Fastify is a fast and low overhead web framework for Node.js.',
          whyIsItViral: ['Speed', 'Ecosystem', 'TypeScript support'],
          takeaway: 'Great for building lightweight server APIs.',
          polls: { overrated: 2, genius: 8 }
        }),
      });
    });

    // Select the second trend item
    const secondTrend = page.locator('.trend-item').last();
    await secondTrend.click();

    // Verify detail-title is updated to Fastify framework
    await expect(page.locator('#detail-title')).toHaveText('Fastify framework');
    await expect(page.locator('#detail-hook')).toHaveText('Fastify v5 is out with better performance.');
  });

  test('should submit a sentiment vote and update poll percentages', async ({ page }) => {
    // Intercept trends and explain API
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

    // Mock poll submission to return updated counts: genius = 18, overrated = 6 (total = 24 => genius = 75%)
    await page.route('**/api/poll', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ genius: 18, overrated: 6 }),
      });
    });

    await page.goto('/');

    // Click Genius button
    await page.locator('#btn-vote-genius').click();

    // Check poll results visibility
    const pollResults = page.locator('#poll-results');
    await expect(pollResults).toBeVisible();

    // Check percentages
    await expect(page.locator('#pct-genius')).toHaveText('75%');
    await expect(page.locator('#pct-overrated')).toHaveText('25%');
  });

  test('should ask follow-up questions and update chat history', async ({ page }) => {
    // Intercept trends, explain, and chat API
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

    const mockReply = 'Google offers Gemini Advanced and public developer APIs for Gemini 1.5 and 2.0.';
    await page.route('**/api/chat', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ reply: mockReply }),
      });
    });

    await page.goto('/');

    // Fill follow-up query
    const chatInput = page.locator('#chat-input');
    await chatInput.fill('Where can I access Gemini models?');

    // Submit form by clicking submit button
    await page.locator('#chat-submit-btn').click();

    // Verify chat messages in history
    const userBubble = page.locator('.chat-bubble.user');
    await expect(userBubble).toHaveText('Where can I access Gemini models?');

    const assistantBubble = page.locator('.chat-bubble.bot').last();
    await expect(assistantBubble).toHaveText(mockReply);
  });

  test('should display live sentiment updates from SSE feed', async ({ page }) => {
    await page.goto('/');

    // Wait for at least one item to render in the live sentiment feed
    // Wait up to 10 seconds because SSE ticks every 4 seconds
    const feedItem = page.locator('#live-sentiment-feed .feed-item').first();
    await expect(feedItem).toBeVisible({ timeout: 12000 });

    const feedContent = await feedItem.textContent();
    expect(feedContent).toContain('voted');
    expect(feedContent).toContain('on');
  });

  test('should load debate arena, render turns, and submit verdict', async ({ page }) => {
    // Intercept trends, explain, debate, and debate vote API
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

    await page.route('**/api/debate', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          turns: [
            { speaker: 'optimist', message: 'Optimist opening argument' },
            { speaker: 'skeptic', message: 'Skeptic counter argument' },
            { speaker: 'optimist', message: 'Optimist final rebuttal' }
          ],
          votes: { optimistWins: 10, skepticWins: 10 }
        }),
      });
    });

    await page.route('**/api/debate/vote', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ optimistWins: 15, skepticWins: 10 }),
      });
    });

    await page.goto('/');

    // Verify debate messages are loading initially
    const optimistBubble = page.locator('.debate-bubble-wrap.optimist').first();
    const skepticBubble = page.locator('.debate-bubble-wrap.skeptic').first();

    // Verify turn 1 renders
    await expect(optimistBubble).toBeVisible();
    await expect(optimistBubble.locator('.debate-bubble')).toHaveText(/Optimist opening argument/);

    // Wait for Turn 2 and Turn 3 to render sequentially (within 4 seconds total)
    await expect(skepticBubble).toBeVisible({ timeout: 5000 });
    await expect(skepticBubble.locator('.debate-bubble')).toHaveText(/Skeptic counter argument/);

    // Verify verdict panel is revealed after turns finish
    const verdictPanel = page.locator('#debate-verdict-panel');
    await expect(verdictPanel).toBeVisible({ timeout: 5000 });

    // Click Optimist wins button
    await page.locator('#btn-verdict-optimist').click();

    // Check results visibility and updated percentages (15 wins vs 10 wins => 60% vs 40%)
    const results = page.locator('#debate-results');
    await expect(results).toBeVisible();
    await expect(page.locator('#pct-optimist')).toHaveText('60%');
    await expect(page.locator('#pct-skeptic')).toHaveText('40%');
  });

  test('should load trend details directly from slug-based route', async ({ page }) => {
    await page.goto('/t/google-gemini');

    // Welcome view should be hidden
    const welcomeView = page.locator('#welcome-view');
    await expect(welcomeView).toHaveClass(/hidden/);

    // Explainer view should be visible
    const explainerView = page.locator('#explainer-view');
    await expect(explainerView).toBeVisible();

    // Verify populated explainer contents for the slug
    await expect(page.locator('#detail-title')).toHaveText('Google Gemini');
  });

  test('should serve a valid XML sitemap at /sitemap.xml', async ({ request }) => {
    const response = await request.get('/sitemap.xml');
    expect(response.status()).toBe(200);
    const contentType = response.headers()['content-type'];
    expect(contentType).toContain('xml');
    const text = await response.text();
    expect(text).toContain('<urlset');
    expect(text).toContain('<loc>');
    expect(text).toContain('/t/google-gemini');
    expect(text).toContain('/t/fastify-framework');
  });

  test('should serve the IndexNow verification key at /trendjackerkey2026.txt', async ({ request }) => {
    const response = await request.get('/trendjackerkey2026.txt');
    expect(response.status()).toBe(200);
    const contentType = response.headers()['content-type'];
    expect(contentType).toContain('text/plain');
    const text = await response.text();
    expect(text.trim()).toBe('trendjackerkey2026');
  });

  test('should support responsive layout, mobile sidebar toggling, and auto-close on select', async ({ page }) => {
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

    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');

    const toggleBtn = page.locator('#sidebar-toggle');
    await expect(toggleBtn).toBeVisible();

    const sidebar = page.locator('.sidebar-panel');
    await expect(sidebar).not.toHaveClass(/open/);

    await toggleBtn.click();
    await expect(sidebar).toHaveClass(/open/);

    const firstTrend = page.locator('.trend-item').first();
    await firstTrend.click();
    await expect(sidebar).not.toHaveClass(/open/);

    await expect(page.locator('#explainer-view')).toBeVisible();
    await expect(page.locator('#detail-title')).toHaveText('Google Gemini');
  });
});
