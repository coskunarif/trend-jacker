import { test, expect } from '@playwright/test';

test.describe('Dynamic SEO/GEO Optimization Tests', () => {

  /**
   * [AC-1] - Dynamic robots.txt
   * The /robots.txt endpoint must return standard crawl instructions in plaintext format.
   * Sending a GET request to /robots.txt returns HTTP 200 with header Content-Type: text/plain
   * and contains:
   * User-agent: *
   * Allow: /
   * Sitemap: https://viraljacker.com/sitemap.xml
   */
  test('AC-1: GET /robots.txt serves correct plaintext format and instructions', async ({ request }) => {
    const response = await request.get('/robots.txt');
    expect(response.status()).toBe(200);
    const contentType = response.headers()['content-type'] || '';
    expect(contentType.toLowerCase()).toContain('text/plain');
    
    const text = await response.text();
    expect(text).toContain('User-agent: *');
    expect(text).toContain('Allow: /');
    expect(text).toContain('Sitemap: https://viraljacker.com/sitemap.xml');
  });

  /**
   * [AC-2] - Dynamic llms.txt
   * The /llms.txt endpoint must return an LLM-friendly Markdown site map of all trending topics.
   * Sending a GET request to /llms.txt returns HTTP 200 with Content-Type: text/plain
   * and renders the following Markdown structure dynamically using latestTrends:
   * - A main # TrendJacker title.
   * - A blockquote brief description of the site.
   * - A list of links under ## Trends pointing to dynamic Markdown representations /t/:slug.md with descriptions.
   */
  test('AC-2: GET /llms.txt serves dynamic LLM sitemap in markdown format', async ({ request }) => {
    const response = await request.get('/llms.txt');
    expect(response.status()).toBe(200);
    const contentType = response.headers()['content-type'] || '';
    expect(contentType.toLowerCase()).toContain('text/plain');

    const text = await response.text();
    expect(text).toContain('# TrendJacker');
    expect(text).toMatch(/^> /m); // Contains blockquote
    expect(text).toContain('## Trends');
    // It should dynamically render links to at least one trend matching /t/:slug.md
    expect(text).toContain('/t/');
    expect(text).toContain('.md');
  });

  /**
   * [AC-3] - Dynamic llms-full.txt
   * The /llms-full.txt endpoint compiles the full content of all trending topics into a single document for single-request ingestion.
   * Sending a GET request to /llms-full.txt returns HTTP 200 with Content-Type: text/plain.
   * The response contains all trend headers, snippets, explanations, and takeaways dynamically rendered in Markdown.
   */
  test('AC-3: GET /llms-full.txt compiles full content of all trending topics', async ({ request }) => {
    const response = await request.get('/llms-full.txt');
    expect(response.status()).toBe(200);
    const contentType = response.headers()['content-type'] || '';
    expect(contentType.toLowerCase()).toContain('text/plain');

    const text = await response.text();
    expect(text).toContain('# TrendJacker - Full Content');
    // Should contain trend title headers, snippets, explanations, takeaways
    expect(text).toContain('## '); // Trend header
    expect(text).toContain('Takeaway:');
  });

  /**
   * [AC-4] - Individual Markdown Trend Explainer /t/:slug.md
   * The /t/:slug.md endpoint serves the raw Markdown explainer page for a single trend matching the given slug.
   * Sending a GET request to /t/:slug.md returns HTTP 200 with Content-Type: text/plain
   * and provides details including the trend title, hook, detailed explanation, why it is viral, and dynamic polling statistics in Markdown.
   */
  test('AC-4: GET /t/:slug.md serves the raw markdown explainer page for a single trend', async ({ request }) => {
    // Standard test trend is Google Gemini (slug: google-gemini)
    const response = await request.get('/t/google-gemini.md');
    expect(response.status()).toBe(200);
    const contentType = response.headers()['content-type'] || '';
    expect(contentType.toLowerCase()).toContain('text/plain');

    const text = await response.text();
    expect(text).toContain('# Google Gemini');
    expect(text).toContain('Hook:');
    expect(text).toContain('Why it is viral:');
    expect(text).toContain('Takeaway:');
    expect(text).toContain('Poll Statistics:');
  });

  /**
   * [AC-5] - Auto-Discovery Meta Link Tag
   * The homepage (/) and trend pages (/t/:slug) must inject a <link> alternate tag pointing to /llms.txt so AI agents can discover the endpoint.
   * Fetching / or /t/:slug and parsing the HTML head confirms the presence of <link rel="alternate" type="text/markdown" href="/llms.txt">.
   */
  test('AC-5: Alternate meta tag for discovery is injected in HTML head for / and /t/:slug', async ({ page }) => {
    // 1. Check Homepage /
    await page.goto('/');
    const headLinkHome = page.locator('head link[rel="alternate"][type="text/markdown"][href="/llms.txt"]');
    await expect(headLinkHome).toBeAttached();

    // 2. Check Trend Page /t/:slug
    await page.goto('/t/google-gemini');
    const headLinkTrend = page.locator('head link[rel="alternate"][type="text/markdown"][href="/llms.txt"]');
    await expect(headLinkTrend).toBeAttached();
  });

  /**
   * [AC-6] - E2E Integration Tests (Request validation, content types, dynamic caching checks)
   * Verify response codes, correct Content-Type (text/plain), and dynamic caching behavior for the new routes.
   */
  test('AC-6: Validation, Content-Type, and dynamic response rendering', async ({ request }) => {
    // Test invalid slug for /t/:slug.md returns 404
    const response404 = await request.get('/t/non-existent-trend-slug-999.md');
    expect(response404.status()).toBe(404);

    // Verify robots.txt caching headers if applicable, or check that content is indeed text/plain
    const robotsRes = await request.get('/robots.txt');
    expect(robotsRes.status()).toBe(200);
    expect(robotsRes.headers()['content-type']).toContain('text/plain');

    const llmsRes = await request.get('/llms.txt');
    expect(llmsRes.status()).toBe(200);
    expect(llmsRes.headers()['content-type']).toContain('text/plain');

    const llmsFullRes = await request.get('/llms-full.txt');
    expect(llmsFullRes.status()).toBe(200);
    expect(llmsFullRes.headers()['content-type']).toContain('text/plain');
  });

});
