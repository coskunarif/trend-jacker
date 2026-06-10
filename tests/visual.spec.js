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

test.describe('Visual Verification & Accessibility Audit', () => {

  test('Desktop viewport: Download fallback buttons (No Web Share)', async ({ page }) => {
    // Intercept API routes
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
    await page.route('**/api/debate', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          turns: [
            { speaker: 'optimist', message: 'Optimist opening' },
            { speaker: 'skeptic', message: 'Skeptic counter' },
            { speaker: 'optimist', message: 'Optimist rebuttal' }
          ],
          votes: { optimistWins: 10, skepticWins: 10 }
        }),
      });
    });

    // Delete Web Share to simulate desktop environment
    await page.addInitScript(() => {
      try {
        delete navigator.share;
        delete navigator.canShare;
      } catch (e) {
        Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
        Object.defineProperty(navigator, 'canShare', { value: undefined, configurable: true });
      }
    });

    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');

    // Vote to reveal Trend Card download button
    await page.locator('#btn-vote-genius').click();
    await expect(page.locator('#btn-download-card')).toBeVisible();
    await expect(page.locator('#btn-download-card')).toHaveText(/Download Card/);

    // Vote on debate to reveal debate meme card download button
    await page.locator('#btn-verdict-optimist').click();
    await expect(page.locator('#btn-download-debate-card')).toBeVisible();
    await expect(page.locator('#btn-download-debate-card')).toHaveText(/Download Debate Meme/);

    // Take screenshot of desktop view showing the fallback buttons
    await page.screenshot({
      path: '/home/ubuntuadmin/.gemini/antigravity-cli/brain/5e714099-9678-486e-bfda-8b7ac04b401e/desktop_download_view.png',
      fullPage: true
    });
  });

  test('Mobile viewport: Web Share active UI button check', async ({ page }) => {
    // Intercept API routes
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
    await page.route('**/api/debate', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          turns: [
            { speaker: 'optimist', message: 'Optimist opening' },
            { speaker: 'skeptic', message: 'Skeptic counter' },
            { speaker: 'optimist', message: 'Optimist rebuttal' }
          ],
          votes: { optimistWins: 10, skepticWins: 10 }
        }),
      });
    });

    // Mock Web Share support (with files support)
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'canShare', {
        value: () => true,
        configurable: true,
        writable: true
      });
      Object.defineProperty(navigator, 'share', {
        value: async () => Promise.resolve(),
        configurable: true,
        writable: true
      });
    });

    // Emulate iPhone viewport size
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');

    // Vote to reveal Trend Card share button
    await page.locator('#btn-vote-genius').click();
    
    const shareCardBtn = page.locator('#btn-download-card');
    await expect(shareCardBtn).toBeVisible();
    await expect(shareCardBtn).toHaveText(/Share Card/);
    await expect(shareCardBtn).toHaveAttribute('aria-label', 'Share Trend Card');

    // Vote on debate to reveal debate meme card share button
    await page.locator('#btn-verdict-optimist').click();
    
    const shareDebateCardBtn = page.locator('#btn-download-debate-card');
    await expect(shareDebateCardBtn).toBeVisible();
    await expect(shareDebateCardBtn).toHaveText(/Share Debate Meme/);
    await expect(shareDebateCardBtn).toHaveAttribute('aria-label', 'Share Debate Meme Card');

    // Take screenshot of mobile view showing the Share buttons
    await page.screenshot({
      path: '/home/ubuntuadmin/.gemini/antigravity-cli/brain/5e714099-9678-486e-bfda-8b7ac04b401e/mobile_share_view.png',
      fullPage: true
    });
  });
});
