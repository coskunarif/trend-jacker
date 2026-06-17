import { test, expect } from '@playwright/test';
import xml2js from 'xml2js';
import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.resolve(__dirname, '../polls.db');

test.describe('Historical Trend Content Discovery Directory', () => {
  let dbModule;
  let seededTrend = `hist-test-${Date.now()}`;
  let seededExpl = {
    hook: 'Seeded Hook',
    whatIsIt: 'Seeded What Is It',
    whyIsItViral: ['Reason One', 'Reason Two'],
    takeaway: 'Seeded Takeaway'
  };

  test.beforeAll(async () => {
    try {
      dbModule = await import('../db.js');
      if (typeof dbModule.setCachedExplanation === 'function') {
        await dbModule.setCachedExplanation(seededTrend, seededExpl);
      }
    } catch (err) {
      console.warn('Could not setup database mock entry:', err.message);
    }
  });

  test.afterAll(async () => {
    // Clean up seeded database entry
    const db = new DatabaseSync(dbPath);
    db.exec('PRAGMA busy_timeout = 5000;');
    db.exec('PRAGMA journal_mode = WAL;');
    try {
      db.prepare('DELETE FROM trend_explanations WHERE trend = ?').run(seededTrend.trim().toLowerCase());
    } catch (err) {
      console.warn('Could not clean up test db entry:', err.message);
    } finally {
      db.close();
    }
  });

  /**
   * [AC-1] Database helper for historical trend list
   * - A new function `getAllCachedExplanations()` must be exported from `db.js`.
   * - It must fetch all cached explanations from the database:
   *   - If `firestore` is active, query the Firestore `trend_explanations` collection and return all documents.
   *   - If `sqliteDb` is active, query the `trend_explanations` table ordered by `created_at DESC`.
   *   - If using in-memory fallback, return a copy of all entries in `inMemoryExplanations` sorted by `created_at` DESC.
   * - The returned array must consist of objects matching the structure: `{ trend: string, created_at: string, explanation: object }`.
   */
  test('[AC-1] Database helper: getAllCachedExplanations function exists, returns structured array sorted by created_at DESC', async () => {
    if (!dbModule || typeof dbModule.getAllCachedExplanations !== 'function') {
      throw new Error('db.js does not export getAllCachedExplanations function');
    }

    // Seed another temporary trend with a delay to assert sorting order
    const secondTrend = `hist-test-second-${Date.now()}`;
    const secondExpl = { hook: 'Second Hook', whatIsIt: 'Second What', whyIsItViral: [], takeaway: 'Second Takeaway' };
    
    await dbModule.setCachedExplanation(secondTrend, secondExpl);
    
    try {
      const results = await dbModule.getAllCachedExplanations();
      expect(Array.isArray(results)).toBe(true);

      const foundSeeded = results.find(e => e.trend.toLowerCase() === seededTrend.toLowerCase());
      const foundSecond = results.find(e => e.trend.toLowerCase() === secondTrend.toLowerCase());

      expect(foundSeeded).toBeDefined();
      expect(foundSecond).toBeDefined();

      expect(foundSeeded.explanation).toEqual(expect.objectContaining({ hook: seededExpl.hook }));
      expect(typeof foundSeeded.created_at).toBe('string');
      expect(typeof foundSeeded.trend).toBe('string');

      // Verify sorting order: secondTrend should have a newer timestamp and appear before seededTrend
      const indexSeeded = results.indexOf(foundSeeded);
      const indexSecond = results.indexOf(foundSecond);
      expect(indexSecond).toBeLessThan(indexSeeded);

    } finally {
      const db = new DatabaseSync(dbPath);
      db.exec('PRAGMA busy_timeout = 5000;');
      db.exec('PRAGMA journal_mode = WAL;');
      try {
        db.prepare('DELETE FROM trend_explanations WHERE trend = ?').run(secondTrend.trim().toLowerCase());
      } finally {
        db.close();
      }
    }
  });

  /**
   * [AC-2] Directory Page Routes and Lowercase Path Normalization
   * - Route matching and redirection must enforce lowercase casing normalization.
   * - Any uppercase letters in path parameters must trigger a 301 redirect to the fully lowercased path.
   * - If the `lang` parameter is passed but is not in the supported list ['es', 'fr', 'ja'], redirect to `/directory`.
   * - The directory page must render as a server-side generated semantic HTML document.
   * - Deduplicate trends by slug, render a clean list of hyperlinks.
   *   - On `/directory` links point to `/t/:slug`.
   *   - On `/directory/:lang` links point to `/t/:slug/:lang`.
   */
  test('[AC-2] Directory Page Routes: mixed-case redirects to lowercase canonical paths', async ({ request }) => {
    // mixed case route redirects to lowercased canonical route
    const responseUpperRoute = await request.get('/Directory', { maxRedirects: 0 });
    expect(responseUpperRoute.status()).toBe(301);
    // Location header redirect target should be lowercased
    expect(responseUpperRoute.headers()['location']).toContain('/directory');

    // mixed case lang parameter redirects to lowercased canonical route
    const responseUpperLang = await request.get('/directory/ES', { maxRedirects: 0 });
    expect(responseUpperLang.status()).toBe(301);
    expect(responseUpperLang.headers()['location']).toContain('/directory/es');

    const responseMixedLang = await request.get('/directory/Fr', { maxRedirects: 0 });
    expect(responseMixedLang.status()).toBe(301);
    expect(responseMixedLang.headers()['location']).toContain('/directory/fr');
  });

  test('[AC-2] Directory Page Routes: unsupported language redirects to /directory', async ({ request }) => {
    // unsupported lang (e.g. en, de) redirects to /directory
    const responseUnsupportedEn = await request.get('/directory/en', { maxRedirects: 0 });
    expect(responseUnsupportedEn.status()).toBe(301);
    expect(responseUnsupportedEn.headers()['location']).toContain('/directory');

    const responseUnsupportedDe = await request.get('/directory/de', { maxRedirects: 0 });
    expect(responseUnsupportedDe.status()).toBe(301);
    expect(responseUnsupportedDe.headers()['location']).toContain('/directory');
  });

  test('[AC-2] Directory Page Routes: serves 200 OK semantic HTML page with trend hyperlinks', async ({ request }) => {
    const responseEn = await request.get('/directory');
    expect(responseEn.status()).toBe(200);
    const htmlEn = await responseEn.text();

    // Verify it is semantic HTML
    expect(htmlEn).toContain('<!DOCTYPE html>');
    expect(htmlEn).toContain('<html');
    
    // Check links for default/English directory point to /t/:slug
    const slugSeeded = seededTrend.trim().toLowerCase();
    expect(htmlEn).toContain(`href="/t/google-gemini"`);
    expect(htmlEn).toContain(`href="/t/${slugSeeded}"`);

    // Check directory page for es route /directory/es
    const responseEs = await request.get('/directory/es');
    expect(responseEs.status()).toBe(200);
    const htmlEs = await responseEs.text();
    expect(htmlEs).toContain(`href="/t/google-gemini/es"`);
    expect(htmlEs).toContain(`href="/t/${slugSeeded}/es"`);
  });

  /**
   * [AC-3] Directory SEO, Alternate Links, and JSON-LD
   * - Localized title and description in <head>.
   * - Canonical tag: <link rel="canonical" href="https://viraljacker.com/directory[/:lang]" />
   * - Alternate hreflang tags for auto-discovery: x-default, en, es, fr, ja.
   * - Script tag type="application/ld+json" containing CollectionPage or ItemList.
   * - Response Link header with canonical and alternates.
   */
  test('[AC-3] Directory SEO: renders localized head metadata (title, description, canonical, alternate hreflangs)', async ({ request }) => {
    const locales = {
      en: { path: '/directory', title: 'Historical Trends Directory | TrendJacker', canonical: 'https://viraljacker.com/directory' },
      es: { path: '/directory/es', title: 'Directorio de Tendencias Históricas | TrendJacker', canonical: 'https://viraljacker.com/directory/es' },
      fr: { path: '/directory/fr', title: 'Annuaire des Tendances Historiques | TrendJacker', canonical: 'https://viraljacker.com/directory/fr' },
      ja: { path: '/directory/ja', title: '歴史的トレンドディレクトリ | TrendJacker', canonical: 'https://viraljacker.com/directory/ja' }
    };

    for (const [lang, details] of Object.entries(locales)) {
      const response = await request.get(details.path);
      expect(response.status()).toBe(200);
      const html = await response.text();

      // Assert localized title
      expect(html).toContain(`<title>${details.title}</title>`);

      // Assert description meta is present
      expect(html).toContain('<meta name="description"');

      // Assert canonical tag
      expect(html).toContain(`<link rel="canonical" href="${details.canonical}"`);

      // Assert alternate hreflangs are present
      expect(html).toContain('<link rel="alternate" hreflang="x-default" href="https://viraljacker.com/directory"');
      expect(html).toContain('<link rel="alternate" hreflang="en" href="https://viraljacker.com/directory"');
      expect(html).toContain('<link rel="alternate" hreflang="es" href="https://viraljacker.com/directory/es"');
      expect(html).toContain('<link rel="alternate" hreflang="fr" href="https://viraljacker.com/directory/fr"');
      expect(html).toContain('<link rel="alternate" hreflang="ja" href="https://viraljacker.com/directory/ja"');
    }
  });

  test('[AC-3] Directory SEO: response headers include canonical and alternate Link header', async ({ request }) => {
    const response = await request.get('/directory');
    const linkHeader = response.headers()['link'];
    expect(linkHeader).toBeDefined();

    expect(linkHeader).toContain('<https://viraljacker.com/directory>; rel="canonical"');
    expect(linkHeader).toContain('<https://viraljacker.com/directory>; rel="alternate"; hreflang="x-default"');
    expect(linkHeader).toContain('<https://viraljacker.com/directory>; rel="alternate"; hreflang="en"');
    expect(linkHeader).toContain('<https://viraljacker.com/directory/es>; rel="alternate"; hreflang="es"');
    expect(linkHeader).toContain('<https://viraljacker.com/directory/fr>; rel="alternate"; hreflang="fr"');
    expect(linkHeader).toContain('<https://viraljacker.com/directory/ja>; rel="alternate"; hreflang="ja"');
  });

  test('[AC-3] Directory SEO: contains and validates CollectionPage / ItemList JSON-LD structured data', async ({ request }) => {
    const response = await request.get('/directory');
    const html = await response.text();

    const match = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
    expect(match).not.toBeNull();

    const jsonLd = JSON.parse(match[1].trim());
    expect(jsonLd['@context']).toBe('https://schema.org');
    
    // Type should be CollectionPage or ItemList
    expect(['CollectionPage', 'ItemList']).toContain(jsonLd['@type']);
    expect(jsonLd.name).toBeDefined();
    expect(jsonLd.description).toBeDefined();
    
    // Main entity or URL matches directory canonical URL
    const canonicalUrl = jsonLd.url || jsonLd.mainEntityOfPage;
    expect(canonicalUrl).toBe('https://viraljacker.com/directory');

    // Checks nested items list
    expect(jsonLd.itemListElement || jsonLd.hasPart).toBeDefined();
  });

  /**
   * [AC-4] Comprehensive sitemap.xml Integration
   * - The `/sitemap.xml` endpoint must fetch all historical trends from the database using `getAllCachedExplanations()`, blend them with `latestTrends`, deduplicate by slug, and include every unique trend slug in the sitemap.
   * - Include elements for all supported language variants: /t/:slug, /t/:slug/es, /t/:slug/fr, /t/:slug/ja.
   * - The sitemap must also include entries for `/directory` and `/directory/:lang`.
   * - All entries must be deduplicated.
   */
  test('[AC-4] Comprehensive sitemap.xml: includes directory, directory lang routes, historical and live trends, with correct alternates', async ({ request }) => {
    const response = await request.get('/sitemap.xml');
    expect(response.status()).toBe(200);
    const xmlText = await response.text();

    const parser = new xml2js.Parser();
    const parsed = await parser.parseStringPromise(xmlText);
    const urlset = parsed.urlset;
    expect(urlset).toBeDefined();

    const urls = urlset.url || [];
    const locs = urls.map(u => u.loc[0]);

    // Check directory locs are in the sitemap
    expect(locs).toContain('https://viraljacker.com/directory');
    expect(locs).toContain('https://viraljacker.com/directory/es');
    expect(locs).toContain('https://viraljacker.com/directory/fr');
    expect(locs).toContain('https://viraljacker.com/directory/ja');

    // Check historical trend is in the sitemap (in all languages)
    const slugSeeded = seededTrend.trim().toLowerCase();
    expect(locs).toContain(`https://viraljacker.com/t/${slugSeeded}`);
    expect(locs).toContain(`https://viraljacker.com/t/${slugSeeded}/es`);
    expect(locs).toContain(`https://viraljacker.com/t/${slugSeeded}/fr`);
    expect(locs).toContain(`https://viraljacker.com/t/${slugSeeded}/ja`);

    // Verify all locs are unique (no duplicates)
    const uniqueLocs = new Set(locs);
    expect(locs.length).toBe(uniqueLocs.size);

    // Verify alternate links are present for both directory and trend pages
    const directoryUrlNode = urls.find(u => u.loc[0] === 'https://viraljacker.com/directory');
    expect(directoryUrlNode).toBeDefined();
    const alternates = directoryUrlNode['xhtml:link'] || [];
    expect(alternates).toHaveLength(5); // x-default, en, es, fr, ja

    const targetHreflangs = ['x-default', 'en', 'es', 'fr', 'ja'];
    for (const lang of targetHreflangs) {
      const exists = alternates.some(a => a.$ && a.$.hreflang === lang);
      expect(exists).toBe(true);
    }
  });

  /**
   * [AC-5] llms.txt and llms-full.txt Sitemap Consolidation
   * - /llms.txt and /llms-full.txt endpoints must incorporate historical trend explanations and latestTrends.
   * - Deduplicated by slug.
   * - /llms.txt formatting: `- [/t/${slug}.md](/t/${slug}.md) - ${desc} (Source: ...)`
   * - /llms-full.txt compiles full markdown representation.
   */
  test('[AC-5] LLM plain text endpoints: incorporates, deduplicates, and formats historical trend data in llms.txt', async ({ request }) => {
    const response = await request.get('/llms.txt');
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('text/plain');
    const text = await response.text();

    const slugSeeded = seededTrend.trim().toLowerCase();
    // Expected format: - [/t/slug.md](/t/slug.md)
    expect(text).toContain(`- [/t/${slugSeeded}.md](/t/${slugSeeded}.md)`);

    // Ensure deduplication
    const lines = text.split('\n');
    const seededMatches = lines.filter(line => line.includes(`/t/${slugSeeded}.md`));
    expect(seededMatches.length).toBe(1);
  });

  test('[AC-5] LLM plain text endpoints: compiles full markdown representation of all trends in llms-full.txt', async ({ request }) => {
    const response = await request.get('/llms-full.txt');
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('text/plain');
    const text = await response.text();

    // Check seeded historical trend title/heading is present in full content
    expect(text).toContain(`## ${seededTrend}`);
    expect(text).toContain(`Explanation: ${seededExpl.whatIsIt}`);
    expect(text).toContain(`Takeaway: ${seededExpl.takeaway}`);

    // Ensure deduplication
    const occurrences = text.split(`## ${seededTrend}`).length - 1;
    expect(occurrences).toBe(1);
  });

  /**
   * [AC-6] Global Footer Links and Client Translation Hydration
   * - Footer section appended in index.html with directory link id="directory-link".
   * - UI_DICTIONARY updated with `directoryLinkText` translation strings.
   * - translateUI updates `#directory-link` text content and rewrites `href` attribute to match active language.
   */
  test('[AC-6] Global Footer Links: renders directory-link in footer, dynamically translates and rewrites href', async ({ page }) => {
    await page.goto('/');

    const footerLink = page.locator('#directory-link');
    await expect(footerLink).toBeVisible();

    // Default language is English. Check href is /directory
    await expect(footerLink).toHaveAttribute('href', '/directory');

    // Switch language to Spanish (es)
    const select = page.locator('#lang-select');
    await select.selectOption('es');

    // Expect href to become /directory/es
    await expect(footerLink).toHaveAttribute('href', '/directory/es');

    // Switch language to French (fr)
    await select.selectOption('fr');
    await expect(footerLink).toHaveAttribute('href', '/directory/fr');

    // Switch language to Japanese (ja)
    await select.selectOption('ja');
    await expect(footerLink).toHaveAttribute('href', '/directory/ja');
  });

});
