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
        body: JSON.stringify({ genius: 10, overrated: 10 }),
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

  // [AC-1] Infographic Customization Panel UI
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

  // [AC-2] Interactive Theme Styles & Background Customization
  // [AC-3] Custom Sticker / Badge Overlay Drawing
  // [AC-4] Custom Text Overlay Render & Word Wrap
  // [AC-5] E2E Playwright Automation & Dimensions Validation
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
});
