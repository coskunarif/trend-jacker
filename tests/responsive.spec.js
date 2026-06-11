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

  test('should render the .visual-cards-grid responsively', async ({ page }) => {
    // [AC-1] Stabilize Responsive Grid E2E Layout Checks
    await page.goto('/');
    await expect(page.locator('#explainer-view')).toBeVisible();

    const grid = page.locator('.visual-cards-grid');
    await expect(grid).toBeVisible();

    const card1 = page.locator('#card-viral-vibe');
    const card2 = page.locator('#card-live-sentiment');
    const card3 = page.locator('#card-snapshot-share');

    // 1. Desktop Viewport
    await page.setViewportSize({ width: 1200, height: 800 });

    await expect(async () => {
      const box1_desk = await card1.boundingBox();
      const box2_desk = await card2.boundingBox();
      const box3_desk = await card3.boundingBox();

      expect(box1_desk).not.toBeNull();
      expect(box2_desk).not.toBeNull();
      expect(box3_desk).not.toBeNull();

      // On desktop, they should be side-by-side (X coords increasing, Y coords similar)
      expect(box1_desk.x).toBeLessThan(box2_desk.x);
      expect(box2_desk.x).toBeLessThan(box3_desk.x);
      expect(Math.abs(box1_desk.y - box2_desk.y)).toBeLessThan(20);
    }).toPass({
      timeout: 5000,
      intervals: [100, 250, 500]
    });

    // 2. Mobile Viewport
    await page.setViewportSize({ width: 375, height: 667 });

    await expect(async () => {
      const box1_mob = await card1.boundingBox();
      const box2_mob = await card2.boundingBox();
      const box3_mob = await card3.boundingBox();

      expect(box1_mob).not.toBeNull();
      expect(box2_mob).not.toBeNull();
      expect(box3_mob).not.toBeNull();

      // On mobile, they should stack vertically (Y coords increasing, X coords aligned/similar)
      expect(box1_mob.y).toBeLessThan(box2_mob.y);
      expect(box2_mob.y).toBeLessThan(box3_mob.y);
      expect(Math.abs(box1_mob.x - box2_mob.x)).toBeLessThan(20);
    }).toPass({
      timeout: 5000,
      intervals: [100, 250, 500]
    });
  });

});
