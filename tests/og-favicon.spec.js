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
      ogImage: 'https://blog.google/static/images/gemini-hero-success.png',
      favicon: 'https://blog.google/favicon-success.png'
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

const mockTrendsWithMetadataFailure = [
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
      ogImage: 'https://blog.google/static/images/gemini-hero-failure.png',
      favicon: 'https://blog.google/favicon-failure.png'
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
      ogImage: null,
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

  // [AC-2] Flakiness-Free E2E Verification: Verify cached or mocked metadata on the server api/trends
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

  // [AC-2] Flakiness-Free E2E Verification: Verify visual thumbnails and publisher favicons in trend list items
  test('should render visual thumbnails and publisher favicons in trend list items', async ({ page }) => {
    // Intercept all image/icon requests to return a successful transparent PNG
    await page.route('**/*', async (route) => {
      const url = route.request().url().toLowerCase();
      if (url.includes('.png') || url.includes('.ico') || url.includes('favicon') || url.includes('.jpg') || url.includes('.jpeg')) {
        await route.fulfill({
          status: 200,
          contentType: 'image/x-icon',
          path: 'node_modules/pino/favicon.ico'
        });
      } else {
        await route.continue();
      }
    });

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

    const firstFavicon = firstItem.locator('.publisher-favicon, img.publisher-favicon');
    await expect(firstFavicon).toBeVisible();
    await expect(firstFavicon).toHaveAttribute('src', mockTrendsWithMetadata[0].news.favicon);

    const firstBadge = firstItem.locator('.source-badge.google-spike');
    await expect(firstBadge).toBeVisible();
    await expect(firstBadge).toHaveText('Google Search Spike');

    // [AC-3] Verify Trend 2 (missing OG image, immediate fallback to /api/topic-image/:slug)
    const secondItem = trendItems.nth(1);
    const secondThumbnail = secondItem.locator('img.trend-thumbnail');
    await expect(secondThumbnail).toBeVisible();
    await expect(secondThumbnail).toHaveAttribute('src', '/api/topic-image/fastify-framework');
    
    // Should render fallback domain-based favicon
    const secondFavicon = secondItem.locator('.publisher-favicon, img.publisher-favicon');
    await expect(secondFavicon).toBeVisible();
    const faviconSrc = await secondFavicon.getAttribute('src');
    expect(faviconSrc).toContain('google.com/s2/favicons?domain=fastify.io');
  });

  // [AC-1] Synchronous and Atomic Detail View Rendering: Verify details update synchronously and atomically without event loop yields
  // [AC-2] Flakiness-Free E2E Verification: Verify E2E stability of news footer publisher favicon and hero images
  test('should render hero image banner and publisher favicon in detail view and news footer', async ({ page }) => {
    // Intercept all image/icon requests to return a successful transparent PNG
    await page.route('**/*', async (route) => {
      const url = route.request().url().toLowerCase();
      if (url.includes('.png') || url.includes('.ico') || url.includes('favicon') || url.includes('.jpg') || url.includes('.jpeg')) {
        await route.fulfill({
          status: 200,
          contentType: 'image/x-icon',
          path: 'node_modules/pino/favicon.ico'
        });
      } else {
        await route.continue();
      }
    });

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

    // Select the second trend (no OG image, fallback to /api/topic-image/:slug)
    const secondItem = page.locator('.trend-item').nth(1);
    await secondItem.click();

    const heroImageSecond = page.locator('#detail-hero-image');
    await expect(heroImageSecond).toBeVisible();
    await expect(heroImageSecond).toHaveAttribute('src', '/api/topic-image/fastify-framework');

    // Check footer card favicon for Trend 2 (which uses fallback)
    const footerFaviconSecond = footerIconContainer.locator('img');
    await expect(footerFaviconSecond).toBeVisible();
    const secondFooterSrc = await footerFaviconSecond.getAttribute('src');
    expect(secondFooterSrc).toContain('google.com/s2/favicons?domain=fastify.io');
  });

  // [AC-2] Flakiness-Free E2E Verification: Verify fallback and error handling for list items
  test('should handle loading failures for list item thumbnails and publisher favicons', async ({ page }) => {
    // Intercept trends API to return mock metadata
    await page.route('**/api/trends', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockTrendsWithMetadataFailure),
      });
    });

    // Intercept image/favicon URLs to return 404
    await page.route(mockTrendsWithMetadataFailure[0].news.ogImage, async (route) => {
      await route.fulfill({ status: 404 });
    });
    await page.route(mockTrendsWithMetadataFailure[0].news.favicon, async (route) => {
      await route.fulfill({ status: 404 });
    });

    await page.goto('/');

    const trendItems = page.locator('.trend-item');
    await expect(trendItems).toHaveCount(2);

    const firstItem = trendItems.nth(0);
    const thumbnailImg = firstItem.locator('img.trend-thumbnail');
    const publisherFavicon = firstItem.locator('img.publisher-favicon');

    // Use Playwright retrying assertions to wait for the client-side onerror handlers to fire
    await expect(async () => {
      // thumbnail image onerror swaps src to /api/topic-image/:slug
      const imgSrc = await thumbnailImg.getAttribute('src');
      expect(imgSrc).toBe('/api/topic-image/google-gemini');

      // and the thumbnail is visible
      await expect(thumbnailImg).toBeVisible();

      // publisher favicon image is hidden/removed (display: none or removed from DOM)
      const faviconCount = await publisherFavicon.count();
      const isFaviconHidden = faviconCount === 0 || 
                              (await publisherFavicon.evaluate(el => window.getComputedStyle(el).display === 'none'));
      expect(isFaviconHidden).toBe(true);
    }).toPass();
  });

  // [AC-2] Flakiness-Free E2E Verification: Verify detail view fallback and error handling under failure conditions
  test('should handle loading failures for detail view hero image and news footer favicon', async ({ page }) => {
    // Intercept trends API to return mock metadata
    await page.route('**/api/trends', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockTrendsWithMetadataFailure),
      });
    });

    // Intercept explainer API
    await page.route('**/api/explain', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockExplanation),
      });
    });

    // Intercept image/favicon URLs to return 404
    await page.route(mockTrendsWithMetadataFailure[0].news.ogImage, async (route) => {
      await route.fulfill({ status: 404 });
    });
    await page.route(mockTrendsWithMetadataFailure[0].news.favicon, async (route) => {
      await route.fulfill({ status: 404 });
    });

    await page.goto('/');

    const firstItem = page.locator('.trend-item').nth(0);
    await firstItem.click();

    const heroImage = page.locator('#detail-hero-image');
    const footerFavicon = page.locator('#footer-favicon-img');
    const genericSvg = page.locator('.news-icon svg.lucide-newspaper');

    // Use Playwright retrying assertions to wait for the client-side onerror handlers to fire
    await expect(async () => {
      // detail hero image onerror swaps src to /api/topic-image/:slug
      const heroSrc = await heroImage.getAttribute('src');
      expect(heroSrc).toBe('/api/topic-image/google-gemini');

      // and the hero image is visible
      await expect(heroImage).toBeVisible();

      // news footer favicon image is hidden (display: none)
      const footerFaviconDisplay = await footerFavicon.evaluate(el => window.getComputedStyle(el).display);
      expect(footerFaviconDisplay).toBe('none');

      // and the newspaper SVG is visible
      await expect(genericSvg).toBeVisible();
    }).toPass();
  });

});
