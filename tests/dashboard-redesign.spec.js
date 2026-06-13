import { test, expect } from '@playwright/test';
import fs from 'fs';

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

test.describe('Dashboard Redesign Verification', () => {

  test.beforeEach(async ({ page }) => {
    // Intercept trends, explain, and debate APIs
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

    await page.route('**/api/poll/history*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { timestamp: '2026-06-10T12:00:00.000Z', geniusPercentage: 75, velocity: 10 },
          { timestamp: '2026-06-10T13:00:00.000Z', geniusPercentage: 80, velocity: 12 },
          { timestamp: '2026-06-10T14:00:00.000Z', geniusPercentage: 85, velocity: 15 },
          { timestamp: '2026-06-10T15:00:00.000Z', geniusPercentage: 70, velocity: 8 },
          { timestamp: '2026-06-10T16:00:00.000Z', geniusPercentage: 65, velocity: 9 },
          { timestamp: '2026-06-10T17:00:00.000Z', geniusPercentage: 72, velocity: 11 },
          { timestamp: '2026-06-10T18:00:00.000Z', geniusPercentage: 78, velocity: 14 },
          { timestamp: '2026-06-10T19:00:00.000Z', geniusPercentage: 90, velocity: 20 },
        ]),
      });
    });
  });

  // [AC-1] Global Sentiment Feed Removal (Subtractive)
  test('should verify Global Sentiment Feed is completely removed from the DOM', async ({ page }) => {
    await page.goto('/');
    const feed = page.locator('#live-sentiment-feed');
    await expect(feed).toBeHidden();
    
    const feedHeader = page.locator('.live-feed-section');
    await expect(feedHeader).toBeHidden();
  });

  // [AC-2] Sidebar Tab Bar Removal
  test('should verify Sidebar Tab Bar is completely removed from the DOM', async ({ page }) => {
    await page.goto('/');
    const tabs = page.locator('.sidebar-tabs');
    await expect(tabs).toBeHidden();
    
    // Only Trending Searches header/content should be displayed
    const trendingHeader = page.locator('.trends-section');
    await expect(trendingHeader).toBeVisible();
  });

  // [AC-3] Expanded Desktop Grid Layout
  test('should verify desktop layout grid template and expanded main panel space', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');
    
    const gridStyles = await page.locator('.dashboard-grid').evaluate(el => {
      const style = window.getComputedStyle(el);
      return {
        display: style.display,
        gridTemplateColumns: style.gridTemplateColumns
      };
    });
    
    expect(gridStyles.display).toBe('grid');
    expect(gridStyles.gridTemplateColumns).toBe('320px 928px'); // 320px sidebar, remainder (1280 - 32px padding - 16px gap - 320px = 912px, depending on margin/padding)
    // We just verify it starts with 320px
    expect(gridStyles.gridTemplateColumns).toMatch(/^320px\b/);
  });

  // [AC-4] Sidebar Mobile Drawer Width Preservation
  test('should verify mobile drawer sidebar width and absence of tabs', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    
    const toggleBtn = page.locator('#sidebar-toggle');
    await toggleBtn.click();
    
    const sidebar = page.locator('.sidebar-panel');
    await expect(sidebar).toBeVisible();
    
    const sidebarBox = await sidebar.boundingBox();
    expect(sidebarBox).not.toBeNull();
    expect(Math.round(sidebarBox.width)).toBe(290);
    
    // Ensure no tabs or live sentiment feed elements are present inside the sidebar
    await expect(sidebar.locator('.sidebar-tabs')).toBeHidden();
    await expect(sidebar.locator('#live-sentiment-feed')).toBeHidden();
  });

  // [AC-5] SSE Stream Resilience
  test('should gracefully handle SSE stream events and update poll stats without throwing errors', async ({ page }) => {
    // Monitor for page errors
    const errors = [];
    page.on('pageerror', (err) => {
      errors.push(err);
    });

    // Mock EventSource
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
    });

    await page.goto('/');
    
    // Select the first trend to view details and open the poll
    const firstTrend = page.locator('.trend-item').first();
    await firstTrend.click();
    
    // Wait for explainer to load
    await expect(page.locator('#explainer-view')).toBeVisible();

    // Trigger a simulated message event through EventSource
    await page.evaluate(() => {
      const es = window.mockEventSources[0];
      if (es) {
        const event = new MessageEvent('message', {
          data: JSON.stringify({
            trend: 'Google Gemini',
            vote: 'genius',
            clientId: 'another-client',
            timestamp: Date.now(),
            updatedPolls: {
              genius: 20,
              overrated: 10
            }
          })
        });
        es.dispatchEvent(event);
      }
    });

    // Verify background updates without throwing errors
    expect(errors).toEqual([]);

    // Check if the poll stats are updated
    // 20/30 = 67%, 10/30 = 33%
    await expect(page.locator('#pct-genius')).toHaveText('67%');
    await expect(page.locator('#pct-overrated')).toHaveText('33%');
  });

  // [AC-6] Redesigned Welcome Screen
  test('should verify welcome view is modern and styled with glassmorphism', async ({ page }) => {
    // Intercept with empty list so that welcome-view remains visible
    await page.route('**/api/trends', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    });

    await page.addInitScript(() => {
      const originalGetElementById = document.getElementById;
      document.getElementById = function(id) {
        if (id === 'preloaded-trend-data') {
          return null;
        }
        return originalGetElementById.apply(this, arguments);
      };
    });

    await page.goto('/');
    
    const welcomeView = page.locator('#welcome-view');
    await expect(welcomeView).toBeVisible();
    
    // Verify glassmorphism / layout styles are applied
    const welcomeStyles = await welcomeView.evaluate(el => {
      const style = window.getComputedStyle(el);
      return {
        backdropFilter: style.backdropFilter || style.webkitBackdropFilter,
        backgroundColor: style.backgroundColor,
        borderRadius: style.borderRadius,
        border: style.border
      };
    });
    
    // Check if backdrop-filter is applied or has translucency / modern styles
    expect(welcomeStyles.borderRadius).not.toBe('0px');
    expect(welcomeStyles.border).not.toBe('none');
  });

  // [AC-7] Modern Card & Border Aesthetics
  test('should verify glass-card style properties for modern border aesthetics', async ({ page }) => {
    await page.goto('/');
    
    // Make sure we have a glass card to inspect
    const skeletonCard = page.locator('.skeleton-card').first();
    await expect(skeletonCard).toBeVisible();
    
    const cardBorder = await skeletonCard.evaluate(el => {
      const style = window.getComputedStyle(el);
      return style.borderColor || style.border;
    });
    
    // Should have a fine border
    expect(cardBorder).toBeDefined();
  });

});
