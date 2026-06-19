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
      url: 'https://blog.google/gemini-gemini',
      source: 'Google Blog'
    }
  }
];

const mockExplanation = {
  hook: 'Gemini is capturing developer mindshare with low latency and long context.',
  whatIsIt: 'Google Gemini is a suite of multimodal generative AI models.',
  whyIsItViral: ['Long context window', 'Low latency API', 'Reasoning capability'],
  takeaway: 'Expect Gemini to power next-gen agentic workflows.',
  polls: { overrated: 5, genius: 15 },
  continuationProbability: 85,
  continuationRationale: 'Developer interest remains strong.'
};

async function selectTrendOnMobile(page) {
  const sidebarToggle = page.locator('#sidebar-toggle');
  if (await sidebarToggle.isVisible()) {
    await sidebarToggle.click();
    await expect(page.locator('.sidebar-panel')).toHaveClass(/open/);
  }
  const trendItem = page.locator('.trend-item').first();
  await trendItem.click();
}

test.describe('Mobile Quick-Action Toolbar & Engagement Optimization Tests', () => {

  test.beforeEach(async ({ page }) => {
    // Mock APIs to isolate frontend toolbar logic
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

    await page.route('**/api/chat-limit*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ count: 0, limit: 10, bonus: 0 }),
      });
    });

    await page.route('**/api/predictions*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    });

    await page.route('**/api/poll/history*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    });
  });

  // =========================================================================
  // [AC-1] Mobile Action Toolbar HTML Structure
  // =========================================================================
  test('should render the correct mobile action toolbar HTML structure with all required semantic elements and IDs', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');

    // Select trend to load explanation details and show toolbar elements
    await selectTrendOnMobile(page);
    await expect(page.locator('#explainer-view')).toBeVisible();

    const toolbar = page.locator('#mobile-action-toolbar');
    await expect(toolbar).toBeAttached();
    await expect(toolbar).toHaveClass(/mobile-action-toolbar/);

    // Share Button
    const shareBtn = toolbar.locator('#toolbar-btn-share');
    await expect(shareBtn).toBeVisible();
    await expect(shareBtn).toHaveClass(/toolbar-btn/);
    await expect(shareBtn).toContainText('Share');
    await expect(shareBtn.locator('svg')).toBeVisible();

    // Sentiment Group
    const sentimentGroup = toolbar.locator('#toolbar-sentiment-group');
    await expect(sentimentGroup).toBeVisible();
    await expect(sentimentGroup).toHaveClass(/toolbar-sentiment-group/);

    // Vote Actions Sub-container
    const voteActions = sentimentGroup.locator('#toolbar-vote-actions');
    await expect(voteActions).toBeVisible();

    const geniusBtn = voteActions.locator('#toolbar-btn-genius');
    await expect(geniusBtn).toBeVisible();
    await expect(geniusBtn).toContainText('Genius ⚡');

    const overratedBtn = voteActions.locator('#toolbar-btn-overrated');
    await expect(overratedBtn).toBeVisible();
    await expect(overratedBtn).toContainText('Overrated 🥱');

    // Vote Results Sub-container
    const voteResults = sentimentGroup.locator('#toolbar-vote-results');
    await expect(voteResults).toBeAttached();
    await expect(voteResults).toHaveClass(/hidden/); // Hidden by default

    const pctGenius = voteResults.locator('#toolbar-pct-genius');
    await expect(pctGenius).toBeAttached();
    const pctOverrated = voteResults.locator('#toolbar-pct-overrated');
    await expect(pctOverrated).toBeAttached();

    const barGenius = voteResults.locator('#toolbar-bar-genius');
    await expect(barGenius).toBeAttached();
    const barOverrated = voteResults.locator('#toolbar-bar-overrated');
    await expect(barOverrated).toBeAttached();

    const sharePollBtn = voteResults.locator('#toolbar-btn-share-poll');
    await expect(sharePollBtn).toBeAttached();
    await expect(sharePollBtn).toHaveClass(/toolbar-icon-btn/);
    await expect(sharePollBtn.locator('svg')).toBeVisible();

    // Trivia Button
    const triviaBtn = toolbar.locator('#toolbar-btn-trivia');
    await expect(triviaBtn).toBeVisible();
    await expect(triviaBtn).toHaveClass(/toolbar-btn/);
    await expect(triviaBtn).toContainText('Trivia');
    await expect(triviaBtn.locator('svg')).toBeVisible();
  });

  // =========================================================================
  // [AC-2] Responsive Layout, CSS Variables, and Margin Safety
  // =========================================================================
  test('should display toolbar only on mobile viewports with fixed bottom positioning, margin safety, and input focus occlusion guard', async ({ page }) => {
    // 1. Desktop Check
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');

    const trendItem = page.locator('.trend-item').first();
    await trendItem.click();
    await expect(page.locator('#explainer-view')).toBeVisible();

    const toolbar = page.locator('#mobile-action-toolbar');
    await expect(toolbar).not.toBeVisible();

    // 2. Mobile Check
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    await selectTrendOnMobile(page);
    await expect(toolbar).toBeVisible();

    // Verify fixed position layout
    const layout = await toolbar.evaluate((el) => {
      const style = window.getComputedStyle(el);
      return {
        position: style.position,
        bottom: style.bottom,
        left: style.left,
        right: style.right,
        zIndex: style.zIndex,
        height: style.height,
        display: style.display,
        alignItems: style.alignItems,
        justifyContent: style.justifyContent
      };
    });

    expect(layout.position).toBe('fixed');
    expect(layout.bottom).toBe('0px');
    expect(layout.left).toBe('0px');
    expect(layout.right).toBe('0px');
    expect(parseInt(layout.zIndex)).toBe(1000);
    expect(layout.height).toBe('64px');
    expect(layout.display).toBe('flex');
    expect(layout.alignItems).toBe('center');
    expect(layout.justifyContent).toBe('space-between');

    // Verify glassmorphism background & border styling
    const styleProperties = await toolbar.evaluate((el) => {
      const style = window.getComputedStyle(el);
      return {
        backdropFilter: style.backdropFilter || style.webkitBackdropFilter,
        borderTopWidth: style.borderTopWidth
      };
    });
    expect(styleProperties.backdropFilter).toContain('blur(12px)');
    expect(parseFloat(styleProperties.borderTopWidth)).toBeGreaterThan(0);

    // Verify Margin/Padding Safety (explainer container padding-bottom should be >= 80px)
    const explainerContainer = page.locator('.explainer-container').first();
    const paddingBottom = await explainerContainer.evaluate((el) => {
      return window.getComputedStyle(el).paddingBottom;
    });
    expect(parseFloat(paddingBottom)).toBeGreaterThanOrEqual(80);

    // Verify Virtual Keyboard Focus Occlusion Guard (focusing an input hides the toolbar on mobile viewports)
    const chatInput = page.locator('#chat-input');
    await chatInput.focus();
    await expect(toolbar).toHaveClass(/hidden-toolbar/);

    await chatInput.blur();
    await expect(toolbar).not.toHaveClass(/hidden-toolbar/);
  });

  // =========================================================================
  // [AC-3] Client-Side Lifecycle and Trend Visibility Sync
  // =========================================================================
  test('should sync toolbar visibility with welcome vs trend explainer view lifecycle and trigger share modals', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');

    const toolbar = page.locator('#mobile-action-toolbar');
    
    // Welcome Screen: Toolbar must be hidden
    await expect(toolbar).toHaveClass(/hidden-toolbar/);

    // Select Trend: Toolbar becomes visible
    await selectTrendOnMobile(page);
    await expect(page.locator('#explainer-view')).toBeVisible();
    await expect(toolbar).not.toHaveClass(/hidden-toolbar/);

    // Click General Share Button from Toolbar
    const shareBtn = toolbar.locator('#toolbar-btn-share');
    await shareBtn.click();

    // Verify general share modal opens
    const shareModal = page.locator('#share-modal');
    await expect(shareModal).toBeVisible();
    await expect(shareModal).not.toHaveClass(/hidden/);
    
    const contextSelect = page.locator('#share-context-select');
    await expect(contextSelect).toHaveValue('general');

    // Close Modal
    await page.locator('#btn-close-share-modal').click();
    await expect(shareModal).toHaveClass(/hidden/);

    // Trigger loading error / failure lifecycle to verify toolbar hides again
    await page.route('**/api/explain', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal Server Error' }),
      });
    });

    // Toggle and select trend again to trigger error
    page.once('dialog', async (dialog) => {
      await dialog.dismiss();
    });
    
    await selectTrendOnMobile(page);

    // Should return to welcome view, and toolbar becomes hidden
    await expect(page.locator('#welcome-view')).toBeVisible();
    await expect(toolbar).toHaveClass(/hidden-toolbar/);
  });

  // =========================================================================
  // [AC-4] Bidirectional Sentiment Vote and Percentage Sync
  // =========================================================================
  test('should sync sentiment votes bidirectionally, handle TypeError safety, sync cache, and update optimistically', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });

    // Mock API to return updated poll values on vote
    await page.route('**/api/poll', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ genius: 15, overrated: 10 }), // 15 Genius, 10 Overrated -> 60% Genius, 40% Overrated
        });
      } else {
        await route.fallback();
      }
    });

    await page.goto('/');
    await selectTrendOnMobile(page);
    await expect(page.locator('#explainer-view')).toBeVisible();

    const toolbar = page.locator('#mobile-action-toolbar');
    const voteActions = toolbar.locator('#toolbar-vote-actions');
    const voteResults = toolbar.locator('#toolbar-vote-results');

    // Verify initial interactive state
    await expect(voteActions).toBeVisible();
    await expect(voteResults).toHaveClass(/hidden/);

    // Tapping a vote button triggers immediate visual disabled feedback (optimistic check)
    const geniusBtn = voteActions.locator('#toolbar-btn-genius');
    
    // We click and immediately measure the latency of optimistic state indicators in the DOM
    const optimisticFeedbackDuration = await page.evaluate(async () => {
      const btn = document.getElementById('toolbar-btn-genius');
      const start = performance.now();
      
      return new Promise((resolve) => {
        const observer = new MutationObserver(() => {
          if (btn.disabled || btn.classList.contains('loading') || btn.closest('#toolbar-vote-actions').classList.contains('disabled')) {
            const end = performance.now();
            observer.disconnect();
            resolve(end - start);
          }
        });
        
        observer.observe(btn, { attributes: true });
        observer.observe(btn.closest('#toolbar-vote-actions'), { attributes: true });
        
        btn.click();
      });
    });

    console.log(`Optimistic vote click feedback latency: ${optimisticFeedbackDuration}ms`);
    expect(optimisticFeedbackDuration).toBeLessThan(100);

    // Verify the results are loaded and displayed in the toolbar
    await expect(voteActions).toHaveClass(/hidden/);
    await expect(voteResults).not.toHaveClass(/hidden/);

    // Verify percentages are synced
    await expect(voteResults.locator('#toolbar-pct-genius')).toContainText('60%');
    await expect(voteResults.locator('#toolbar-pct-overrated')).toContainText('40%');

    // Verify progress bars are updated
    const barGeniusWidth = await voteResults.locator('#toolbar-bar-genius').evaluate((el) => el.style.width);
    const barOverratedWidth = await voteResults.locator('#toolbar-bar-overrated').evaluate((el) => el.style.width);
    expect(barGeniusWidth).toBe('60%');
    expect(barOverratedWidth).toBe('40%');

    // Verify bidirectional sync: the main poll results card must also show results matching the vote
    await expect(page.locator('#poll-results')).not.toHaveClass(/hidden/);
    await expect(page.locator('#pct-genius')).toContainText('60%');
    await expect(page.locator('#pct-overrated')).toContainText('40%');

    // Verify click on toolbar share-poll button triggers poll modal
    const sharePollBtn = voteResults.locator('#toolbar-btn-share-poll');
    await sharePollBtn.click();
    await expect(page.locator('#share-modal')).toBeVisible();
    await expect(page.locator('#share-context-select')).toHaveValue('poll');
    await page.locator('#btn-close-share-modal').click();

    // Verify TypeError safety in updatePollPercentages
    const hasConsoleError = await page.evaluate(() => {
      let threw = false;
      const originalError = console.error;
      console.error = () => { threw = true; };
      try {
        window.updatePollPercentages(null);
        window.updatePollPercentages(undefined);
        window.updatePollPercentages({});
      } catch (err) {
        threw = true;
      } finally {
        console.error = originalError;
      }
      return threw;
    });
    expect(hasConsoleError).toBe(false);

    // Verify Explanation Cache Sync: Navigation away and back preserves voted state
    // First, let's navigate to welcome view (simulated)
    await page.evaluate(() => {
      document.getElementById('explainer-view').classList.add('hidden');
      document.getElementById('welcome-view').classList.remove('hidden');
    });

    // Select trend again
    await selectTrendOnMobile(page);
    await expect(page.locator('#explainer-view')).toBeVisible();

    // Verify results are preserved on load from cache
    await expect(voteResults).not.toHaveClass(/hidden/);
    await expect(voteResults.locator('#toolbar-pct-genius')).toContainText('60%');
  });

  // =========================================================================
  // [AC-5] Trivia Challenge Focus Scroll and Start Trigger
  // =========================================================================
  test('should scroll trivia into view with pulse glow animation, start gameplay, and guard against concurrent requests', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });

    let triviaRequestCount = 0;
    await page.route('**/api/trivia', async (route) => {
      triviaRequestCount++;
      // Delay response to test loading throttle
      await new Promise(r => setTimeout(r, 500));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { question: 'Q1', options: ['A', 'B', 'C', 'D'], correctAnswer: 0, explanation: 'Exp1' }
        ]),
      });
    });

    await page.goto('/');
    await selectTrendOnMobile(page);
    await expect(page.locator('#explainer-view')).toBeVisible();

    const triviaBtn = page.locator('#toolbar-btn-trivia');
    
    // Simulate double/multiple rapid taps to test concurrent request prevention
    await triviaBtn.click();
    await triviaBtn.click({ delay: 50 });
    await triviaBtn.click({ delay: 50 });

    // Wait for gameplay screen to become visible
    await expect(page.locator('.trivia-gameplay-screen')).toBeVisible();

    // Assert that only 1 trivia request was fired, due to loading throttle guard
    expect(triviaRequestCount).toBe(1);

    // Verify smooth scrolling and pulse highlight animation class addition/removal
    const triviaCard = page.locator('#trivia-card-container');
    await expect(triviaCard).toHaveClass(/trivia-pulse-highlight/);

    // Assert that the trivia card is in or intersecting the viewport (Margin/viewport check)
    const isIntersecting = await triviaCard.evaluate((el) => {
      const rect = el.getBoundingClientRect();
      return rect.top < window.innerHeight && rect.bottom > 0;
    });
    expect(isIntersecting).toBe(true);

    // Verify that the gameplay has successfully started (i.e. start screen is hidden)
    await expect(page.locator('.trivia-start-screen')).toHaveClass(/hidden/);
  });

});
