import { test, expect } from '@playwright/test';
import xml2js from 'xml2js';
import { pingSearchEngines } from '../indexing.js';

test.describe('Search Index Consolidation and Canonicalization Tests', () => {

  /**
   * [AC-1] HTML Head Canonical Tags
   * - Homepage '/' must render '<link rel="canonical" href="https://viraljacker.com/" />'
   *   (or the configured host variant from process.env.APP_HOST) in its HTML <head>.
   */
  test('AC-1: Homepage renders canonical link tag in head', async ({ page }) => {
    const host = process.env.APP_HOST || 'viraljacker.com';
    const protocol = host.includes('localhost') || host.includes('127.0.0.1') ? 'http' : 'https';
    const expectedUrl = `${protocol}://${host}/`;
    
    await page.goto('/');
    const canonical = page.locator('head link[rel="canonical"]');
    await expect(canonical).toHaveAttribute('href', expectedUrl);
  });

  /**
   * [AC-1] HTML Head Canonical Tags
   * - The trend page '/t/:slug' must render '<link rel="canonical" href="https://viraljacker.com/t/:slug" />'
   *   (using lowercase slug) in its HTML <head>.
   */
  test('AC-1: Trend page renders canonical link tag with lowercase slug in head', async ({ page }) => {
    const host = process.env.APP_HOST || 'viraljacker.com';
    const protocol = host.includes('localhost') || host.includes('127.0.0.1') ? 'http' : 'https';
    const expectedUrl = `${protocol}://${host}/t/google-gemini`;
    
    await page.goto('/t/google-gemini');
    const canonical = page.locator('head link[rel="canonical"]');
    await expect(canonical).toHaveAttribute('href', expectedUrl);
  });

  /**
   * [AC-1] HTML Head Canonical Tags
   * - The localized trend page '/t/:slug/:lang' must render '<link rel="canonical" href="https://viraljacker.com/t/:slug/:lang" />'
   *   (using lowercase slug and lang) in its HTML <head>.
   */
  test('AC-1: Localized trend page renders canonical link tag with lowercase slug and lang in head', async ({ page }) => {
    const host = process.env.APP_HOST || 'viraljacker.com';
    const protocol = host.includes('localhost') || host.includes('127.0.0.1') ? 'http' : 'https';
    const expectedUrl = `${protocol}://${host}/t/google-gemini/es`;
    
    await page.goto('/t/google-gemini/es');
    const canonical = page.locator('head link[rel="canonical"]');
    await expect(canonical).toHaveAttribute('href', expectedUrl);
  });

  /**
   * [AC-2] HTTP Link Canonical Response Headers
   * - GET requests to '/' must return a response with a Link header containing '<canonicalUrl>; rel="canonical"'.
   * - This canonical relation must coexist alongside other link relations, such as alternate links for '/llms.txt'.
   */
  test('AC-2: GET / response Link header contains rel="canonical" and coexists with alternate relation', async ({ request }) => {
    const host = process.env.APP_HOST || 'viraljacker.com';
    const protocol = host.includes('localhost') || host.includes('127.0.0.1') ? 'http' : 'https';
    const expectedUrl = `${protocol}://${host}/`;
    
    const response = await request.get('/');
    const linkHeader = response.headers()['link'];
    expect(linkHeader).toBeDefined();
    expect(linkHeader).toContain(`<${expectedUrl}>; rel="canonical"`);
    expect(linkHeader).toContain('</llms.txt>; rel="alternate"; type="text/plain"');
  });

  /**
   * [AC-2] HTTP Link Canonical Response Headers
   * - GET requests to '/t/:slug' must return a response with a Link header containing '<canonicalUrl>; rel="canonical"'.
   * - This canonical relation must coexist alongside other link relations, such as alternate links for '/llms.txt'.
   */
  test('AC-2: GET /t/:slug response Link header contains rel="canonical" and coexists with alternate relation', async ({ request }) => {
    const host = process.env.APP_HOST || 'viraljacker.com';
    const protocol = host.includes('localhost') || host.includes('127.0.0.1') ? 'http' : 'https';
    const expectedUrl = `${protocol}://${host}/t/google-gemini`;
    
    const response = await request.get('/t/google-gemini');
    const linkHeader = response.headers()['link'];
    expect(linkHeader).toBeDefined();
    expect(linkHeader).toContain(`<${expectedUrl}>; rel="canonical"`);
    expect(linkHeader).toContain('</llms.txt>; rel="alternate"; type="text/plain"');
  });

  /**
   * [AC-2] HTTP Link Canonical Response Headers
   * - GET requests to '/t/:slug/:lang' must return a response with a Link header containing '<canonicalUrl>; rel="canonical"'.
   */
  test('AC-2: GET /t/:slug/:lang response Link header contains rel="canonical"', async ({ request }) => {
    const host = process.env.APP_HOST || 'viraljacker.com';
    const protocol = host.includes('localhost') || host.includes('127.0.0.1') ? 'http' : 'https';
    const expectedUrl = `${protocol}://${host}/t/google-gemini/es`;
    
    const response = await request.get('/t/google-gemini/es');
    const linkHeader = response.headers()['link'];
    expect(linkHeader).toBeDefined();
    expect(linkHeader).toContain(`<${expectedUrl}>; rel="canonical"`);
  });

  /**
   * [AC-3] Path Casing Normalization & 301 Redirects
   * - Accessing '/t/:slug' with mixed-case parameters (e.g. '/t/Google-Gemini') must trigger a 301 permanent redirect
   *   to the fully lowercased canonical route path.
   */
  test('AC-3: GET /t/:slug with mixed case redirect status 301 to lowercased path', async ({ request }) => {
    const response = await request.get('/t/Google-Gemini', { maxRedirects: 0 });
    expect(response.status()).toBe(301);
    expect(response.headers()['location']).toBe('/t/google-gemini');
  });

  /**
   * [AC-3] Path Casing Normalization & 301 Redirects
   * - Accessing '/t/:slug/:lang' with mixed-case parameters (e.g. '/t/google-gemini/ES' or '/t/Google-Gemini/Es')
   *   must trigger a 301 permanent redirect to the fully lowercased canonical route path.
   */
  test('AC-3: GET /t/:slug/:lang with mixed case redirects to fully lowercased path with 301 status', async ({ request }) => {
    const response1 = await request.get('/t/google-gemini/ES', { maxRedirects: 0 });
    expect(response1.status()).toBe(301);
    expect(response1.headers()['location']).toBe('/t/google-gemini/es');

    const response2 = await request.get('/t/Google-Gemini/Es', { maxRedirects: 0 });
    expect(response2.status()).toBe(301);
    expect(response2.headers()['location']).toBe('/t/google-gemini/es');
  });

  /**
   * [AC-4] /index.html Redirect
   * - Accessing '/index.html' directly must trigger a 301 permanent redirect to '/'.
   */
  test('AC-4: Direct access to /index.html redirects to / with 301 status', async ({ request }) => {
    const response = await request.get('/index.html', { maxRedirects: 0 });
    expect(response.status()).toBe(301);
    expect(response.headers()['location']).toBe('/');
  });

  /**
   * [AC-5] Sitemap /sitemap.xml Deduplication
   * - The generated '/sitemap.xml' must not contain any duplicate '<loc>' entries or duplicate localized
   *   alternate link definitions for the same trend slug.
   */
  test('AC-5: /sitemap.xml has unique loc elements and unique alternate links', async ({ request }) => {
    const response = await request.get('/sitemap.xml');
    expect(response.status()).toBe(200);
    const xmlText = await response.text();
    
    const parser = new xml2js.Parser();
    const parsed = await parser.parseStringPromise(xmlText);
    const urlset = parsed.urlset;
    expect(urlset).toBeDefined();
    
    const urls = urlset.url || [];
    const locs = urls.map(u => u.loc[0]);
    
    // Assert all locs are unique
    const uniqueLocs = new Set(locs);
    expect(locs.length).toBe(uniqueLocs.size);
    
    // Assert alternate link definitions are unique per url node
    for (const urlObj of urls) {
      const alternates = urlObj['xhtml:link'] || [];
      const altKeys = alternates.map(a => {
        const attrs = a.$ || {};
        return `${attrs.hreflang || ''}:${attrs.href || ''}`;
      });
      const uniqueAlts = new Set(altKeys);
      expect(altKeys.length).toBe(uniqueAlts.size);
    }
  });

  /**
   * [AC-6] IndexNow API Slugs and URL Deduplication
   * - The pingSearchEngines function in indexing.js must normalize incoming slugs (lowercased, trimmed)
   *   and deduplicate the list before formatting URLs for the IndexNow payload.
   */
  test('AC-6: pingSearchEngines normalizes mixed-case/whitespaced slugs and deduplicates', async () => {
    const testSlugs = ['openai-gpt', ' OpenAI-GPT ', 'fastify', 'fastify', 'OPENAI-GPT'];
    const result = await pingSearchEngines(testSlugs);
    
    expect(result).toBeDefined();
    expect(result.urls).toBeDefined();
    
    // Expected output slugs are: 'openai-gpt' and 'fastify' (2 unique normalized slugs)
    // 2 slugs * 4 language variants (en, es, fr, ja) = 8 unique URLs
    expect(result.urls.length).toBe(8);
    
    const host = process.env.APP_HOST || 'viraljacker.com';
    const protocol = host.includes('localhost') || host.includes('127.0.0.1') ? 'http' : 'https';
    
    const expected = [
      `${protocol}://${host}/t/openai-gpt`,
      `${protocol}://${host}/t/openai-gpt/es`,
      `${protocol}://${host}/t/openai-gpt/fr`,
      `${protocol}://${host}/t/openai-gpt/ja`,
      `${protocol}://${host}/t/fastify`,
      `${protocol}://${host}/t/fastify/es`,
      `${protocol}://${host}/t/fastify/fr`,
      `${protocol}://${host}/t/fastify/ja`,
    ];
    
    for (const url of expected) {
      expect(result.urls).toContain(url);
    }
    
    const uniqueUrls = new Set(result.urls);
    expect(result.urls.length).toBe(uniqueUrls.size);
  });

  /**
   * [AC-7] /llms.txt and /llms-full.txt Deduplication
   * - The /llms.txt and /llms-full.txt sitemap endpoints must display deduplicated trend lists.
   */
  test('AC-7: /llms.txt displays deduplicated trend list', async ({ request }) => {
    const response = await request.get('/llms.txt');
    expect(response.status()).toBe(200);
    const text = await response.text();
    
    // Each unique trend slug should appear exactly once in the list
    const countGemini = (text.match(/-\s+\[\/t\/google-gemini\.md\]/g) || []).length;
    expect(countGemini).toBe(1);

    const countFastify = (text.match(/-\s+\[\/t\/fastify-framework\.md\]/g) || []).length;
    expect(countFastify).toBe(1);
  });

  test('AC-7: /llms-full.txt displays deduplicated trend headings', async ({ request }) => {
    const response = await request.get('/llms-full.txt');
    expect(response.status()).toBe(200);
    const text = await response.text();
    
    // Each unique trend should appear exactly once as a header
    const countGemini = (text.match(/## Google Gemini/g) || []).length;
    expect(countGemini).toBe(1);

    const countFastify = (text.match(/## Fastify framework/g) || []).length;
    expect(countFastify).toBe(1);
  });

});
