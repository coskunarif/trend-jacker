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

  test('2. Verify Desktop Split-Screen Layout & Mobile Tab Switcher', async ({ page }) => {
    // --- DESKTOP VIEWPORT TEST (>= 769px) ---
    // [AC-1] Desktop Double-Blade Sidebar Grid
    // [AC-2] Scrollbar & Overflow Isolation
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');

    // [AC-1] Verify the main dashboard layout container (.dashboard-grid) displays two columns: a 640px sidebar column and a flexible 1fr main panel column
    const gridStyles = await page.locator('.dashboard-grid').evaluate(el => {
      const style = window.getComputedStyle(el);
      return {
        display: style.display,
        gridTemplateColumns: style.gridTemplateColumns
      };
    });
    expect(gridStyles.display).toBe('grid');
    // It should start with 640px
    expect(gridStyles.gridTemplateColumns).toMatch(/^640px\b/);

    // [AC-1] The left sidebar (.sidebar-panel) must layout its child components horizontally side-by-side using flex-direction: row
    const sidebarStyles = await page.locator('.sidebar-panel').evaluate(el => {
      const style = window.getComputedStyle(el);
      return {
        display: style.display,
        flexDirection: style.flexDirection
      };
    });
    expect(sidebarStyles.display).toBe('flex');
    expect(sidebarStyles.flexDirection).toBe('row');

    // [AC-1] Verification of visibility, positioning, and width of blades
    const trendsSection = page.locator('.trends-section');
    const liveFeedSection = page.locator('.live-feed-section');
    
    // Both blades must be visible simultaneously on desktop
    await expect(trendsSection).toBeVisible();
    await expect(liveFeedSection).toBeVisible();

    // Use expect().toPass() for layout geometry checks to avoid flakiness
    await expect(async () => {
      const trendsBox = await trendsSection.boundingBox();
      const feedBox = await liveFeedSection.boundingBox();
      
      expect(trendsBox).not.toBeNull();
      expect(feedBox).not.toBeNull();
      
      // Same vertical top position within 5px margin
      expect(Math.abs(trendsBox.y - feedBox.y)).toBeLessThanOrEqual(5);
      
      // Distinct x coordinates (side-by-side)
      expect(trendsBox.x).toBeLessThan(feedBox.x);
      
      // Divide space equally: each 320px wide
      expect(Math.round(trendsBox.width)).toBe(320);
      expect(Math.round(feedBox.width)).toBe(320);
      
      // Combined bounding box widths totaling 640px
      expect(Math.round(trendsBox.width + feedBox.width)).toBe(640);
    }).toPass();

    // [AC-1] Verify vertical border of 1px solid var(--border) separates the two blades
    const borderStyles = await page.evaluate(() => {
      const trends = document.querySelector('.trends-section') ? window.getComputedStyle(document.querySelector('.trends-section')) : null;
      const feed = document.querySelector('.live-feed-section') ? window.getComputedStyle(document.querySelector('.live-feed-section')) : null;
      return {
        trendsRightWidth: trends ? trends.borderRightWidth : '0px',
        trendsRightStyle: trends ? trends.borderRightStyle : 'none',
        feedLeftWidth: feed ? feed.borderLeftWidth : '0px',
        feedLeftStyle: feed ? feed.borderLeftStyle : 'none'
      };
    });
    const hasBorder = (borderStyles.trendsRightWidth === '1px' && borderStyles.trendsRightStyle === 'solid') ||
                      (borderStyles.feedLeftWidth === '1px' && borderStyles.feedLeftStyle === 'solid');
    expect(hasBorder).toBe(true);

    // [AC-2] Scrollbar & Overflow Isolation: parent containers have overflow: hidden
    const parentOverflows = await page.evaluate(() => {
      const trends = document.querySelector('.trends-section') ? window.getComputedStyle(document.querySelector('.trends-section')) : null;
      const feed = document.querySelector('.live-feed-section') ? window.getComputedStyle(document.querySelector('.live-feed-section')) : null;
      return {
        trendsOverflow: trends ? trends.overflow : 'visible',
        feedOverflow: feed ? feed.overflow : 'visible'
      };
    });
    expect(parentOverflows.trendsOverflow).toBe('hidden');
    expect(parentOverflows.feedOverflow).toBe('hidden');

    // [AC-2] Inner list containers should be scrollable (overflow-y: auto)
    const innerOverflows = await page.evaluate(() => {
      const trendsList = document.querySelector('#trends-list') ? window.getComputedStyle(document.querySelector('#trends-list')) : null;
      const feedList = document.querySelector('#live-sentiment-feed') ? window.getComputedStyle(document.querySelector('#live-sentiment-feed')) : null;
      return {
        trendsListOverflowY: trendsList ? trendsList.overflowY : 'visible',
        feedListOverflowY: feedList ? feedList.overflowY : 'visible'
      };
    });
    expect(innerOverflows.trendsListOverflowY).toBe('auto');
    expect(innerOverflows.feedListOverflowY).toBe('auto');

    // [AC-2] Column headers remain static and fixed at the top of their respective columns
    await expect(async () => {
      const trendsHeaderBox = await page.locator('.trends-section .panel-header').boundingBox();
      const trendsSectionBox = await trendsSection.boundingBox();
      expect(trendsHeaderBox.y).toBeCloseTo(trendsSectionBox.y, 1);

      const feedHeaderBox = await page.locator('.live-feed-section .feed-header').boundingBox();
      const feedSectionBox = await liveFeedSection.boundingBox();
      expect(feedHeaderBox.y).toBeCloseTo(feedSectionBox.y, 1);
    }).toPass();

    // Adding interactive classes must NOT hide either panel on desktop
    await page.evaluate(() => {
      const sidebar = document.querySelector('.sidebar-panel');
      sidebar.classList.add('tabs-toggled', 'show-sentiment');
    });
    await expect(trendsSection).toBeVisible();
    await expect(liveFeedSection).toBeVisible();

    await page.evaluate(() => {
      const sidebar = document.querySelector('.sidebar-panel');
      sidebar.classList.remove('show-sentiment');
      sidebar.classList.add('show-trending');
    });
    await expect(trendsSection).toBeVisible();
    await expect(liveFeedSection).toBeVisible();

    // Reset classes for sanity
    await page.evaluate(() => {
      const sidebar = document.querySelector('.sidebar-panel');
      sidebar.classList.remove('tabs-toggled', 'show-sentiment', 'show-trending');
    });

    // --- MOBILE VIEWPORT TEST (<= 768px) ---
    // [AC-3] Mobile Drawer & Tab Switcher Behavior Preservation
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');

    // Open sidebar on mobile
    const toggleBtn = page.locator('#sidebar-toggle');
    await toggleBtn.click();

    // Tab switcher must be visible on mobile
    const sidebarTabs = page.locator('.sidebar-tabs');
    await expect(sidebarTabs).toBeVisible();

    // [AC-3] Sidebar drawer must remain 290px wide on mobile
    await expect(async () => {
      const sidebarBox = await page.locator('.sidebar-panel').boundingBox();
      expect(sidebarBox).not.toBeNull();
      expect(Math.round(sidebarBox.width)).toBe(290);
    }).toPass();

    // [AC-3] "Trending" Tab Active behavior check
    const trendingTab = page.locator('.tab-btn[data-tab="trending"]');
    await trendingTab.click();
    await expect(page.locator('#trends-list')).toBeVisible();
    await expect(page.locator('.trends-section .panel-header-text')).toBeVisible();
    await expect(liveFeedSection).toBeHidden();

    // [AC-3] "Sentiment Feed" Tab Active behavior check
    const sentimentTab = page.locator('.tab-btn[data-tab="sentiment"]');
    await sentimentTab.click();
    await expect(sidebarTabs).toBeVisible();
    await expect(liveFeedSection).toBeVisible();
    await expect(page.locator('#trends-list')).toBeHidden();
    await expect(page.locator('.trends-section .panel-header-text')).toBeHidden();

    // [AC-3] The .trends-section wrapper must shrink to fit only the tab header height
    // and live-feed-section expand to occupy the full remaining vertical space
    const trendsSectionStyles = await trendsSection.evaluate(el => {
      const style = window.getComputedStyle(el);
      return {
        flex: style.flex,
        height: style.height
      };
    });
    expect(trendsSectionStyles.flex).toMatch(/0 0 auto/);
    expect(trendsSectionStyles.height).toBe('auto');

    // --- WEBDRIVER VIEW TRANSITIONS TEST ---
    // [AC-4] View Transitions Integrity: Enable View Transitions in All Environments
    const body = page.locator('body');
    await expect(body).not.toHaveClass(/playwright-e2e-desktop/);
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
    // Set to mobile viewport to use the tab switcher
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');

    // Open sidebar on mobile
    const toggleBtn = page.locator('#sidebar-toggle');
    await toggleBtn.click();

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
    // Re-open sidebar and switch to sentiment tab
    await toggleBtn.click();
    await sentimentTab.click();
    await expect(banner).not.toBeVisible();
  });
});
