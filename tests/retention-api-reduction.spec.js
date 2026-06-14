import { test, expect } from '@playwright/test';

test.describe('User Retention & API Request Reduction Tests', () => {

  test.beforeEach(async ({ context }) => {
    // [AC-7] Clipboard read/write permissions
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  });

  // =========================================================================
  // [AC-1] Prevent Redundant Demographic Selector Calls
  // =========================================================================
  test('AC-1: Clicking the already active demographic pill does not trigger any POST /api/explain requests', async ({ page }) => {
    await page.goto('/');
    
    // Select the first trend to load details
    const firstTrendItem = page.locator('.trend-item').first();
    await firstTrendItem.click();

    // Verify which demographic is active (should have active class)
    const activePill = page.locator('.demo-pill.active');
    await expect(activePill).toBeVisible();

    let explainRequestsCount = 0;
    await page.route('**/api/explain', async (route) => {
      explainRequestsCount++;
      await route.continue();
    });

    // Click the already active demographic pill
    await activePill.click();

    // Wait short time to ensure no network calls were made
    await page.waitForTimeout(500);
    expect(explainRequestsCount).toBe(0);
  });

  // =========================================================================
  // [AC-2] Prevent Redundant Language Selector Calls
  // =========================================================================
  test('AC-2: Triggering a change event on #lang-select with the current active language value does not trigger POST /api/explain requests', async ({ page }) => {
    await page.goto('/');
    
    const firstTrendItem = page.locator('.trend-item').first();
    await firstTrendItem.click();

    // Get currently selected language value
    const currentLang = await page.locator('#lang-select').inputValue();

    let explainRequestsCount = 0;
    await page.route('**/api/explain', async (route) => {
      explainRequestsCount++;
      await route.continue();
    });

    // Dispatch change event with the same language value programmatically
    await page.evaluate((val) => {
      const select = document.getElementById('lang-select');
      if (select) {
        select.value = val;
        select.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }, currentLang);

    // Wait short time to ensure no network calls were made
    await page.waitForTimeout(500);
    expect(explainRequestsCount).toBe(0);
  });

  // =========================================================================
  // [AC-3] Prevent Redundant Platform Pill Calls in Post Generator
  // =========================================================================
  test('AC-3: Clicking the already active platform pill in the post generator does not send POST /api/generate-post requests', async ({ page }) => {
    await page.goto('/');
    
    const firstTrendItem = page.locator('.trend-item').first();
    await firstTrendItem.click();

    // Open share modal
    const shareBtn = page.locator('#btn-share-trend');
    await shareBtn.click();
    await expect(page.locator('#share-modal')).toBeVisible();

    // Find the active platform pill
    const activePill = page.locator('.platform-pill.active');
    await expect(activePill).toBeVisible();

    let generateRequestsCount = 0;
    await page.route('**/api/generate-post', async (route) => {
      generateRequestsCount++;
      await route.continue();
    });

    // Click the already active platform pill
    await activePill.click();

    // Wait short time to ensure no network calls were made
    await page.waitForTimeout(500);
    expect(generateRequestsCount).toBe(0);
  });

  // =========================================================================
  // [AC-4] Client-Side Explanation Caching
  // =========================================================================
  test('AC-4: Client-side explanation cache Map exists, uses `${trendTitle}:${lang}:${bracket}` lowercase format, and serves cached responses synchronously', async ({ page }) => {
    await page.goto('/');

    // Locate the first trend and get its name
    const firstTrendItem = page.locator('.trend-item').first();
    const trendTitle = (await firstTrendItem.locator('.trend-name, h4').textContent()).trim();
    
    await firstTrendItem.click();

    // 1. Check window.explanationCache exists and is a Map
    const cacheExists = await page.evaluate(() => {
      return typeof window.explanationCache !== 'undefined' && window.explanationCache instanceof Map;
    });
    expect(cacheExists).toBe(true);

    // 2. Cache key verification
    const currentDemo = await page.evaluate(() => localStorage.getItem('selected-demographic') || 'adults');
    const currentLang = await page.locator('#lang-select').inputValue();
    const expectedKey = `${trendTitle}:${currentLang}:${currentDemo}`.toLowerCase();

    // Verify key exists in the cache Map
    const keyInCache = await page.evaluate((k) => window.explanationCache.has(k), expectedKey);
    expect(keyInCache).toBe(true);

    // 3. Verify caching behavior: toggle to kids_teens (network request) and then toggle back to adults (no request)
    let explainRequestsCount = 0;
    await page.route('**/api/explain', async (route) => {
      explainRequestsCount++;
      await route.continue();
    });

    // Toggle demographic to kids_teens
    await page.locator('.demo-pill[data-val="kids_teens"]').click();
    await page.waitForResponse(response => response.url().includes('/api/explain') && response.status() === 200);
    expect(explainRequestsCount).toBe(1);

    // Reset counter
    explainRequestsCount = 0;

    // Toggle back to the initial demographic (adults)
    await page.locator(`.demo-pill[data-val="${currentDemo}"]`).click();

    // Wait and verify no network requests were sent
    await page.waitForTimeout(500);
    expect(explainRequestsCount).toBe(0);
  });

  // =========================================================================
  // [AC-5] Initial Cache Seeding
  // =========================================================================
  test('AC-5: Initial explanation cache seeding with preloadedData on page load', async ({ page }) => {
    await page.goto('/');

    // Verify cache is seeded on startup matching preloadedData
    const isSeeded = await page.evaluate(() => {
      const cache = window.explanationCache;
      if (!cache || cache.size === 0) return false;
      
      const preloadedEl = document.getElementById('preloaded-trend-data');
      if (!preloadedEl) return false;
      const preloaded = JSON.parse(preloadedEl.textContent);
      const trend = preloaded.trend;
      const lang = preloaded.lang || 'en';
      const bracket = localStorage.getItem('selected-demographic') || 'adults';
      
      const key = `${trend}:${lang}:${bracket}`.toLowerCase();
      return cache.has(key);
    });
    expect(isSeeded).toBe(true);

    // Verify toggling away and back uses cache without hitting network
    let explainRequestsCount = 0;
    await page.route('**/api/explain', async (route) => {
      explainRequestsCount++;
      await route.continue();
    });

    // Toggle away to kids_teens
    await page.locator('.demo-pill[data-val="kids_teens"]').click();
    await page.waitForResponse(response => response.url().includes('/api/explain') && response.status() === 200);

    // Reset counter
    explainRequestsCount = 0;

    // Toggle back to the original loaded demographic
    const defaultDemo = await page.evaluate(() => localStorage.getItem('selected-demographic') || 'adults');
    await page.locator(`.demo-pill[data-val="${defaultDemo}"]`).click();

    await page.waitForTimeout(500);
    expect(explainRequestsCount).toBe(0);
  });

  // =========================================================================
  // [AC-6] Lock Screen Prediction CTA (Not Predicted State)
  // =========================================================================
  test('AC-6: Lock Screen Prediction CTA displays correct message when not predicted, scrolls and focuses on click, and updates on prediction', async ({ page }) => {
    // 1. Mock api/chat-limit to return limit reached
    await page.route('**/api/chat-limit*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          allowedLimit: 3,
          currentCount: 3,
          limitReached: true,
          predictionBonus: 0
        })
      });
    });

    // Mock predictions list to return empty (not predicted today)
    await page.route('**/api/predictions*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([])
      });
    });

    await page.goto('/');
    
    // Select trend to trigger chat rendering / locking
    await page.locator('.trend-item').first().click();

    // Verify chat lock container is visible
    const lockContainer = page.locator('#chat-lock-container');
    await expect(lockContainer).toBeVisible();

    // Verify CTA text
    await expect(lockContainer).toContainText("Predict if this trend will Rise or Fall tomorrow to earn +3 capacity when correct!");
    
    const predictBtn = lockContainer.locator('#chat-lock-predict-btn');
    await expect(predictBtn).toBeVisible();
    await expect(predictBtn).toHaveText("Predict Trend's Next Move");

    // Mock prediction submission endpoint
    let predictionRecorded = null;
    await page.route('**/api/predict', async (route) => {
      predictionRecorded = route.request().postDataJSON();
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true })
      });
    });

    // Click CTA button
    const riseBtn = page.locator('#prediction-card-container .btn-predict-rise');
    await predictBtn.click();

    // Verify focus shifts to rise button
    await expect(riseBtn).toBeFocused();

    // Submit prediction
    await riseBtn.click();

    // Verify prediction payload
    expect(predictionRecorded).toBeDefined();
    expect(predictionRecorded.prediction).toBe('rise');

    // Verify CTA updates immediately to show we predicted rise
    await expect(lockContainer).toContainText("You predicted this trend will rise tomorrow. Correct predictions unlock +3 capacity!");
    await expect(predictBtn).toBeHidden();
  });

  // =========================================================================
  // [AC-6] Lock Screen Prediction CTA (Already Predicted State)
  // =========================================================================
  test('AC-6: Lock Screen Prediction CTA displays already predicted message if client has predicted today', async ({ page }) => {
    // 1. Mock api/chat-limit to return limit reached
    await page.route('**/api/chat-limit*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          allowedLimit: 3,
          currentCount: 3,
          limitReached: true,
          predictionBonus: 0
        })
      });
    });

    // Mock predictions list to return a prediction for 'google gemini'
    await page.route('**/api/predictions*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            trend: 'google gemini',
            prediction: 'fall',
            prediction_date: '2026-06-13',
            status: 'pending'
          }
        ])
      });
    });

    await page.goto('/');
    
    // Select Google Gemini
    await page.locator('.trend-item', { hasText: 'Google Gemini' }).first().click();

    const lockContainer = page.locator('#chat-lock-container');
    await expect(lockContainer).toBeVisible();

    // Verify CTA text shows that user already predicted "fall"
    await expect(lockContainer).toContainText("You predicted this trend will fall tomorrow. Correct predictions unlock +3 capacity!");
    // Predict button should be hidden
    await expect(lockContainer.locator('#chat-lock-predict-btn')).toBeHidden();
  });

  // =========================================================================
  // [AC-7] Invite Link Clipboard Action
  // =========================================================================
  test('AC-7: Clicking #referral-share-link copies unique link, prevents navigation, updates text to "Link Copied!", and reverts after 2000ms', async ({ page, context }) => {
    // Mock api/chat-limit to return limit reached
    await page.route('**/api/chat-limit*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          allowedLimit: 3,
          currentCount: 3,
          limitReached: true,
          predictionBonus: 0
        })
      });
    });

    await page.goto('/');
    await page.locator('.trend-item').first().click();

    const shareLink = page.locator('#referral-share-link');
    await expect(shareLink).toBeVisible();
    
    // Capture the dynamic referral link URL text
    const originalText = (await shareLink.textContent() || '').trim();
    expect(originalText).toContain('?ref=');

    // Click link
    await shareLink.click();

    // Verify it doesn't navigate away or append hash to URL incorrectly
    expect(page.url()).not.toContain('?ref=');

    // Verify text changed to "Link Copied!"
    await expect(shareLink).toHaveText('Link Copied!');

    // Check clipboard content
    const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
    expect(clipboardText).toContain('?ref=');

    // Verify it reverts to original text after 2000ms
    await page.waitForTimeout(2100);
    await expect(shareLink).toHaveText(originalText);
  });

});
