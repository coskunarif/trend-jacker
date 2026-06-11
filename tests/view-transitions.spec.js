import { test, expect } from '@playwright/test';

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
  hook: 'Gemini is capturing developer mindshare with low latency and long context.',
  whatIsIt: 'Google Gemini is a suite of multimodal generative AI models.',
  whyIsItViral: ['Long context window', 'Low latency API', 'Reasoning capability'],
  takeaway: 'Expect Gemini to power next-gen agentic workflows.',
  polls: { overrated: 5, genius: 15 }
};

test.describe('View Transitions API Integration & Motion-Driven Navigation', () => {
  test.beforeEach(async ({ page }) => {
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
  });

  test('should trigger startViewTransition when selecting a trend', async ({ page }) => {
    let viewTransitionCalled = false;
    await page.exposeFunction('onViewTransitionCalled', () => {
      viewTransitionCalled = true;
    });

    // Expose a spy on document.startViewTransition
    await page.addInitScript(() => {
      document.startViewTransition = (callback) => {
        window.onViewTransitionCalled();
        const result = callback();
        if (result && typeof result.then === 'function') {
          return {
            finished: result,
            ready: result,
            updateCallbackDone: result,
            skipTransition: () => {}
          };
        }
        return {
          finished: Promise.resolve(),
          ready: Promise.resolve(),
          updateCallbackDone: Promise.resolve(),
          skipTransition: () => {}
        };
      };
    });

    await page.goto('/');

    // Wait for trend items to load
    const trendItem = page.locator('.trend-item').first();
    await expect(trendItem).toBeVisible();

    // Click the trend item to trigger trend selection
    await trendItem.click();

    // Check if view transition was called
    // (This should fail initially as it is not implemented yet)
    expect(viewTransitionCalled).toBe(true);
  });

  test('should trigger startViewTransition when switching mobile tabs', async ({ page }) => {
    let viewTransitionCalled = false;
    await page.exposeFunction('onViewTransitionCalled', () => {
      viewTransitionCalled = true;
    });

    // Expose a spy on document.startViewTransition
    await page.addInitScript(() => {
      document.startViewTransition = (callback) => {
        window.onViewTransitionCalled();
        const result = callback();
        if (result && typeof result.then === 'function') {
          return {
            finished: result,
            ready: result,
            updateCallbackDone: result,
            skipTransition: () => {}
          };
        }
        return {
          finished: Promise.resolve(),
          ready: Promise.resolve(),
          updateCallbackDone: Promise.resolve(),
          skipTransition: () => {}
        };
      };
    });

    // Emulate iPhone viewport size to trigger mobile tabs view
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');

    // Toggle sidebar to make tabs visible/clickable
    const toggleBtn = page.locator('#sidebar-toggle');
    await expect(toggleBtn).toBeVisible();
    await toggleBtn.click();

    // Switch tab - locate tab buttons
    const sentimentTabBtn = page.locator('.tab-btn[data-tab="sentiment"]');
    await expect(sentimentTabBtn).toBeVisible();

    // Switch tab
    await sentimentTabBtn.click();

    // Check if view transition was called
    // (This should fail initially as it is not implemented yet)
    expect(viewTransitionCalled).toBe(true);
  });

  test('should have hardware accelerated transition styles defined in stylesheet', async ({ page }) => {
    await page.goto('/');
    
    // Evaluate if stylesheet or elements contain view-transition properties or modern transitions
    // For initial failure, we assert that custom transition styles exist for view transitions,
    // which will fail since they are not added yet.
    const hasViewTransitionCSS = await page.evaluate(() => {
      for (const sheet of document.styleSheets) {
        try {
          for (const rule of sheet.cssRules) {
            if (rule.cssText.includes('view-transition') || rule.cssText.includes('::view-transition')) {
              return true;
            }
          }
        } catch (e) {
          // ignore CORS/access issues with external stylesheets
        }
      }
      return false;
    });

    expect(hasViewTransitionCSS).toBe(true);
  });
});
