import { test, expect } from '@playwright/test';
import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.resolve(__dirname, '../polls.db');

test.describe('Global Trivia Leaderboard Feature Tests', () => {
  let saveClientNickname;
  let getClientNickname;
  let getTriviaLeaderboard;
  let recordTriviaScore;

  const testClientId1 = `client-test-1-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
  const testClientId2 = `client-test-2-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
  const testClientId3 = `client-test-3-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
  const testClientIdCurrentUser = `client-current-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
  const testTrend = `test-trend-leaderboard-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
  const normalizedTrend = testTrend.toLowerCase();

  test.beforeAll(async () => {
    try {
      const dbModule = await import('../db.js');
      saveClientNickname = dbModule.saveClientNickname;
      getClientNickname = dbModule.getClientNickname;
      getTriviaLeaderboard = dbModule.getTriviaLeaderboard;
      recordTriviaScore = dbModule.recordTriviaScore;
    } catch (err) {
      console.warn('Could not dynamically import helpers from db.js:', err.message);
    }
  });

  test.beforeEach(async () => {
    // Clean up test data from SQLite
    const db = new DatabaseSync(dbPath);
    db.exec('PRAGMA busy_timeout = 5000;');
    db.exec('PRAGMA journal_mode = WAL;');
    try {
      db.prepare('DELETE FROM client_nicknames WHERE client_id IN (?, ?, ?, ?)')
        .run(testClientId1, testClientId2, testClientId3, testClientIdCurrentUser);
    } catch (err) {
      // Ignore if table client_nicknames doesn't exist yet (which is expected on first test run)
    }
    try {
      db.prepare('DELETE FROM client_trivia_scores WHERE client_id IN (?, ?, ?, ?)')
        .run(testClientId1, testClientId2, testClientId3, testClientIdCurrentUser);
      db.prepare('DELETE FROM client_trivia_scores WHERE trend = ?').run(normalizedTrend);
    } catch (err) {
      // Ignore
    } finally {
      db.close();
    }
  });

  // =========================================================================
  // [AC-1] Database Schema & Persistence
  // =========================================================================
  test.describe('Database helpers and Schema tests', () => {

    test('[AC-1] should verify client_nicknames table exists with correct schema', async () => {
      const db = new DatabaseSync(dbPath);
      db.exec('PRAGMA busy_timeout = 5000;');
      db.exec('PRAGMA journal_mode = WAL;');
      try {
        const stmt = db.prepare(`
          SELECT sql FROM sqlite_master 
          WHERE type = 'table' AND name = 'client_nicknames'
        `);
        const row = stmt.get();
        expect(row).toBeDefined();
        expect(row.sql).toContain('client_id TEXT');
        expect(row.sql).toContain('nickname TEXT');
        expect(row.sql).toContain('PRIMARY KEY (client_id)');
      } finally {
        db.close();
      }
    });

    test('[AC-1] should persist and retrieve nicknames using saveClientNickname and getClientNickname', async () => {
      if (typeof saveClientNickname !== 'function' || typeof getClientNickname !== 'function') {
        throw new Error('saveClientNickname or getClientNickname is not exported from db.js');
      }

      // 1. Check get on non-existent returns null/falsy
      const initial = await getClientNickname(testClientId1);
      expect(initial).toBeFalsy();

      // 2. Save and verify
      await saveClientNickname(testClientId1, 'Alice');
      const saved = await getClientNickname(testClientId1);
      expect(saved).toBe('Alice');

      // 3. Update and verify
      await saveClientNickname(testClientId1, 'Alisha');
      const updated = await getClientNickname(testClientId1);
      expect(updated).toBe('Alisha');
    });

    test('[AC-1] should correctly retrieve top 10 scores sorted by score DESC, then completed_at ASC', async () => {
      if (typeof getTriviaLeaderboard !== 'function' || typeof recordTriviaScore !== 'function') {
        throw new Error('getTriviaLeaderboard or recordTriviaScore helper is missing from db.js');
      }

      // Setup custom nicknames
      await saveClientNickname(testClientId1, 'P1');
      await saveClientNickname(testClientId2, 'P2');
      // testClientId3 remains anonymous

      const db = new DatabaseSync(dbPath);
      db.exec('PRAGMA busy_timeout = 5000;');
      db.exec('PRAGMA journal_mode = WAL;');
      try {
        // Record scores with controlled completed_at dates to check sorting
        // We write directly to the DB to override dates, as recordTriviaScore uses new Date().toISOString()
        const insertStmt = db.prepare(`
          INSERT INTO client_trivia_scores (client_id, trend, score, completed_at)
          VALUES (?, ?, ?, ?)
        `);
        
        // Player 1: Score 3, completed later (rank 2)
        insertStmt.run(testClientId1, normalizedTrend, 3, '2026-06-13T12:00:10.000Z');
        // Player 2: Score 3, completed earlier (rank 1)
        insertStmt.run(testClientId2, normalizedTrend, 3, '2026-06-13T12:00:00.000Z');
        // Player 3: Score 2 (rank 3)
        insertStmt.run(testClientId3, normalizedTrend, 2, '2026-06-13T12:00:05.000Z');
      } finally {
        db.close();
      }

      // Query leaderboard for currentUser (who has not played yet)
      const data = await getTriviaLeaderboard(testTrend, testClientIdCurrentUser);
      expect(data).toBeDefined();
      expect(data.leaderboard).toHaveLength(3);

      // Verify rankings and nicknames
      // Rank 1: Player 2 (earlier score of 3)
      expect(data.leaderboard[0].nickname).toBe('P2');
      expect(data.leaderboard[0].score).toBe(3);
      expect(data.leaderboard[0].completed_at).toBe('2026-06-13T12:00:00.000Z');

      // Rank 2: Player 1 (later score of 3)
      expect(data.leaderboard[1].nickname).toBe('P1');
      expect(data.leaderboard[1].score).toBe(3);
      expect(data.leaderboard[1].completed_at).toBe('2026-06-13T12:00:10.000Z');

      // Rank 3: Player 3 (score of 2, fallback anonymous name Player_<last-5-chars>)
      const last5 = testClientId3.slice(-5);
      expect(data.leaderboard[2].nickname).toBe(`Player_${last5}`);
      expect(data.leaderboard[2].score).toBe(2);

      // Current user metrics
      expect(data.userScore).toBeNull();
      expect(data.userRank).toBeNull();
    });

    test('[AC-1] should calculate userRank and userScore for the specified user', async () => {
      if (typeof getTriviaLeaderboard !== 'function') {
        throw new Error('getTriviaLeaderboard helper is missing from db.js');
      }

      const db = new DatabaseSync(dbPath);
      db.exec('PRAGMA busy_timeout = 5000;');
      db.exec('PRAGMA journal_mode = WAL;');
      try {
        const insertStmt = db.prepare(`
          INSERT INTO client_trivia_scores (client_id, trend, score, completed_at)
          VALUES (?, ?, ?, ?)
        `);
        // 12 scores to test limit 10 and ranking outside top 10
        for (let i = 1; i <= 12; i++) {
          const clientId = `client-limit-test-${i}`;
          // Score 3 for top 10, Score 2 for 11th, Score 1 for 12th (current user)
          const score = i <= 10 ? 3 : (i === 11 ? 2 : 1);
          // completed_at timestamps ordered sequentially
          const completedAt = `2026-06-13T12:00:${i.toString().padStart(2, '0')}.000Z`;
          insertStmt.run(clientId, normalizedTrend, score, completedAt);
        }
      } finally {
        db.close();
      }

      // Check leaderboard for currentUser who is the 12th player
      const data = await getTriviaLeaderboard(testTrend, 'client-limit-test-12');
      expect(data.leaderboard).toHaveLength(10); // limited to 10
      expect(data.userScore).toBe(1);
      expect(data.userRank).toBe(12); // User is 12th
    });

    test('[AC-1] should normalize mixed-case trend parameters for case insensitivity', async () => {
      if (typeof getTriviaLeaderboard !== 'function') {
        throw new Error('getTriviaLeaderboard helper is missing');
      }

      const db = new DatabaseSync(dbPath);
      db.exec('PRAGMA busy_timeout = 5000;');
      db.exec('PRAGMA journal_mode = WAL;');
      try {
        db.prepare(`
          INSERT INTO client_trivia_scores (client_id, trend, score, completed_at)
          VALUES (?, ?, 3, '2026-06-13T12:00:00.000Z')
        `).run(testClientId1, normalizedTrend);
      } finally {
        db.close();
      }

      // Query with mixed case
      const data = await getTriviaLeaderboard(testTrend.toUpperCase(), testClientId1);
      expect(data.leaderboard).toHaveLength(1);
      expect(data.userScore).toBe(3);
    });
  });

  // =========================================================================
  // [AC-2] Backend API Endpoints
  // =========================================================================
  test.describe('Backend API Integration Tests', () => {

    test('[AC-2] GET /api/trivia/leaderboard returns correct response structure', async ({ request }) => {
      // Setup some scores
      const db = new DatabaseSync(dbPath);
      db.exec('PRAGMA busy_timeout = 5000;');
      db.exec('PRAGMA journal_mode = WAL;');
      try {
        db.prepare('INSERT INTO client_nicknames (client_id, nickname) VALUES (?, ?)').run(testClientId1, 'Bob');
        db.prepare(`
          INSERT INTO client_trivia_scores (client_id, trend, score, completed_at)
          VALUES (?, ?, 3, '2026-06-13T12:00:00.000Z')
        `).run(testClientId1, normalizedTrend);
      } finally {
        db.close();
      }

      const response = await request.get(`/api/trivia/leaderboard?trend=${testTrend}&clientId=${testClientId1}`);
      expect(response.status()).toBe(200);
      const data = await response.json();
      
      expect(data.success).toBe(true);
      expect(Array.isArray(data.leaderboard)).toBe(true);
      expect(data.leaderboard).toHaveLength(1);
      expect(data.leaderboard[0]).toEqual({
        rank: 1,
        nickname: 'Bob',
        score: 3,
        completed_at: '2026-06-13T12:00:00.000Z',
        isCurrentUser: true
      });
      expect(data.userScore).toBe(3);
      expect(data.userRank).toBe(1);
    });

    test('[AC-2] GET /api/trivia/leaderboard fails with 400 if trend is missing', async ({ request }) => {
      const response = await request.get('/api/trivia/leaderboard');
      expect(response.status()).toBe(400);
    });

    test('[AC-2] POST /api/trivia/nickname updates and validates nickname', async ({ request }) => {
      // 1. Success case: save trimmed nickname
      const response = await request.post('/api/trivia/nickname', {
        data: {
          clientId: testClientId1,
          nickname: '  MyNewName  '
        }
      });
      expect(response.status()).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.nickname).toBe('MyNewName'); // trimmed

      // Check DB via unit helper/direct queries
      const db = new DatabaseSync(dbPath);
      db.exec('PRAGMA busy_timeout = 5000;');
      db.exec('PRAGMA journal_mode = WAL;');
      try {
        const stmt = db.prepare('SELECT nickname FROM client_nicknames WHERE client_id = ?');
        expect(stmt.get(testClientId1).nickname).toBe('MyNewName');
      } finally {
        db.close();
      }

      // 2. Failure: too long
      const responseTooLong = await request.post('/api/trivia/nickname', {
        data: {
          clientId: testClientId1,
          nickname: 'Averylongnickname16chars'
        }
      });
      expect(responseTooLong.status()).toBe(400);

      // 3. Failure: empty/whitespace only
      const responseEmpty = await request.post('/api/trivia/nickname', {
        data: {
          clientId: testClientId1,
          nickname: '   '
        }
      });
      expect(responseEmpty.status()).toBe(400);

      // 4. Failure: invalid types
      const responseInvalid = await request.post('/api/trivia/nickname', {
        data: {
          clientId: testClientId1,
          nickname: 123
        }
      });
      expect(responseInvalid.status()).toBe(400);
    });
  });

  // =========================================================================
  // [AC-3] Start Screen Global Leaderboard UI
  // =========================================================================
  test.describe('Start Screen UI Tests', () => {

    test.beforeEach(async ({ page }) => {
      // Intercept EventSource to prevent SSE flaking
      await page.addInitScript(() => {
        class MockEventSource extends EventTarget {
          constructor() { super(); }
          close() {}
        }
        window.EventSource = MockEventSource;
      });
    });

    test('[AC-3] should display leaderboard container and show correct elements', async ({ page }) => {
      const mockLeaderboardResponse = {
        success: true,
        leaderboard: [
          { rank: 1, nickname: 'Champ1', score: 3, completed_at: '2026-06-13T12:00:00.000Z', isCurrentUser: false },
          { rank: 2, nickname: 'Champ2', score: 2, completed_at: '2026-06-13T12:01:00.000Z', isCurrentUser: true }
        ],
        userRank: 2,
        userScore: 2
      };

      await page.route('**/api/trivia/leaderboard*', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockLeaderboardResponse),
        });
      });

      await page.goto('/');

      // Select first trend to show trivia container
      await page.locator('.trend-item').first().click();

      // Check leaderboard container exists below start button
      const leaderboardContainer = page.locator('.trivia-start-screen .trivia-leaderboard');
      await expect(leaderboardContainer).toBeVisible();

      // Verify header is visible
      await expect(leaderboardContainer.locator('.leaderboard-header')).toContainText(/Global Leaderboard/i);

      // Verify list contains items and highlights current user
      const rows = leaderboardContainer.locator('.leaderboard-row');
      await expect(rows).toHaveCount(2);

      await expect(rows.nth(0)).toContainText('Champ1');
      await expect(rows.nth(0)).toContainText('3/3');
      
      await expect(rows.nth(1)).toContainText('Champ2');
      await expect(rows.nth(1)).toContainText('2/3');
      // Highlight current user
      await expect(rows.nth(1)).toHaveClass(/highlight|current-user/);
    });

    test('[AC-3] should display empty state when there are no scores recorded yet', async ({ page }) => {
      const mockEmptyResponse = {
        success: true,
        leaderboard: [],
        userRank: null,
        userScore: null
      };

      await page.route('**/api/trivia/leaderboard*', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockEmptyResponse),
        });
      });

      await page.goto('/');
      await page.locator('.trend-item').first().click();

      const leaderboardContainer = page.locator('.trivia-start-screen .trivia-leaderboard');
      await expect(leaderboardContainer).toBeVisible();

      const emptyMsg = leaderboardContainer.locator('.leaderboard-empty');
      await expect(emptyMsg).toBeVisible();
      await expect(emptyMsg).toContainText('No scores recorded yet. Be the first!');
    });

    test('[AC-3] should display personal rank below the list if user is outside top 10', async ({ page }) => {
      const mockOutsideTop10Response = {
        success: true,
        leaderboard: Array.from({ length: 10 }, (_, i) => ({
          rank: i + 1,
          nickname: `TopPlayer${i + 1}`,
          score: 3,
          completed_at: '2026-06-13T12:00:00.000Z',
          isCurrentUser: false
        })),
        userRank: 15,
        userScore: 2
      };

      await page.route('**/api/trivia/leaderboard*', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockOutsideTop10Response),
        });
      });

      await page.goto('/');
      await page.locator('.trend-item').first().click();

      const leaderboardContainer = page.locator('.trivia-start-screen .trivia-leaderboard');
      await expect(leaderboardContainer).toBeVisible();

      const personalRank = leaderboardContainer.locator('.leaderboard-personal-rank');
      await expect(personalRank).toBeVisible();
      await expect(personalRank).toContainText(/Your Rank: #15/);
      await expect(personalRank).toContainText(/High Score: 2\/3/);
    });
  });

  // =========================================================================
  // [AC-4] Results Screen Leaderboard UI & Nickname Submission
  // =========================================================================
  test.describe('Results Screen E2E & Nickname Submission Tests', () => {
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

    test.beforeEach(async ({ page }) => {
      // Intercept EventSource to prevent SSE flaking
      await page.addInitScript(() => {
        class MockEventSource extends EventTarget {
          constructor() { super(); }
          close() {}
        }
        window.EventSource = MockEventSource;
      });
    });

    test('[AC-4] should show results leaderboard, submit nickname, save to localStorage/backend, and refresh list in-place', async ({ page }) => {
      // 1. Intercept Trivia API
      await page.route('**/api/trivia', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockTriviaResponse),
        });
      });

      // 2. Intercept leaderboard fetches
      let callCount = 0;
      await page.route('**/api/trivia/leaderboard*', async (route) => {
        callCount++;
        if (callCount === 1) {
          // Initial start screen fetch
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              leaderboard: [{ rank: 1, nickname: 'Champ1', score: 3, completed_at: '2026-06-13T12:00:00.000Z', isCurrentUser: false }],
              userRank: null,
              userScore: null
            }),
          });
        } else if (callCount === 2) {
          // After score auto-submission
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              leaderboard: [
                { rank: 1, nickname: 'Champ1', score: 3, completed_at: '2026-06-13T12:00:00.000Z', isCurrentUser: false },
                { rank: 2, nickname: 'Player_12345', score: 2, completed_at: '2026-06-13T12:10:00.000Z', isCurrentUser: true }
              ],
              userRank: 2,
              userScore: 2
            }),
          });
        } else {
          // After nickname submission
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              leaderboard: [
                { rank: 1, nickname: 'Champ1', score: 3, completed_at: '2026-06-13T12:00:00.000Z', isCurrentUser: false },
                { rank: 2, nickname: 'MyCustomNick', score: 2, completed_at: '2026-06-13T12:10:00.000Z', isCurrentUser: true }
              ],
              userRank: 2,
              userScore: 2
            }),
          });
        }
      });

      // 3. Intercept nickname POST
      let nicknamePosted = false;
      await page.route('**/api/trivia/nickname', async (route) => {
        const body = route.request().postDataJSON();
        expect(body.nickname).toBe('MyCustomNick');
        nicknamePosted = true;
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, nickname: 'MyCustomNick' })
        });
      });

      // 4. Intercept score auto-submission
      await page.route('**/api/trivia/score', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, allowedLimit: 6, currentCount: 1, limitReached: false })
        });
      });

      // Start gameplay loop
      await page.goto('/');
      await page.locator('.trend-item').first().click();

      // Verify start screen leaderboard exists
      const startLeaderboard = page.locator('.trivia-start-screen .trivia-leaderboard');
      await expect(startLeaderboard).toBeVisible();

      // Click "Start Trivia Challenge"
      await page.locator('#btn-start-trivia').click();

      const gameplayScreen = page.locator('.trivia-gameplay-screen');
      const options = gameplayScreen.locator('.trivia-option-btn');
      const nextBtn = gameplayScreen.locator('.trivia-nav-btn');

      // Play gameplay (Score 2/3)
      await options.nth(1).click(); // Q1 correct (Opt 1)
      await nextBtn.click();
      await options.nth(2).click(); // Q2 correct (Opt 2)
      await nextBtn.click();
      await options.nth(0).click(); // Q3 incorrect (Opt 0)
      await nextBtn.click(); // See Results

      // Verify transition to results screen
      const resultsScreen = page.locator('.trivia-results-screen');
      await expect(resultsScreen).toBeVisible();

      // Verify results leaderboard container is visible
      const resultsLeaderboard = resultsScreen.locator('.trivia-leaderboard');
      await expect(resultsLeaderboard).toBeVisible();
      
      // Initially displays user with default anonymous name Player_12345
      await expect(resultsLeaderboard.locator('.leaderboard-row').nth(1)).toContainText('Player_12345');

      // Nickname Submission form checks
      const nicknameInput = resultsScreen.locator('#nickname-input');
      const saveBtn = resultsScreen.locator('#btn-save-nickname');
      const statusText = resultsScreen.locator('#nickname-status');

      await expect(nicknameInput).toBeVisible();
      await expect(nicknameInput).toHaveAttribute('maxlength', '15');
      await expect(saveBtn).toBeVisible();

      // Fill and save nickname
      await nicknameInput.fill('MyCustomNick');
      await saveBtn.click();

      // Check status notification displays "Nickname saved!"
      await expect(statusText).toBeVisible();
      await expect(statusText).toContainText('Nickname saved!');

      // Check localStorage updated
      const localStorageNickname = await page.evaluate(() => localStorage.getItem('trivia-nickname'));
      expect(localStorageNickname).toBe('MyCustomNick');

      // Verify nickname POST was triggered
      expect(nicknamePosted).toBe(true);

      // Verify results leaderboard refreshed in-place immediately to reflect the new nickname
      await expect(resultsLeaderboard.locator('.leaderboard-row').nth(1)).toContainText('MyCustomNick');
      await expect(resultsLeaderboard.locator('.leaderboard-row').nth(1)).not.toContainText('Player_12345');
    });
  });
});
