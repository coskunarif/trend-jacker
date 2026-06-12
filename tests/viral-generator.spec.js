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

  // [AC-1] Unified Modal Component Structure
  test('1. Verify Modal Opening and Structure', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');

    // Wait for the trend to render and click unified share button
    const shareBtn = page.locator('#btn-share-trend');
    await expect(shareBtn).toBeVisible();
    await shareBtn.click();

    // Assert the share modal is visible
    const shareModal = page.locator('#share-modal');
    await expect(shareModal).toBeVisible();

    // Verify AC-1 components
    await expect(page.locator('#share-modal-title')).toBeVisible();
    await expect(page.locator('#btn-close-share-modal')).toBeVisible();
    await expect(page.locator('#share-context-select')).toBeVisible();
    await expect(page.locator('.platform-pill[data-platform="x"]')).toBeVisible();
    await expect(page.locator('.platform-pill[data-platform="linkedin"]')).toBeVisible();
    await expect(page.locator('.platform-pill[data-platform="facebook"]')).toBeVisible();
    await expect(page.locator('.platform-pill[data-platform="reddit"]')).toBeVisible();
    await expect(page.locator('#share-preview-text')).toBeVisible();
    await expect(page.locator('#btn-copy-share')).toBeVisible();
    await expect(page.locator('#btn-post-share')).toBeVisible();
  });

  // [AC-2] Pre-selection & Behavior
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
  });

  // [AC-2] Pre-selection & Behavior
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

  // [AC-2] Pre-selection & Behavior
  test('4. Verify Context Dropdown Change Behavior', async ({ page }) => {
    let lastPostPayload = null;

    // Intercept POST /api/generate-post
    await page.route('**/api/generate-post', async (route) => {
      lastPostPayload = route.request().postDataJSON();
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          postText: `Dynamic response for ${lastPostPayload.platform} with context ${lastPostPayload.contextType}`
        }),
      });
    });

    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');

    // Open share modal via share-trend (general context)
    await page.locator('#btn-share-trend').click();
    await expect(page.locator('#share-modal')).toBeVisible();

    // Change dropdown selection to 'poll'
    const contextSelect = page.locator('#share-context-select');
    await contextSelect.selectOption('poll');

    // Assert backend was called with updated context
    await expect.poll(() => lastPostPayload?.contextType).toBe('poll');

    // Verify textarea shows updated response text
    const previewTextarea = page.locator('#share-preview-text');
    await expect(previewTextarea).toHaveValue('Dynamic response for x with context poll');
  });

  // [AC-1] Unified Modal Component Structure
  test('5. Verify Copy-to-Clipboard', async ({ page, context }) => {
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

  // [AC-1] Unified Modal Component Structure
  test('6. Verify Outbound Sharing Intent', async ({ page, context }) => {
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

  // [AC-3] Redundant Button Removal
  test('7. Verify Redundant Button Removal', async ({ page }) => {
    await page.goto('/');

    // Assert that legacy share buttons are removed from the DOM
    const legacyShareTrendBtn = page.locator('#btn-share-x');
    const legacySharePollBtn = page.locator('#btn-share-poll-x');

    await expect(legacyShareTrendBtn).not.toBeAttached();
    await expect(legacySharePollBtn).not.toBeAttached();
  });

  // [AC-4] Social Media Copy Constraints
  test('8. Verify Platform-Specific Formatting and URL Inclusion', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');

    // Open share modal
    await page.locator('#btn-share-trend').click();
    await expect(page.locator('#share-modal')).toBeVisible();

    const previewTextarea = page.locator('#share-preview-text');

    // 1. Verify X (Twitter) formatting & URL
    const xPill = page.locator('.platform-pill[data-platform="x"]');
    await xPill.click();
    await expect(previewTextarea).not.toHaveValue('');
    await expect(previewTextarea).not.toHaveValue('Generating post...');
    const xText = await previewTextarea.inputValue();
    expect(xText).toContain('https://viraljacker.com/t/google-gemini');
    expect(xText.length).toBeLessThanOrEqual(280);
    const xHashtags = xText.match(/#[a-zA-Z0-9]+/g) || [];
    expect(xHashtags.length).toBeGreaterThanOrEqual(2);
    expect(xHashtags.length).toBeLessThanOrEqual(3);

    // 2. Verify LinkedIn formatting & URL
    const linkedinPill = page.locator('.platform-pill[data-platform="linkedin"]');
    await linkedinPill.click();
    // Wait for the text to change from X text to LinkedIn text
    await expect(previewTextarea).not.toHaveValue(xText);
    await expect(previewTextarea).not.toHaveValue('Generating post...');
    const liText = await previewTextarea.inputValue();
    expect(liText).toContain('https://viraljacker.com/t/google-gemini');
    const liHashtags = liText.match(/#[a-zA-Z0-9]+/g) || [];
    expect(liHashtags.length).toBe(3);
    // LinkedIn hashtags should be at the bottom
    const lines = liText.trim().split('\n');
    const bottomLine = lines[lines.length - 1];
    expect(bottomLine).toContain('#');

    // 3. Verify Facebook formatting & URL
    const fbPill = page.locator('.platform-pill[data-platform="facebook"]');
    await fbPill.click();
    await expect(previewTextarea).not.toHaveValue(liText);
    await expect(previewTextarea).not.toHaveValue('Generating post...');
    const fbText = await previewTextarea.inputValue();
    expect(fbText).toContain('https://viraljacker.com/t/google-gemini');
    const fbHashtags = fbText.match(/#[a-zA-Z0-9]+/g) || [];
    expect(fbHashtags.length).toBeGreaterThanOrEqual(1);
    expect(fbHashtags.length).toBeLessThanOrEqual(2);

    // 4. Verify Reddit formatting & URL
    const redditPill = page.locator('.platform-pill[data-platform="reddit"]');
    await redditPill.click();
    await expect(previewTextarea).not.toHaveValue(fbText);
    await expect(previewTextarea).not.toHaveValue('Generating post...');
    const redditText = await previewTextarea.inputValue();
    expect(redditText).toContain('https://viraljacker.com/t/google-gemini');
    const redditHashtags = redditText.match(/#[a-zA-Z0-9]+/g) || [];
    expect(redditHashtags.length).toBe(0);
    // Reddit should have a headline hook and structured body
    expect(redditText).toContain('\n');
  });
});


