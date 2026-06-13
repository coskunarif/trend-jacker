import { test, expect } from '@playwright/test';
import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';

// Resolve database path
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.resolve(__dirname, '../polls.db');

test.describe('TJ-XXX: Gamified Trend Predictions Tests', () => {

  let recordPrediction;
  let getClientPredictions;
  let resolvePredictions;
  let getPredictionBonus;

  test.beforeAll(async () => {
    try {
      const dbModule = await import('../db.js');
      recordPrediction = dbModule.recordPrediction;
      getClientPredictions = dbModule.getClientPredictions;
      resolvePredictions = dbModule.resolvePredictions;
      getPredictionBonus = dbModule.getPredictionBonus;
    } catch (err) {
      console.warn('Could not import prediction functions from db.js:', err.message);
    }
  });

  // =========================================================================
  // [AC-1] Database Schema & Methods
  // =========================================================================
  test('1. SQLite client_predictions table schema verification', async () => {
    const db = new DatabaseSync(dbPath);
    try {
      const stmt = db.prepare(`
        SELECT sql FROM sqlite_master 
        WHERE type = 'table' AND name = 'client_predictions'
      `);
      const row = stmt.get();
      expect(row).toBeDefined();
      expect(row.sql).toContain('client_id TEXT');
      expect(row.sql).toContain('trend TEXT');
      expect(row.sql).toContain('prediction TEXT');
      expect(row.sql).toContain('prediction_date TEXT');
      expect(row.sql).toContain('status TEXT');
      expect(row.sql).toContain('resolved_at TEXT');
      expect(row.sql).toContain('PRIMARY KEY');
    } finally {
      db.close();
    }
  });

  test('2. Database helper methods exist and enforce normalization/casing', async () => {
    expect(typeof recordPrediction).toBe('function');
    expect(typeof getClientPredictions).toBe('function');
    expect(typeof resolvePredictions).toBe('function');
    expect(typeof getPredictionBonus).toBe('function');

    const clientId = '  Test-Client-123 ';
    const trend = ' Google Gemini ';
    const prediction = 'rise';
    const date = '2026-06-13';

    // Insert a pending prediction
    await recordPrediction(clientId, trend, prediction, date);

    // Retrieve predictions for the client
    const predictions = await getClientPredictions(clientId);
    expect(predictions).toBeDefined();
    expect(predictions.length).toBeGreaterThan(0);

    const record = predictions.find(p => p.trend === 'google gemini');
    expect(record).toBeDefined();
    // Verify case normalization and trimming
    expect(record.client_id).toBe('test-client-123');
    expect(record.trend).toBe('google gemini');
    expect(record.prediction).toBe('rise');
    expect(record.prediction_date).toBe('2026-06-13');
    expect(record.status).toBe('pending');
  });

  test('3. resolvePredictions deterministically resolves pending predictions', async () => {
    expect(typeof resolvePredictions).toBe('function');

    const clientId = 'test-client-resolve';
    const trend = 'rise-trend';
    const date = '2026-06-12';
    // Hash: sha256 of 'rise-trend:2026-06-12'
    const hashVal = crypto.createHash('sha256').update('rise-trend:' + date).digest('hex');
    const lastChar = hashVal.slice(-1);
    const modVal = parseInt(lastChar, 16) % 2;
    const expectedOutcome = modVal === 0 ? 'rise' : 'fall';

    await recordPrediction(clientId, trend, expectedOutcome, date);

    // Resolve predictions before 2026-06-13
    const resolved = await resolvePredictions(clientId, '2026-06-13');
    expect(resolved).toBeDefined();
    expect(resolved.length).toBeGreaterThan(0);

    const resolvedRecord = resolved.find(p => p.trend === 'rise-trend');
    expect(resolvedRecord).toBeDefined();
    expect(resolvedRecord.status).toBe('correct');
    expect(resolvedRecord.resolved_at).toBeDefined();
    expect(resolvedRecord.resolved_at).not.toBeNull();

    // Verify incorrect prediction
    const incorrectTrend = 'incorrect-trend';
    const hashVal2 = crypto.createHash('sha256').update('incorrect-trend:' + date).digest('hex');
    const lastChar2 = hashVal2.slice(-1);
    const modVal2 = parseInt(lastChar2, 16) % 2;
    const actualOutcome2 = modVal2 === 0 ? 'rise' : 'fall';
    const predictedWrong = actualOutcome2 === 'rise' ? 'fall' : 'rise';

    await recordPrediction(clientId, incorrectTrend, predictedWrong, date);
    const resolved2 = await resolvePredictions(clientId, '2026-06-13');
    const resolvedRecord2 = resolved2.find(p => p.trend === 'incorrect-trend');
    expect(resolvedRecord2).toBeDefined();
    expect(resolvedRecord2.status).toBe('incorrect');
  });

  test('4. getPredictionBonus returns correct bonus capability', async () => {
    expect(typeof getPredictionBonus).toBe('function');

    const clientId = 'test-client-bonus';
    const date = '2026-06-10';
    
    const t1 = 'trend-bonus-1';
    const hash1 = crypto.createHash('sha256').update('trend-bonus-1:' + date).digest('hex');
    const outcome1 = parseInt(hash1.slice(-1), 16) % 2 === 0 ? 'rise' : 'fall';
    await recordPrediction(clientId, t1, outcome1, date);

    const t2 = 'trend-bonus-2';
    const hash2 = crypto.createHash('sha256').update('trend-bonus-2:' + date).digest('hex');
    const outcome2 = parseInt(hash2.slice(-1), 16) % 2 === 0 ? 'rise' : 'fall';
    await recordPrediction(clientId, t2, outcome2, date);

    await resolvePredictions(clientId, '2026-06-13');

    const bonus = await getPredictionBonus(clientId);
    expect(bonus).toBe(6);
  });

  // =========================================================================
  // [AC-2] Backend Route Handlers
  // =========================================================================
  test('5. POST /api/predict parameter validation and recording', async ({ request }) => {
    // Missing client ID
    const res1 = await request.post('/api/predict', {
      data: { trend: 'Google Gemini', prediction: 'rise', localDate: '2026-06-13' }
    });
    expect(res1.status()).toBe(400);

    // Invalid prediction value
    const res2 = await request.post('/api/predict', {
      data: { clientId: 'test-client', trend: 'Google Gemini', prediction: 'maybe', localDate: '2026-06-13' }
    });
    expect(res2.status()).toBe(400);

    // Valid parameters
    const res3 = await request.post('/api/predict', {
      data: { clientId: 'test-client-api', trend: 'Google Gemini', prediction: 'rise', localDate: '2026-06-13' }
    });
    expect(res3.status()).toBe(200);
    const body3 = await res3.json();
    expect(body3.success).toBe(true);
  });

  test('6. GET /api/predictions retrieves client predictions list', async ({ request }) => {
    const res = await request.get('/api/predictions?clientId=test-client-api');
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body.some(p => p.trend === 'google gemini')).toBe(true);
  });

  test('7. /api/chat-limit, /api/trivia/score, and /api/chat include predictionBonus in allowedLimit', async ({ request }) => {
    const clientId = 'test-client-limit-formulas';

    // Clean up database state for this client to ensure a pristine start
    const db = new DatabaseSync(dbPath);
    try {
      db.prepare('DELETE FROM client_predictions WHERE client_id = ?').run(clientId);
      db.prepare('DELETE FROM client_streaks WHERE client_id = ?').run(clientId);
      db.prepare('DELETE FROM client_trivia_scores WHERE client_id = ?').run(clientId);
    } catch (e) {
      console.warn('Could not clean up database for Test 7:', e.message);
    } finally {
      db.close();
    }

    const resLimitInitial = await request.get(`/api/chat-limit?clientId=${clientId}&trend=Google%20Gemini`);
    expect(resLimitInitial.status()).toBe(200);
    const initialBody = await resLimitInitial.json();
    const initialAllowed = initialBody.allowedLimit;

    const date = '2026-06-11';
    const trend = 'limit-formula-trend';
    const hash = crypto.createHash('sha256').update('limit-formula-trend:' + date).digest('hex');
    const outcome = parseInt(hash.slice(-1), 16) % 2 === 0 ? 'rise' : 'fall';
    await recordPrediction(clientId, trend, outcome, date);

    const resLimitResolve = await request.get(`/api/chat-limit?clientId=${clientId}&trend=Google%20Gemini&localDate=2026-06-13`);
    expect(resLimitResolve.status()).toBe(200);
    const resolveBody = await resLimitResolve.json();
    expect(resolveBody.newlyResolvedPredictions).toBeDefined();
    expect(resolveBody.newlyResolvedPredictions.length).toBeGreaterThan(0);
    expect(resolveBody.predictionBonus).toBe(3);

    const expectedNewAllowed = initialAllowed + 3 + (resolveBody.streakBonus || 0);
    expect(resolveBody.allowedLimit).toBe(expectedNewAllowed);

    const resTrivia = await request.post('/api/trivia/score', {
      data: { clientId, trend: 'Google Gemini', score: 3 }
    });
    expect(resTrivia.status()).toBe(200);
    const triviaBody = await resTrivia.json();
    expect(triviaBody.allowedLimit).toBe(expectedNewAllowed + 5);
  });

  // =========================================================================
  // [AC-3] Trend Predictor UI Card
  // =========================================================================
  test('8. UI Prediction Card presence and elements', async ({ page }) => {
    await page.goto('/');

    const card = page.locator('#prediction-card-container');
    await expect(card).toBeVisible();

    const riseBtn = card.locator('.btn-predict-rise');
    const fallBtn = card.locator('.btn-predict-fall');
    await expect(riseBtn).toBeVisible();
    await expect(fallBtn).toBeVisible();

    const pointsBadge = card.locator('#prediction-points-badge');
    await expect(pointsBadge).toBeVisible();
    await expect(pointsBadge.locator('#prediction-correct-count')).toBeVisible();

    const historyList = card.locator('.prediction-history, #prediction-history-list');
    await expect(historyList).toBeDefined();
  });

  test('9. UI Prediction Card handles today\'s predictions correctly', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');

    const card = page.locator('#prediction-card-container');
    const riseBtn = card.locator('.btn-predict-rise');
    const fallBtn = card.locator('.btn-predict-fall');

    await riseBtn.click();

    await expect(riseBtn).toBeDisabled();
    await expect(fallBtn).toBeDisabled();
    await expect(card).toContainText(/you predicted this trend will rise tomorrow/i);
  });

  // =========================================================================
  // [AC-4] Celebratory Toast & Immediate Synchronization
  // =========================================================================
  test('10. Lock prediction triggers immediate un-awaited sync & toast triggers on resolved reward', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });

    let chatLimitCalled = false;
    await page.route('**/api/chat-limit*', async (route) => {
      chatLimitCalled = true;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          allowedLimit: 9,
          currentCount: 0,
          limitReached: false,
          newlyResolvedPredictions: [
            { trend: 'mock-trend-toast', prediction: 'rise', status: 'correct' }
          ],
          predictionBonus: 3
        })
      });
    });

    await page.goto('/');

    const card = page.locator('#prediction-card-container');
    const riseBtn = card.locator('.btn-predict-rise');
    
    chatLimitCalled = false;
    await riseBtn.click();

    expect(chatLimitCalled).toBe(true);

    const toast = page.locator('.unlock-toast, .toast-notification');
    await expect(toast).toBeVisible();
    await expect(toast).toContainText(/capacity unlocked/i);
    await expect(toast).toContainText(/\+3/);
  });

  // =========================================================================
  // [AC-5] Shareable Canvas Prediction Card
  // =========================================================================
  test('11. Shareable Canvas Card rendering and download', async ({ page }) => {
    await page.goto('/');

    const card = page.locator('#prediction-card-container');
    const downloadBtn = card.locator('#btn-download-prediction-card');
    await expect(downloadBtn).toBeVisible();

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      downloadBtn.click()
    ]);

    expect(download.suggestedFilename()).toContain('prediction-card-');
    expect(download.suggestedFilename()).toContain('.png');
  });

  // =========================================================================
  // [AC-6] Unified Share Preview Integration
  // =========================================================================
  test('12. Unified Share Preview dropdown option and post generation', async ({ page }) => {
    await page.goto('/');

    await page.locator('#btn-share-trend').click();
    await expect(page.locator('#share-modal')).toBeVisible();

    const dropdown = page.locator('#share-context-select, .share-context-dropdown');
    await expect(dropdown).toBeVisible();

    await dropdown.selectOption('prediction');

    let generatePostPayload = null;
    await page.route('**/api/generate-post', async (route) => {
      generatePostPayload = route.request().postDataJSON();
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          postText: `I just predicted that Google Gemini will Keep Rising 📈 tomorrow! Join me on TrendJacker!`
        })
      });
    });

    await page.locator('.platform-pill[data-platform="x"]').click();

    expect(generatePostPayload).toBeDefined();
    expect(generatePostPayload.contextType || generatePostPayload.context).toBe('prediction');

    const previewText = page.locator('.preview-post-text, [data-testid="preview-post-text"]');
    await expect(previewText).toContainText(/predicted/i);
    await expect(previewText).toContainText(/Keep Rising 📈/i);
  });
});
