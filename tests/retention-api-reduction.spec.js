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
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const todayStr = `${year}-${month}-${day}`;

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
            prediction_date: todayStr,
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

  // =========================================================================
  // [AC-3] Non-Blocking UI Updates and Event Loop Yields
  // =========================================================================
  test('AC-3: Asynchronous checks (such as /api/chat-limit) are non-blocking and do not delay UI detail rendering', async ({ page }) => {
    // Intercept /api/chat-limit and delay the response by 3 seconds
    let chatLimitCalled = false;
    await page.route('**/api/chat-limit*', async (route) => {
      chatLimitCalled = true;
      await new Promise(resolve => setTimeout(resolve, 3000));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          allowedLimit: 3,
          currentCount: 0,
          limitReached: false
        })
      });
    });

    await page.goto('/');

    // Select the first trend to load details
    const firstTrendItem = page.locator('.trend-item').first();
    const trendTitle = (await firstTrendItem.locator('.trend-name, h4').textContent()).trim();

    // Start timer before clicking
    const startTime = Date.now();

    await firstTrendItem.click();

    // The detail panel header (#detail-title or similar) should immediately update with the selected trend's title
    const detailTitleEl = page.locator('#detail-title');
    await expect(detailTitleEl).toHaveText(trendTitle);

    const duration = Date.now() - startTime;
    // The UI must update immediately (under 300ms) without waiting for the delayed /api/chat-limit request
    expect(duration).toBeLessThan(300);
    expect(chatLimitCalled).toBe(true);
  });

  // =========================================================================
  // [AC-1] Client-Side Chat History Truncation (Sliding Window)
  // =========================================================================
  test('AC-1: Conversation history sent to server is truncated to the last 4 messages, while all bubbles remain in the DOM', async ({ page }) => {
    // Track outgoing history payloads
    const outgoingHistories = [];
    await page.route('**/api/chat', async (route) => {
      const postData = route.request().postDataJSON();
      outgoingHistories.push(postData.history || []);
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ reply: `Mock reply for ${postData.query}` })
      });
    });

    await page.goto('/');
    await page.locator('.trend-item').first().click();

    const chatInput = page.locator('#chat-input');
    const chatForm = page.locator('#chat-form');

    // Send 5 messages in sequence
    for (let i = 1; i <= 5; i++) {
      await chatInput.fill(`Message ${i}`);
      await page.locator('#chat-submit-btn').click();
      // Wait for the response bubble to appear
      await expect(page.locator(`.chat-bubble.bot`, { hasText: `Mock reply for Message ${i}` })).toBeVisible();
    }

    // Outgoing payloads logic:
    // Request 1: history = []
    // Request 2: history = [M1, R1]
    // Request 3: history = [M1, R1, M2, R2]
    // Request 4: history = [M2, R2, M3, R3] (truncated to last 4)
    // Request 5: history = [M3, R3, M4, R4] (truncated to last 4)
    expect(outgoingHistories.length).toBe(5);
    
    // Check request 4
    expect(outgoingHistories[3].length).toBe(4);
    expect(outgoingHistories[3][0].content).toBe('Message 2');
    
    // Check request 5
    expect(outgoingHistories[4].length).toBe(4);
    expect(outgoingHistories[4][0].content).toBe('Message 3');

    // Verify all 10 bubbles + the initial greeting bubble are in the DOM (total 11 bubbles)
    const bubblesCount = await page.locator('.chat-bubble').count();
    expect(bubblesCount).toBe(11); // 1 greeting + 5 user messages + 5 assistant replies
  });

  // =========================================================================
  // [AC-2] Browser-Side sessionStorage Chat Caching
  // =========================================================================
  test('AC-2: Chat queries and responses are cached client-side in sessionStorage and retrieved case-insensitively', async ({ page }) => {
    // Intercept /api/chat to count requests
    let chatRequestsCount = 0;
    await page.route('**/api/chat', async (route) => {
      chatRequestsCount++;
      const postData = route.request().postDataJSON();
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ reply: `Mock reply for ${postData.query}` })
      });
    });

    await page.goto('/');

    const firstTrendItem = page.locator('.trend-item').first();
    const trendTitle = (await firstTrendItem.locator('.trend-name, h4').textContent()).trim();
    await firstTrendItem.click();

    // Clear sessionStorage at the start
    await page.evaluate(() => sessionStorage.clear());

    const chatInput = page.locator('#chat-input');
    const chatForm = page.locator('#chat-form');

    // 1. Submit Query A in lowercase
    const queryA = 'is this trend legit?';
    await chatInput.fill(queryA);
    await page.locator('#chat-submit-btn').click();
    await expect(page.locator(`.chat-bubble.bot`, { hasText: `Mock reply for ${queryA}` })).toBeVisible();

    expect(chatRequestsCount).toBe(1);

    // Verify key in sessionStorage
    const storageKeys = await page.evaluate(() => Object.keys(sessionStorage));
    const cacheKey = storageKeys.find(key => key.startsWith('chat_cache:'));
    expect(cacheKey).toBeDefined();

    // Key format: chat_cache:${trend}:${query}:${historyKey} (all in lowercase)
    const expectedPrefix = `chat_cache:${trendTitle.toLowerCase()}:${queryA.toLowerCase()}:`;
    expect(cacheKey.startsWith(expectedPrefix)).toBe(true);

    const cachedVal = await page.evaluate((k) => sessionStorage.getItem(k), cacheKey);
    expect(cachedVal).toContain(`Mock reply for ${queryA}`);

    // Reset counter
    chatRequestsCount = 0;

    // 2. Submit identical query A with different casing (e.g. UPPERCASE)
    const queryAUpper = queryA.toUpperCase();
    await chatInput.fill(queryAUpper);
    await page.locator('#chat-submit-btn').click();

    // Verify it renders the response but does NOT send a network request
    await expect(page.locator(`.chat-bubble.bot`).last()).toBeVisible();
    await page.waitForTimeout(500); // Wait short time to ensure no network call is fired
    expect(chatRequestsCount).toBe(0);

    // Verify the response content in the bubble matches the cached reply
    const lastBubbleText = await page.locator(`.chat-bubble.bot`).last().textContent();
    expect(lastBubbleText).toContain(`Mock reply for ${queryA}`);
  });

});
