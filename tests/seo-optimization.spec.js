import { test, expect } from '@playwright/test';
import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import { execSync } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.resolve(__dirname, '../polls.db');

test.describe('SEO Crawlability and Database Lifespan Optimization Tests', () => {

  /**
   * [AC-1] Server-Side HTML Pre-Rendering (Core Fields & XSS Safety)
   * - Verification: Programmatic HTTP GET request to /t/google-gemini (with JS disabled/ignored)
   *   must return indexable, properly escaped text within the main explainer container.
   */
  test('[AC-1] GET /t/google-gemini pre-renders core explainer fields and escapes text', async ({ request }) => {
    const response = await request.get('/t/google-gemini');
    expect(response.status()).toBe(200);
    const html = await response.text();

    // Check main explainer container classes
    expect(html).toContain('id="welcome-view" class="empty-state hidden"');
    expect(html).not.toContain('id="explainer-view" class="explainer-container hidden"');

    // Check header and text contents are pre-rendered
    expect(html).toContain('id="detail-title" class="trend-title">Google Gemini</h1>');
    expect(html).toContain('id="detail-hook"');
    expect(html).toContain('id="detail-what"');
    expect(html).toContain('id="detail-takeaway"');

    // Check detail-viral-tags contains class viral-tag
    expect(html).toContain('class="viral-tag"');
  });

  /**
   * [AC-1] Server-Side HTML Pre-Rendering (Core Fields & XSS Safety)
   * - XSS Protection: All server-side dynamically interpolated text content must be HTML-escaped before injection.
   */
  test('[AC-1] Server-Side Pre-Rendering escapes dynamic inputs to prevent XSS', async ({ request }) => {
    // Insert a payload with XSS characters into the database
    const db = new DatabaseSync(dbPath);
    db.exec('PRAGMA busy_timeout = 5000;');
    db.exec('PRAGMA journal_mode = WAL;');

    const maliciousTrend = 'xss-trend-test';
    const xssPayload = '"><script>alert(1)</script>';
    const testExpl = {
      hook: `Hook ${xssPayload}`,
      whatIsIt: `What ${xssPayload}`,
      whyIsItViral: [`Viral ${xssPayload}`],
      takeaway: `Takeaway ${xssPayload}`
    };

    try {
      db.prepare(`
        INSERT OR REPLACE INTO trend_explanations (trend, explanation, created_at)
        VALUES (?, ?, ?)
      `).run(maliciousTrend, JSON.stringify(testExpl), new Date().toISOString());
      
      // Close db before making HTTP call to avoid locking
      db.close();

      const response = await request.get(`/t/${maliciousTrend}`);
      expect(response.status()).toBe(200);
      const html = await response.text();

      // The raw script tag must NOT be rendered in HTML
      expect(html).not.toContain('"><script>alert(1)</script>');
      // Instead, it must be properly escaped
      expect(html).toContain('&quot;&gt;&lt;script&gt;alert(1)&lt;/script&gt;');
    } finally {
      try {
        const cleanupDb = new DatabaseSync(dbPath);
        cleanupDb.exec('PRAGMA busy_timeout = 5000;');
        cleanupDb.exec('PRAGMA journal_mode = WAL;');
        cleanupDb.prepare('DELETE FROM trend_explanations WHERE trend = ?').run(maliciousTrend);
        cleanupDb.close();
      } catch (e) {
        // ignore
      }
    }
  });

  /**
   * [AC-2] Server-Side HTML Pre-Rendering (Polls, Gauge, & News Footer)
   * - Division-by-Zero Safety: Percentages default to 50% if total votes is 0.
   */
  test('[AC-2] Sentiment percentages default to 50% when total votes is 0', async ({ request }) => {
    const db = new DatabaseSync(dbPath);
    db.exec('PRAGMA busy_timeout = 5000;');
    db.exec('PRAGMA journal_mode = WAL;');

    const pollTrend = 'poll-zero-votes-trend';
    try {
      // Ensure no votes exist for this trend
      db.prepare('DELETE FROM votes WHERE trend = ?').run(pollTrend);
      
      // Store mock explanation
      const testExpl = { hook: 'Test Hook', whatIsIt: 'What', whyIsItViral: [], takeaway: 'Takeaway' };
      db.prepare(`
        INSERT OR REPLACE INTO trend_explanations (trend, explanation, created_at)
        VALUES (?, ?, ?)
      `).run(pollTrend, JSON.stringify(testExpl), new Date().toISOString());

      db.close();

      const response = await request.get(`/t/${pollTrend}`);
      expect(response.status()).toBe(200);
      const html = await response.text();

      // Check progress bars style width is set to 50%
      expect(html).toContain('id="bar-genius" class="progress-bar bar-g" style="width: 50%"');
      expect(html).toContain('id="bar-overrated" class="progress-bar bar-o" style="width: 50%"');

      // Check text percentages display 50%
      expect(html).toContain('id="pct-genius" class="result-pct">50%</span>');
      expect(html).toContain('id="pct-overrated" class="result-pct">50%</span>');

      // Sentiment gauge displays 50% and fill offset is calculated
      expect(html).toContain('id="gauge-genius-pct">50%</span>');
      // dashoffset for 50%: 251.2 * (1 - 50/100) = 125.6
      expect(html).toContain('id="gauge-fill" cx="50" cy="50" r="40" fill="none" stroke-width="8" stroke-dasharray="251.2" stroke-dashoffset="125.6"');
    } finally {
      try {
        const cleanupDb = new DatabaseSync(dbPath);
        cleanupDb.exec('PRAGMA busy_timeout = 5000;');
        cleanupDb.exec('PRAGMA journal_mode = WAL;');
        cleanupDb.prepare('DELETE FROM trend_explanations WHERE trend = ?').run(pollTrend);
        cleanupDb.prepare('DELETE FROM votes WHERE trend = ?').run(pollTrend);
        cleanupDb.close();
      } catch (e) {
        // ignore
      }
    }
  });

  /**
   * [AC-2] Server-Side HTML Pre-Rendering (Polls, Gauge, & News Footer)
   * - Verification: Pre-rendered news footer details are populated when news context is present, and HTML-escaped.
   */
  test('[AC-2] News footer pre-renders escaped news context if present', async ({ request }) => {
    const response = await request.get('/t/google-gemini');
    expect(response.status()).toBe(200);
    const html = await response.text();

    // Verify news card is not hidden
    expect(html).toContain('class="news-footer-card"');
    expect(html).not.toContain('class="news-footer-card hidden"');

    // Verify headline, publisher, snippet pre-rendered
    expect(html).toContain('id="detail-news-publisher">Google Blog</span>');
    expect(html).toContain('id="detail-news-title">Google announces Gemini 3.5</span>');
    expect(html).toContain('id="detail-news-snippet">Gemini 3.5 is now live');
    
    // Verify blockquote cite and link href
    expect(html).toContain('<blockquote cite="https://blog.google/gemini-3.5"');
    expect(html).toContain('id="detail-news-link" class="news-link-btn" href="https://blog.google/gemini-3.5"');
  });

  /**
   * [AC-2] Server-Side HTML Pre-Rendering (Polls, Gauge, & News Footer)
   * - Verification: The news footer card has class hidden added if news context is missing.
   */
  test('[AC-2] News footer card is hidden if news context is missing', async ({ request }) => {
    const db = new DatabaseSync(dbPath);
    db.exec('PRAGMA busy_timeout = 5000;');
    db.exec('PRAGMA journal_mode = WAL;');

    const noNewsTrend = 'no-news-trend-test';
    try {
      const testExpl = { hook: 'Test Hook', whatIsIt: 'What', whyIsItViral: [], takeaway: 'Takeaway' };
      db.prepare(`
        INSERT OR REPLACE INTO trend_explanations (trend, explanation, created_at)
        VALUES (?, ?, ?)
      `).run(noNewsTrend, JSON.stringify(testExpl), new Date().toISOString());

      db.close();

      const response = await request.get(`/t/${noNewsTrend}`);
      expect(response.status()).toBe(200);
      const html = await response.text();

      // Check news footer card is hidden
      expect(html).toContain('class="news-footer-card hidden"');
    } finally {
      try {
        const cleanupDb = new DatabaseSync(dbPath);
        cleanupDb.exec('PRAGMA busy_timeout = 5000;');
        cleanupDb.exec('PRAGMA journal_mode = WAL;');
        cleanupDb.prepare('DELETE FROM trend_explanations WHERE trend = ?').run(noNewsTrend);
        cleanupDb.close();
      } catch (e) {
        // ignore
      }
    }
  });

  /**
   * [AC-3] Header Link & Client Translation
   * - Verification: E2E browser test navigating to / and checking the navbar layout.
   * - Checks that header link points to /directory by default, and translates when language is toggled.
   */
  test('[AC-3] Header directory link in navbar dynamically translates and rewrites href', async ({ page }) => {
    await page.goto('/');

    const headerLink = page.locator('#header-directory-link');
    await expect(headerLink).toBeVisible();

    // Default language is English. Check href is /directory
    await expect(headerLink).toHaveAttribute('href', '/directory');
    await expect(headerLink).toHaveText('Historical Directory'); // or appropriate translation

    // Switch language to Spanish (es)
    const select = page.locator('#lang-select');
    await select.selectOption('es');

    // Expect href to become /directory/es
    await expect(headerLink).toHaveAttribute('href', '/directory/es');
    await expect(headerLink).toHaveText('Directorio Histórico'); // or appropriate translation

    // Switch language to French (fr)
    await select.selectOption('fr');
    await expect(headerLink).toHaveAttribute('href', '/directory/fr');

    // Switch language to Japanese (ja)
    await select.selectOption('ja');
    await expect(headerLink).toHaveAttribute('href', '/directory/ja');
  });

  /**
   * [AC-4] Google Sitemap Ping Integration & Test Updates
   * - A standalone CLI script scripts/ping-sitemap.js must trigger the sitemap ping and run safely in test mode.
   */
  test('[AC-4] scripts/ping-sitemap.js CLI runs safely and prints a mock statement in test mode', async () => {
    const scriptPath = path.resolve(__dirname, '../scripts/ping-sitemap.js');
    // We expect this script to be added by the Builder
    expect(fs.existsSync(scriptPath)).toBe(true);

    const stdout = execSync('node scripts/ping-sitemap.js', {
      env: {
        ...process.env,
        NODE_ENV: 'test',
        APP_HOST: 'localhost:3001'
      }
    }).toString();

    expect(stdout.toLowerCase()).toContain('mock');
    expect(stdout.toLowerCase()).toContain('google');
    expect(stdout.toLowerCase()).toContain('sitemap');
  });

  /**
   * [AC-5] Database Lifespan Extension (Atomic Transaction Pruning)
   * - Verification: pruneOldExplanations() deletes records from both trend_explanations
   *   and localized_explanations where created_at is older than 21 days.
   */
  test('[AC-5] pruneOldExplanations() atomically deletes records older than 21 days', async () => {
    const dbModule = await import('../db.js');
    if (typeof dbModule.pruneOldExplanations !== 'function') {
      throw new Error('pruneOldExplanations is not exported from db.js');
    }

    const db = new DatabaseSync(dbPath);
    db.exec('PRAGMA busy_timeout = 5000;');
    db.exec('PRAGMA journal_mode = WAL;');

    // Setup dates
    const now = new Date();
    
    // Older than 21 days: e.g. 25 days ago
    const oldDate = new Date(now.getTime() - 25 * 24 * 60 * 60 * 1000).toISOString();
    // Newer than 21 days: e.g. 5 days ago
    const newDate = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString();

    const oldTrend = 'old-trend-prune-test';
    const newTrend = 'new-trend-keep-test';

    const testExpl = { hook: 'Hook', whatIsIt: 'What', whyIsItViral: [], takeaway: 'Takeaway' };
    const locData = { title: 'Loc Title', meta_description: 'Loc Desc', explanation: testExpl };

    try {
      // Clean up first
      db.prepare('DELETE FROM trend_explanations WHERE trend IN (?, ?)').run(oldTrend, newTrend);
      db.prepare('DELETE FROM localized_explanations WHERE trend IN (?, ?)').run(oldTrend, newTrend);

      // Seed old trend and localized explanations
      db.prepare(`
        INSERT INTO trend_explanations (trend, explanation, created_at)
        VALUES (?, ?, ?)
      `).run(oldTrend, JSON.stringify(testExpl), oldDate);
      db.prepare(`
        INSERT INTO localized_explanations (trend, lang, title, meta_description, explanation, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(oldTrend, 'es', locData.title, locData.meta_description, JSON.stringify(locData.explanation), oldDate);

      // Seed new trend and localized explanations
      db.prepare(`
        INSERT INTO trend_explanations (trend, explanation, created_at)
        VALUES (?, ?, ?)
      `).run(newTrend, JSON.stringify(testExpl), newDate);
      db.prepare(`
        INSERT INTO localized_explanations (trend, lang, title, meta_description, explanation, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(newTrend, 'es', locData.title, locData.meta_description, JSON.stringify(locData.explanation), newDate);

      db.close();

      // Run pruneOldExplanations
      await dbModule.pruneOldExplanations();

      // Open database to assert
      const assertDb = new DatabaseSync(dbPath);
      assertDb.exec('PRAGMA busy_timeout = 5000;');
      assertDb.exec('PRAGMA journal_mode = WAL;');

      // Assert old trend is deleted
      const oldRow = assertDb.prepare('SELECT * FROM trend_explanations WHERE trend = ?').get(oldTrend);
      expect(oldRow).toBeUndefined();

      const oldLocRow = assertDb.prepare('SELECT * FROM localized_explanations WHERE trend = ?').get(oldTrend);
      expect(oldLocRow).toBeUndefined();

      // Assert new trend is preserved
      const newRow = assertDb.prepare('SELECT * FROM trend_explanations WHERE trend = ?').get(newTrend);
      expect(newRow).toBeDefined();
      expect(newRow.trend).toBe(newTrend);

      const newLocRow = assertDb.prepare('SELECT * FROM localized_explanations WHERE trend = ?').get(newTrend);
      expect(newLocRow).toBeDefined();
      expect(newLocRow.trend).toBe(newTrend);

      assertDb.close();

    } finally {
      try {
        const cleanupDb = new DatabaseSync(dbPath);
        cleanupDb.exec('PRAGMA busy_timeout = 5000;');
        cleanupDb.exec('PRAGMA journal_mode = WAL;');
        cleanupDb.prepare('DELETE FROM trend_explanations WHERE trend IN (?, ?)').run(oldTrend, newTrend);
        cleanupDb.prepare('DELETE FROM localized_explanations WHERE trend IN (?, ?)').run(oldTrend, newTrend);
        cleanupDb.close();
      } catch (e) {
        // ignore
      }
    }
  });

});
