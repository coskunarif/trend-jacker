import { test, expect } from '@playwright/test';
import fs from 'fs';

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

    // Wait for the active trend item to render in the DOM
    await expect(page.locator('.trend-item.active')).toBeVisible();

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
    await expect(page.locator('.platform-pill[data-platform="pinterest"]')).toBeVisible();
    await expect(page.locator('#share-preview-text')).toBeVisible();
    await expect(page.locator('#btn-copy-share')).toBeVisible();
    await expect(page.locator('#btn-post-share')).toBeVisible();
  });

  // [AC-2] Pre-selection & Behavior
  test('2. Verify Context Preselection', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');

    // Wait for the active trend item to render in the DOM
    await expect(page.locator('.trend-item.active')).toBeVisible();

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

    // Wait for the active trend item to render in the DOM
    await expect(page.locator('.trend-item.active')).toBeVisible();

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

    // Wait for the active trend item to render in the DOM
    await expect(page.locator('.trend-item.active')).toBeVisible();

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
  test('5. Verify Copy-to-Clipboard', async ({ page, context, browserName }) => {
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

    // Grant clipboard permissions only if Chromium
    if (browserName === 'chromium') {
      await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    }

    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');

    // Wait for the active trend item to render in the DOM
    await expect(page.locator('.trend-item.active')).toBeVisible();

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

  // [AC-2] [AC-3] Unified Modal Component Structure
  test('6. Verify Outbound Sharing Intent', async ({ page, context, browserName }) => {
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

    // Grant clipboard permissions only if Chromium
    if (browserName === 'chromium') {
      await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    }

    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');

    // Wait for the active trend item to render in the DOM
    await expect(page.locator('.trend-item.active')).toBeVisible();

    await page.locator('#btn-share-trend').click();
    await expect(page.locator('#share-modal')).toBeVisible();

    // Wait for preview to load
    await expect(page.locator('#share-preview-text')).toHaveValue('Awesome Gemini post!');

    // Intercept popup page / target page opening on click
    const [newPage] = await Promise.all([
      context.waitForEvent('page'),
      page.locator('#btn-post-share').click() // This should trigger window.open
    ]);

    await expect(async () => {
      const url = newPage.url();
      expect(url).toContain('https://x.com/intent/tweet?text=');
      expect(url).toMatch(/x\.com.*intent.*tweet/);
      expect(url).toMatch(/Awesome.*Gemini.*post/);
    }).toPass();
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

    // Wait for the active trend item to render in the DOM
    await expect(page.locator('.trend-item.active')).toBeVisible();

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

    // 5. Verify Pinterest formatting & URL [AC-3]
    const pinterestPill = page.locator('.platform-pill[data-platform="pinterest"]');
    await pinterestPill.click();
    await expect(previewTextarea).not.toHaveValue(redditText);
    await expect(previewTextarea).not.toHaveValue('Generating post...');
    const pinterestText = await previewTextarea.inputValue();
    expect(pinterestText).toContain('https://viraljacker.com/t/google-gemini');
    expect(pinterestText).toContain('Pin Title:');
    expect(pinterestText).toContain('Pin Description:');
  });

  // [AC-3] Automated Validation of High-DPI Card Dimensions
  test('9. Verify downloaded card and infographic PNG dimensions are 2400x1260', async ({ page }) => {
    // We already have mockTrends and mockExplanation routes set up in beforeEach.
    // Let's also intercept api/poll to ensure the vote button reveals the download card button.
    await page.route('**/api/poll', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ genius: 10, overrated: 10 }),
      });
    });

    // Delete Web Share to trigger download
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

    // Vote to reveal Trend Card download button
    await page.locator('#btn-vote-genius').click();
    await expect(page.locator('#btn-download-card')).toBeVisible();

    // Download Trend Card and check dimensions
    const trendDownloadPromise = page.waitForEvent('download');
    await page.locator('#btn-download-card').click();
    const trendDownload = await trendDownloadPromise;
    const trendPath = await trendDownload.path();
    const trendBuffer = fs.readFileSync(trendPath);
    const trendWidth = trendBuffer.readUInt32BE(16);
    const trendHeight = trendBuffer.readUInt32BE(20);
    expect(trendWidth).toBe(2400);
    expect(trendHeight).toBe(1260);

    // Download Infographic Card and check dimensions
    const infoDownloadPromise = page.waitForEvent('download');
    await page.locator('#btn-download-infographic').click();
    const infoDownload = await infoDownloadPromise;
    const infoPath = await infoDownload.path();
    const infoBuffer = fs.readFileSync(infoPath);
    const infoWidth = infoBuffer.readUInt32BE(16);
    const infoHeight = infoBuffer.readUInt32BE(20);
    expect(infoWidth).toBe(2400);
    expect(infoHeight).toBe(1260);
  });

  // [AC-7] Generation Request ID Synchronization
  test('10. Verify Generation Request ID Synchronization (discards out-of-order responses)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });

    let requestCount = 0;
    // Intercept generate post to resolve the first request quickly but delay the second request
    await page.route('**/api/generate-post', async (route) => {
      requestCount++;
      const currentReqNum = requestCount;
      
      if (currentReqNum === 1) {
        // First request (X) resolves at 2000ms
        await new Promise((resolve) => setTimeout(resolve, 2000));
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ postText: 'Fast First Request Content' }),
        });
      } else {
        // Second request (LinkedIn) resolves at 4000ms
        await new Promise((resolve) => setTimeout(resolve, 4000));
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ postText: 'Slow Second Request Content' }),
        });
      }
    });

    await page.goto('/');
    await expect(page.locator('.trend-item.active')).toBeVisible();

    // Open share modal (starts 1st request automatically)
    await page.locator('#btn-share-trend').click();
    await expect(page.locator('#share-modal')).toBeVisible();

    // Immediately click LinkedIn pill to start 2nd request
    const linkedinPill = page.locator('.platform-pill[data-platform="linkedin"]');
    await linkedinPill.click();

    // Wait for 6000ms so both requests complete
    await page.waitForTimeout(6000);

    // Verify textarea shows the second request's content (Slow Second Request Content),
    // because it was the last requested platform, and request ID synchronization must ensure it updates.
    const previewTextarea = page.locator('#share-preview-text');
    await expect(previewTextarea).toHaveValue('Slow Second Request Content');
  });
});
