import { test, expect } from '@playwright/test';

// Mock API data matching the server's test mode defaults but enhanced with ogImage and favicon metadata
const mockTrendsWithMetadata = [
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
      source: 'Google Blog',
      ogImage: 'https://blog.google/static/images/gemini-hero.png',
      favicon: 'https://blog.google/favicon.ico'
    }
  },
  {
    id: 2,
    title: 'Fastify framework',
    traffic: '20K+',
    description: 'High performance web framework for Node.js.',
    source: 'google',
    news: {
      headline: 'Fastify v5 released',
      snippet: 'Fastify v5 introduces improved plugin loading and security features.',
      url: 'https://fastify.io/v5-release',
      source: 'Fastify Blog',
      // Testing missing ogImage (should trigger fallback/placeholder)
      ogImage: null,
      // Testing missing favicon (should trigger domain-based fallback)
      favicon: null
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

test.describe('OG Image & Publisher Favicon Integration', () => {

  // [AC-1] Server-Side Metadata Fetcher & Caching
  // [AC-2] Robust Fallbacks & Test Safety
  test('should return cached or mocked metadata on the server api/trends', async ({ request }) => {
    const response = await request.get('/api/trends');
    expect(response.status()).toBe(200);
    const trends = await response.json();
    expect(trends.length).toBeGreaterThan(0);

    // Verify metadata presence on first trend
    const firstTrend = trends[0];
    expect(firstTrend.news).toBeDefined();
    // In test environment, the server must return deterministic mock OG image URLs and mock favicon URLs
    expect(firstTrend.news.ogImage).toBeDefined();
    expect(firstTrend.news.favicon).toBeDefined();

    // Verify fallbacks logic for a trend without explicit favicon
    const secondTrend = trends.find(t => t.id === 2 || t.title === 'Fastify framework');
    if (secondTrend && secondTrend.news) {
      // If it failed/timed out/contains no icon, should fallback to a domain-based favicon provider
      if (!secondTrend.news.favicon || secondTrend.news.favicon.includes('google.com/s2/favicons')) {
        expect(secondTrend.news.favicon).toContain('google.com/s2/favicons?domain=');
      }
      // If it contains no OG image, should fallback to null or placeholder indicator
      expect(secondTrend.news.ogImage === null || secondTrend.news.ogImage === undefined || secondTrend.news.ogImage === '').toBe(true);
    }
  });

  // [AC-3] Trend List Items Visual Upgrade
  // [AC-5] Playwright E2E Verification - list items
  test('should render visual thumbnails and publisher favicons in trend list items', async ({ page }) => {
    // Intercept trends to use our specific mock metadata
    await page.route('**/api/trends', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockTrendsWithMetadata),
      });
    });

    await page.goto('/');

    const trendItems = page.locator('.trend-item');
    await expect(trendItems).toHaveCount(2);

    // Verify Trend 1 (has OG image and favicon)
    const firstItem = trendItems.nth(0);
    const firstThumbnail = firstItem.locator('.trend-thumbnail, img.trend-thumbnail, .trend-item-thumbnail');
    await expect(firstThumbnail).toBeVisible();
    await expect(firstThumbnail).toHaveAttribute('src', mockTrendsWithMetadata[0].news.ogImage);

    const firstFavicon = firstItem.locator('.publisher-favicon, img.publisher-favicon');
    await expect(firstFavicon).toBeVisible();
    await expect(firstFavicon).toHaveAttribute('src', mockTrendsWithMetadata[0].news.favicon);

    // Verify existing badge selectors/text are preserved
    const firstBadge = firstItem.locator('.source-badge.google-spike');
    await expect(firstBadge).toBeVisible();
    await expect(firstBadge).toHaveText('Google Search Spike');

    // Verify Trend 2 (missing OG image & favicon, testing fallbacks/placeholders)
    const secondItem = trendItems.nth(1);
    // Should render a clean gradient placeholder when no image is available
    const secondPlaceholder = secondItem.locator('.trend-thumbnail-placeholder, .gradient-placeholder, div.trend-thumbnail');
    await expect(secondPlaceholder).toBeVisible();
    
    // Should render fallback domain-based favicon
    const secondFavicon = secondItem.locator('.publisher-favicon, img.publisher-favicon');
    await expect(secondFavicon).toBeVisible();
    const faviconSrc = await secondFavicon.getAttribute('src');
    expect(faviconSrc).toContain('google.com/s2/favicons?domain=fastify.io');
  });

  // [AC-4] Trend Details & News Footer Enhancement
  // [AC-5] Playwright E2E Verification - detail view & footer
  test('should render hero image banner and publisher favicon in detail view and news footer', async ({ page }) => {
    await page.route('**/api/trends', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockTrendsWithMetadata),
      });
    });

    await page.route('**/api/explain', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockExplanation),
      });
    });

    await page.goto('/');

    // Select the first trend to load detail view
    const firstItem = page.locator('.trend-item').nth(0);
    await firstItem.click();

    // Verify prominent hero image banner rendering ogImage in detail view
    const heroImage = page.locator('#detail-hero-image, .detail-hero-image, img.detail-hero');
    await expect(heroImage).toBeVisible();
    await expect(heroImage).toHaveAttribute('src', mockTrendsWithMetadata[0].news.ogImage);
    // Aspect ratio styling verify if possible, or lazy loading
    await expect(heroImage).toHaveAttribute('loading', 'lazy');

    // Verify the news context footer contains the actual publisher's favicon image replacing generic newspaper SVG
    const footerCard = page.locator('.news-footer-card');
    const footerIconContainer = footerCard.locator('.news-icon');
    const footerFavicon = footerIconContainer.locator('img');
    await expect(footerFavicon).toBeVisible();
    await expect(footerFavicon).toHaveAttribute('src', mockTrendsWithMetadata[0].news.favicon);
    // The generic newspaper SVG icon must be replaced (either hidden or removed)
    const genericSvg = footerIconContainer.locator('svg.lucide-newspaper');
    await expect(genericSvg).not.toBeVisible();

    // Select the second trend (no OG image, fallback favicon)
    const secondItem = page.locator('.trend-item').nth(1);
    await secondItem.click();

    // Hero block should hide gracefully or render a CSS gradient fallback
    // Either the image is hidden or it's a gradient block
    const heroImageSecond = page.locator('#detail-hero-image, .detail-hero-image, img.detail-hero');
    const heroGradientFallback = page.locator('.detail-hero-gradient, .hero-placeholder');
    
    // We use a robust assertion that either the hero image is hidden/removed or the gradient is visible
    await expect().toPass(async () => {
      const isHeroImageVisible = await heroImageSecond.isVisible();
      const isGradientVisible = await heroGradientFallback.isVisible();
      expect(!isHeroImageVisible || isGradientVisible).toBe(true);
    });

    // Check footer card favicon for Trend 2 (which uses fallback)
    const footerFaviconSecond = footerIconContainer.locator('img');
    await expect(footerFaviconSecond).toBeVisible();
    const secondFooterSrc = await footerFaviconSecond.getAttribute('src');
    expect(secondFooterSrc).toContain('google.com/s2/favicons?domain=fastify.io');
  });

});
