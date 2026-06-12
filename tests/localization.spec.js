import { test, expect } from '@playwright/test';
import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Resolve database path
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.resolve(__dirname, '../polls.db');

test.describe('Gemini AI Multi-Language Localization Engine', () => {

  test.describe('[AC-3] Database Caching of Localized Explanations', () => {
    let db;
    let getLocalizedExplanation;
    let setLocalizedExplanation;

    test.beforeAll(async () => {
      try {
        const dbModule = await import('../db.js');
        getLocalizedExplanation = dbModule.getLocalizedExplanation;
        setLocalizedExplanation = dbModule.setLocalizedExplanation;
      } catch (err) {
        console.warn('Could not import localized caching functions from db.js:', err.message);
      }
      db = new DatabaseSync(dbPath);
    });

    test.afterAll(() => {
      if (db) {
        db.close();
      }
    });

    // [AC-3] SQLite Schema Verification
    test('should have localized_explanations table created in SQLite with correct schema', async () => {
      const stmt = db.prepare(`
        SELECT sql FROM sqlite_master 
        WHERE type = 'table' AND name = 'localized_explanations'
      `);
      const row = stmt.get();
      expect(row).toBeDefined();
      expect(row.sql).toContain('trend TEXT');
      expect(row.sql).toContain('lang TEXT');
      expect(row.sql).toContain('title TEXT');
      expect(row.sql).toContain('meta_description TEXT');
      expect(row.sql).toContain('explanation TEXT');
      expect(row.sql).toContain('created_at TEXT');
      expect(row.sql).toContain('PRIMARY KEY (trend, lang)');
    });

    // [AC-3] getLocalizedExplanation and setLocalizedExplanation unit tests
    test('should write and retrieve a localized explanation from the database', async () => {
      if (typeof setLocalizedExplanation !== 'function' || typeof getLocalizedExplanation !== 'function') {
        throw new Error('getLocalizedExplanation or setLocalizedExplanation is not exported from db.js');
      }

      const testTrend = `local-trend-${Date.now()}`;
      const testLang = 'es';
      const testTitle = 'Spanish Title';
      const testMeta = 'Spanish Meta Description';
      const testExpl = {
        hook: 'Spanish Hook text',
        whatIsIt: 'Spanish WhatIsIt text',
        whyIsItViral: ['Reason ES A', 'Reason ES B'],
        takeaway: 'Spanish Takeaway text'
      };

      // Store in localized cache
      await setLocalizedExplanation(testTrend, testLang, {
        title: testTitle,
        meta_description: testMeta,
        explanation: testExpl
      });

      // Retrieve directly from SQLite table to confirm serialization
      const checkStmt = db.prepare('SELECT title, meta_description, explanation, created_at FROM localized_explanations WHERE trend = ? AND lang = ?');
      const dbRow = checkStmt.get(testTrend, testLang);
      expect(dbRow).toBeDefined();
      expect(dbRow.title).toBe(testTitle);
      expect(dbRow.meta_description).toBe(testMeta);
      const parsed = JSON.parse(dbRow.explanation);
      expect(parsed).toEqual(testExpl);
      expect(dbRow.created_at).toBeDefined();

      // Retrieve via getLocalizedExplanation function
      const cached = await getLocalizedExplanation(testTrend, testLang);
      expect(cached).toBeDefined();
      expect(cached.title).toBe(testTitle);
      expect(cached.meta_description).toBe(testMeta);
      expect(cached.explanation).toEqual(testExpl);
    });

    // [AC-3] Retrieve non-existent localized trend returns null/undefined
    test('should return null or undefined for non-cached localized trends', async () => {
      if (typeof getLocalizedExplanation !== 'function') {
        throw new Error('getLocalizedExplanation is not exported from db.js');
      }
      const result = await getLocalizedExplanation('none', 'es');
      expect(result).toBeFalsy();
    });
  });

  test.describe('[AC-1] Locale Route & Query Handling & [AC-2] Mock Translations', () => {
    // [AC-1] Route parameter support
    test('should serve Spanish HTML with HTTP 200 via route parameter /t/:slug/:lang', async ({ request }) => {
      const response = await request.get('/t/google-gemini/es');
      expect(response.status()).toBe(200);
      expect(response.headers()['content-type']).toContain('text/html');
      
      const html = await response.text();
      // [AC-2] Under mock mode, Spanish has suffix "(en español)"
      expect(html).toContain('(en español)');
      expect(html).toContain('preloaded-trend-data');
    });

    // [AC-1] Query parameter support
    test('should serve Spanish HTML with HTTP 200 via query parameter /t/:slug?lang=:lang', async ({ request }) => {
      const response = await request.get('/t/google-gemini?lang=es');
      expect(response.status()).toBe(200);
      expect(response.headers()['content-type']).toContain('text/html');
      
      const html = await response.text();
      expect(html).toContain('(en español)');
    });

    // [AC-1] Fallback to English
    test('should fallback to English (en) when lang is unsupported or empty', async ({ request }) => {
      const responseUnsupported = await request.get('/t/google-gemini/de');
      expect(responseUnsupported.status()).toBe(200);
      const htmlUnsupported = await responseUnsupported.text();
      expect(htmlUnsupported).not.toContain('(en español)');
      expect(htmlUnsupported).not.toContain('(en français)');
      expect(htmlUnsupported).not.toContain('(日本語訳)');
      expect(htmlUnsupported).toContain('Why is Google Gemini Trending?');

      const responseEmpty = await request.get('/t/google-gemini?lang=');
      expect(responseEmpty.status()).toBe(200);
      const htmlEmpty = await responseEmpty.text();
      expect(htmlEmpty).toContain('Why is Google Gemini Trending?');
    });

    // [AC-1] Markdown Support for Route Parameter
    test('should serve Spanish raw markdown with HTTP 200 via /t/:slug/:lang.md', async ({ request }) => {
      const response = await request.get('/t/google-gemini/es.md');
      expect(response.status()).toBe(200);
      expect(response.headers()['content-type']).toContain('text/plain');
      
      const markdown = await response.text();
      expect(markdown).toContain('# Google Gemini');
      expect(markdown).toContain('(en español)');
    });

    // [AC-1] Markdown Support for Query Parameter
    test('should serve Spanish raw markdown with HTTP 200 via /t/:slug.md?lang=:lang', async ({ request }) => {
      const response = await request.get('/t/google-gemini.md?lang=es');
      expect(response.status()).toBe(200);
      expect(response.headers()['content-type']).toContain('text/plain');
      
      const markdown = await response.text();
      expect(markdown).toContain('# Google Gemini');
      expect(markdown).toContain('(en español)');
    });

    // [AC-1] Invalid slugs return 404
    test('should return 404 for invalid slugs in HTML and Markdown localized routes', async ({ request }) => {
      const responseHtml = await request.get('/t/invalid-slug-123456/es');
      expect(responseHtml.status()).toBe(404);

      const responseMd = await request.get('/t/invalid-slug-123456/es.md');
      expect(responseMd.status()).toBe(404);
    });

    // [AC-2] Verification of mock language suffixes (fr and ja)
    test('should render appropriate mock language suffixes in preloaded script and page copy', async ({ request }) => {
      // French
      const resFr = await request.get('/t/google-gemini/fr');
      expect(resFr.status()).toBe(200);
      const htmlFr = await resFr.text();
      expect(htmlFr).toContain('(en français)');

      // Japanese
      const resJa = await request.get('/t/google-gemini/ja');
      expect(resJa.status()).toBe(200);
      const htmlJa = await resJa.text();
      expect(htmlJa).toContain('(日本語訳)');
    });
  });

  test.describe('[AC-4] Dynamic Localized SEO & Schema.org JSON-LD (SSR)', () => {
    test('should update HTML lang, title, meta description, OG tags, Twitter cards, and structured JSON-LD data dynamically', async ({ request }) => {
      const response = await request.get('/t/google-gemini/es');
      expect(response.status()).toBe(200);
      const html = await response.text();

      expect(html).toContain('<html lang="es"');
      expect(html).toMatch(/<title>.*\(en español\).*<\/title>/i);
      expect(html).toMatch(/<meta\s+name="description"\s+content=".*\(en español\).*"/i);
      expect(html).toMatch(/<meta\s+property="og:title"\s+content=".*\(en español\).*"/i);
      expect(html).toMatch(/<meta\s+property="og:description"\s+content=".*\(en español\).*"/i);
      expect(html).toContain('property="og:url" content="https://viraljacker.com/t/google-gemini/es"');
      expect(html).toMatch(/<meta\s+name="twitter:title"\s+content=".*\(en español\).*"/i);
      expect(html).toMatch(/<meta\s+name="twitter:description"\s+content=".*\(en español\).*"/i);

      const jsonLdMatch = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
      expect(jsonLdMatch).not.toBeNull();
      const jsonLd = JSON.parse(jsonLdMatch[1]);
      expect(jsonLd.headline).toContain('(en español)');
      expect(jsonLd.description).toContain('(en español)');
      expect(jsonLd.articleBody).toContain('(en español)');
    });
  });

  test.describe('[AC-5] Alternate Link Tags & Localized Sitemap', () => {
    // [AC-5] Alternate link tags in <head>
    test('should inject alternate link tags for all supported locales in head', async ({ request }) => {
      const response = await request.get('/t/google-gemini');
      expect(response.status()).toBe(200);
      const html = await response.text();

      expect(html).toContain('<link rel="alternate" hreflang="x-default" href="https://viraljacker.com/t/google-gemini" />');
      expect(html).toContain('<link rel="alternate" hreflang="en" href="https://viraljacker.com/t/google-gemini" />');
      expect(html).toContain('<link rel="alternate" hreflang="es" href="https://viraljacker.com/t/google-gemini/es" />');
      expect(html).toContain('<link rel="alternate" hreflang="fr" href="https://viraljacker.com/t/google-gemini/fr" />');
      expect(html).toContain('<link rel="alternate" hreflang="ja" href="https://viraljacker.com/t/google-gemini/ja" />');
    });

    // [AC-5] Sitemap mapping all trend slugs for each locale
    test('should serve dynamic sitemap containing alternate links for all locales', async ({ request }) => {
      const response = await request.get('/sitemap.xml');
      expect(response.status()).toBe(200);
      expect(response.headers()['content-type']).toContain('xml');
      const xml = await response.text();

      expect(xml).toContain('https://viraljacker.com/t/google-gemini');
      expect(xml).toContain('https://viraljacker.com/t/google-gemini/es');
      expect(xml).toContain('https://viraljacker.com/t/google-gemini/fr');
      expect(xml).toContain('https://viraljacker.com/t/google-gemini/ja');

      expect(xml).toContain('rel="alternate"');
      expect(xml).toContain('hreflang="x-default"');
      expect(xml).toContain('hreflang="en"');
      expect(xml).toContain('hreflang="es"');
      expect(xml).toContain('hreflang="fr"');
      expect(xml).toContain('hreflang="ja"');
    });
  });

  test.describe('[AC-6] Client UI Translation & Interactive Switcher', () => {
    test('should load dropdown in navbar, switch languages without full reload, update URL, and translate UI elements', async ({ page }) => {
      await page.goto('/t/google-gemini');

      const select = page.locator('#lang-select');
      await expect(select).toBeVisible();

      await page.evaluate(() => {
        window.__noPageReloadIndicator = true;
      });

      let apiExplainRequestData = null;
      await page.route('**/api/explain', async (route) => {
        const req = route.request();
        if (req.method() === 'POST') {
          apiExplainRequestData = req.postDataJSON();
        }
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            hook: 'Spanish Hook text (en español)',
            whatIsIt: 'Spanish WhatIsIt text (en español)',
            whyIsItViral: ['Reason ES A (en español)', 'Reason ES B (en español)'],
            takeaway: 'Spanish Takeaway text (en español)',
            polls: { overrated: 5, genius: 15 }
          })
        });
      });

      await select.selectOption('es');

      await expect(page).toHaveURL(/\/t\/google-gemini\/es$/);

      const isPersistent = await page.evaluate(() => window.__noPageReloadIndicator);
      expect(isPersistent).toBe(true);

      // Verify static UI labels mapped to dictionary are translated instantly
      await expect(async () => {
        const text = await page.locator('body').textContent();
        expect(text).toContain('¿Qué es?');
      }).toPass();

      expect(apiExplainRequestData).toBeDefined();
      expect(apiExplainRequestData.lang).toBe('es');

      await expect(page.locator('#detail-hook')).toContainText('(en español)');
      await expect(page.locator('#detail-what')).toContainText('(en español)');
      await expect(page.locator('#detail-takeaway')).toContainText('(en español)');
    });
  });
});
