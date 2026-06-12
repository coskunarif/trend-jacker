import { test, expect } from '@playwright/test';
import fs from 'fs';

test.describe('Infographic Overlay Customization E2E Tests', () => {
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
    // Intercept standard APIs to avoid real network requests
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

    await page.route('**/api/poll', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ genius: 15, overrated: 5 }),
      });
    });

    // Delete Web Share API to trigger physical downloads rather than web share interface
    await page.addInitScript(() => {
      try {
        delete navigator.share;
        delete navigator.canShare;
      } catch (e) {
        Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
        Object.defineProperty(navigator, 'canShare', { value: undefined, configurable: true });
      }
    });
  });

  // Supporting UI Check
  test('Verify that customization controls exist and have default values', async ({ page }) => {
    await page.goto('/');

    // Vote to reveal the share/download section if needed
    const voteBtn = page.locator('#btn-vote-genius');
    await expect(voteBtn).toBeVisible();
    await voteBtn.click();

    // The customization panel should be within the snapshot share card
    const snapshotCard = page.locator('#card-snapshot-share');
    await expect(snapshotCard).toBeVisible();

    const themeSelect = page.locator('#info-theme-select');
    await expect(themeSelect).toBeVisible();
    await expect(themeSelect).toHaveValue('midnight'); // Default value

    const badgeSelect = page.locator('#info-overlay-badge-select');
    await expect(badgeSelect).toBeVisible();
    await expect(badgeSelect).toHaveValue('none'); // Default value

    const customTextInput = page.locator('#info-custom-text-input');
    await expect(customTextInput).toBeVisible();
    await expect(customTextInput).toHaveValue(''); // Default empty
    await expect(customTextInput).toHaveAttribute('maxlength', '60');
  });

  // Supporting Dimension and Download Check
  test('Verify theme selection, badge selection, custom text inputs, and exact dimension download', async ({ page }) => {
    await page.goto('/');

    // Vote to show the infographic share card
    await page.locator('#btn-vote-genius').click();
    await expect(page.locator('#card-snapshot-share')).toBeVisible();

    // Select Cyberpunk theme
    const themeSelect = page.locator('#info-theme-select');
    await themeSelect.selectOption('cyberpunk');

    // Select HOT TAKE badge
    const badgeSelect = page.locator('#info-overlay-badge-select');
    await badgeSelect.selectOption('hot-take');

    // Type a long custom text to trigger rendering and word wrap
    const customTextInput = page.locator('#info-custom-text-input');
    await customTextInput.fill('This is a custom infographic subtitle designed to test word wrap');

    // Download the infographic card
    const downloadPromise = page.waitForEvent('download');
    await page.locator('#btn-download-infographic').click();
    const download = await downloadPromise;

    // Validate the file headers for exact high-DPI 2400x1260 dimensions
    const path = await download.path();
    const buffer = fs.readFileSync(path);
    
    // PNG dimensions are stored at offset 16 (width) and 20 (height) in big-endian 32-bit unsigned integers
    const width = buffer.readUInt32BE(16);
    const height = buffer.readUInt32BE(20);

    expect(width).toBe(2400);
    expect(height).toBe(1260);
  });

  // [AC-2] Enhanced wrapText Helper
  test('Verify that wrapText helper supports dryRun and returns final y-coordinate', async ({ page }) => {
    await page.goto('/');

    // Ensure app.js is loaded and wrapText is exposed on window
    const wrapTextExists = await page.evaluate(() => typeof window.wrapText === 'function');
    expect(wrapTextExists).toBe(true);

    const result = await page.evaluate(() => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      ctx.font = "16px sans-serif";
      
      let fillTextCalled = false;
      const originalFillText = ctx.fillText;
      ctx.fillText = function(...args) {
        fillTextCalled = true;
        originalFillText.apply(this, args);
      };

      // Test dryRun: true
      const y1 = window.wrapText(ctx, "This is a very long text to test wrapText with dryRun set to true", 10, 100, 100, 20, true);
      const calledDuringDryRun = fillTextCalled;

      // Test dryRun: false
      fillTextCalled = false;
      const y2 = window.wrapText(ctx, "This is a very long text to test wrapText with dryRun set to false", 10, 100, 100, 20, false);
      const calledDuringNormalRun = fillTextCalled;

      // Test dryRun: undefined/default (should draw)
      fillTextCalled = false;
      const y3 = window.wrapText(ctx, "This is a very long text to test wrapText with default dryRun", 10, 100, 100, 20);
      const calledDuringDefaultRun = fillTextCalled;

      return {
        y1,
        calledDuringDryRun,
        y2,
        calledDuringNormalRun,
        y3,
        calledDuringDefaultRun
      };
    });

    expect(result.calledDuringDryRun).toBe(false);
    expect(result.calledDuringNormalRun).toBe(true);
    expect(result.calledDuringDefaultRun).toBe(true);
    expect(result.y1).toBeGreaterThan(100);
    expect(result.y2).toBe(result.y1);
    expect(result.y3).toBe(result.y1);
  });

  // [AC-1] [AC-3] [AC-6] [AC-7] Scenario 1: Infographic card layout with NO custom subtitle
  test('Verify infographic layout parameters with no custom subtitle text', async ({ page }) => {
    await page.goto('/');

    // Vote to show the infographic share card
    await page.locator('#btn-vote-genius').click();
    await expect(page.locator('#card-snapshot-share')).toBeVisible();

    // Clear any text just in case
    await page.locator('#info-custom-text-input').fill('');

    // Click download infographic card button to trigger drawing and layout calculations
    const downloadPromise = page.waitForEvent('download');
    await page.locator('#btn-download-infographic').click();
    await downloadPromise; // wait for download to finish

    // Verify global layout telemetry
    const telemetry = await page.evaluate(() => window.__canvasLayouts?.infographic);
    expect(telemetry).toBeDefined();
    expect(telemetry.hookHeaderY).toBe(275);
    expect(telemetry.hookBoxY).toBe(290);
    expect(telemetry.hookFontSize).toBe(18);

    // Box height calculation: (lastHookTextY - hookTextStartY) + 80, min 120
    const expectedBoxHeight = Math.max(120, (telemetry.lastHookTextY - 330) + 80);
    expect(telemetry.hookBoxHeight).toBe(expectedBoxHeight);
    
    // Bounds check
    expect(telemetry.hookBoxY + telemetry.hookBoxHeight).toBeLessThanOrEqual(540);
  });

  // [AC-1] [AC-3] [AC-6] [AC-7] Scenario 2: Infographic card layout with normal 1-line subtitle
  test('Verify infographic layout parameters with normal custom subtitle text', async ({ page }) => {
    await page.goto('/');

    // Vote to show the infographic share card
    await page.locator('#btn-vote-genius').click();
    await expect(page.locator('#card-snapshot-share')).toBeVisible();

    // Fill normal 1-line subtitle
    await page.locator('#info-custom-text-input').fill('A short normal subtitle');

    // Click download infographic card button
    const downloadPromise = page.waitForEvent('download');
    await page.locator('#btn-download-infographic').click();
    await downloadPromise;

    // Verify global layout telemetry
    const telemetry = await page.evaluate(() => window.__canvasLayouts?.infographic);
    expect(telemetry).toBeDefined();
    expect(telemetry.subtitleLines).toBe(1);
    
    // The "THE AI HOOK" header must be calculated dynamically based on the bottom coordinate of wrapped subtitle plus 65px
    // Since subtitle starts at 255 and has 1 line, bottom coordinate of subtitle is 255. 255 + 65 = 320.
    expect(telemetry.hookHeaderY).toBe(320); 
    
    // hookBoxY starts 15px below hookHeaderY
    expect(telemetry.hookBoxY).toBe(335);

    // Box height calculation: (lastHookTextY - hookTextStartY) + 80, min 120
    const hookTextStartY = telemetry.hookHeaderY + 55;
    const expectedBoxHeight = Math.max(120, (telemetry.lastHookTextY - hookTextStartY) + 80);
    expect(telemetry.hookBoxHeight).toBe(expectedBoxHeight);

    // Bounds check
    expect(telemetry.hookBoxY + telemetry.hookBoxHeight).toBeLessThanOrEqual(540);
  });

  // [AC-1] [AC-3] [AC-4] [AC-6] [AC-7] Scenario 3: Infographic card layout with long subtitle and long hook text
  test('Verify infographic bounds reduction loop with long custom subtitle and long hook text', async ({ page }) => {
    // Override the explain endpoint before page load for this test specifically to return a very long hook text
    const longHook = "This is an extremely long AI hook designed to stress test the layout bounds logic of the sharing card. It contains multiple lines of text that will easily exceed the default height and push the community sentiment labels and footer out of bounds if not properly scaled and constrained by the dynamic font size and line height reduction loop. We want to see it shrink down to 12px and still fit within the maximum allowed y coordinate of 540.";
    
    await page.route('**/api/explain', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ...mockExplanation,
          hook: longHook
        }),
      });
    });

    await page.goto('/');

    // Vote to show the infographic share card
    await page.locator('#btn-vote-genius').click();
    await expect(page.locator('#card-snapshot-share')).toBeVisible();

    // Fill extremely long multi-line custom subtitle
    const longSubtitle = "This is a custom infographic subtitle designed to test word wrap, but with even more words to make it span multiple lines, push the layout down, and verify that the layout bounds loop works under high stress! Yes, this is very long.";
    await page.locator('#info-custom-text-input').fill(longSubtitle);

    // Click download infographic card button
    const downloadPromise = page.waitForEvent('download');
    await page.locator('#btn-download-infographic').click();
    await downloadPromise;

    // Verify global layout telemetry
    const telemetry = await page.evaluate(() => window.__canvasLayouts?.infographic);
    expect(telemetry).toBeDefined();
    
    // Subtitle must wrap and occupy multiple lines
    expect(telemetry.subtitleLines).toBeGreaterThan(1);
    
    // Header must shift down accordingly
    expect(telemetry.hookHeaderY).toBeGreaterThan(320); 

    // The bottom of the Hook box must not exceed y=540
    const hookBoxBottom = telemetry.hookBoxY + telemetry.hookBoxHeight;
    expect(hookBoxBottom).toBeLessThanOrEqual(540);

    // The font size should have scaled down to fit (less than 18px)
    expect(telemetry.hookFontSize).toBeLessThan(18);
    expect(telemetry.hookFontSize).toBeGreaterThanOrEqual(12);

    // If it still exceeded even at 12px, box height is capped at 540 - hookBoxY
    if (telemetry.hookFontSize === 12) {
      expect(hookBoxBottom).toBe(540);
    }
  });

  // [AC-5] [AC-6] Dynamic Positioning & Sizing on Standard Share Card
  test('Verify dynamic sizing, shifting and font scaling on standard share card', async ({ page }) => {
    // Intercept to return a long hook text
    const longHook = "This is a very long hook text for the standard share card designed to push the subsequent sections down and force the font scaling logic to activate if the layout bottom exceeds y=540. It needs to test the dynamic sizing of the hook background box and the shifting of the community sentiment header and poll bar.";
    
    await page.route('**/api/explain', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ...mockExplanation,
          hook: longHook
        }),
      });
    });

    await page.goto('/');

    // Vote to show the share card
    await page.locator('#btn-vote-genius').click();
    await expect(page.locator('#btn-download-card')).toBeVisible();

    // Click download standard card button
    const downloadPromise = page.waitForEvent('download');
    await page.locator('#btn-download-card').click();
    await downloadPromise;

    // Verify global layout telemetry for standard card
    const telemetry = await page.evaluate(() => window.__canvasLayouts?.trendCard);
    expect(telemetry).toBeDefined();

    // Assert that the hook box is sized dynamically
    // Hook background box on standard card starts at y=240
    expect(telemetry.hookBoxY).toBe(240);
    expect(telemetry.hookHeaderY).toBe(225);

    // Check hookBoxHeight matches the hook text height + padding
    const hookTextStartY = 275;
    const expectedBoxHeight = Math.max(120, (telemetry.lastHookTextY - hookTextStartY) + 80);
    expect(telemetry.hookBoxHeight).toBe(expectedBoxHeight);

    // Ensure font size scaled down if bottom coordinate (poll section/labels/footer bounds) exceeded 540
    if (telemetry.hookFontSize < 20) {
      expect(telemetry.hookFontSize).toBeGreaterThanOrEqual(12);
    }
  });
});
