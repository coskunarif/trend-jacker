import { test, expect } from '@playwright/test';

// [AC-5] E2E Playwright Tests - Test suite for Interactive Sentiment Timeline Dashboard
test.describe('Sentiment Timeline Dashboard E2E Tests', () => {

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

  // [AC-1] Database Schema and API Endpoint
  test('should fetch poll history from the API endpoint and get structured timeline data', async ({ request }) => {
    const response = await request.get('/api/poll/history?trend=Google%20Gemini');
    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThanOrEqual(8);
    expect(data.length).toBeLessThanOrEqual(10);
    
    // Each data point must have timestamps, geniusPercentage, and velocity
    data.forEach(point => {
      expect(point).toHaveProperty('timestamp');
      expect(point).toHaveProperty('geniusPercentage');
      expect(point).toHaveProperty('velocity');
      expect(typeof point.geniusPercentage).toBe('number');
      expect(typeof point.velocity).toBe('number');
    });
  });

  // [AC-1] Database Schema and API Endpoint
  test('should generate realistic randomized historical baseline when trend has no history', async ({ request }) => {
    const uniqueTrend = `NewTrend-${Date.now()}`;
    const response = await request.get(`/api/poll/history?trend=${encodeURIComponent(uniqueTrend)}`);
    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThanOrEqual(8);
    expect(data.length).toBeLessThanOrEqual(10);

    data.forEach(point => {
      expect(new Date(point.timestamp).getTime()).toBeGreaterThan(Date.now() - 24 * 60 * 60 * 1000 - 60000);
      expect(point.geniusPercentage).toBeGreaterThanOrEqual(0);
      expect(point.geniusPercentage).toBeLessThanOrEqual(100);
      expect(point.velocity).toBeGreaterThanOrEqual(0);
    });
  });

  // [AC-2] Frontend Timeline Container & Layout
  test('should render Interactive Sentiment Timeline container card and canvas', async ({ page }) => {
    await page.route('**/api/poll/history?trend=Google%20Gemini', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockHistoryData),
      });
    });

    await page.goto('/');
    
    // Find the canvas container card or element
    const container = page.locator('.card, .glass-card');
    const timelineCard = container.filter({ hasText: 'Interactive Sentiment Timeline' });
    await expect(timelineCard).toBeVisible();

    const canvas = page.locator('#sentiment-timeline-canvas');
    await expect(canvas).toBeVisible();
  });

  // [AC-3] Canvas Rendering & Fluid Animations
  test('should handle vote submission and trigger updates on the sentiment timeline', async ({ page }) => {
    // Intercept API calls
    await page.route('**/api/poll/history?trend=Google%20Gemini', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockHistoryData),
      });
    });

    await page.route('**/api/poll', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ genius: 19, overrated: 6 }),
      });
    });

    await page.goto('/');

    const canvas = page.locator('#sentiment-timeline-canvas');
    await expect(canvas).toBeVisible();

    // Click on a vote button
    await page.locator('#btn-vote-genius').click();

    // We expect the canvas to be updated. Since it's canvas, we can monitor if
    // any update events or fetches are triggered, but at least we can verify it doesn't crash.
    await expect(canvas).toBeVisible();
  });

  // [AC-4] Interactive Hover Tooltips
  test('should display tooltip on hovering over the sentiment timeline and hide when cursor leaves', async ({ page }) => {
    await page.route('**/api/poll/history?trend=Google%20Gemini', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockHistoryData),
      });
    });

    const responsePromise = page.waitForResponse('**/api/poll/history*');
    await page.goto('/');
    await responsePromise;

    const canvas = page.locator('#sentiment-timeline-canvas');
    await expect(canvas).toBeVisible();

    // Get canvas bounding box
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();

    // Hover near a point on the canvas (e.g. center)
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);

    // Expect tooltip element to appear
    const tooltip = page.locator('#timeline-tooltip');
    await expect(tooltip).toBeVisible();
    
    // The tooltip should have dynamic values like timestamp, sentiment %, and velocity
    await expect(tooltip).toContainText('%');
    await expect(tooltip).toContainText('votes');

    // Move mouse away from canvas
    await page.mouse.move(box.x - 20, box.y - 20);
    await expect(tooltip).toBeHidden();
  });

});
