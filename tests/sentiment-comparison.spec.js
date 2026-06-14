import { test, expect } from '@playwright/test';

// [AC-5] E2E Playwright Tests - Test suite for Interactive Sentiment Timeline Comparison
test.describe('Sentiment History Comparison E2E & API Adversarial Tests', () => {

  // =========================================================================
  // [AC-1] Lowercase Case-Insensitive Cache & DB Lookups
  // Requirement: Normalize database/cache lookup keys and query params for
  // history to lowercase to prevent casing mismatch cache misses/duplicate seeds.
  // =========================================================================
  test('AC-1: GET /api/poll/history normalizes trend to lowercase and queries are case-insensitive', async ({ request }) => {
    const uniqueTrendBase = `CaseInsensitiveTrend-${Date.now()}-${Math.random().toString(36).substring(2)}`;
    const trendMixed = `${uniqueTrendBase}-MiXeD`;
    const trendLower = trendMixed.toLowerCase();
    const trendUpper = trendMixed.toUpperCase();

    // 1. Get history for trendMixed (seeds the trend with initial data)
    const res1 = await request.get(`/api/poll/history?trend=${encodeURIComponent(trendMixed)}`);
    expect(res1.status()).toBe(200);
    const data1 = await res1.json();
    expect(Array.isArray(data1)).toBe(true);
    expect(data1.length).toBeGreaterThan(0);

    // 2. Get history for trendLower, should return the EXACT same data
    const res2 = await request.get(`/api/poll/history?trend=${encodeURIComponent(trendLower)}`);
    expect(res2.status()).toBe(200);
    const data2 = await res2.json();
    expect(data2).toEqual(data1);

    // 3. Get history for trendUpper, should return the EXACT same data
    const res3 = await request.get(`/api/poll/history?trend=${encodeURIComponent(trendUpper)}`);
    expect(res3.status()).toBe(200);
    const data3 = await res3.json();
    expect(data3).toEqual(data1);
  });

  test('AC-1: Database access methods sanitize and normalize to lowercase in db.js', async () => {
    const dbModule = await import('../db.js');
    const getPollData = dbModule.getPollData;
    const incrementVote = dbModule.incrementVote;
    const getVoteEvents = dbModule.getVoteEvents;
    const seedVoteEvents = dbModule.seedVoteEvents;

    const baseTrend = `CasingDbTest-${Date.now()}`;
    const trendUpper = `${baseTrend}-UPPER`;
    const trendLower = `${baseTrend}-upper`.toLowerCase();

    // Seed events on trendUpper
    const initialEvents = [
      { vote: 'genius', timestamp: new Date().toISOString(), location: { city: 'London', country: 'UK', flag: '🇬🇧' } }
    ];
    await seedVoteEvents(trendUpper, initialEvents);

    // Retrieve via lower casing, should have the event
    const eventsLower = await getVoteEvents(trendLower);
    expect(eventsLower.length).toBe(1);
    expect(eventsLower[0].vote).toBe('genius');

    // Increment vote using upper casing
    await incrementVote(trendUpper, 'overrated');

    // Retrieve poll data using lower casing, should see both votes
    const dataLower = await getPollData(trendLower);
    expect(dataLower.genius).toBe(1);
    expect(dataLower.overrated).toBe(1);

    // Retrieve poll data using upper casing, should see both votes
    const dataUpper = await getPollData(trendUpper);
    expect(dataUpper.genius).toBe(1);
    expect(dataUpper.overrated).toBe(1);
  });

  // =========================================================================
  // [AC-2] Sentiment Comparison Selector in UI
  // Requirement: Add a dropdown selection element #compare-trend-select,
  // populate dynamically with non-active trends, and handle selection & guards.
  // =========================================================================
  test('AC-2: Dropdown selection element #compare-trend-select exists, is populated, fetches compared trend history, and guards against redundant actions', async ({ page }) => {
    // Mock the trends API to return a fixed list of trends
    await page.route('**/api/trends', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { title: 'Google Gemini', traffic: '100K+', description: 'Desc 1', news: { headline: 'HL1', snippet: 'SN1', url: 'https://e1.com' } },
          { title: 'OpenAI Search', traffic: '50K+', description: 'Desc 2', news: { headline: 'HL2', snippet: 'SN2', url: 'https://e2.com' } },
          { title: 'Apple Intelligence', traffic: '20K+', description: 'Desc 3', news: { headline: 'HL3', snippet: 'SN3', url: 'https://e3.com' } }
        ])
      });
    });

    // Mock history responses
    await page.route('**/api/poll/history?trend=google%20gemini', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { timestamp: '2026-06-14T00:00:00.000Z', geniusPercentage: 80, velocity: 10 },
          { timestamp: '2026-06-14T02:00:00.000Z', geniusPercentage: 85, velocity: 12 }
        ])
      });
    });

    let openAiSearchHistoryCalled = 0;
    await page.route('**/api/poll/history?trend=openai%20search', async (route) => {
      openAiSearchHistoryCalled++;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { timestamp: '2026-06-14T00:00:00.000Z', geniusPercentage: 60, velocity: 8 },
          { timestamp: '2026-06-14T02:00:00.000Z', geniusPercentage: 65, velocity: 9 }
        ])
      });
    });

    await page.goto('/');

    // Click on "Google Gemini" trend to make it active
    const trendItem = page.locator('.trend-item', { hasText: 'Google Gemini' });
    await trendItem.click();

    // Verify comparison dropdown selector exists in the header area of the timeline card
    const select = page.locator('.timeline-card-wrap #compare-trend-select');
    await expect(select).toBeVisible();

    // The dropdown list must be populated dynamically with options corresponding to all available trends in client state,
    // excluding the currently active trend (Google Gemini).
    const options = select.locator('option');
    await expect(options).toHaveCount(3); // "Compare with..." (placeholder) + "OpenAI Search" + "Apple Intelligence"
    
    // Check option values/texts
    const firstOption = options.nth(0);
    await expect(firstOption).toHaveAttribute('value', '');
    await expect(firstOption).toHaveText(/Compare with|Select trend/i);

    const secondOption = options.nth(1);
    await expect(secondOption).toHaveAttribute('value', 'OpenAI Search');
    await expect(secondOption).toHaveText('OpenAI Search');

    const thirdOption = options.nth(2);
    await expect(thirdOption).toHaveAttribute('value', 'Apple Intelligence');
    await expect(thirdOption).toHaveText('Apple Intelligence');

    // Change selector to "OpenAI Search". It must fetch "/api/poll/history?trend=openai%20search".
    await select.selectOption('OpenAI Search');
    
    await expect(async () => {
      expect(openAiSearchHistoryCalled).toBe(1);
    }).toPass();

    // Redundant actions guard: selecting the same option ("OpenAI Search")
    // must return early without triggering a new network request.
    const initialCallCount = openAiSearchHistoryCalled;
    await select.selectOption('OpenAI Search');
    await page.waitForTimeout(200); // Wait brief moment
    expect(openAiSearchHistoryCalled).toBe(initialCallCount); // Call count should NOT increment
  });

  // =========================================================================
  // [AC-3] Overlay Comparative Sentiment Chart Canvas
  // Requirement: Render dual lines/fills for active (emerald) and compared
  // (purple) trends on a single canvas.
  // =========================================================================
  test('AC-3: Overlay comparative sentiment chart canvas rendering styles', async ({ page }) => {
    // Mock trends and histories
    await page.route('**/api/trends', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { title: 'Google Gemini', traffic: '100K+', description: 'Desc 1', news: { headline: 'HL1', snippet: 'SN1', url: 'https://e1.com' } },
          { title: 'OpenAI Search', traffic: '50K+', description: 'Desc 2', news: { headline: 'HL2', snippet: 'SN2', url: 'https://e2.com' } }
        ])
      });
    });

    await page.route('**/api/poll/history?trend=google%20gemini', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { timestamp: '2026-06-14T00:00:00.000Z', geniusPercentage: 80, velocity: 10 },
          { timestamp: '2026-06-14T02:00:00.000Z', geniusPercentage: 85, velocity: 12 }
        ])
      });
    });

    await page.route('**/api/poll/history?trend=openai%20search', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { timestamp: '2026-06-14T00:00:00.000Z', geniusPercentage: 60, velocity: 8 },
          { timestamp: '2026-06-14T02:00:00.000Z', geniusPercentage: 65, velocity: 9 }
        ])
      });
    });

    // Add Canvas Spying script before load
    await page.addInitScript(() => {
      window.__canvasSpies = {
        gradients: [],
        calls: []
      };

      const origCreateLinearGradient = CanvasRenderingContext2D.prototype.createLinearGradient;
      CanvasRenderingContext2D.prototype.createLinearGradient = function(x0, y0, x1, y1) {
        const grad = origCreateLinearGradient.call(this, x0, y0, x1, y1);
        const gradSpy = {
          type: 'linear',
          coords: { x0, y0, x1, y1 },
          stops: []
        };
        window.__canvasSpies.gradients.push(gradSpy);
        
        const origAddColorStop = grad.addColorStop;
        grad.addColorStop = function(offset, color) {
          gradSpy.stops.push({ offset, color });
          return origAddColorStop.call(this, offset, color);
        };
        Object.defineProperty(grad, '__spy', { value: gradSpy, enumerable: false });
        return grad;
      };

      const origStroke = CanvasRenderingContext2D.prototype.stroke;
      CanvasRenderingContext2D.prototype.stroke = function() {
        window.__canvasSpies.calls.push({
          method: 'stroke',
          strokeStyle: this.strokeStyle,
          lineWidth: this.lineWidth
        });
        return origStroke.call(this);
      };

      const origFill = CanvasRenderingContext2D.prototype.fill;
      CanvasRenderingContext2D.prototype.fill = function() {
        let fillDetails = this.fillStyle;
        if (this.fillStyle && this.fillStyle.__spy) {
          fillDetails = { isGradient: true, ...this.fillStyle.__spy };
        }
        window.__canvasSpies.calls.push({
          method: 'fill',
          fillStyle: fillDetails
        });
        return origFill.call(this);
      };
    });

    await page.goto('/');

    const trendItem = page.locator('.trend-item', { hasText: 'Google Gemini' });
    await trendItem.click();

    // 1. Without comparison trend selected: Only active trend line (emerald) is rendered.
    await page.waitForTimeout(500);

    let canvasSpies = await page.evaluate(() => window.__canvasSpies);
    // Find active trend line stroke style (#10b981 / rgb(16, 185, 129))
    let emeraldStrokeFound = canvasSpies.calls.some(c => 
      c.method === 'stroke' && 
      (c.strokeStyle === '#10b981' || c.strokeStyle === 'rgb(16, 185, 129)' || c.strokeStyle === 'rgba(16, 185, 129, 1)')
    );
    expect(emeraldStrokeFound).toBe(true);

    // Verify purple compared line stroke style (#a855f7) is NOT present
    let purpleStrokeFound = canvasSpies.calls.some(c => 
      c.method === 'stroke' && 
      (c.strokeStyle === '#a855f7' || c.strokeStyle === 'rgb(168, 85, 247)' || c.strokeStyle === 'rgba(168, 85, 247, 1)')
    );
    expect(purpleStrokeFound).toBe(false);

    // 2. Select comparison trend: Both active and compared trend lines must be rendered.
    await page.evaluate(() => {
      window.__canvasSpies.calls = [];
      window.__canvasSpies.gradients = [];
    });

    const select = page.locator('.timeline-card-wrap #compare-trend-select');
    await select.selectOption('OpenAI Search');

    // Wait for data load and animation/rendering
    await page.waitForTimeout(500);

    canvasSpies = await page.evaluate(() => window.__canvasSpies);

    // Verify Active Trend Line stroke and fill
    emeraldStrokeFound = canvasSpies.calls.some(c => 
      c.method === 'stroke' && 
      (c.strokeStyle === '#10b981' || c.strokeStyle === 'rgb(16, 185, 129)' || c.strokeStyle === 'rgba(16, 185, 129, 1)')
    );
    expect(emeraldStrokeFound).toBe(true);

    let emeraldFillFound = canvasSpies.calls.some(c => 
      c.method === 'fill' && 
      (c.fillStyle === 'rgba(16, 185, 129, 0.25)' || 
       (c.fillStyle.isGradient && c.fillStyle.stops.some(s => s.color.includes('16, 185, 129') || s.color.includes('10b981'))))
    );
    expect(emeraldFillFound).toBe(true);

    // Verify Compared Trend Line stroke and fill
    purpleStrokeFound = canvasSpies.calls.some(c => 
      c.method === 'stroke' && 
      (c.strokeStyle === '#a855f7' || c.strokeStyle === 'rgb(168, 85, 247)' || c.strokeStyle === 'rgba(168, 85, 247, 1)')
    );
    expect(purpleStrokeFound).toBe(true);

    let purpleFillFound = canvasSpies.calls.some(c => 
      c.method === 'fill' && 
      (c.fillStyle === 'rgba(168, 85, 247, 0.15)' || 
       (c.fillStyle.isGradient && c.fillStyle.stops.some(s => s.color.includes('168, 85, 247') || s.color.includes('a855f7'))))
    );
    expect(purpleFillFound).toBe(true);
  });

  // =========================================================================
  // [AC-4] Comparative Interactive Tooltip
  // Requirement: When a comparison is active, hovering displays data for both
  // trends for that time segment, clearly labeled, positioning dynamically.
  // =========================================================================
  test('AC-4: Comparative interactive tooltip displays data for both active and compared trends on hover', async ({ page }) => {
    // Mock trends and histories
    await page.route('**/api/trends', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { title: 'Google Gemini', traffic: '100K+', description: 'Desc 1', news: { headline: 'HL1', snippet: 'SN1', url: 'https://e1.com' } },
          { title: 'OpenAI Search', traffic: '50K+', description: 'Desc 2', news: { headline: 'HL2', snippet: 'SN2', url: 'https://e2.com' } }
        ])
      });
    });

    await page.route('**/api/poll/history?trend=google%20gemini', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { timestamp: '2026-06-14T00:00:00.000Z', geniusPercentage: 80, velocity: 10 },
          { timestamp: '2026-06-14T02:00:00.000Z', geniusPercentage: 85, velocity: 12 },
          { timestamp: '2026-06-14T04:00:00.000Z', geniusPercentage: 90, velocity: 15 }
        ])
      });
    });

    await page.route('**/api/poll/history?trend=openai%20search', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { timestamp: '2026-06-14T00:00:00.000Z', geniusPercentage: 60, velocity: 8 },
          { timestamp: '2026-06-14T02:00:00.000Z', geniusPercentage: 65, velocity: 9 },
          { timestamp: '2026-06-14T04:00:00.000Z', geniusPercentage: 70, velocity: 11 }
        ])
      });
    });

    await page.goto('/');

    const trendItem = page.locator('.trend-item', { hasText: 'Google Gemini' });
    await trendItem.click();

    // Select comparison trend
    const select = page.locator('.timeline-card-wrap #compare-trend-select');
    await select.selectOption('OpenAI Search');

    // Wait for chart rendering
    await page.waitForTimeout(500);

    const canvas = page.locator('#sentiment-timeline-canvas');
    await expect(canvas).toBeVisible();

    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();

    // Hover at the center of the canvas
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);

    const tooltip = page.locator('#timeline-tooltip');
    await expect(tooltip).toBeVisible();

    // Check tooltip content contains info for both Google Gemini and OpenAI Search
    await expect(tooltip).toContainText('Google Gemini');
    await expect(tooltip).toContainText('% Genius');
    await expect(tooltip).toContainText('OpenAI Search');

    // Tooltip positioning check
    const styleAttr = await tooltip.getAttribute('style');
    expect(styleAttr).toContain('left');
    expect(styleAttr).toContain('top');

    // Boundary check: move cursor to extreme coordinates (top-left, bottom-right)
    await page.mouse.move(box.x + 1, box.y + 1);
    await expect(tooltip).toBeVisible();

    await page.mouse.move(box.x + box.width - 1, box.y + box.height - 1);
    await expect(tooltip).toBeVisible();

    // Clean up: move off canvas and check it hides
    await page.mouse.move(box.x - 50, box.y - 50);
    await expect(tooltip).toBeHidden();
  });

  // =========================================================================
  // [AC-5] Event Loop Yield Safety & Async Limit Updates
  // Requirement: API requests like limit checks, referral lookups, etc. must
  // be executed as un-awaited background promises or after the main render block.
  // =========================================================================
  test('AC-5: Event Loop Yield Safety - UI does not block on non-critical API requests', async ({ page }) => {
    // Intercept trends API
    await page.route('**/api/trends', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { title: 'Google Gemini', traffic: '100K+', description: 'Desc 1', news: { headline: 'HL1', snippet: 'SN1', url: 'https://e1.com' } }
        ])
      });
    });

    // We hang these requests (they never resolve or resolve with huge timeout)
    let chatLimitPromiseResolve;
    const chatLimitPromise = new Promise(resolve => {
      chatLimitPromiseResolve = resolve;
    });
    await page.route('**/api/chat-limit*', async (route) => {
      await chatLimitPromise;
      await route.fulfill({
        status: 200,
        body: JSON.stringify({ limitReached: false, currentCount: 0, allowedLimit: 3 })
      });
    });

    let predictionsPromiseResolve;
    const predictionsPromise = new Promise(resolve => {
      predictionsPromiseResolve = resolve;
    });
    await page.route('**/api/predictions*', async (route) => {
      await predictionsPromise;
      await route.fulfill({
        status: 200,
        body: JSON.stringify([])
      });
    });

    await page.goto('/');

    // Click on trend to load details
    const trendItem = page.locator('.trend-item', { hasText: 'Google Gemini' });
    await trendItem.click();

    // The detail title must update to "Google Gemini" immediately, even though chat-limit and predictions endpoints are hanging
    const detailTitle = page.locator('#detail-title');
    await expect(detailTitle).toHaveText('Google Gemini');

    // Now resolve the hanging promises to clean up the test
    chatLimitPromiseResolve();
    predictionsPromiseResolve();
  });

});
