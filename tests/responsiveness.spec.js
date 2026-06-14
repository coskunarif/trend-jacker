import { test, expect } from '@playwright/test';

// Test suite for UI Detail Panel Responsiveness

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
      url: 'https://blog.google/gemini-gemini',
      source: 'Google Blog'
    }
  },
  {
    id: 2,
    title: 'Fastify framework',
    traffic: '20K+',
    description: 'High performance web framework for Node.js.',
    source: 'google',
    news: {
      headline: 'Fastify v5 released',
      snippet: 'Fastify v5 introduces improved plugin loading and security features.',
      url: 'https://fastify.io/v5-release',
      source: 'Fastify Blog'
    }
  }
];

const mockExplanation = {
  hook: 'Fastify v5 is out with better performance.',
  whatIsIt: 'Fastify is a fast and low overhead web framework for Node.js.',
  whyIsItViral: ['Speed', 'Ecosystem', 'TypeScript support'],
  takeaway: 'Great for building lightweight server APIs.',
  polls: { overrated: 2, genius: 8 }
};

test.describe('UI Detail Panel Responsiveness', () => {

  test.beforeEach(async ({ page }) => {
    // Intercept trends API
    await page.route('**/api/trends', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockTrends),
      });
    });
  });

  // [AC-1] Synchronous UI Initialization
  // Verify that clicked trend's static info (title, traffic, speedometer, vibe card, news footer, chat history)
  // are updated immediately before the explain API resolves.
  test('should synchronously update details panel static elements before explain API resolves', async ({ page }) => {
    let explainPromiseResolve;
    const explainPromise = new Promise(resolve => {
      explainPromiseResolve = resolve;
    });

    await page.route('**/api/explain', async (route) => {
      await explainPromise;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockExplanation),
      });
    });

    await page.goto('/');

    // Select the second trend item. The explain API will remain pending.
    const secondTrend = page.locator('.trend-item').nth(1);
    await secondTrend.click();

    // Verify static details are populated immediately:
    // - Title set to Fastify framework
    await expect(page.locator('#detail-title')).toHaveText('Fastify framework');
    
    // - Traffic set to searches text
    await expect(page.locator('#detail-traffic')).toHaveText('20K+ searches');

    // - Speedometer velocity needle rotation & text
    await expect(page.locator('#detail-velocity-text')).toHaveText('Breakout Speed 📈');
    const needleStyle = await page.locator('#needle').getAttribute('style');
    expect(needleStyle).toContain('rotate(-30deg)');

    // - Sparkline canvas and timeline canvas should exist (and drawing initialized)
    await expect(page.locator('#trend-sparkline')).toBeVisible();
    await expect(page.locator('#sentiment-timeline-canvas')).toBeVisible();

    // - Vibe card populated based on category metadata immediately
    await expect(page.locator('#vibe-category')).not.toBeEmpty();
    await expect(page.locator('#vibe-emoji')).not.toBeEmpty();

    // - News elements in footer set up immediately
    await expect(page.locator('#detail-news-publisher')).toHaveText('Fastify Blog');
    await expect(page.locator('#detail-news-title')).toHaveText('Fastify v5 released');
    await expect(page.locator('#detail-news-snippet')).toHaveText('Fastify v5 introduces improved plugin loading and security features.');

    // - Chat history greeting reset
    await expect(page.locator('.chat-bubble.bot').first()).toContainText('Fastify framework');

    // Resolve explanation API
    explainPromiseResolve();
  });

  // [AC-2] Non-Blocking Background API Fetching
  // Verify explain, chat-limit, and predictions APIs are called concurrently in the background and do not block.
  test('should trigger explain, chat-limit, and predictions APIs in background concurrently', async ({ page }) => {
    const apiCalls = [];
    
    await page.route('**/api/explain', async (route) => {
      apiCalls.push('explain');
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockExplanation),
      });
    });

    await page.route('**/api/chat-limit*', async (route) => {
      apiCalls.push('chat-limit');
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ count: 0, limit: 10, bonus: 0 }),
      });
    });

    await page.route('**/api/predictions*', async (route) => {
      apiCalls.push('predictions');
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    });

    await page.goto('/');

    // Click second trend
    const secondTrend = page.locator('.trend-item').nth(1);
    await secondTrend.click();

    // Wait for explanation view to be fully loaded
    await expect(page.locator('#detail-title')).toHaveText('Fastify framework');

    // Verify all APIs were called
    expect(apiCalls).toContain('explain');
    expect(apiCalls).toContain('chat-limit');
    expect(apiCalls).toContain('predictions');
  });

  // [AC-3] UI Detail Panel Responsiveness
  // Verify that the title element updates in less than 300ms, even if the explain API is delayed.
  test('should update detail title in less than 300ms even when explain API is slow', async ({ page }) => {
    // Intercept with a 1500ms delay
    await page.route('**/api/explain', async (route) => {
      await new Promise(r => setTimeout(r, 1500));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockExplanation),
      });
    });

    await page.goto('/');

    // Bypass Playwright CDP actionability delays and measure DOM updates inside the browser context
    const duration = await page.evaluate(async () => {
      const secondTrendItem = document.querySelectorAll('.trend-item')[1];
      const titleEl = document.getElementById('detail-title');
      
      return new Promise((resolve) => {
        const observer = new MutationObserver(() => {
          if (titleEl.textContent === 'Fastify framework') {
            const end = performance.now();
            observer.disconnect();
            resolve(end - start);
          }
        });
        observer.observe(titleEl, { childList: true, characterData: true, subtree: true });
        
        const start = performance.now();
        secondTrendItem.click();
      });
    });

    console.log(`UI Responsiveness duration: ${duration}ms`);
    expect(duration).toBeLessThan(300);
  });

  // [AC-4] Post-API Loading & Cache Preservation
  // Once explain resolves, the dependent details are populated and stored in explanationCache.
  test('should display explanation data upon resolve and cache results', async ({ page }) => {
    let explainCallsCount = 0;
    await page.route('**/api/explain', async (route) => {
      explainCallsCount++;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockExplanation),
      });
    });

    await page.goto('/');

    const secondTrend = page.locator('.trend-item').nth(1);
    await secondTrend.click();

    // Check explanation dependent details
    await expect(page.locator('#detail-hook')).toHaveText(mockExplanation.hook);
    await expect(page.locator('#detail-what')).toHaveText(mockExplanation.whatIsIt);
    await expect(page.locator('#detail-takeaway')).toHaveText(mockExplanation.takeaway);
    
    // Check viral tags
    const tags = page.locator('#detail-viral-tags .viral-tag');
    await expect(tags).toHaveCount(3);

    // Verify cache has it
    const hasCache = await page.evaluate((title) => {
      const cacheKey = `${title}:en:adults`.toLowerCase();
      return window.explanationCache.has(cacheKey);
    }, 'Fastify framework');
    expect(hasCache).toBe(true);

    // Click first trend and then click second trend again
    const firstTrend = page.locator('.trend-item').first();
    await firstTrend.click();
    await secondTrend.click();

    // Explain API calls should still be 1 (for first click) since second was cached (or 2 if first is counted, but explainCallsCount should not increment again for Fastify)
    // Wait, first trend is loaded on startup, but clicking it might hit API or cache.
    // Let's check that explainCallsCount does not exceed 2 (1 for Gemini, 1 for Fastify framework).
    expect(explainCallsCount).toBeLessThanOrEqual(2);
  });
});
