import { test, expect } from '@playwright/test';

test.describe('TJ-25: AI-Powered Viral Social Post Generator Tests', () => {
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

  test('1. Verify Modal Opening', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');

    // Wait for the trend to render and click unified share button
    const shareBtn = page.locator('#btn-share-trend');
    await expect(shareBtn).toBeVisible();
    await shareBtn.click();

    // Assert the share modal is visible
    const shareModal = page.locator('#share-modal');
    await expect(shareModal).toBeVisible();
  });

  test('2. Verify Context Preselection', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');

    // Click the unified Share Poll button
    const sharePollBtn = page.locator('#btn-share-poll');
    await expect(sharePollBtn).toBeVisible();
    await sharePollBtn.click();

    const shareModal = page.locator('#share-modal');
    await expect(shareModal).toBeVisible();

    // Assert modal opens with "Poll Verdict" context pre-selected
    const contextSelect = page.locator('#share-context-select');
    await expect(contextSelect).toHaveValue('poll');

    // Close modal
    await page.locator('#btn-close-share-modal').click();
    await expect(shareModal).not.toBeVisible();

    // Click the unified Share Debate button
    const shareDebateBtn = page.locator('#btn-share-debate');
    await expect(shareDebateBtn).toBeVisible();
    await shareDebateBtn.click();
    await expect(shareModal).toBeVisible();

    // Assert modal opens with "Debate Summary" context pre-selected
    await expect(contextSelect).toHaveValue('debate');
  });

  test('3. Verify Generation & Platform Switching', async ({ page }) => {
    let lastPostPayload = null;

    // Intercept POST /api/generate-post
    await page.route('**/api/generate-post', async (route) => {
      lastPostPayload = route.request().postDataJSON();
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          postText: `This is a mock post for ${lastPostPayload.platform} with context ${lastPostPayload.contextType}`
        }),
      });
    });

    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');

    // Open share modal
    await page.locator('#btn-share-trend').click();
    await expect(page.locator('#share-modal')).toBeVisible();

    // Select LinkedIn platform pill/button
    const linkedinPill = page.locator('.platform-pill[data-platform="linkedin"]');
    await linkedinPill.click();

    // Assert backend was called with correct parameters
    await expect.poll(() => lastPostPayload).not.toBeNull();
    expect(lastPostPayload.trendTitle).toBe('Google Gemini');
    expect(lastPostPayload.platform).toBe('linkedin');
    expect(lastPostPayload.contextType).toBe('general');

    // Verify textarea is updated with response text
    const previewTextarea = page.locator('#share-preview-text');
    await expect(previewTextarea).toHaveValue('This is a mock post for linkedin with context general');
  });

  test('4. Verify Copy-to-Clipboard', async ({ page, context }) => {
    // Intercept POST /api/generate-post
    await page.route('**/api/generate-post', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          postText: 'Awesome Gemini post!'
        }),
      });
    });

    // Grant clipboard permissions
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);

    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');

    await page.locator('#btn-share-trend').click();
    await expect(page.locator('#share-modal')).toBeVisible();

    // Wait for mock response to populate textarea
    const previewTextarea = page.locator('#share-preview-text');
    await expect(previewTextarea).toHaveValue('Awesome Gemini post!');

    // Click copy button
    const copyBtn = page.locator('#btn-copy-share');
    await copyBtn.click();

    // Read and assert clipboard content matches preview text
    const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
    expect(clipboardText).toBe('Awesome Gemini post!');
  });

  test('5. Verify Outbound Sharing Intent', async ({ page, context }) => {
    // Intercept POST /api/generate-post
    await page.route('**/api/generate-post', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          postText: 'Awesome Gemini post!'
        }),
      });
    });

    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');

    await page.locator('#btn-share-trend').click();
    await expect(page.locator('#share-modal')).toBeVisible();

    // Wait for preview to load
    await expect(page.locator('#share-preview-text')).toHaveValue('Awesome Gemini post!');

    // Intercept popup page / target page opening on click
    const [newPage] = await Promise.all([
      context.waitForEvent('page'),
      page.locator('#btn-post-share').click() // This should trigger window.open
    ]);

    await newPage.waitForLoadState();
    expect(newPage.url()).toMatch(/x\.com.*intent.*tweet/);
    expect(newPage.url()).toMatch(/Awesome.*Gemini.*post/);
  });

  test('6. Verify Redundant Button Removal', async ({ page }) => {
    await page.goto('/');

    // Assert that legacy share buttons are removed from the DOM
    const legacyShareTrendBtn = page.locator('#btn-share-x');
    const legacySharePollBtn = page.locator('#btn-share-poll-x');
    const legacyShareDebateBtn = page.locator('#btn-share-debate-x');

    await expect(legacyShareTrendBtn).not.toBeAttached();
    await expect(legacySharePollBtn).not.toBeAttached();
    await expect(legacyShareDebateBtn).not.toBeAttached();
  });
});
