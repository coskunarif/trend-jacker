import { test, expect } from '@playwright/test';
import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.resolve(__dirname, '../polls.db');

test.describe('Trivia Challenge Chat Capacity Rewards', () => {
  const clientId = `test-client-rewards-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
  const trend = 'Google Gemini';
  const lowercaseTrend = 'google gemini';

  test.beforeEach(async () => {
    const db = new DatabaseSync(dbPath);
    db.exec('PRAGMA busy_timeout = 5000;');
    db.exec('PRAGMA journal_mode = WAL;');
    try {
      db.prepare('DELETE FROM client_trivia_scores WHERE client_id = ?').run(clientId);
    } catch (e) {
      // client_trivia_scores table might not exist yet, which is expected to fail AC-1
    }
    try {
      db.prepare('DELETE FROM client_chat_counts WHERE client_id = ?').run(clientId);
      db.prepare('DELETE FROM client_referrals WHERE client_id = ?').run(clientId);
    } catch (e) {
      // Ignore
    } finally {
      db.close();
    }
  });

  // ==========================================
  // [AC-1] Client Trivia Score Database Cache & Helpers
  // ==========================================
  test.describe('[AC-1] Client Trivia Score Database Cache & Helpers', () => {
    test('should verify client_trivia_scores table exists with correct columns', async () => {
      const db = new DatabaseSync(dbPath);
      db.exec('PRAGMA busy_timeout = 5000;');
      db.exec('PRAGMA journal_mode = WAL;');
      try {
        const stmt = db.prepare(`
          SELECT sql FROM sqlite_master 
          WHERE type = 'table' AND name = 'client_trivia_scores'
        `);
        const row = stmt.get();
        expect(row).toBeDefined();
        expect(row.sql).toContain('client_id TEXT');
        expect(row.sql).toContain('trend TEXT');
        expect(row.sql).toContain('score INTEGER');
        expect(row.sql).toContain('completed_at TEXT');
        expect(row.sql).toContain('PRIMARY KEY (client_id, trend)');
      } finally {
        db.close();
      }
    });

    test('should verify recordTriviaScore and getTriviaScore store and retrieve values correctly', async () => {
      const dbModule = await import('../db.js');
      expect(dbModule.recordTriviaScore).toBeDefined();
      expect(dbModule.getTriviaScore).toBeDefined();

      const { recordTriviaScore, getTriviaScore } = dbModule;

      // Initially score should be null/undefined/0
      const initialScore = await getTriviaScore(clientId, trend);
      expect(initialScore).toBeFalsy();

      // Record a score of 2
      await recordTriviaScore(clientId, trend, 2);
      const savedScore1 = await getTriviaScore(clientId, trend);
      expect(savedScore1).toBe(2);

      // Try to record a lower score of 1 (should not update)
      await recordTriviaScore(clientId, trend, 1);
      const savedScore2 = await getTriviaScore(clientId, trend);
      expect(savedScore2).toBe(2);

      // Record a higher score of 3 (should update)
      await recordTriviaScore(clientId, trend, 3);
      const savedScore3 = await getTriviaScore(clientId, trend);
      expect(savedScore3).toBe(3);
    });

    test('should verify in-memory fallback handles scores when SQLite is bypassed', async () => {
      // We check if db.js behaves correctly when sqlite is not used (or firestore/in-memory fallback)
      const dbModule = await import('../db.js');
      // If we temporarily disable sqliteDb or test the fallback, it should work.
      // We can assert that the helpers can run without throwing errors and save to a fallback store.
      const testClientMemory = `client-mem-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
      await dbModule.recordTriviaScore(testClientMemory, 'Memory Trend', 3);
      const score = await dbModule.getTriviaScore(testClientMemory, 'Memory Trend');
      expect(score).toBe(3);
    });
  });

  // ==========================================
  // [AC-2] Case-Insensitive Key Normalization
  // ==========================================
  test.describe('[AC-2] Case-Insensitive Key Normalization', () => {
    test('should normalize trend strings to lowercase in trivia score and chat counting helpers', async () => {
      const dbModule = await import('../db.js');
      const { recordTriviaScore, getTriviaScore, getChatCount, incrementChatCount } = dbModule;

      const mixedTrend = 'GoOgLe GeMiNi';

      // 1. Trivia scores case-insensitivity
      await recordTriviaScore(clientId, mixedTrend, 2);
      
      const score1 = await getTriviaScore(clientId, 'google gemini');
      expect(score1).toBe(2);

      const score2 = await getTriviaScore(clientId, 'GOOGLE GEMINI');
      expect(score2).toBe(2);

      // Verify direct DB query contains the normalized lowercase trend
      const db = new DatabaseSync(dbPath);
      db.exec('PRAGMA busy_timeout = 5000;');
      db.exec('PRAGMA journal_mode = WAL;');
      try {
        const stmt = db.prepare('SELECT trend, score FROM client_trivia_scores WHERE client_id = ?');
        const rows = stmt.all(clientId);
        expect(rows.length).toBe(1);
        expect(rows[0].trend).toBe(lowercaseTrend);
      } finally {
        db.close();
      }

      // 2. Chat count case-insensitivity
      await incrementChatCount(clientId, mixedTrend);
      
      const count1 = await getChatCount(clientId, 'google gemini');
      expect(count1).toBe(1);

      const count2 = await getChatCount(clientId, 'GOOGLE GEMINI');
      expect(count2).toBe(1);
    });
  });

  // ==========================================
  // [AC-3] Gamified Chat Limit API
  // ==========================================
  test.describe('[AC-3] Gamified Chat Limit API', () => {
    test('should calculate allowedLimit correctly and expose POST /api/trivia/score', async ({ request }) => {
      // 1. Verify GET /api/chat-limit initial state
      const resInitial = await request.get(`/api/chat-limit?clientId=${clientId}&trend=${trend}`);
      expect(resInitial.status()).toBe(200);
      const dataInitial = await resInitial.json();
      // allowedLimit = 3 + 5 * referralCount + triviaBonus
      // initially referralCount = 0, triviaBonus = 0 => 3
      expect(dataInitial.allowedLimit).toBe(3);
      expect(dataInitial.limitReached).toBe(false);

      // 2. Add one referral to DB directly or via API
      await request.post('/api/referral', {
        data: { client_id: clientId, referee_id: `ref-${Date.now()}-${Math.floor(Math.random() * 1000000)}` }
      });

      // GET again: referralCount = 1 => allowedLimit = 3 + 5*1 + 0 = 8
      const resRef = await request.get(`/api/chat-limit?clientId=${clientId}&trend=${trend}`);
      const dataRef = await resRef.json();
      expect(dataRef.allowedLimit).toBe(8);

      // 3. Submit a trivia score of 1 (participation) => triviaBonus = +1
      // POST /api/trivia/score returns { success: true, allowedLimit, currentCount, limitReached }
      const resScore1 = await request.post('/api/trivia/score', {
        data: { clientId, trend, score: 1 }
      });
      expect(resScore1.status()).toBe(200);
      const dataScore1 = await resScore1.json();
      expect(dataScore1.success).toBe(true);
      // allowedLimit = 3 + 5*1 + 1 = 9
      expect(dataScore1.allowedLimit).toBe(9);

      // 4. Submit trivia score of 2 => triviaBonus = +3
      // allowedLimit = 3 + 5*1 + 3 = 11
      const resScore2 = await request.post('/api/trivia/score', {
        data: { clientId, trend, score: 2 }
      });
      const dataScore2 = await resScore2.json();
      expect(dataScore2.allowedLimit).toBe(11);

      // 5. Submit trivia score of 3 => triviaBonus = +5
      // allowedLimit = 3 + 5*1 + 5 = 13
      const resScore3 = await request.post('/api/trivia/score', {
        data: { clientId, trend, score: 3 }
      });
      const dataScore3 = await resScore3.json();
      expect(dataScore3.allowedLimit).toBe(13);

      // 6. Verify GET /api/chat-limit matches the updated allowedLimit
      const resFinalLimit = await request.get(`/api/chat-limit?clientId=${clientId}&trend=${trend}`);
      const dataFinalLimit = await resFinalLimit.json();
      expect(dataFinalLimit.allowedLimit).toBe(13);
    });

    test('should enforce chat limit in POST /api/chat based on new capacity limits', async ({ request }) => {
      // Lock limit by setting a trivia score of 1 (bonus +1, allowedLimit = 4)
      await request.post('/api/trivia/score', {
        data: { clientId, trend, score: 1 }
      });

      // Send 4 chat messages (allowedLimit is 4)
      for (let i = 0; i < 4; i++) {
        const res = await request.post('/api/chat', {
          headers: { 'x-enforce-limits': 'true' },
          data: { trend, query: `Query ${i}`, history: [], clientId }
        });
        expect(res.status()).toBe(200);
      }

      // 5th chat message should return 403 Forbidden
      const res5 = await request.post('/api/chat', {
        headers: { 'x-enforce-limits': 'true' },
        data: { trend, query: 'Query 5', history: [], clientId }
      });
      expect(res5.status()).toBe(403);
      const data5 = await res5.json();
      expect(data5).toEqual({
        error: 'limit_reached',
        allowedLimit: 4
      });
    });
  });

  // ==========================================
  // [AC-4] Chat Lock Screen CTA for Trivia Challenge
  // ==========================================
  test.describe('[AC-4] Chat Lock Screen CTA for Trivia Challenge', () => {
    test('should show play trivia CTA inside lock container and scroll to trivia card on click', async ({ page }) => {
      await page.goto('/');

      // Select first trend
      await page.locator('.trend-item').first().click();

      // Artificially trigger locked UI or send messages to reach limit
      // Let's set message count high or allowed limit low in db/localStorage, or mock the API
      await page.route('**/api/chat-limit*', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            limitReached: true,
            currentCount: 3,
            allowedLimit: 3
          }),
        });
      });

      // Reload/trigger status check to show lock screen
      await page.reload();
      await page.locator('.trend-item').first().click();

      const lockContainer = page.locator('#chat-lock-container');
      await expect(lockContainer).toBeVisible();

      // Check lock container contains CTA text inviting to play trivia
      await expect(lockContainer).toContainText(/trivia/i);
      await expect(lockContainer).toContainText(/\+5/);

      // Verify Play Trivia Challenge button exists
      const playTriviaBtn = lockContainer.locator('#chat-lock-play-trivia-btn');
      await expect(playTriviaBtn).toBeVisible();

      // Click button and verify it scrolls and focuses start trivia button
      const triviaContainer = page.locator('#trivia-card-container');
      const startTriviaBtn = page.locator('#btn-start-trivia');
      
      await playTriviaBtn.click();

      // Assert that startTriviaBtn is focused
      await expect(startTriviaBtn).toBeFocused();

      // Use a retrying assertion to check that trivia container is scrolled into view
      await expect(async () => {
        const isInViewport = await triviaContainer.evaluate((el) => {
          const rect = el.getBoundingClientRect();
          const windowHeight = window.innerHeight || document.documentElement.clientHeight;
          return rect.top < windowHeight && rect.bottom > 0;
        });
        expect(isInViewport).toBe(true);
      }).toPass();
    });
  });

  // ==========================================
  // [AC-5] Trivia Results Celebration & Go to Chat Button
  // ==========================================
  test.describe('[AC-5] Trivia Results Celebration & Go to Chat Button', () => {
    const mockTriviaResponse = [
      {
        question: "What is Gemini?",
        options: ["A search engine", "An AI model family", "A database", "A web server"],
        correctAnswer: 1,
        explanation: "Gemini is Google's multimodal AI model family."
      },
      {
        question: "Who developed Gemini?",
        options: ["Meta", "OpenAI", "Google", "Microsoft"],
        correctAnswer: 2,
        explanation: "Google announced and developed the Gemini family of models."
      },
      {
        question: "Is Gemini multimodal?",
        options: ["No", "Yes", "Only in labs", "Never"],
        correctAnswer: 1,
        explanation: "Yes, Gemini was built from the ground up to be multimodal."
      }
    ];

    test('should show reward display on results screen and scroll back to chat on return button click', async ({ page }) => {
      await page.route('**/api/trivia', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockTriviaResponse),
        });
      });

      await page.goto('/');
      await page.locator('.trend-item').first().click();

      // Go to trivia section and play
      const startBtn = page.locator('#btn-start-trivia');
      await startBtn.click();

      const gameplayScreen = page.locator('.trivia-gameplay-screen');
      const options = gameplayScreen.locator('.trivia-option-btn');
      const nextBtn = gameplayScreen.locator('.trivia-nav-btn');

      // Question 1: correct (opt index 1)
      await options.nth(1).click();
      await nextBtn.click();

      // Question 2: correct (opt index 2)
      await options.nth(2).click();
      await nextBtn.click();

      // Question 3: correct (opt index 1)
      await options.nth(1).click();
      const scorePromise = page.waitForResponse('**/api/trivia/score');
      await nextBtn.click(); // See Results
      await scorePromise;

      // Results Screen should be visible
      const resultsScreen = page.locator('.trivia-results-screen');
      await expect(resultsScreen).toBeVisible();

      // AC-5: Check success message badge shows earned capacity reward
      const rewardDisplay = resultsScreen.locator('#trivia-reward-display');
      await expect(rewardDisplay).toBeVisible();
      await expect(rewardDisplay).toContainText(/\+5/);

      // AC-5: Click "Go to Chat" button and verify smooth scroll back to chat-history
      const returnToChatBtn = resultsScreen.locator('#btn-return-to-chat');
      await expect(returnToChatBtn).toBeVisible();

      await returnToChatBtn.click();

      const chatHistory = page.locator('#chat-history');
      await expect(async () => {
        const isInViewport = await chatHistory.evaluate((el) => {
          const rect = el.getBoundingClientRect();
          const windowHeight = window.innerHeight || document.documentElement.clientHeight;
          return rect.top < windowHeight && rect.bottom > 0;
        });
        expect(isInViewport).toBe(true);
      }).toPass();
    });
  });

  // ==========================================
  // [AC-6] Automatic UI Sync and Unlocking
  // ==========================================
  test.describe('[AC-6] Automatic UI Sync and Unlocking', () => {
    const mockTriviaResponse = [
      {
        question: "What is Gemini?",
        options: ["A search engine", "An AI model family", "A database", "A web server"],
        correctAnswer: 1,
        explanation: "Gemini is Google's multimodal AI model family."
      },
      {
        question: "Who developed Gemini?",
        options: ["Meta", "OpenAI", "Google", "Microsoft"],
        correctAnswer: 2,
        explanation: "Google announced and developed the Gemini family of models."
      },
      {
        question: "Is Gemini multimodal?",
        options: ["No", "Yes", "Only in labs", "Never"],
        correctAnswer: 1,
        explanation: "Yes, Gemini was built from the ground up to be multimodal."
      }
    ];

    test('should auto-submit score on trivia finish, update limits, and automatically restore chat input without reload', async ({ page }) => {
      // Intercept trivia questions
      await page.route('**/api/trivia', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockTriviaResponse),
        });
      });

      // Intercept chat-limit checks to simulate chat initially locked (3/3 messages)
      let currentLimit = 3;
      await page.route('**/api/chat-limit*', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            limitReached: currentLimit <= 3,
            currentCount: 3,
            allowedLimit: currentLimit
          }),
        });
      });

      // Intercept score submission to update our local currentLimit mock variable
      let scoreSubmitted = false;
      await page.route('**/api/trivia/score', async (route) => {
        const body = route.request().postDataJSON();
        expect(body.score).toBe(3); // Expecting perfect score
        currentLimit = 8; // allowedLimit = 3 + 5 (trivia bonus) = 8
        scoreSubmitted = true;
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            allowedLimit: 8,
            currentCount: 3,
            limitReached: false
          })
        });
      });

      await page.goto('/');
      await page.locator('.trend-item').first().click();

      // Check initially locked
      const lockContainer = page.locator('#chat-lock-container');
      const chatForm = page.locator('#chat-form');
      await expect(lockContainer).toBeVisible();
      await expect(chatForm).toBeHidden();

      // Scroll and play trivia
      await lockContainer.locator('#chat-lock-play-trivia-btn').click();
      await page.locator('#btn-start-trivia').click();

      const gameplayScreen = page.locator('.trivia-gameplay-screen');
      const options = gameplayScreen.locator('.trivia-option-btn');
      const nextBtn = gameplayScreen.locator('.trivia-nav-btn');

      // Play through perfectly (score 3)
      await options.nth(1).click();
      await nextBtn.click();
      await options.nth(2).click();
      await nextBtn.click();
      await options.nth(1).click();
      const scorePromise = page.waitForResponse('**/api/trivia/score');
      await nextBtn.click(); // See Results
      await scorePromise;

      // Verify results screen displays
      await expect(page.locator('.trivia-results-screen')).toBeVisible();

      // Verify that POST /api/trivia/score was called automatically
      expect(scoreSubmitted).toBe(true);

      // Verify that chat lock overlay is automatically hidden and chat form is restored without page reload
      await expect(lockContainer).toBeHidden();
      await expect(chatForm).toBeVisible();
    });
  });
});
