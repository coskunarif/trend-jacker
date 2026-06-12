import { test, expect } from '@playwright/test';

test.describe('TJ-26: Unified Social Sharing Preview Interface Tests', () => {
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

  test.beforeEach(async ({ page }) => {
    // Intercept standard APIs
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
        body: JSON.stringify({
          hook: 'Gemini hook text',
          whatIsIt: 'What is Gemini',
          whyIsItViral: ['reason1'],
          takeaway: 'Takeaway',
          polls: { overrated: 5, genius: 15 }
        }),
      });
    });

    // Intercept POST /api/generate-post to return mock responses for platforms
    await page.route('**/api/generate-post', async (route) => {
      const payload = route.request().postDataJSON();
      let text = `Default mock post for ${payload.platform}`;
      if (payload.platform === 'pinterest') {
        text = `Title: Pinterest Title\nDescription: Pinterest Description content.`;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ postText: text }),
      });
    });
  });

  // [AC-1] Visual Preview Mockup Box
  test('1. Verify preview mockup visibility and default components', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');

    // Open share modal
    await page.locator('#btn-share-trend').click();
    await expect(page.locator('#share-modal')).toBeVisible();

    // Verify preview card container exists and is visible
    const previewCard = page.locator('#share-card-preview');
    await expect(previewCard).toBeVisible();

    // Verify standard components are present
    // User avatar placeholder
    await expect(previewCard.locator('.preview-avatar, [data-testid="preview-avatar"]')).toBeVisible();
    // Profile name
    await expect(previewCard.locator('.preview-profile-name, [data-testid="preview-profile-name"]')).toBeVisible();
    // Dynamically updated text container
    await expect(previewCard.locator('.preview-post-text, [data-testid="preview-post-text"]')).toBeVisible();
    // Link preview card (containing trend title and viraljacker.com domain)
    const linkCard = previewCard.locator('.preview-link-card, [data-testid="preview-link-card"]');
    await expect(linkCard).toBeVisible();
    await expect(linkCard).toContainText('Google Gemini');
    await expect(linkCard).toContainText('viraljacker.com');
  });

  // [AC-1] Visual Preview Mockup Box
  test('2. Verify real-time post text synchronization', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');

    await page.locator('#btn-share-trend').click();
    await expect(page.locator('#share-modal')).toBeVisible();

    const textInput = page.locator('#share-preview-text');
    const previewText = page.locator('.preview-post-text, [data-testid="preview-post-text"]');

    // Clear and fill the input
    await textInput.fill('This is a manual edit of the viral post sharing content!');
    
    // Assert the mockup updates dynamically
    await expect(previewText).toHaveText('This is a manual edit of the viral post sharing content!');
  });

  // [AC-1] Visual Preview Mockup Box
  test('3. Verify Pinterest layout details', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');

    await page.locator('#btn-share-trend').click();
    await expect(page.locator('#share-modal')).toBeVisible();

    // Select Pinterest platform
    await page.locator('.platform-pill[data-platform="pinterest"]').click();

    const previewCard = page.locator('#share-card-preview');
    
    // Pinterest vertical pin layout assertions
    // Pin image preview
    await expect(previewCard.locator('.preview-pin-image, [data-testid="preview-pin-image"]')).toBeVisible();
    // Pin title
    await expect(previewCard.locator('.preview-pin-title, [data-testid="preview-pin-title"]')).toBeVisible();
    // Pin description
    await expect(previewCard.locator('.preview-pin-desc, [data-testid="preview-pin-desc"]')).toBeVisible();
  });

  // [AC-2] Platform-Specific Themes & Layout Styles
  test('4. Verify platform theme class updating', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');

    await page.locator('#btn-share-trend').click();
    await expect(page.locator('#share-modal')).toBeVisible();

    const previewCard = page.locator('#share-card-preview');

    const platforms = ['x', 'linkedin', 'facebook', 'reddit', 'pinterest'];

    for (const platform of platforms) {
      await page.locator(`.platform-pill[data-platform="${platform}"]`).click();
      
      // Verify visual style/class changes
      await expect(previewCard).toHaveClass(new RegExp(`preview-${platform}`));
    }
  });

  // [AC-3] Real-time Character Counter & Limit Validation
  test('5. Verify character counter updates and tracks text length', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');

    await page.locator('#btn-share-trend').click();
    await expect(page.locator('#share-modal')).toBeVisible();

    // Select LinkedIn platform (non-strict character counting)
    await page.locator('.platform-pill[data-platform="linkedin"]').click();

    const textInput = page.locator('#share-preview-text');
    const charCounter = page.locator('#share-char-counter');

    await textInput.fill('Hello LinkedIn');
    // For non-X platforms, it tracks length, e.g. "14" or "LinkedIn: 14"
    await expect(charCounter).toContainText('14');
  });

  // [AC-3] Real-time Character Counter & Limit Validation
  test('6. Verify X (Twitter) character limit validation', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');

    await page.locator('#btn-share-trend').click();
    await expect(page.locator('#share-modal')).toBeVisible();

    // Select X platform
    await page.locator('.platform-pill[data-platform="x"]').click();

    const textInput = page.locator('#share-preview-text');
    const charCounter = page.locator('#share-char-counter');
    const postBtn = page.locator('#btn-post-share');

    // Fill under limit
    await textInput.fill('Short text');
    await expect(charCounter).toContainText('10 / 280');
    await expect(charCounter).not.toHaveClass(/warning|error/);
    await expect(postBtn).not.toBeDisabled();

    // Fill exactly at 280
    const exactLimitText = 'a'.repeat(280);
    await textInput.fill(exactLimitText);
    await expect(charCounter).toContainText('280 / 280');
    await expect(charCounter).not.toHaveClass(/warning|error/);
    await expect(postBtn).not.toBeDisabled();

    // Fill exceeding 280
    const exceedingText = 'a'.repeat(281);
    await textInput.fill(exceedingText);
    await expect(charCounter).toContainText('281 / 280');
    
    // Check validation styling / warning class on counter
    await expect(charCounter).toHaveClass(/warning|error|limit-exceeded/);
    
    // Check validation warning message visibility
    const validationWarning = page.locator('.share-validation-warning, [data-testid="share-validation-warning"]');
    await expect(validationWarning).toBeVisible();

    // Check button disabled or has error class/state
    const isBtnDisabled = await postBtn.isDisabled();
    const hasErrorClass = await postBtn.evaluate((el) => el.classList.contains('error') || el.classList.contains('disabled'));
    expect(isBtnDisabled || hasErrorClass).toBe(true);
  });
});
