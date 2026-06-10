import { test, expect } from '@playwright/test';

test.describe('TJ-24: Desktop Tabbed Sidebar & Live Feed Hydration Tests', () => {
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

  test('1. Verify Startup Hydration & Staggered Timestamps', async ({ page }) => {
    // Inject MockEventSource to mock SSE
    await page.addInitScript(() => {
      window.mockEventSources = [];
      class MockEventSource extends EventTarget {
        constructor(url) {
          super();
          this.url = url;
          window.mockEventSources.push(this);
          
          // Send hydration event after a small delay
          setTimeout(() => {
            const hydrationData = Array.from({ length: 10 }).map((_, i) => ({
              trend: 'Google Gemini',
              vote: i % 2 === 0 ? 'genius' : 'overrated',
              location: { city: 'London', country: 'United Kingdom', flag: '🇬🇧' },
              clientId: `client-${i}`,
              timestamp: Date.now() - i * 90000 // staggered
            }));

            const event = new MessageEvent('hydration', {
              data: JSON.stringify(hydrationData)
            });
            this.dispatchEvent(event);
          }, 100);
        }
        close() {}
      }
      window.EventSource = MockEventSource;
    });

    await page.goto('/');

    // Wait for feed items to render
    const feedList = page.locator('#live-sentiment-feed');
    await expect(feedList).toBeVisible();

    // Verify empty state is removed and 10 items are rendered
    const emptyState = page.locator('#live-sentiment-feed .feed-empty-state');
    await expect(emptyState).not.toBeVisible();

    const feedItems = page.locator('#live-sentiment-feed .feed-item');
    await expect(feedItems).toHaveCount(10);

    // Verify content of first item
    const firstItem = feedItems.first();
    await expect(firstItem.locator('.feed-item-flag')).toHaveText('🇬🇧');
    await expect(firstItem.locator('.feed-item-user')).toContainText('London, United Kingdom');
    await expect(firstItem.locator('.feed-item-trend')).toHaveText('Google Gemini');
  });

  test('2. Verify Desktop Tab Toggle & Scroll Heights', async ({ page }) => {
    // Set viewport to desktop
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');

    // Verify tabs switcher is visible on desktop
    const sidebarTabs = page.locator('.sidebar-tabs');
    await expect(sidebarTabs).toBeVisible();

    // Click Sentiment Feed tab
    const sentimentTab = page.locator('.tab-btn[data-tab="sentiment"]');
    await sentimentTab.click();

    // Verify trends-list is hidden and live-feed-section is visible
    const trendsList = page.locator('#trends-list');
    const liveFeedSection = page.locator('.live-feed-section');
    await expect(trendsList).not.toBeVisible();
    await expect(liveFeedSection).toBeVisible();

    // Verify scroll heights (active panels take 100% of height with overflow-y: auto)
    await expect(liveFeedSection).toHaveCSS('overflow-y', 'auto');

    // Click Trending Searches tab
    const trendingTab = page.locator('.tab-btn[data-tab="trending"]');
    await trendingTab.click();
    await expect(trendsList).toBeVisible();
    await expect(liveFeedSection).not.toBeVisible();
    await expect(trendsList).toHaveCSS('overflow-y', 'auto');
  });

  test('3. Verify Timezone Location & User Vote Attribution', async ({ page }) => {
    // Intercept poll submission
    let pollPayload = null;
    await page.route('**/api/poll', async (route) => {
      pollPayload = route.request().postDataJSON();
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ genius: 16, overrated: 5 }),
      });
    });

    // Mock timezone in resolvedOptions to Europe/London
    await page.addInitScript(() => {
      window.mockEventSources = [];
      class MockEventSource extends EventTarget {
        constructor(url) {
          super();
          this.url = url;
          window.mockEventSources.push(this);
        }
        close() {}
      }
      window.EventSource = MockEventSource;

      // Mock timezone
      Intl.DateTimeFormat.prototype.resolvedOptions = () => ({
        timeZone: 'Europe/London',
        locale: 'en-GB'
      });
    });

    await page.goto('/');

    // Perform a vote to trigger API call
    const voteBtn = page.locator('#btn-vote-genius');
    await voteBtn.click();

    // Wait for the request and verify payload has localClientId and timezone-resolved location
    await expect.poll(() => pollPayload).not.toBeNull();
    expect(pollPayload.clientId).toBeDefined();
    expect(pollPayload.location).toBeDefined();
    // It should be mapped from Europe/London timezone to city/country/flag
    expect(pollPayload.location.city).toBe('London');
    expect(pollPayload.location.country).toBe('United Kingdom');

    // Send SSE event back to client with matching clientId and verify "(You)" is appended
    const clientSideId = pollPayload.clientId;
    await page.evaluate((clientId) => {
      const es = window.mockEventSources[0];
      if (es) {
        const event = new MessageEvent('message', {
          data: JSON.stringify({
            trend: 'Google Gemini',
            vote: 'genius',
            location: { city: 'London', country: 'United Kingdom', flag: '🇬🇧' },
            clientId: clientId,
            timestamp: Date.now()
          })
        });
        es.dispatchEvent(event);
      }
    }, clientSideId);

    // Verify first feed item has '(You)' appended to user location
    const firstUserText = await page.locator('#live-sentiment-feed .feed-item').first().locator('.feed-item-user').textContent();
    expect(firstUserText).toContain('(You)');
  });

  test('4. Verify Dismissible Static Banner', async ({ page }) => {
    await page.goto('/');

    // Activate Sentiment Feed tab to see the banner
    const sentimentTab = page.locator('.tab-btn[data-tab="sentiment"]');
    await sentimentTab.click();

    // Verify explanation banner is visible with correct copy
    const banner = page.locator('#sentiment-explanation-banner');
    await expect(banner).toBeVisible();
    await expect(banner).toContainText('This feed displays live community sentiment from around the world. Select any trending topic to cast your vote!');

    // Click close button on the banner
    const closeBtn = page.locator('#btn-close-banner');
    await closeBtn.click();

    // Assert banner is hidden
    await expect(banner).not.toBeVisible();

    // Reload page and verify it remains hidden (persistence via localStorage)
    await page.reload();
    await sentimentTab.click();
    await expect(banner).not.toBeVisible();
  });
});
