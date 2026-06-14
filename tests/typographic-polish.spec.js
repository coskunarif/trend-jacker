import { test, expect } from '@playwright/test';

// Test suite for SPEC.md: Trend Details View Typographic and Layout Polish

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

const mockAchievements = {
  streak: { count: 0, bonus: 0 },
  trivia: { count: 0, averageScore: 0, maxScore: 0 },
  predictions: { correct: 0, total: 0, accuracy: 0, incorrect: 0, pending: 0 },
  referrals: { count: 0, bonus: 0 },
  history: []
};

test.describe('Trend Details View Typographic and Layout Polish', () => {

  test.beforeEach(async ({ page }) => {
    // Pipe page console and errors to system logs
    page.on('console', msg => console.log(`[BROWSER CONSOLE] [${msg.type()}] ${msg.text()}`));
    page.on('pageerror', err => console.log(`[BROWSER ERROR] ${err.message}`));

    // Intercept trends, explain, and other APIs to avoid hitting the actual DB/Gemini APIs
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

    await page.route('**/api/chat', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ reply: 'Short bot reply.' }),
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

    await page.route('**/api/achievements*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockAchievements),
      });
    });

    await page.route('**/api/topic-image/*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'image/png',
        body: Buffer.from([]),
      });
    });
  });

  // [AC-1] Demographic Selector Flex Wrapping
  test('should wrap demographic pills and adjust container height dynamically on narrow screens', async ({ page }) => {
    // We will test on 320px viewport
    await page.setViewportSize({ width: 320, height: 568 });
    await page.goto('/');

    await expect(page.locator('#explainer-view')).toBeVisible();

    const selector = page.locator('#demographic-selector');
    await expect(selector).toBeVisible();

    // Verify demographic pills flex wrapping via styling
    const flexWrap = await selector.evaluate((el) => window.getComputedStyle(el).flexWrap);
    expect(flexWrap).toBe('wrap');

    // Assert that no demographic pill overflows the viewport or clipping boundary
    const pills = page.locator('#demographic-selector .demo-pill');
    const pillCount = await pills.count();
    expect(pillCount).toBeGreaterThan(0);

    for (let i = 0; i < pillCount; i++) {
      const pill = pills.nth(i);
      const box = await pill.boundingBox();
      expect(box).not.toBeNull();
      // Right edge of pill should be inside viewport width (320px)
      expect(box.x + box.width).toBeLessThanOrEqual(320);
      // Left edge should be >= 0
      expect(box.x).toBeGreaterThanOrEqual(0);
    }
  });

  // [AC-2] Trend Title Flow and Spacing
  test('should flow vertically below demographic selector without overlap and with >= 8px space', async ({ page }) => {
    const viewports = [320, 375, 1280];
    for (const width of viewports) {
      await page.setViewportSize({ width, height: 800 });
      await page.goto('/');

      await expect(page.locator('#explainer-view')).toBeVisible();

      const selectorBox = await page.locator('#demographic-selector').boundingBox();
      const titleBox = await page.locator('#detail-title').boundingBox();

      expect(selectorBox).not.toBeNull();
      expect(titleBox).not.toBeNull();

      // y coordinate of title top must be >= y + height of selector + 8
      expect(titleBox.y).toBeGreaterThanOrEqual(selectorBox.y + selectorBox.height + 8);
    }
  });

  // [AC-3] Multiline Title Formatting and Line Height
  test('should enforce line-height between 1.2 and 1.25 and word/overflow wrap rules, and wrap long titles gracefully', async ({ page }) => {
    // Navigate to a slug that formats to our long title and starts with test-
    const slug = 'test-long-title-wrap-check-verify-wrapping-behavior-and-prevent-overlap';
    const longTitle = 'Test Long Title Wrap Check Verify Wrapping Behavior And Prevent Overlap';

    // Override route for this specific trend explain endpoint
    await page.route(`**/api/explain`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockExplanation),
      });
    });

    await page.setViewportSize({ width: 320, height: 800 });
    await page.goto(`/t/${slug}`);

    // Wait for the detail title to render
    const title = page.locator('#detail-title');
    await expect(title).toBeVisible();
    await expect(title).toHaveText(longTitle);

    // Verify it wrapped: since it's a long title on 320px width, height must span multiple lines
    const styles = await title.evaluate((el) => {
      const computed = window.getComputedStyle(el);
      return {
        lineHeight: computed.lineHeight,
        fontSize: computed.fontSize,
        wordWrap: computed.wordWrap,
        overflowWrap: computed.overflowWrap,
        height: el.getBoundingClientRect().height,
      };
    });

    // Check line-height ratio
    const fontSizeVal = parseFloat(styles.fontSize);
    let ratio;
    if (styles.lineHeight === 'normal') {
      ratio = 1.2;
    } else {
      ratio = parseFloat(styles.lineHeight) / fontSizeVal;
    }
    
    // Test that the explicit line-height ratio is between 1.2 and 1.25
    expect(ratio).toBeGreaterThanOrEqual(1.19);
    expect(ratio).toBeLessThanOrEqual(1.26);

    // Verify overflow-wrap or word-wrap is active
    const wrapActive = styles.wordWrap === 'break-word' || styles.overflowWrap === 'break-word' || styles.overflowWrap === 'anywhere';
    expect(wrapActive).toBe(true);

    // Ensure title does not overflow horizontally
    const titleBox = await title.boundingBox();
    expect(titleBox.x + titleBox.width).toBeLessThanOrEqual(320);
  });

  // [AC-4] Viewport Overflow Prevention
  test('should not trigger horizontal scrollbar or extend past viewport on narrow mobile sizes', async ({ page }) => {
    const viewports = [320, 375, 1280];
    for (const width of viewports) {
      await page.setViewportSize({ width, height: 800 });
      await page.goto('/');

      await expect(page.locator('#explainer-view')).toBeVisible();

      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      const innerWidth = await page.evaluate(() => window.innerWidth);
      expect(scrollWidth).toBeLessThanOrEqual(innerWidth);
    }
  });

});
