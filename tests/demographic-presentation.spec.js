import { test, expect } from '@playwright/test';
import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Resolve database path
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.resolve(__dirname, '../polls.db');

test.describe('Dynamic Demographic Trend Presentation', () => {

  test.describe('Backend API & Caching [AC-1, AC-2, AC-3, AC-7]', () => {
    let getCachedExplanation;
    let setCachedExplanation;
    let getLocalizedExplanation;
    let setLocalizedExplanation;

    test.beforeAll(async () => {
      try {
        const dbModule = await import('../db.js');
        getCachedExplanation = dbModule.getCachedExplanation;
        setCachedExplanation = dbModule.setCachedExplanation;
        getLocalizedExplanation = dbModule.getLocalizedExplanation;
        setLocalizedExplanation = dbModule.setLocalizedExplanation;
      } catch (err) {
        console.warn('Could not import db functions:', err.message);
      }
    });

    // [AC-1] API Extension
    test('POST /api/explain accepts optional bracket parameter and returns success', async ({ request }) => {
      const response = await request.post('/api/explain', {
        data: {
          trend: 'Test Trend API',
          bracket: 'kids_teens'
        }
      });
      expect(response.status()).toBe(200);
      const data = await response.json();
      expect(data).toHaveProperty('hook');
      expect(data).toHaveProperty('whatIsIt');
    });

    // [AC-7] Test Mode / Mock Support & [AC-2] Backend Demographic Generation Guidelines
    test('returns customized mock explanations based on the requested demographic bracket in test mode', async ({ request }) => {
      // kids_teens bracket test
      const responseKids = await request.post('/api/explain', {
        data: {
          trend: 'Test Demographic Mock',
          bracket: 'kids_teens'
        }
      });
      expect(responseKids.status()).toBe(200);
      const kidsData = await responseKids.json();
      const kidsText = `${kidsData.hook} ${kidsData.whatIsIt}`.toLowerCase();
      expect(kidsText).toContain('no cap');

      // seniors bracket test
      const responseSeniors = await request.post('/api/explain', {
        data: {
          trend: 'Test Demographic Mock',
          bracket: 'seniors'
        }
      });
      expect(responseSeniors.status()).toBe(200);
      const seniorsData = await responseSeniors.json();
      const seniorsText = `${seniorsData.hook} ${seniorsData.whatIsIt}`.toLowerCase();
      expect(seniorsText).toContain('historical context');
      expect(seniorsText).not.toContain('no cap');

      // adults (default) bracket test
      const responseAdults = await request.post('/api/explain', {
        data: {
          trend: 'Test Demographic Mock',
          bracket: 'adults'
        }
      });
      expect(responseAdults.status()).toBe(200);
      const adultsData = await responseAdults.json();
      const adultsText = `${adultsData.hook} ${adultsData.whatIsIt}`.toLowerCase();
      expect(adultsText).not.toContain('no cap');
      expect(adultsText).not.toContain('historical context');
    });

    // [AC-3] Database Caching with Bracket Key
    test('caches non-default brackets with :{bracket} suffix in trend_explanations and localized_explanations', async () => {
      if (!setCachedExplanation || !getCachedExplanation || !setLocalizedExplanation || !getLocalizedExplanation) {
        throw new Error('Database functions not loaded');
      }

      const baseTrend = `test-cache-trend-${Date.now()}`;
      const testExpl = {
        hook: 'Dynamic Hook',
        whatIsIt: 'Dynamic explanation text',
        whyIsItViral: ['Factor A', 'Factor B'],
        takeaway: 'Takeaway text'
      };

      // 1. Check caching for kids_teens
      const kidsKey = `${baseTrend}:kids_teens`;
      await setCachedExplanation(kidsKey, testExpl);

      const db = new DatabaseSync(dbPath);
      db.exec('PRAGMA busy_timeout = 5000;');
      db.exec('PRAGMA journal_mode = WAL;');
      try {
        const stmt = db.prepare('SELECT explanation FROM trend_explanations WHERE trend = ?');
        const row = stmt.get(kidsKey);
        expect(row).toBeDefined();
        const parsed = JSON.parse(row.explanation);
        expect(parsed.hook).toBe(testExpl.hook);
      } finally {
        db.close();
      }

      const cached = await getCachedExplanation(kidsKey);
      expect(cached).toBeDefined();
      expect(cached.hook).toBe(testExpl.hook);

      // 2. Check localized cache with bracket key
      const seniorKey = `${baseTrend}:seniors`;
      const testLocData = {
        title: 'Senior Title',
        meta_description: 'Senior Meta Description',
        explanation: testExpl
      };
      await setLocalizedExplanation(seniorKey, 'es', testLocData);

      const db2 = new DatabaseSync(dbPath);
      db2.exec('PRAGMA busy_timeout = 5000;');
      db2.exec('PRAGMA journal_mode = WAL;');
      try {
        const stmt = db2.prepare('SELECT title, explanation FROM localized_explanations WHERE trend = ? AND lang = ?');
        const row = stmt.get(seniorKey, 'es');
        expect(row).toBeDefined();
        expect(row.title).toBe(testLocData.title);
        const parsed = JSON.parse(row.explanation);
        expect(parsed.hook).toBe(testExpl.hook);
      } finally {
        db2.close();
      }

      const cachedLoc = await getLocalizedExplanation(seniorKey, 'es');
      expect(cachedLoc).toBeDefined();
      expect(cachedLoc.title).toBe(testLocData.title);
    });

    // [AC-3] Case-Insensitive Database Caching with Bracket Key
    test('should normalize demographic cache keys to lowercase for trend_explanations and localized_explanations', async () => {
      if (!setCachedExplanation || !getCachedExplanation || !setLocalizedExplanation || !getLocalizedExplanation) {
        throw new Error('Database functions not loaded');
      }

      const baseTrendMixed = `Test-Cache-Trend-Case-${Date.now()}`;
      const bracketMixed = `Kids_Teens`;
      const testExpl = {
        hook: 'Dynamic Hook',
        whatIsIt: 'Dynamic explanation text',
        whyIsItViral: ['Factor A'],
        takeaway: 'Takeaway text'
      };

      // 1. Check casing normalization for trend_explanations
      const kidsKeyMixed = `${baseTrendMixed}:${bracketMixed}`;
      const kidsKeyLower = `${baseTrendMixed.toLowerCase()}:${bracketMixed.toLowerCase()}`;
      
      await setCachedExplanation(kidsKeyMixed, testExpl);

      const db = new DatabaseSync(dbPath);
      db.exec('PRAGMA busy_timeout = 5000;');
      db.exec('PRAGMA journal_mode = WAL;');
      try {
        const stmt = db.prepare('SELECT trend, explanation FROM trend_explanations WHERE trend = ?');
        // The record in SQLite must have the lowercase normalized trend key
        const row = stmt.get(kidsKeyLower);
        expect(row).toBeDefined();
        expect(row.trend).toBe(kidsKeyLower);
      } finally {
        db.close();
      }

      const cachedUpper = await getCachedExplanation(kidsKeyMixed.toUpperCase());
      expect(cachedUpper).toBeDefined();
      expect(cachedUpper.hook).toBe(testExpl.hook);

      // 2. Check casing normalization for localized_explanations
      const seniorKeyMixed = `${baseTrendMixed}:Seniors`;
      const seniorKeyLower = `${baseTrendMixed.toLowerCase()}:seniors`;
      const testLocData = {
        title: 'Senior Title',
        meta_description: 'Senior Meta Description',
        explanation: testExpl
      };

      await setLocalizedExplanation(seniorKeyMixed, 'ES', testLocData);

      const db2 = new DatabaseSync(dbPath);
      db2.exec('PRAGMA busy_timeout = 5000;');
      db2.exec('PRAGMA journal_mode = WAL;');
      try {
        const stmt = db2.prepare('SELECT trend, lang, title FROM localized_explanations WHERE trend = ? AND lang = ?');
        const row = stmt.get(seniorKeyLower, 'es');
        expect(row).toBeDefined();
        expect(row.trend).toBe(seniorKeyLower);
        expect(row.lang).toBe('es');
      } finally {
        db2.close();
      }

      const cachedLocUpper = await getLocalizedExplanation(seniorKeyMixed.toUpperCase(), 'ES');
      expect(cachedLocUpper).toBeDefined();
      expect(cachedLocUpper.title).toBe(testLocData.title);
    });
  });

  test.describe('Frontend UI & Dynamic Interactivity [AC-4, AC-5, AC-6]', () => {
    const trendSlug = 'test-google-spike';

    test.beforeEach(async ({ page }) => {
      // Intercept EventSource to prevent live SSE flaking
      await page.addInitScript(() => {
        class MockEventSource extends EventTarget {
          constructor() { super(); }
          close() {}
        }
        window.EventSource = MockEventSource;
      });
    });

    // [AC-4] Interactive UI demographic selector
    test('displays the demographic selector pills (Adult, Kids & Teens, Seniors)', async ({ page }) => {
      await page.goto(`/t/${trendSlug}`);

      const selector = page.locator('#demographic-selector');
      await expect(selector).toBeVisible();

      const adultPill = page.locator('.demo-pill[data-val="adults"]');
      const kidsPill = page.locator('.demo-pill[data-val="kids_teens"]');
      const seniorsPill = page.locator('.demo-pill[data-val="seniors"]');

      await expect(adultPill).toBeVisible();
      await expect(adultPill).toContainText('Adult');
      await expect(kidsPill).toBeVisible();
      await expect(kidsPill).toContainText('Kids & Teens');
      await expect(seniorsPill).toBeVisible();
      await expect(seniorsPill).toContainText('Seniors');
    });

    // [AC-5] Client-side Dynamic Presentation Switching
    test('updates styles and fetches correct explanation upon selecting bracket', async ({ page }) => {
      let explainRequests = [];
      await page.route('**/api/explain', async (route) => {
        const req = route.request();
        if (req.method() === 'POST') {
          const body = req.postDataJSON();
          explainRequests.push(body);
          
          let responseBody = {
            hook: `Default hook for ${body.trend}`,
            whatIsIt: `Default what for ${body.trend}`,
            whyIsItViral: [`Default reason`],
            takeaway: `Default takeaway`,
            polls: { genius: 10, overrated: 5 }
          };

          if (body.bracket === 'kids_teens') {
            responseBody = {
              hook: `Kids hook no cap 🔥`,
              whatIsIt: `Kids what rizz`,
              whyIsItViral: [`Kids viral reason`],
              takeaway: `Kids takeaway`,
              polls: { genius: 10, overrated: 5 }
            };
          } else if (body.bracket === 'seniors') {
            responseBody = {
              hook: `Seniors hook with historical context`,
              whatIsIt: `Seniors what clearly defined`,
              whyIsItViral: [`Seniors reason`],
              takeaway: `Seniors takeaway`,
              polls: { genius: 10, overrated: 5 }
            };
          }

          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(responseBody)
          });
        } else {
          await route.continue();
        }
      });

      await page.goto(`/t/${trendSlug}`);
      await expect(page.locator('#detail-hook')).toBeVisible();

      const targetElement = page.locator('#explainer-view, body').first();

      // 1. Click Kids & Teens
      const kidsPill = page.locator('.demo-pill[data-val="kids_teens"]');
      await kidsPill.click();

      // Verify data-demographic attribute is set
      await expect(targetElement).toHaveAttribute('data-demographic', 'kids_teens');

      // Verify API request with bracket: "kids_teens" was made
      await expect.poll(() => explainRequests.some(r => r.bracket === 'kids_teens')).toBe(true);

      // Verify content is updated
      await expect(page.locator('#detail-hook')).toContainText('no cap');

      // Verify visual style for kids_teens is applied (e.g. active energetic class/property)
      const kidsStyleMatch = await targetElement.evaluate((el) => {
        const styles = window.getComputedStyle(el);
        return el.classList.contains('kids-teens-theme') || styles.getPropertyValue('--glow-color') !== '' || styles.boxShadow !== 'none';
      });
      expect(kidsStyleMatch).toBe(true);

      // 2. Click Seniors
      const seniorsPill = page.locator('.demo-pill[data-val="seniors"]');
      await seniorsPill.click();

      // Verify data-demographic attribute is set
      await expect(targetElement).toHaveAttribute('data-demographic', 'seniors');

      // Verify API request with bracket: "seniors" was made
      await expect.poll(() => explainRequests.some(r => r.bracket === 'seniors')).toBe(true);

      // Verify content is updated
      await expect(page.locator('#detail-hook')).toContainText('historical context');

      // Verify text scaling for seniors
      const seniorFontSize = await page.locator('#detail-hook').evaluate((el) => {
        const style = window.getComputedStyle(el);
        return parseFloat(style.fontSize);
      });
      
      const defaultFontSize = await page.locator('#detail-hook').evaluate((el) => {
        const container = el.closest('[data-demographic]');
        if (!container) return null;
        const original = container.getAttribute('data-demographic');
        container.setAttribute('data-demographic', 'adults');
        const styleDefault = window.getComputedStyle(el);
        const sizeDefault = parseFloat(styleDefault.fontSize);
        container.setAttribute('data-demographic', original);
        return sizeDefault;
      });

      expect(seniorFontSize).toBeGreaterThanOrEqual(defaultFontSize * 1.2);
    });

    // [AC-6] LocalStorage Persistence
    test('persists selected demographic preference in localStorage', async ({ page }) => {
      await page.goto(`/t/${trendSlug}`);
      const seniorsPill = page.locator('.demo-pill[data-val="seniors"]');
      await expect(seniorsPill).toBeVisible();
      await seniorsPill.click();

      // Check localStorage
      const storedVal = await page.evaluate(() => localStorage.getItem('selected-demographic'));
      expect(storedVal).toBe('seniors');

      // Reload page
      await page.reload();

      // Verify pill remains active and demographic class/attribute is set
      const activePill = page.locator('.demo-pill[data-val="seniors"]');
      await expect(activePill).toHaveClass(/active/);
      
      const targetElement = page.locator('#explainer-view, body').first();
      await expect(targetElement).toHaveAttribute('data-demographic', 'seniors');

      // Navigate to a different trend
      await page.goto(`/t/test-reddit-spike`);
      await expect(targetElement).toHaveAttribute('data-demographic', 'seniors');
    });
  });
});
