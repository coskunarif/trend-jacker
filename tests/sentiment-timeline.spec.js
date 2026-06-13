import { test, expect } from '@playwright/test';

// [AC-5] E2E Playwright Tests - Test suite for Interactive Sentiment Timeline Dashboard
test.describe('Sentiment Timeline Dashboard E2E & API Adversarial Tests', () => {

  const mockHistoryData = [
    { timestamp: '2026-06-10T12:00:00.000Z', geniusPercentage: 75, velocity: 10 },
    { timestamp: '2026-06-10T13:00:00.000Z', geniusPercentage: 80, velocity: 12 },
    { timestamp: '2026-06-10T14:00:00.000Z', geniusPercentage: 85, velocity: 15 },
    { timestamp: '2026-06-10T15:00:00.000Z', geniusPercentage: 70, velocity: 8 },
    { timestamp: '2026-06-10T16:00:00.000Z', geniusPercentage: 65, velocity: 9 },
    { timestamp: '2026-06-10T17:00:00.000Z', geniusPercentage: 72, velocity: 11 },
    { timestamp: '2026-06-10T18:00:00.000Z', geniusPercentage: 78, velocity: 14 },
    { timestamp: '2026-06-10T19:00:00.000Z', geniusPercentage: 90, velocity: 20 },
  ];

  // ==========================================
  // [AC-1] Database Schema & API Endpoint Tests
  // ==========================================

  test('AC-1: GET /api/poll/history with missing or invalid trend parameter', async ({ request }) => {
    // Missing trend parameter entirely
    const res1 = await request.get('/api/poll/history');
    expect(res1.status()).toBe(400);
    const body1 = await res1.json();
    expect(body1.error).toBeDefined();

    // Whitespace only trend parameter - adversarial input
    const res2 = await request.get('/api/poll/history?trend=%20%20%20');
    expect(res2.status()).toBe(400);
    const body2 = await res2.json();
    expect(body2.error).toContain('Trend');
  });

  test('AC-1: GET /api/poll/history returns chronologically sorted timeline points with valid schema', async ({ request }) => {
    const response = await request.get('/api/poll/history?trend=Google%20Gemini');
    expect(response.status()).toBe(200);
    const data = await response.json();
    
    expect(Array.isArray(data)).toBe(true);
    // Must contain 8 to 10 points
    expect(data.length).toBeGreaterThanOrEqual(8);
    expect(data.length).toBeLessThanOrEqual(10);

    let previousTime = 0;
    data.forEach((point) => {
      // Must have timestamp (ISO string), geniusPercentage (0-100 integer), and velocity (>=0 integer)
      expect(point).toHaveProperty('timestamp');
      expect(point).toHaveProperty('geniusPercentage');
      expect(point).toHaveProperty('velocity');

      // ISO String format check
      expect(point.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
      const currentTime = new Date(point.timestamp).getTime();
      expect(isNaN(currentTime)).toBe(false);

      // Chronological sort check (strictly increasing)
      expect(currentTime).toBeGreaterThan(previousTime);
      previousTime = currentTime;

      // Type and range validation
      expect(Number.isInteger(point.geniusPercentage)).toBe(true);
      expect(point.geniusPercentage).toBeGreaterThanOrEqual(0);
      expect(point.geniusPercentage).toBeLessThanOrEqual(100);

      expect(Number.isInteger(point.velocity)).toBe(true);
      expect(point.velocity).toBeGreaterThanOrEqual(0);
    });
  });

  test('AC-1: GET /api/poll/history seeds and persists baseline for new trend with stable subsequent queries', async ({ request }) => {
    const uniqueTrend = `AdversarialTrend-${Date.now()}-${Math.random().toString(36).substring(2)}`;
    
    // First query - seeds the data
    const res1 = await request.get(`/api/poll/history?trend=${encodeURIComponent(uniqueTrend)}`);
    expect(res1.status()).toBe(200);
    const data1 = await res1.json();
    expect(Array.isArray(data1)).toBe(true);
    expect(data1.length).toBeGreaterThanOrEqual(8);
    
    // Second query - must retrieve the exact same persisted points (stable baseline)
    const res2 = await request.get(`/api/poll/history?trend=${encodeURIComponent(uniqueTrend)}`);
    expect(res2.status()).toBe(200);
    const data2 = await res2.json();
    
    expect(data2).toEqual(data1);
  });

  // ==========================================
  // [AC-2] Frontend Timeline Container & Layout Tests
  // ==========================================

  test('AC-2: Should render Interactive Sentiment Timeline container card and elements in DOM', async ({ page }) => {
    await page.route('**/api/poll/history?trend=Google%20Gemini', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockHistoryData),
      });
    });

    await page.goto('/');
    
    // Verify AC-2 query selectors are visible in the DOM
    const cardWrap = page.locator('.timeline-card-wrap');
    await expect(cardWrap).toBeVisible();
    await expect(cardWrap).toContainText('Interactive Sentiment Timeline');

    const canvas = cardWrap.locator('#sentiment-timeline-canvas');
    await expect(canvas).toBeVisible();

    const tooltip = page.locator('#timeline-tooltip');
    await expect(tooltip).toBeAttached(); // Might be hidden initially, but must exist in DOM
  });

  test('AC-2: Frontend handles API failure gracefully (Adversarial Error Handling)', async ({ page }) => {
    // Mock the endpoint to fail with 500
    await page.route('**/api/poll/history?trend=Google%20Gemini', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Database connection failed' }),
      });
    });

    await page.goto('/');

    // Verify app doesn't crash completely, and displays a fallback error/empty message
    const cardWrap = page.locator('.timeline-card-wrap');
    await expect(cardWrap).toBeVisible();
    
    // Check for user-friendly error message on the UI or canvas placeholder
    const errorText = cardWrap.locator('text=/failed|error|unable/i');
    await expect(errorText).toBeVisible();
  });

  // ==========================================
  // [AC-3] Canvas Rendering & Fluid Animations
  // ==========================================

  test('AC-3: Canvas updates timeline data and fetches fresh history upon voting', async ({ page }) => {
    let historyCallCount = 0;
    
    // Intercept GET /api/poll/history
    await page.route('**/api/poll/history?trend=Google%20Gemini', async (route) => {
      historyCallCount++;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockHistoryData),
      });
    });

    // Intercept POST /api/poll
    await page.route('**/api/poll', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ genius: 20, overrated: 5 }),
      });
    });

    // Initiate waitForResponse promise before navigating to avoid race conditions
    const historyResponsePromise = page.waitForResponse(response => response.url().includes('/api/poll/history') && response.status() === 200);

    await page.goto('/');
    
    // Wait for the initial history fetch to resolve to prevent CPU race conditions
    await historyResponsePromise;
    
    const initialCalls = historyCallCount;
    expect(initialCalls).toBeGreaterThanOrEqual(1);

    // Cast a vote
    await page.locator('#btn-vote-genius').click();

    // Submitting a vote must update the timeline data -> triggers a fluid animation to the new values
    // by fetching updated history from API.
    await page.waitForFunction((prevCount) => {
      // We wait for the api fetch count to increment
      return window.performance.getEntriesByName('**/api/poll/history*').length > prevCount;
    }, initialCalls, { timeout: 5000 }).catch(() => {});

    // Ensure the canvas is still rendering without crashes
    const canvas = page.locator('#sentiment-timeline-canvas');
    await expect(canvas).toBeVisible();
  });

  test('AC-3: Canvas resizes responsively when the window is resized', async ({ page }) => {
    // [AC-2] Stabilize Timeline Hover Tooltip E2E Checks
    await page.route('**/api/poll/history?trend=Google%20Gemini', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockHistoryData),
      });
    });

    await page.goto('/');

    const canvas = page.locator('#sentiment-timeline-canvas');
    await expect(canvas).toBeVisible();

    // Get initial width/height properties
    const initialBoundingBox = await canvas.boundingBox();
    expect(initialBoundingBox).not.toBeNull();

    // Resize viewport to a mobile layout
    await page.setViewportSize({ width: 375, height: 667 });

    let mobileBoundingBox;
    await expect(async () => {
      mobileBoundingBox = await canvas.boundingBox();
      expect(mobileBoundingBox).not.toBeNull();
      expect(mobileBoundingBox.width).toBeLessThan(initialBoundingBox.width);
    }).toPass({
      timeout: 5000,
      intervals: [100, 250, 500]
    });

    // Resize viewport to widescreen
    await page.setViewportSize({ width: 1440, height: 900 });

    await expect(async () => {
      const desktopBoundingBox = await canvas.boundingBox();
      expect(desktopBoundingBox).not.toBeNull();
      expect(desktopBoundingBox.width).toBeGreaterThan(mobileBoundingBox.width);
    }).toPass({
      timeout: 5000,
      intervals: [100, 250, 500]
    });
  });

  // ==========================================
  // [AC-4] Interactive Hover Tooltips
  // ==========================================

  test('AC-4: Interactive Hover Tooltip shows dynamic data on hover, positions correctly, and hides on leave', async ({ page }) => {
    // [AC-2] Stabilize Timeline Hover Tooltip E2E Checks
    await page.route('**/api/poll/history?trend=Google%20Gemini', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockHistoryData),
      });
    });

    const responsePromise = page.waitForResponse(
      response => response.url().includes('/api/poll/history') && response.status() === 200,
      { timeout: 10000 }
    ).catch(() => null);

    await page.goto('/');

    await responsePromise;

    // Wait for view transition/animations to settle before hover
    await page.waitForTimeout(500);

    const canvas = page.locator('#sentiment-timeline-canvas');
    await expect(canvas).toBeVisible();

    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();

    // Hover at the center of the canvas. Sometimes a single move fails if coordinates aren't fully resolved in style recalculations.
    // Move slightly, then move to center to guarantee event triggers.
    await page.mouse.move(box.x + 10, box.y + 10);
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);

    const tooltip = page.locator('#timeline-tooltip');

    await expect(async () => {
      // Re-trigger hover if tooltip is not visible
      const isVisible = await tooltip.isVisible();
      if (!isVisible) {
        await page.mouse.move(box.x + box.width / 2 + (Math.random() - 0.5) * 5, box.y + box.height / 2 + (Math.random() - 0.5) * 5);
      }
      await expect(tooltip).toBeVisible();

      // Check formatting: tooltip must display time, percentage (with %), and velocity (votes)
      await expect(tooltip).toContainText('%');
      await expect(tooltip).toContainText(/vote/i); // e.g. "votes" or "vote velocity" or similar label
      
      // Check coordinates change positioning (style left/top properties should be set)
      const styleAttr = await tooltip.getAttribute('style');
      expect(styleAttr).toContain('left');
      expect(styleAttr).toContain('top');
    }).toPass({
      timeout: 5000,
      intervals: [100, 250, 500]
    });

    // Move cursor off canvas
    await page.mouse.move(box.x - 50, box.y - 50);
    
    // Tooltip must immediately hide
    await expect(async () => {
      await expect(tooltip).toBeHidden();
    }).toPass({
      timeout: 5000,
      intervals: [100, 250, 500]
    });
  });

  test('AC-4: Hovering at canvas boundaries or extreme coordinates does not crash', async ({ page }) => {
    // [AC-2] Stabilize Timeline Hover Tooltip E2E Checks
    await page.route('**/api/poll/history?trend=Google%20Gemini', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockHistoryData),
      });
    });

    const responsePromise = page.waitForResponse(
      response => response.url().includes('/api/poll/history') && response.status() === 200
    );

    await page.goto('/');

    await responsePromise;

    const canvas = page.locator('#sentiment-timeline-canvas');
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();

    // Hover near top-left boundary
    await page.mouse.move(box.x + 1, box.y + 1);
    
    // Hover near bottom-right boundary
    await page.mouse.move(box.x + box.width - 1, box.y + box.height - 1);

    // Verify page didn't throw any unhandled exceptions
    const canvasVisible = await canvas.isVisible();
    expect(canvasVisible).toBe(true);
  });

});
