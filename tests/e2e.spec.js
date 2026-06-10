import { test, expect } from '@playwright/test';

test.describe('TrendJacker E2E tests', () => {
  // Mock API data matching the server's test mode defaults
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
    },
    {
      id: 3,
      title: 'Reddit Spike Topic',
      traffic: 'Reddit Spike',
      description: 'Hot post on r/technology',
      source: 'reddit',
      news: {
        headline: 'Reddit Spike Topic: OpenAI leaks new model features',
        snippet: 'A viral post in r/technology outlines upcoming features.',
        url: 'https://www.reddit.com/r/technology/comments/1u1ngzk/openai_leaks_new_model_features',
        source: 'r/technology'
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
    const secondTrend = page.locator('.trend-item').nth(1);
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

  test('should support responsive layout, mobile sidebar toggling, tabs and close button', async ({ page }) => {
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

    // Verify mobile tabs are visible
    const tabsContainer = page.locator('.sidebar-tabs');
    await expect(tabsContainer).toBeVisible();

    // Verify default tab is 'trending' (list is visible, feed is hidden)
    const trendsList = page.locator('#trends-list');
    await expect(trendsList).toBeVisible();
    const liveFeed = page.locator('.live-feed-section');
    await expect(liveFeed).not.toBeVisible();

    // Switch to sentiment tab
    const sentimentTabBtn = page.locator('.tab-btn[data-tab="sentiment"]');
    await sentimentTabBtn.click();
    await expect(trendsList).not.toBeVisible();
    await expect(liveFeed).toBeVisible();

    // Switch back to trending tab
    const trendingTabBtn = page.locator('.tab-btn[data-tab="trending"]');
    await trendingTabBtn.click();
    await expect(trendsList).toBeVisible();
    await expect(liveFeed).not.toBeVisible();

    // Verify close button closes the sidebar
    const closeBtn = page.locator('#sidebar-close');
    await expect(closeBtn).toBeVisible();
    await closeBtn.click();
    await expect(sidebar).not.toHaveClass(/open/);

    // Reopen sidebar to select a trend
    await toggleBtn.click();
    await expect(sidebar).toHaveClass(/open/);

    const firstTrend = page.locator('.trend-item').first();
    await firstTrend.click();
    await expect(sidebar).not.toHaveClass(/open/);

    await expect(page.locator('#explainer-view')).toBeVisible();
    await expect(page.locator('#detail-title')).toHaveText('Google Gemini');
  });

  test('should display loading skeleton when explaining a trend', async ({ page }) => {
    await page.route('**/api/trends', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockTrends),
      });
    });

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

    // Select second trend item to trigger fetch (since first is loaded on startup)
    const secondTrend = page.locator('.trend-item').nth(1);
    await secondTrend.click();

    // Skeleton should be visible while explaining is pending
    const skeleton = page.locator('#explainer-skeleton');
    await expect(skeleton).toBeVisible();
    await expect(page.locator('#explainer-view')).not.toBeVisible();

    // Resolve the API call
    explainPromiseResolve();

    // Skeleton should disappear and explainer-view should be visible
    await expect(skeleton).not.toBeVisible();
    await expect(page.locator('#explainer-view')).toBeVisible();
    await expect(page.locator('#detail-title')).toHaveText('Fastify framework');
  });

  test('should render unified share buttons and download infographic card', async ({ page }) => {
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

    const shareTrendBtn = page.locator('#btn-share-trend');
    const sharePollBtn = page.locator('#btn-share-poll');

    await expect(shareTrendBtn).toBeVisible();
    await expect(sharePollBtn).toBeVisible();

    const downloadInfographicBtn = page.locator('#btn-download-infographic');
    await expect(downloadInfographicBtn).toBeVisible();

    // Verify download triggers successfully
    const downloadPromise = page.waitForEvent('download');
    await downloadInfographicBtn.click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toContain('infographic-');
  });

  test('should render source badges on trend list items', async ({ page }) => {
    await page.route('**/api/trends', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockTrends),
      });
    });

    await page.goto('/');

    const googleBadge = page.locator('.trend-item .source-badge.google-spike').first();
    await expect(googleBadge).toBeVisible();
    await expect(googleBadge).toHaveText('Google Search Spike');

    const redditBadge = page.locator('.trend-item .source-badge.reddit-spike').first();
    await expect(redditBadge).toBeVisible();
    await expect(redditBadge).toHaveText('Reddit Spike');
  });

  test.describe('Web Share API Integration', () => {
    test('should fall back to standard download when Web Share is unsupported', async ({ page }) => {
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
      await page.route('**/api/poll', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ genius: 18, overrated: 6 }),
        });
      });

      await page.addInitScript(() => {
        try {
          delete navigator.share;
          delete navigator.canShare;
        } catch (e) {
          Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
          Object.defineProperty(navigator, 'canShare', { value: undefined, configurable: true });
        }
      });

      await page.goto('/');
      
      // Vote first to show the download card button
      await page.locator('#btn-vote-genius').click();

      const downloadPromise = page.waitForEvent('download');
      await page.locator('#btn-download-card').click();
      const download = await downloadPromise;
      expect(download.suggestedFilename()).toContain('trend-card-');
    });

    test('should use Web Share file sharing when fully supported', async ({ page }) => {
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
      await page.route('**/api/poll', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ genius: 18, overrated: 6 }),
        });
      });

      await page.addInitScript(() => {
        window.shareCalls = [];
        
        Object.defineProperty(navigator, 'canShare', {
          value: (data) => {
            return !!(data && data.files);
          },
          configurable: true,
          writable: true
        });
        
        Object.defineProperty(navigator, 'share', {
          value: async (data) => {
            window.shareCalls.push(data);
            return Promise.resolve();
          },
          configurable: true,
          writable: true
        });
      });

      await page.goto('/');

      // Vote first to show the download card button
      await page.locator('#btn-vote-genius').click();

      await page.locator('#btn-download-card').click();

      const shareCalls = await page.evaluate(() => window.shareCalls);
      expect(shareCalls.length).toBe(1);
      expect(shareCalls[0].files).toBeDefined();
      expect(shareCalls[0].files.length).toBe(1);
      expect(shareCalls[0].files[0].type).toBe('image/png');
      expect(shareCalls[0].title).toContain('Google Gemini');
    });

    test('should share text + URL when Web Share is supported but files are not', async ({ page }) => {
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
      await page.route('**/api/poll', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ genius: 18, overrated: 6 }),
        });
      });

      await page.addInitScript(() => {
        window.shareCalls = [];
        Object.defineProperty(navigator, 'canShare', {
          value: () => false,
          configurable: true,
          writable: true
        });
        Object.defineProperty(navigator, 'share', {
          value: async (data) => {
            window.shareCalls.push(data);
            return Promise.resolve();
          },
          configurable: true,
          writable: true
        });
      });

      await page.goto('/');

      // Vote first to show the download card button
      await page.locator('#btn-vote-genius').click();

      await page.locator('#btn-download-card').click();

      const shareCalls = await page.evaluate(() => window.shareCalls);
      expect(shareCalls.length).toBe(1);
      expect(shareCalls[0].files).toBeUndefined();
      expect(shareCalls[0].title).toContain('Google Gemini');
      expect(shareCalls[0].url).toContain('/t/google-gemini');
    });

    test('should fall back to download when Web Share throws a generic error', async ({ page }) => {
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
      await page.route('**/api/poll', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ genius: 18, overrated: 6 }),
        });
      });

      await page.addInitScript(() => {
        window.shareCalls = [];
        Object.defineProperty(navigator, 'canShare', {
          value: () => true,
          configurable: true,
          writable: true
        });
        Object.defineProperty(navigator, 'share', {
          value: async (data) => {
            window.shareCalls.push(data);
            throw new Error('Generic sharing failure');
          },
          configurable: true,
          writable: true
        });
      });

      await page.goto('/');

      // Vote first to show the download card button
      await page.locator('#btn-vote-genius').click();

      const downloadPromise = page.waitForEvent('download');
      await page.locator('#btn-download-card').click();
      const download = await downloadPromise;
      expect(download.suggestedFilename()).toContain('trend-card-');

      const shareCalls = await page.evaluate(() => window.shareCalls);
      expect(shareCalls.length).toBe(1);
    });

    test('should fail silently and not download when Web Share is aborted (AbortError)', async ({ page }) => {
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
      await page.route('**/api/poll', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ genius: 18, overrated: 6 }),
        });
      });

      await page.addInitScript(() => {
        window.shareCalls = [];
        Object.defineProperty(navigator, 'canShare', {
          value: () => true,
          configurable: true,
          writable: true
        });
        Object.defineProperty(navigator, 'share', {
          value: async (data) => {
            window.shareCalls.push(data);
            const err = new Error('Share canceled');
            err.name = 'AbortError';
            throw err;
          },
          configurable: true,
          writable: true
        });
      });

      await page.goto('/');

      // Vote first to show the download card button
      await page.locator('#btn-vote-genius').click();

      let downloadTriggered = false;
      page.on('download', () => {
        downloadTriggered = true;
      });

      await page.locator('#btn-download-card').click();

      // Wait a brief moment to ensure no download is triggered
      await page.waitForTimeout(1000);

      const shareCalls = await page.evaluate(() => window.shareCalls);
      expect(shareCalls.length).toBe(1);
      expect(downloadTriggered).toBe(false);
    });
  });
});

