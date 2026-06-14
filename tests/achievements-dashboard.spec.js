import { test, expect } from '@playwright/test';
import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.resolve(__dirname, '../polls.db');

test.describe('Achievements Dashboard Spec Verification Tests', () => {
  const clientId = `test-client-achievements-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;

  test.beforeEach(async () => {
    const db = new DatabaseSync(dbPath);
    db.exec('PRAGMA busy_timeout = 5000;');
    db.exec('PRAGMA journal_mode = WAL;');
    try {
      db.prepare('DELETE FROM client_streaks WHERE client_id = ?').run(clientId);
      db.prepare('DELETE FROM client_trivia_scores WHERE client_id = ?').run(clientId);
      db.prepare('DELETE FROM client_predictions WHERE client_id = ?').run(clientId);
      db.prepare('DELETE FROM client_referrals WHERE client_id = ?').run(clientId);
    } catch (e) {
      // Ignore
    } finally {
      db.close();
    }
  });

  // =========================================================================
  // [AC-1] Toggleable Achievements Dashboard View
  // =========================================================================
  test('[AC-1] Toggle achievements view with navbar/sidebar and exit via trend list click', async ({ page }) => {
    await page.goto('/');

    const btnShowAchievements = page.locator('#btn-show-achievements');
    const sidebarShowAchievements = page.locator('#sidebar-show-achievements');
    const achievementsView = page.locator('#achievements-view');
    const explainerView = page.locator('#explainer-view');

    // Initially achievements dashboard should be hidden, explainer should be visible or default state
    await expect(achievementsView).toBeHidden();

    // Click navbar button -> toggles view synchronously
    await btnShowAchievements.click();
    await expect(achievementsView).toBeVisible();
    await expect(explainerView).toBeHidden();

    // Click trend item in left sidebar -> exits dashboard back to explainer view
    const firstTrend = page.locator('#trends-list .trend-item').first();
    await firstTrend.click();
    await expect(achievementsView).toBeHidden();

    // Click sidebar link -> shows achievements again
    await sidebarShowAchievements.click();
    await expect(achievementsView).toBeVisible();
    await expect(explainerView).toBeHidden();
  });

  test('[AC-1] Achievements layout is responsive and prevents scrollbar duplication', async ({ page }) => {
    await page.goto('/');
    await page.locator('#btn-show-achievements').click();
    const achievementsView = page.locator('#achievements-view');

    // Desktop view layout
    await page.setViewportSize({ width: 1280, height: 800 });
    await expect(achievementsView).toHaveCSS('overflow', 'hidden');
    
    // Responsive grid structure (e.g. inner scrollable wrapper vs outer panel)
    const innerScrollable = achievementsView.locator('.achievements-scrollable-container, .achievements-inner-container').first();
    await expect(innerScrollable).toBeVisible();
    await expect(innerScrollable).toHaveCSS('overflow-y', 'auto');

    // Mobile viewport stacking layout
    await page.setViewportSize({ width: 375, height: 667 });
    const statsGrid = page.locator('.achievements-stats-grid');
    await expect(statsGrid).toHaveCSS('grid-template-columns', /1fr/);
  });

  // =========================================================================
  // [AC-2] Unified Stats Room Grid
  // =========================================================================
  test('[AC-2] Render stats room grid cards with correct metrics, capacity bonuses, and formatting', async ({ page }) => {
    // Mock API fetch to return specific achievements stats
    await page.route('**/api/achievements*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          streak: { count: 3, bonus: 6 },
          trivia: { count: 5, averageScore: 2.4, maxScore: 3 },
          predictions: { correct: 4, total: 8, accuracy: 50, incorrect: 4, pending: 0 },
          referrals: { count: 2, bonus: 10 },
          history: []
        })
      });
    });

    await page.goto('/');
    await page.locator('#btn-show-achievements').click();

    const statsGrid = page.locator('.achievements-stats-grid');
    await expect(statsGrid).toBeVisible();

    // 1. Streak Card
    const streakCard = statsGrid.locator('.stats-card').filter({ hasText: /Streak/ });
    await expect(streakCard).toContainText('🔥');
    await expect(streakCard).toContainText('3-Day Streak');
    await expect(streakCard).toContainText('+6');

    // 2. Trivia Card
    const triviaCard = statsGrid.locator('.stats-card').filter({ hasText: /Trivia/ });
    await expect(triviaCard).toContainText('5');
    await expect(triviaCard).toContainText('2.4');

    // 3. Predictions Card
    const predictionsCard = statsGrid.locator('.stats-card').filter({ hasText: /Prediction/ });
    await expect(predictionsCard).toContainText('4');
    await expect(predictionsCard).toContainText('8');
    await expect(predictionsCard).toContainText('50%');

    // 4. Referrals Card
    const referralsCard = statsGrid.locator('.stats-card').filter({ hasText: /Referral/ });
    await expect(referralsCard).toContainText('2');
    await expect(referralsCard).toContainText('+10');
  });

  // =========================================================================
  // [AC-3] Interactive Badges Gallery
  // =========================================================================
  test('[AC-3] Badges gallery renders exactly 9 cards with correct lock/unlock status', async ({ page }) => {
    // Mock achievements payload
    await page.route('**/api/achievements*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          streak: { count: 2, bonus: 4 },
          trivia: { count: 1, averageScore: 2.0, maxScore: 2 },
          predictions: { correct: 1, total: 1, accuracy: 100, incorrect: 0, pending: 0 },
          referrals: { count: 0, bonus: 0 },
          history: []
        })
      });
    });

    await page.goto('/');
    await page.locator('#btn-show-achievements').click();

    const galleryGrid = page.locator('.badges-gallery-grid');
    await expect(galleryGrid).toBeVisible();

    const badges = galleryGrid.locator('.badge-card');
    await expect(badges).toHaveCount(9);

    // Explorer (activity > 0) -> Unlocked
    const explorerBadge = badges.filter({ hasText: 'Explorer' });
    await expect(explorerBadge).toHaveClass(/unlocked/);
    await expect(explorerBadge).not.toHaveClass(/locked/);
    await expect(explorerBadge).not.toHaveCSS('opacity', '0.4');

    // Streak Starter (streak >= 1) -> Unlocked
    const starterBadge = badges.filter({ hasText: 'Streak Starter' });
    await expect(starterBadge).toHaveClass(/unlocked/);

    // Consistent Reader (streak >= 3, mock has 2) -> Locked
    const consistentBadge = badges.filter({ hasText: 'Consistent Reader' });
    await expect(consistentBadge).toHaveClass(/locked/);
    await expect(consistentBadge).toHaveCSS('opacity', '0.4');
    await expect(consistentBadge).toContainText('🔒');

    // Weekly Legend (streak >= 7, mock has 2) -> Locked
    const legendBadge = badges.filter({ hasText: 'Weekly Legend' });
    await expect(legendBadge).toHaveClass(/locked/);

    // Sharp Challenger (max score >= 2, mock has 2) -> Unlocked
    const sharpBadge = badges.filter({ hasText: 'Sharp Challenger' });
    await expect(sharpBadge).toHaveClass(/unlocked/);

    // Brainiac Mastermind (max score = 3, mock has 2) -> Locked
    const brainiacBadge = badges.filter({ hasText: 'Brainiac Mastermind' });
    await expect(brainiacBadge).toHaveClass(/locked/);

    // Apprentice Oracle (predictions >= 1, mock has 1) -> Unlocked
    const apprenticeBadge = badges.filter({ hasText: 'Apprentice Oracle' });
    await expect(apprenticeBadge).toHaveClass(/unlocked/);

    // Ultimate Seer (correct predictions >= 3, mock has 1) -> Locked
    const seerBadge = badges.filter({ hasText: 'Ultimate Seer' });
    await expect(seerBadge).toHaveClass(/locked/);

    // Viral Pioneer (referrals >= 1, mock has 0) -> Locked
    const pioneerBadge = badges.filter({ hasText: 'Viral Pioneer' });
    await expect(pioneerBadge).toHaveClass(/locked/);
  });

  // =========================================================================
  // [AC-4] Unified Activity History Log
  // =========================================================================
  test('[AC-4] History log renders messages in reverse chronological order or shows empty state fallback', async ({ page }) => {
    // 1. Verify fallback empty text
    await page.route('**/api/achievements*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          streak: { count: 0, bonus: 0 },
          trivia: { count: 0, averageScore: 0, maxScore: 0 },
          predictions: { correct: 0, total: 0, accuracy: 0, incorrect: 0, pending: 0 },
          referrals: { count: 0, bonus: 0 },
          history: []
        })
      });
    });

    await page.goto('/');
    await page.locator('#btn-show-achievements').click();

    const historyContainer = page.locator('.achievements-history-list');
    await expect(historyContainer).toContainText('No achievements recorded yet. View a trend to start your journey!');

    // 2. Verify populated history list format
    await page.route('**/api/achievements*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          streak: { count: 1, bonus: 2 },
          trivia: { count: 1, averageScore: 3, maxScore: 3 },
          predictions: { correct: 1, total: 1, accuracy: 100, incorrect: 0, pending: 0 },
          referrals: { count: 0, bonus: 0 },
          history: [
            {
              type: 'trivia',
              trend: 'Google Gemini',
              score: 3,
              date: '2026-06-13T12:00:00Z'
            },
            {
              type: 'prediction',
              trend: 'OpenAI GPT-5',
              outcome: 'rise',
              status: 'correct',
              date: '2026-06-12T15:30:00Z'
            }
          ]
        })
      });
    });

    await page.reload();
    await page.locator('#btn-show-achievements').click();

    const historyItems = historyContainer.locator('.history-item');
    await expect(historyItems).toHaveCount(2);

    // Trivia format check: "Completed trivia for **[Trend]** with score [Score]/3 on [Date]"
    await expect(historyItems.nth(0)).toContainText('Completed trivia for Google Gemini with score 3/3');

    // Prediction format check: "Predicted **[Outcome]** on **[Trend]** - [Resolved Status] on [Date]"
    await expect(historyItems.nth(1)).toContainText('Predicted rise on OpenAI GPT-5 - correct');
  });

  // =========================================================================
  // [AC-5] Asynchronous Data Hydration
  // =========================================================================
  test('[AC-5] Background achievements fetch and instant refresh on action completion', async ({ page }) => {
    let achievementsCallCount = 0;

    await page.route('**/api/achievements*', async (route) => {
      achievementsCallCount++;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          streak: { count: 1, bonus: 2 },
          trivia: { count: 0, averageScore: 0, maxScore: 0 },
          predictions: { correct: 0, total: 0, accuracy: 0, incorrect: 0, pending: 0 },
          referrals: { count: 0, bonus: 0 },
          history: []
        })
      });
    });

    await page.route('**/api/trivia', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { question: "Q1", options: ["A", "B", "C"], correctAnswer: 1, explanation: "E1" }
        ])
      });
    });

    await page.route('**/api/trivia/score', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, allowedLimit: 8, currentCount: 0, limitReached: false, rewardCount: 5 })
      });
    });

    await page.goto('/');
    await page.locator('#btn-show-achievements').click();
    
    // Initial fetch should have run
    expect(achievementsCallCount).toBeGreaterThanOrEqual(1);
    const baselineCallCount = achievementsCallCount;

    // Go back to trends
    await page.locator('#trends-list .trend-item').first().click();

    // Start and complete trivia
    const container = page.locator('#trivia-card-container');
    await container.locator('#btn-start-trivia').click();
    await container.locator('.trivia-option-btn').nth(1).click();
    await container.locator('.trivia-nav-btn').click();

    // Solving trivia must trigger instant refresh of achievements in the background
    await page.waitForTimeout(500); // Give event loop small buffer to fire background request
    expect(achievementsCallCount).toBeGreaterThan(baselineCallCount);
  });

  // =========================================================================
  // [AC-6] Casing & Caching Robustness
  // =========================================================================
  test('[AC-6] Database helper getClientAchievements enforces normalized casing and handles fallback paths', async () => {
    let dbModule;
    try {
      dbModule = await import('../db.js');
    } catch (e) {
      // Ignore if db.js cannot be resolved during initial run
    }

    if (dbModule && dbModule.getClientAchievements) {
      const { getClientAchievements } = dbModule;
      expect(typeof getClientAchievements).toBe('function');

      const messyClientId = `  ClIeNt-AC6-tEsT-${Date.now()}  `;
      const normalizedClientId = messyClientId.trim().toLowerCase();

      // Seed data into SQLite
      const db = new DatabaseSync(dbPath);
      db.exec('PRAGMA busy_timeout = 5000;');
      db.exec('PRAGMA journal_mode = WAL;');
      try {
        db.prepare('INSERT INTO client_streaks (client_id, streak_count, last_active_date) VALUES (?, 4, "2026-06-13")').run(normalizedClientId);
        db.prepare('INSERT INTO client_referrals (client_id, referee_id) VALUES (?, "ref-1")').run(normalizedClientId);
      } finally {
        db.close();
      }

      // Query with messy ID
      const res = await getClientAchievements(messyClientId);
      expect(res).toBeDefined();
      expect(res.streak.count).toBe(4);
      expect(res.referrals.count).toBe(1);
    } else {
      // Fail the test if functions do not exist
      expect(dbModule).toBeDefined();
      expect(dbModule.getClientAchievements).toBeDefined();
    }
  });

  test('[AC-6] GET /api/achievements route processes casing and query validation correctly', async ({ request }) => {
    // Bad request (missing clientId)
    const badRes = await request.get('/api/achievements');
    expect(badRes.status()).toBe(400);

    // Good request with messy clientId
    const messyClientId = `  ClIeNt-Api-Normalizer-${Date.now()}  `;
    const res = await request.get(`/api/achievements?clientId=${messyClientId}`);
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body).toBeDefined();
    expect(body.streak).toBeDefined();
    expect(body.trivia).toBeDefined();
    expect(body.predictions).toBeDefined();
    expect(body.referrals).toBeDefined();
    expect(Array.isArray(body.history)).toBe(true);
  });
});
