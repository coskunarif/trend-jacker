import { test, expect } from '@playwright/test';
import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.resolve(__dirname, '../polls.db');

test.describe('Daily Streaks & Trivia Rewards Gamification', () => {
  const clientId = `test-client-streaks-${Date.now()}`;
  const trend = 'Google Gemini';

  test.beforeEach(async () => {
    const db = new DatabaseSync(dbPath);
    db.exec('PRAGMA busy_timeout = 5000;');
    db.exec('PRAGMA journal_mode = WAL;');
    try {
      db.prepare('DELETE FROM client_streaks WHERE client_id = ?').run(clientId);
    } catch (e) {
      // client_streaks table might not exist yet, which is expected to fail AC-1 initially
    }
    try {
      db.prepare('DELETE FROM client_trivia_scores WHERE client_id = ?').run(clientId);
      db.prepare('DELETE FROM client_chat_counts WHERE client_id = ?').run(clientId);
      db.prepare('DELETE FROM client_referrals WHERE client_id = ?').run(clientId);
    } catch (e) {
      // Ignore
    } finally {
      db.close();
    }
  });

  // ==========================================
  // [AC-1] SQLite/Firestore Streak Persistence & Helpers
  // ==========================================
  test.describe('[AC-1] SQLite/Firestore Streak Persistence & Helpers', () => {
    
    // AC-1: Verify client_streaks table schema
    test('should verify client_streaks table exists with correct columns', async () => {
      const db = new DatabaseSync(dbPath);
      db.exec('PRAGMA busy_timeout = 5000;');
      db.exec('PRAGMA journal_mode = WAL;');
      try {
        const stmt = db.prepare(`
          SELECT sql FROM sqlite_master 
          WHERE type = 'table' AND name = 'client_streaks'
        `);
        const row = stmt.get();
        expect(row).toBeDefined();
        expect(row.sql).toContain('client_id TEXT PRIMARY KEY');
        expect(row.sql).toContain('streak_count INTEGER');
        expect(row.sql).toContain('last_active_date TEXT');
      } finally {
        db.close();
      }
    });

    // AC-1: Verify updateClientStreak and getClientStreak logic and normalization
    test('should verify updateClientStreak and getClientStreak logic and normalization', async () => {
      const dbModule = await import('../db.js');
      expect(dbModule.updateClientStreak).toBeDefined();
      expect(dbModule.getClientStreak).toBeDefined();

      const { updateClientStreak, getClientStreak } = dbModule;

      const messyClientId = `  Client-Streak-Test-${Date.now()}  `;
      const normalizedClientId = messyClientId.trim().toLowerCase();

      // Initially no record
      const initial = await getClientStreak(messyClientId);
      expect(initial).toBeNull();

      // 1. Initial streak insertion (day 0)
      const date1 = '2026-06-13';
      await updateClientStreak(messyClientId, date1);
      const streak1 = await getClientStreak(normalizedClientId);
      expect(streak1).toBeDefined();
      expect(streak1.streak_count).toBe(1);
      expect(streak1.last_active_date).toBe(date1);

      // 2. Same day update (diff === 0) -> streak_count remains 1
      await updateClientStreak(messyClientId, date1);
      const streakSameDay = await getClientStreak(normalizedClientId);
      expect(streakSameDay.streak_count).toBe(1);
      expect(streakSameDay.last_active_date).toBe(date1);

      // 3. Next day update (diff === 1) -> streak_count increments to 2
      const date2 = '2026-06-14';
      await updateClientStreak(messyClientId, date2);
      const streakNextDay = await getClientStreak(normalizedClientId);
      expect(streakNextDay.streak_count).toBe(2);
      expect(streakNextDay.last_active_date).toBe(date2);

      // 4. Gap day update (diff === 2) -> streak_count resets to 1
      const date3 = '2026-06-16';
      await updateClientStreak(messyClientId, date3);
      const streakGapDay = await getClientStreak(normalizedClientId);
      expect(streakGapDay.streak_count).toBe(1);
      expect(streakGapDay.last_active_date).toBe(date3);

      // 5. Past day update (diff === -2) -> streak_count resets to 1
      const date4 = '2026-06-14';
      await updateClientStreak(messyClientId, date4);
      const streakPastDay = await getClientStreak(normalizedClientId);
      expect(streakPastDay.streak_count).toBe(1);
      expect(streakPastDay.last_active_date).toBe(date4);
    });

    // AC-1: Verify in-memory fallback Map exists and functions
    test('should verify in-memory fallback Map exists and functions when db is not used', async () => {
      const dbModule = await import('../db.js');
      expect(dbModule.inMemoryClientStreaks).toBeDefined();
      expect(dbModule.inMemoryClientStreaks).toBeInstanceOf(Map);
    });

    // AC-1: Adversarial test cases: null/empty/whitespace client IDs and case normalization on update/get
    test('should handle edge cases, empty/whitespace IDs, and case normalization on update/get', async () => {
      const dbModule = await import('../db.js');
      const { updateClientStreak, getClientStreak } = dbModule;

      const clientIdMixed = '  My-WeIrD-ClIeNt-123  ';
      const clientIdNormalized = 'my-weird-client-123';
      
      await updateClientStreak(clientIdMixed, '2026-06-13');
      const streakObj = await getClientStreak(clientIdNormalized);
      expect(streakObj).toBeDefined();
      expect(streakObj.client_id).toBe(clientIdNormalized);
      expect(streakObj.streak_count).toBe(1);

      const streakObjMixed = await getClientStreak(' MY-weIRD-clIENT-123 ');
      expect(streakObjMixed).toBeDefined();
      expect(streakObjMixed.client_id).toBe(clientIdNormalized);
      expect(streakObjMixed.streak_count).toBe(1);

      const emptyStreak = await getClientStreak(null);
      expect(emptyStreak).toBeNull();

      await updateClientStreak(null, '2026-06-13');
      const emptyUpdated = await getClientStreak('');
      expect(emptyUpdated).toBeDefined();
      expect(emptyUpdated.client_id).toBe('');
      expect(emptyUpdated.streak_count).toBe(1);
    });

    // AC-1: Adversarial test cases: malformed or out-of-order date strings
    test('should handle malformed or out-of-order date strings gracefully', async () => {
      const dbModule = await import('../db.js');
      const { updateClientStreak, getClientStreak } = dbModule;
      const tempClientId = `temp-date-test-${Date.now()}`;

      await updateClientStreak(tempClientId, '2026-06-13');
      let streak = await getClientStreak(tempClientId);
      expect(streak.streak_count).toBe(1);

      // Malformed date string (does not match YYYY-MM-DD but is string)
      await updateClientStreak(tempClientId, 'not-a-date');
      streak = await getClientStreak(tempClientId);
      expect(streak.streak_count).toBe(1);

      // Reset to 1 on out-of-order/past date
      await updateClientStreak(tempClientId, '2026-06-13');
      await updateClientStreak(tempClientId, '2026-06-14');
      streak = await getClientStreak(tempClientId);
      expect(streak.streak_count).toBe(2);

      await updateClientStreak(tempClientId, '2026-06-13');
      streak = await getClientStreak(tempClientId);
      expect(streak.streak_count).toBe(1);
    });
  });

  // ==========================================
  // [AC-2] Backend API & Chat Limit Logic Integration
  // ==========================================
  test.describe('[AC-2] Backend API & Chat Limit Logic Integration', () => {
    
    // AC-2: Calculate allowedLimit with streak bonus via GET /api/chat-limit
    test('should calculate allowedLimit with streak bonus via GET /api/chat-limit', async ({ request }) => {
      const res1 = await request.get(`/api/chat-limit?clientId=${clientId}&trend=${trend}`);
      expect(res1.status()).toBe(200);
      const data1 = await res1.json();
      expect(data1.streakCount).toBe(0);
      expect(data1.streakBonus).toBe(0);
      expect(data1.allowedLimit).toBe(3);

      const res2 = await request.get(`/api/chat-limit?clientId=${clientId}&trend=${trend}&localDate=2026-06-13`);
      expect(res2.status()).toBe(200);
      const data2 = await res2.json();
      expect(data2.streakCount).toBe(1);
      expect(data2.streakBonus).toBe(2);
      expect(data2.allowedLimit).toBe(5);

      const res3 = await request.get(`/api/chat-limit?clientId=${clientId}&trend=${trend}&localDate=2026-06-14`);
      expect(res3.status()).toBe(200);
      const data3 = await res3.json();
      expect(data3.streakCount).toBe(2);
      expect(data3.streakBonus).toBe(4);
      expect(data3.allowedLimit).toBe(7);
    });

    // AC-2: Verify capacity formula is used in POST /api/trivia/score and POST /api/chat
    test('should verify capacity formula is used in POST /api/trivia/score and POST /api/chat', async ({ request }) => {
      await request.get(`/api/chat-limit?clientId=${clientId}&trend=${trend}&localDate=2026-06-13`);
      await request.get(`/api/chat-limit?clientId=${clientId}&trend=${trend}&localDate=2026-06-14`);

      const triviaRes = await request.post('/api/trivia/score', {
        data: { clientId, trend, score: 2 }
      });
      expect(triviaRes.status()).toBe(200);
      const triviaData = await triviaRes.json();
      expect(triviaData.allowedLimit).toBe(10);

      for (let i = 0; i < 10; i++) {
        const chatRes = await request.post('/api/chat', {
          headers: { 'x-enforce-limits': 'true' },
          data: { trend, query: `Query ${i}`, history: [], clientId }
        });
        expect(chatRes.status()).toBe(200);
      }

      const chatRes11 = await request.post('/api/chat', {
        headers: { 'x-enforce-limits': 'true' },
        data: { trend, query: `Query 11`, history: [], clientId }
      });
      expect(chatRes11.status()).toBe(403);
      const chatData11 = await chatRes11.json();
      expect(chatData11.error).toBe('limit_reached');
      expect(chatData11.allowedLimit).toBe(10);
    });

    // AC-2: Missing query params on GET /api/chat-limit returns 400 Bad Request
    test('should return 400 Bad Request if clientId or trend is missing on GET /api/chat-limit', async ({ request }) => {
      const res1 = await request.get('/api/chat-limit');
      expect(res1.status()).toBe(400);

      const res2 = await request.get(`/api/chat-limit?clientId=${clientId}`);
      expect(res2.status()).toBe(400);

      const res3 = await request.get(`/api/chat-limit?trend=${trend}`);
      expect(res3.status()).toBe(400);
    });

    // AC-2: Missing parameters on POST /api/trivia/score returns 400 Bad Request
    test('should return 400 Bad Request if parameters are missing on POST /api/trivia/score', async ({ request }) => {
      const res1 = await request.post('/api/trivia/score', { data: {} });
      expect(res1.status()).toBe(400);

      const res2 = await request.post('/api/trivia/score', { data: { clientId } });
      expect(res2.status()).toBe(400);

      const res3 = await request.post('/api/trivia/score', { data: { clientId, trend } });
      expect(res3.status()).toBe(400);
    });

    // AC-2: Mixed-case/whitespace ID normalization verification via /api/chat-limit
    test('should normalize clientId case and trim whitespaces in GET /api/chat-limit', async ({ request }) => {
      const mixedId = '  My-Weird-Client-ID-AC2  ';
      const normalizedId = 'my-weird-client-id-ac2';

      const res = await request.get(`/api/chat-limit?clientId=${mixedId}&trend=${trend}&localDate=2026-06-13`);
      expect(res.status()).toBe(200);
      const data = await res.json();
      expect(data.streakCount).toBe(1);

      const dbModule = await import('../db.js');
      const streak = await dbModule.getClientStreak(normalizedId);
      expect(streak).toBeDefined();
      expect(streak.streak_count).toBe(1);
    });
  });

  // ==========================================
  // [AC-3] Chat Capacity Progress Bar UI
  // ==========================================
  test.describe('[AC-3] Chat Capacity Progress Bar UI', () => {
    
    // AC-3: Display progress bar elements and correct color-coding based on capacity
    test('should display progress bar elements and correct color-coding based on capacity', async ({ page }) => {
      // Case A: < 50% messages used (1/4 -> 25%) => emerald green (#10b981)
      await page.route('**/api/chat-limit*', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            limitReached: false,
            currentCount: 1,
            allowedLimit: 4,
            streakCount: 1,
            streakBonus: 2
          })
        });
      });

      const responsePromiseA = page.waitForResponse('**/api/chat-limit*');
      await page.goto('/');
      await page.locator('.trend-item').first().click();
      await responsePromiseA;

      const capBar = page.locator('#chat-capacity-bar');
      const capFill = page.locator('#chat-capacity-fill');
      const capText = page.locator('#chat-capacity-text');

      await expect(capBar).toBeVisible();
      await expect(capFill).toBeVisible();
      await expect(capText).toBeVisible();

      await expect(capText).toHaveText('Message Capacity: 1 / 4');
      await expect(capFill).toHaveCSS('background-color', 'rgb(16, 185, 129)');

      // Case B: 50% - 80% messages used (2/4 -> 50%) => amber/orange (#f59e0b)
      await page.route('**/api/chat-limit*', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            limitReached: false,
            currentCount: 2,
            allowedLimit: 4,
            streakCount: 1,
            streakBonus: 2
          })
        });
      });
      const responsePromiseB = page.waitForResponse('**/api/chat-limit*');
      await page.reload();
      await page.locator('.trend-item').first().click();
      await responsePromiseB;
      await expect(capText).toHaveText('Message Capacity: 2 / 4');
      await expect(capFill).toHaveCSS('background-color', 'rgb(245, 158, 11)');

      // Case C: > 80% messages used (4/4 -> 100%) => rose/red (#ef4444)
      await page.route('**/api/chat-limit*', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            limitReached: true,
            currentCount: 4,
            allowedLimit: 4,
            streakCount: 1,
            streakBonus: 2
          })
        });
      });
      const responsePromiseC = page.waitForResponse('**/api/chat-limit*');
      await page.reload();
      await page.locator('.trend-item').first().click();
      await responsePromiseC;
      await expect(capText).toHaveText('Message Capacity: 4 / 4');
      await expect(capFill).toHaveCSS('background-color', 'rgb(239, 68, 68)');
    });
  });

  // ==========================================
  // [AC-4] Dynamic Daily Streak UI Badge
  // ==========================================
  test.describe('[AC-4] Dynamic Daily Streak UI Badge', () => {
    
    // AC-4: Show pulsing badge for active streak and style inactive when 0
    test('should show pulsing badge for active streak and style inactive when 0', async ({ page }) => {
      // 1. Mock active streak
      await page.route('**/api/chat-limit*', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            limitReached: false,
            currentCount: 0,
            allowedLimit: 5,
            streakCount: 3,
            streakBonus: 6
          })
        });
      });

      const responsePromiseActive = page.waitForResponse('**/api/chat-limit*');
      await page.goto('/');
      await page.locator('.trend-item').first().click();
      await responsePromiseActive;

      const streakBadge = page.locator('#streak-badge-container');
      await expect(streakBadge).toBeVisible();
      await expect(streakBadge).toContainText('🔥');
      await expect(streakBadge).toContainText('3-Day Streak');
      await expect(streakBadge).toContainText('+6 capacity');

      await expect(streakBadge).toHaveCSS('animation', /pulse-streak/);

      // 2. Mock inactive streak (streak count is 0)
      await page.route('**/api/chat-limit*', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            limitReached: false,
            currentCount: 0,
            allowedLimit: 3,
            streakCount: 0,
            streakBonus: 0
          })
        });
      });
      const responsePromiseInactive = page.waitForResponse('**/api/chat-limit*');
      await page.reload();
      await page.locator('.trend-item').first().click();
      await responsePromiseInactive;

      await expect(async () => {
        const isHidden = await streakBadge.isHidden();
        const opacity = await streakBadge.evaluate(el => window.getComputedStyle(el).opacity);
        expect(isHidden || parseFloat(opacity) < 0.5).toBe(true);
      }).toPass();
    });
  });

  // ==========================================
  // [AC-5] Lock Screen Streak Retention CTA
  // ==========================================
  test.describe('[AC-5] Lock Screen Streak Retention CTA', () => {
    
    // AC-5: Display next streak rewards in retention CTA when locked
    test('should display next streak rewards in retention CTA when locked', async ({ page }) => {
      await page.route('**/api/chat-limit*', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            limitReached: true,
            currentCount: 9,
            allowedLimit: 9,
            streakCount: 3,
            streakBonus: 6
          })
        });
      });

      const responsePromise = page.waitForResponse('**/api/chat-limit*');
      await page.goto('/');
      await page.locator('.trend-item').first().click();
      await responsePromise;

      const lockContainer = page.locator('#chat-lock-container');
      await expect(lockContainer).toBeVisible();

      const expectedPrompt = 'Come back tomorrow to keep your 🔥 4-Day streak alive and unlock +8 messages!';
      await expect(lockContainer).toContainText(expectedPrompt);
    });
  });

  // ==========================================
  // [AC-6] Smooth Unlock Transition & Celebratory Toast
  // ==========================================
  test.describe('[AC-6] Smooth Unlock Transition & Celebratory Toast', () => {
    
    // AC-6: Trigger smooth transitions and display celebratory toast when unlocked
    test('should trigger smooth transitions and display celebratory toast when unlocked', async ({ page }) => {
      let limitReached = true;
      let allowedLimit = 3;
      await page.route('**/api/chat-limit*', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            limitReached,
            currentCount: 3,
            allowedLimit,
            streakCount: 0,
            streakBonus: 0
          })
        });
      });

      await page.route('**/api/trivia/score', async (route) => {
        limitReached = false;
        allowedLimit = 8;
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            allowedLimit: 8,
            currentCount: 3,
            limitReached: false,
            rewardCount: 5
          })
        });
      });

      const mockTriviaResponse = [
        { question: 'Q1', options: ['A', 'B', 'C'], answer: 'B' },
        { question: 'Q2', options: ['A', 'B', 'C'], answer: 'C' },
        { question: 'Q3', options: ['A', 'B', 'C'], answer: 'B' }
      ];
      await page.route('**/api/trivia/questions*', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockTriviaResponse)
        });
      });

      const responsePromise1 = page.waitForResponse('**/api/chat-limit*');
      await page.goto('/');
      await page.locator('.trend-item').first().click();
      await responsePromise1;

      const lockContainer = page.locator('#chat-lock-container');
      const chatForm = page.locator('#chat-form');

      await expect(lockContainer).toBeVisible();
      await expect(chatForm).toBeHidden();

      await lockContainer.locator('#chat-lock-play-trivia-btn').click();
      await page.locator('#btn-start-trivia').click();

      const gameplayScreen = page.locator('.trivia-gameplay-screen');
      const options = gameplayScreen.locator('.trivia-option-btn');
      const nextBtn = gameplayScreen.locator('.trivia-nav-btn');

      await options.nth(1).click();
      await nextBtn.click();
      await options.nth(2).click();
      await nextBtn.click();
      
      const responsePromise2 = page.waitForResponse('**/api/trivia/score');
      await options.nth(1).click();
      await nextBtn.click();
      await responsePromise2;

      await expect(page.locator('.trivia-results-screen')).toBeVisible();

      await expect(async () => {
        const lockOpacity = await lockContainer.evaluate(el => window.getComputedStyle(el).opacity);
        const formOpacity = await chatForm.evaluate(el => window.getComputedStyle(el).opacity);
        expect(parseFloat(lockOpacity)).toBe(0);
        expect(parseFloat(formOpacity)).toBe(1);
      }).toPass();

      const toast = page.locator('#chat-unlock-toast');
      await expect(toast).toBeVisible();
      await expect(toast).toHaveText('Capacity Unlocked! +5 messages available.');

      await expect(async () => {
        const isHidden = await toast.isHidden();
        expect(isHidden).toBe(true);
      }).toPass({ timeout: 4000 });
    });
  });
});
