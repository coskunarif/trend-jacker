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
const mockTrends10 = [
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
  },
  {
    id: 2,
    title: 'Reddit Bitcoin',
    traffic: '80K+',
    description: 'Bitcoin cryptocurrency surges in finance market.',
    source: 'reddit',
    news: {
      headline: 'Bitcoin crosses new milestone',
      snippet: 'BTC hit a new high today as finance markets react.',
      url: 'https://reddit.com/r/bitcoin',
      source: 'Reddit'
    }
  },
  {
    id: 3,
    title: 'PlayStation 6',
    traffic: '75K+',
    description: 'Leaks reveal next-gen gaming console.',
    source: 'google',
    news: {
      headline: 'PS6 rumors heat up',
      snippet: 'Next-gen gaming consoles discussed by insiders.',
      url: 'https://ign.com/ps6',
      source: 'IGN'
    }
  },
  {
    id: 4,
    title: 'Taylor Swift Concert',
    traffic: '60K+',
    description: 'Pop star concert tour dates announced.',
    source: 'google',
    news: {
      headline: 'Eras Tour adds new dates',
      snippet: 'Taylor Swift announces additional cities for next year.',
      url: 'https://billboard.com/taylor-swift',
      source: 'Billboard'
    }
  },
  {
    id: 5,
    title: 'OpenAI GPT-5',
    traffic: '50K+',
    description: 'OpenAI trains new AI models.',
    source: 'reddit',
    news: {
      headline: 'GPT-5 training underway',
      snippet: 'Next-generation tech model set for release.',
      url: 'https://openai.com/gpt-5',
      source: 'OpenAI'
    }
  },
  {
    id: 6,
    title: 'NVIDIA Stock Spike',
    traffic: '45K+',
    description: 'Chipmaker NVIDIA stock hits records in finance.',
    source: 'google',
    news: {
      headline: 'NVIDIA quarterly earnings soar',
      snippet: 'AI chip demand drives finance stock to new highs.',
      url: 'https://bloomberg.com/nvidia',
      source: 'Bloomberg'
    }
  },
  {
    id: 7,
    title: 'Elden Ring DLC',
    traffic: '40K+',
    description: 'New gameplay video shows gaming expansion.',
    source: 'reddit',
    news: {
      headline: 'Shadow of the Erdtree gameplay details',
      snippet: 'FromSoftware shows off gaming combat improvements.',
      url: 'https://gamespot.com/elden-ring',
      source: 'Gamespot'
    }
  },
  {
    id: 8,
    title: 'Super Bowl Highlights',
    traffic: '35K+',
    description: 'Football highlights trending after the big game.',
    source: 'google',
    news: {
      headline: 'Super Bowl ends in thriller',
      snippet: 'Highlights from the final quarter of the game.',
      url: 'https://nfl.com/superbowl',
      source: 'NFL'
    }
  },
  {
    id: 9,
    title: 'Apple Vision Pro 2',
    traffic: '30K+',
    description: 'Apple developing new tech headset.',
    source: 'google',
    news: {
      headline: 'Vision Pro 2 leaks online',
      snippet: 'Tech updates on Apple spatial headset timeline.',
      url: 'https://macrumors.com/vision-pro-2',
      source: 'MacRumors'
    }
  },
  {
    id: 10,
    title: 'Inflation Rates Drop',
    traffic: '25K+',
    description: 'Economic reports show finance shift.',
    source: 'reddit',
    news: {
      headline: 'Inflation cooling down',
      snippet: 'Laters reports show general finance relief.',
      url: 'https://reuters.com/inflation',
      source: 'Reuters'
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

  // ==========================================
  // [AC-2] Mobile Trends List Search and Category Filtering
  // ==========================================
  test('should support real-time search box and platform filter tabs', async ({ page }) => {
    // Override default route to return mockTrends10 (10 items)
    await page.route('**/api/trends', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockTrends10),
      });
    });

    await page.goto('/');
    
    // Wait for the trends list to render and skeleton loaders to disappear
    const trendsList = page.locator('#trends-list');
    await expect(trendsList).toBeVisible();
    
    const trendItems = trendsList.locator('.trend-item');
    await expect(trendItems.first()).toBeVisible();

    // Verify search input is present
    const searchInput = page.locator('#trends-search');
    await expect(searchInput).toBeVisible();

    // Verify platform filter tabs are present
    const filterTabs = page.locator('.trends-filter-tabs');
    await expect(filterTabs).toBeVisible();

    const tabAll = filterTabs.locator('.filter-tab', { hasText: 'All' }).first();
    const tabGoogle = filterTabs.locator('.filter-tab', { hasText: 'Google' }).first();
    const tabReddit = filterTabs.locator('.filter-tab', { hasText: 'Reddit' }).first();

    await expect(tabAll).toBeVisible();
    await expect(tabGoogle).toBeVisible();
    await expect(tabReddit).toBeVisible();

    // Test Search input: type "gemini" (case-insensitive check)
    await searchInput.fill('gemini');
    await expect(trendItems).toHaveCount(1);
    await expect(trendItems.first()).toContainText('Google Gemini');

    // Test Search input: type "stock" (case-insensitive check)
    await searchInput.fill('STOCK');
    await expect(trendItems).toHaveCount(1);
    await expect(trendItems.first()).toContainText('NVIDIA Stock Spike');

    // Clear search
    await searchInput.fill('');
    // On desktop, should show all 10 items
    await expect(trendItems).toHaveCount(10);

    // Test Platform Filter Tabs: Click "Google"
    await tabGoogle.click();
    const visibleCountGoogle = await trendItems.count();
    expect(visibleCountGoogle).toBe(6);
    for (let i = 0; i < visibleCountGoogle; i++) {
      const text = await trendItems.nth(i).innerText();
      expect(text).not.toContain('Bitcoin');
      expect(text).not.toContain('GPT-5');
      expect(text).not.toContain('Elden Ring');
      expect(text).not.toContain('Inflation');
    }

    // Click "Reddit"
    await tabReddit.click();
    const visibleCountReddit = await trendItems.count();
    expect(visibleCountReddit).toBe(4);
    for (let i = 0; i < visibleCountReddit; i++) {
      const text = await trendItems.nth(i).innerText();
      expect(text).not.toContain('Gemini');
      expect(text).not.toContain('PlayStation');
      expect(text).not.toContain('Taylor Swift');
      expect(text).not.toContain('NVIDIA');
      expect(text).not.toContain('Super Bowl');
      expect(text).not.toContain('Apple Vision');
    }

    // Click "All"
    await tabAll.click();
    await expect(trendItems).toHaveCount(10);
  });

  // ==========================================
  // [AC-3] Mobile Trends List Truncation and "Show More" Pagination
  // ==========================================
  test('should truncate trends list to 6 on mobile viewports and toggle expand/collapse', async ({ page }) => {
    // Override default route to return mockTrends10 (10 items)
    await page.route('**/api/trends', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockTrends10),
      });
    });

    // Set mobile viewport size (e.g. 390x844)
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');

    const trendsList = page.locator('#trends-list');
    await expect(trendsList).toBeVisible();

    const trendItems = trendsList.locator('.trend-item');
    await expect(trendItems.first()).toBeVisible();

    // Confirm that exactly 6 trend items are visible in the trends list
    const visibleCount = await trendItems.evaluateAll((elements) => {
      return elements.filter(el => window.getComputedStyle(el).display !== 'none').length;
    });
    expect(visibleCount).toBe(6);

    // Confirm the "+ Show More Trends" button is visible
    const showMoreBtn = page.locator('#btn-show-more-trends');
    await expect(showMoreBtn).toBeVisible();
    await expect(showMoreBtn).toContainText('+ Show More Trends');

    // Click "+ Show More Trends"
    await showMoreBtn.click();

    // Verify the list expands to show all 10 trends
    const expandedCount = await trendItems.evaluateAll((elements) => {
      return elements.filter(el => window.getComputedStyle(el).display !== 'none').length;
    });
    expect(expandedCount).toBe(10);

    // Verify the button changes text to "- Show Less Trends"
    await expect(showMoreBtn).toContainText('- Show Less Trends');

    // Click again
    await showMoreBtn.click();

    // Verify the list collapses back to 6
    const collapsedCount = await trendItems.evaluateAll((elements) => {
      return elements.filter(el => window.getComputedStyle(el).display !== 'none').length;
    });
    expect(collapsedCount).toBe(6);
    await expect(showMoreBtn).toContainText('+ Show More Trends');
  });

  // ==========================================
  // [AC-4] Dynamic Emojis & Fluid Mobile Typography
  // ==========================================
  test('should display dynamic category emojis and scale titles fluidly with clamp', async ({ page }) => {
    // Override default route to return mockTrends10 (10 items)
    await page.route('**/api/trends', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockTrends10),
      });
    });

    await page.goto('/');

    const trendsList = page.locator('#trends-list');
    await expect(trendsList).toBeVisible();
    const trendItems = trendsList.locator('.trend-item');
    await expect(trendItems.first()).toBeVisible();

    // Verify each trend card has a category emoji
    const count = await trendItems.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i++) {
      const card = trendItems.nth(i);
      const titleText = await card.locator('.trend-item-title').innerText();
      const badge = card.locator('.trend-category-emoji');
      await expect(badge).toBeVisible();
      const emoji = await badge.innerText();

      if (titleText.toLowerCase().includes('gemini') || titleText.toLowerCase().includes('gpt-5') || titleText.toLowerCase().includes('vision pro')) {
        // Tech/AI -> 🤖
        expect(emoji).toBe('🤖');
      } else if (titleText.toLowerCase().includes('bitcoin') || titleText.toLowerCase().includes('stock') || titleText.toLowerCase().includes('inflation')) {
        // Business/Finance -> 📈
        expect(emoji).toBe('📈');
      } else if (titleText.toLowerCase().includes('playstation') || titleText.toLowerCase().includes('elden ring')) {
        // Gaming -> 🎮
        expect(emoji).toBe('🎮');
      } else {
        // Other -> 🔥
        expect(emoji).toBe('🔥');
      }
    }

    // Load trend detail page to verify .trend-title uses fluid typography
    // Let's click the first trend item
    await trendItems.first().click();
    const title = page.locator('.trend-title');
    await expect(title).toBeVisible();

    // Resize viewport from 1280px to 375px
    // 1. Large viewport (1280px)
    await page.setViewportSize({ width: 1280, height: 800 });
    const sizeLarge = await title.evaluate((el) => {
      return parseFloat(window.getComputedStyle(el).fontSize);
    });

    // 2. Small viewport (375px)
    await page.setViewportSize({ width: 375, height: 667 });
    const sizeSmall = await title.evaluate((el) => {
      return parseFloat(window.getComputedStyle(el).fontSize);
    });

    // Verify that the font size at 375px is smaller than at 1280px, showing fluid scaling
    expect(sizeSmall).toBeLessThan(sizeLarge);

    // Verify that clamp() is used in the CSS rule for .trend-title
    const hasClamp = await page.evaluate(() => {
      for (const sheet of document.styleSheets) {
        try {
          for (const rule of sheet.cssRules) {
            if (rule.selectorText && rule.selectorText.includes('.trend-title')) {
              const fs = rule.style.fontSize;
              if (fs && fs.includes('clamp')) {
                return true;
              }
            }
          }
        } catch (e) {}
      }
      return false;
    });
    expect(hasClamp).toBe(true);
  });

});

