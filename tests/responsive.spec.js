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

const mockDebate = {
  turns: [
    { speaker: 'optimist', message: 'Optimist opening argument. We believe Gemini is absolute genius because it delivers unprecedented context length and speed.' },
    { speaker: 'skeptic', message: 'Skeptic counter argument. Overrated hype. The context window is large but retrieval quality drops significantly at the center.' },
    { speaker: 'optimist', message: 'Optimist final rebuttal. In-context learning performance remains high across the entire context window.' }
  ],
  votes: { optimistWins: 10, skepticWins: 10 }
};

test.describe('TJ-21: Mobile Layout and Responsiveness Overhaul Tests', () => {

  test.beforeEach(async ({ page }) => {
    // Intercept trends, explain, and debate APIs
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

    await page.route('**/api/debate', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockDebate),
      });
    });

    await page.route('**/api/chat', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ reply: 'Short bot reply.' }),
      });
    });
  });

  const viewports = [
    { width: 375, height: 667, name: 'iPhone SE' },
    { width: 320, height: 568, name: 'iPhone 5/SE (First Gen)' }
  ];

  for (const vp of viewports) {
    test.describe(`Viewport: ${vp.name} (${vp.width}x${vp.height})`, () => {

      test.beforeEach(async ({ page }) => {
        await page.setViewportSize({ width: vp.width, height: vp.height });
      });

      test('should not have horizontal viewport overflow', async ({ page }) => {
        await page.goto('/');

        // Let the page settle and details load
        await expect(page.locator('#explainer-view')).toBeVisible();

        // Check overall page scrollWidth vs innerWidth
        const overflow = await page.evaluate(() => {
          return document.documentElement.scrollWidth > window.innerWidth;
        });
        expect(overflow).toBe(false);

        // Scan all visible elements inside .main-panel to ensure none of them extend past innerWidth
        const overflowingElements = await page.evaluate(() => {
          const els = Array.from(document.querySelectorAll('.main-panel *'));
          return els
            .filter(el => {
              const style = window.getComputedStyle(el);
              if (style.display === 'none' || style.visibility === 'hidden' || parseFloat(style.opacity) === 0) {
                return false;
              }
              const rect = el.getBoundingClientRect();
              if (rect.width === 0 || rect.height === 0) {
                return false;
              }
              // Allow small subpixel rounding margin (up to 1px)
              return rect.right > window.innerWidth + 1;
            })
            .map(el => ({
              tagName: el.tagName,
              className: el.className,
              id: el.id,
              right: el.getBoundingClientRect().right,
              innerWidth: window.innerWidth
            }));
        });

        expect(overflowingElements).toEqual([]);
      });

      test('should render debate bubbles side-by-side with uncompressed avatars', async ({ page }) => {
        await page.goto('/');
        await expect(page.locator('#explainer-view')).toBeVisible();

        // Wait for debate turns to render (turn 1 is immediate, turn 2 at 1.5s, turn 3 at 3s)
        const optimistBubbleWrap = page.locator('.debate-bubble-wrap.optimist').first();
        const skepticBubbleWrap = page.locator('.debate-bubble-wrap.skeptic').first();
        
        await expect(optimistBubbleWrap).toBeVisible({ timeout: 5000 });
        await expect(skepticBubbleWrap).toBeVisible({ timeout: 5000 });

        // Evaluate optimist turn layout
        const optAvatarBox = await optimistBubbleWrap.locator('.debate-avatar').boundingBox();
        const optBubbleBox = await optimistBubbleWrap.locator('.debate-bubble').boundingBox();

        expect(optAvatarBox).not.toBeNull();
        expect(optBubbleBox).not.toBeNull();

        // Avatar should not be squashed: exact dimensions 36x36
        expect(optAvatarBox.width).toBeCloseTo(36, 1);
        expect(optAvatarBox.height).toBeCloseTo(36, 1);

        // Optimist: side-by-side (row layout) => Avatar is on the left of bubble
        expect(optAvatarBox.x + optAvatarBox.width).toBeLessThanOrEqual(optBubbleBox.x);
        
        // Vertical positioning: they should overlap vertically (side-by-side, not stacked)
        expect(optAvatarBox.y).toBeLessThan(optBubbleBox.y + optBubbleBox.height);
        expect(optBubbleBox.y).toBeLessThan(optAvatarBox.y + optAvatarBox.height);

        // Bounding box width of the debate bubble should be healthy (>= 150px) and wrap properly, not collapse
        expect(optBubbleBox.width).toBeGreaterThanOrEqual(150);

        // Evaluate skeptic turn layout
        const skAvatarBox = await skepticBubbleWrap.locator('.debate-avatar').boundingBox();
        const skBubbleBox = await skepticBubbleWrap.locator('.debate-bubble').boundingBox();

        expect(skAvatarBox).not.toBeNull();
        expect(skBubbleBox).not.toBeNull();

        // Skeptic avatar should not be squashed: exact dimensions 36x36
        expect(skAvatarBox.width).toBeCloseTo(36, 1);
        expect(skAvatarBox.height).toBeCloseTo(36, 1);

        // Skeptic: side-by-side (row-reverse layout) => Bubble is on the left of Avatar
        expect(skBubbleBox.x + skBubbleBox.width).toBeLessThanOrEqual(skAvatarBox.x);

        // Bounding box width of the skeptic debate bubble should be healthy (>= 150px)
        expect(skBubbleBox.width).toBeGreaterThanOrEqual(150);

        // Optimist alignment: left-aligned (close to left boundary)
        const optimistWrapBox = await optimistBubbleWrap.boundingBox();
        expect(optimistWrapBox.x).toBeLessThanOrEqual(25); // Close to left edge

        // Skeptic alignment: right-aligned (close to right boundary)
        const skepticWrapBox = await skepticBubbleWrap.boundingBox();
        expect(skepticWrapBox.x + skepticWrapBox.width).toBeGreaterThanOrEqual(vp.width - 25);

        // Verify width: fit-content is declared in styles for .debate-bubble-wrap
        const hasDebateFitContent = await page.evaluate(() => {
          for (const sheet of document.styleSheets) {
            try {
              for (const rule of sheet.cssRules) {
                if (rule.selectorText === '.debate-bubble-wrap' && rule.style.width === 'fit-content') {
                  return true;
                }
              }
            } catch (e) {}
          }
          return false;
        });
        expect(hasDebateFitContent).toBe(true);
      });

      test('should enforce fit-content layout behavior on chat bubbles', async ({ page }) => {
        await page.goto('/');
        await expect(page.locator('#explainer-view')).toBeVisible();

        // Submit a very short chat query to test fit-content width
        const chatInput = page.locator('#chat-input');
        await chatInput.fill('Hi');
        await page.locator('#chat-submit-btn').click();

        const userBubble = page.locator('.chat-bubble.user').first();
        await expect(userBubble).toBeVisible();

        const userBubbleBox = await userBubble.boundingBox();
        expect(userBubbleBox).not.toBeNull();

        // Under width: fit-content, a short text "Hi" should result in a very narrow bubble (e.g. < 80px)
        expect(userBubbleBox.width).toBeLessThan(80);

        // Verify width: fit-content is declared in styles for .chat-bubble
        const hasChatFitContent = await page.evaluate(() => {
          for (const sheet of document.styleSheets) {
            try {
              for (const rule of sheet.cssRules) {
                if (rule.selectorText === '.chat-bubble' && rule.style.width === 'fit-content') {
                  return true;
                }
              }
            } catch (e) {}
          }
          return false;
        });
        expect(hasChatFitContent).toBe(true);
      });

      test('should wrap, gap, and left-align the metadata row', async ({ page }) => {
        await page.goto('/');
        await expect(page.locator('#explainer-view')).toBeVisible();

        // Target the active explainer metadata row (not the skeleton loader's)
        const metaRow = page.locator('#explainer-view .trend-meta-row');
        await expect(metaRow).toBeVisible();

        const layoutStyles = await metaRow.evaluate((el) => {
          const style = window.getComputedStyle(el);
          return {
            flexWrap: style.flexWrap,
            justifyContent: style.justifyContent,
            columnGap: style.columnGap,
            rowGap: style.rowGap,
          };
        });

        // Ensure wrapping is enabled
        expect(layoutStyles.flexWrap).toBe('wrap');
        // Ensure left-alignment
        expect(layoutStyles.justifyContent).toMatch(/flex-start|start|left/);
        // Ensure gap is --space-2 (8px)
        expect(layoutStyles.columnGap).toBe('8px');
        expect(layoutStyles.rowGap).toBe('8px');
      });

    });
  }

  test.describe('Ultra-narrow viewport: <= 360px (e.g. 320x568)', () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width: 320, height: 568 });
    });

    test('should style velocity gauge and prevent its internal elements from causing overflow', async ({ page }) => {
      await page.goto('/');
      await expect(page.locator('#explainer-view')).toBeVisible();

      const gauge = page.locator('.velocity-gauge-container');
      await expect(gauge).toBeVisible();

      // Gauge container itself should fit inside viewport width
      const gaugeBox = await gauge.boundingBox();
      expect(gaugeBox).not.toBeNull();
      expect(gaugeBox.width).toBeLessThanOrEqual(320);

      // Verify sparkline canvas does not exceed 90px on narrow screens
      const sparkline = page.locator('#trend-sparkline');
      const sparklineBox = await sparkline.boundingBox();
      expect(sparklineBox).not.toBeNull();
      expect(sparklineBox.width).toBeLessThanOrEqual(90);

      // Verify speedometer SVG has auto height and behaves fluidly
      const speedometer = page.locator('.speedometer');
      const speedoStyles = await speedometer.evaluate((el) => {
        const style = window.getComputedStyle(el);
        return {
          maxWidth: style.maxWidth,
          height: style.height
        };
      });
      expect(speedoStyles.maxWidth).toBe('100%');
    });
  });

});
