import { test, expect } from '@playwright/test';
import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.resolve(__dirname, '../polls.db');

// Helper to check PNG dimensions from raw buffer
function getPngDimensions(filePath) {
  const buffer = fs.readFileSync(filePath);
  // PNG signature is 8 bytes.
  // IHDR chunk starts at byte 12 (4 bytes chunk length, 4 bytes chunk type 'IHDR')
  // Width starts at offset 16, Height at offset 20 (both 4 bytes big-endian)
  const width = buffer.readUInt32BE(16);
  const height = buffer.readUInt32BE(20);
  return { width, height };
}

test.describe('Gamified Trivia Milestones and Daily Streaks Spec Tests', () => {
  const clientId = `test-client-milestones-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
  const trend = 'Google Gemini';

  test.beforeEach(async () => {
    const db = new DatabaseSync(dbPath);
    db.exec('PRAGMA busy_timeout = 5000;');
    db.exec('PRAGMA journal_mode = WAL;');
    try {
      db.prepare('DELETE FROM client_streaks WHERE client_id = ?').run(clientId);
      db.prepare('DELETE FROM client_trivia_scores WHERE client_id = ?').run(clientId);
    } catch (e) {
      // Ignore if tables don't exist yet
    } finally {
      db.close();
    }
  });

  // ==========================================
  // [AC-1] Daily Streak Tracker UI & Visual Progression
  // ==========================================
  test('[AC-1] should render streak progress track with 7 child items and correct active/inactive states', async ({ page }) => {
    // Mock api/chat-limit to return a 3-day streak
    await page.route('**/api/chat-limit*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          limitReached: false,
          currentCount: 0,
          allowedLimit: 9,
          streakCount: 3,
          streakBonus: 6
        })
      });
    });

    await page.goto('/');
    // Click on the first trend to load the chat view
    await page.locator('.trend-item').first().click();

    // Verify streak progress track container exists
    const track = page.locator('#streak-progress-track');
    await expect(track).toBeVisible();

    // Verify it contains 7 child items (representing days of the week)
    const days = track.locator('.streak-day');
    await expect(days).toHaveCount(7);

    // Verify first 3 days are marked active/filled, and others are inactive/unfilled
    // We assume class list 'active' or data-active="true" is used. We will verify with class contains 'active'.
    for (let i = 0; i < 3; i++) {
      await expect(days.nth(i)).toHaveClass(/active/);
    }
    for (let i = 3; i < 7; i++) {
      await expect(days.nth(i)).not.toHaveClass(/active/);
    }

    // Verify milestone labels highlight thresholds and rewards
    await expect(track).toContainText('Consistent 🔥 (+6 capacity)');
    await expect(track).toContainText('Weekly Legend 👑 (+14 capacity)');
  });

  // ==========================================
  // [AC-2] Shareable Canvas Streak Milestone Card
  // ==========================================
  test('[AC-2] should render download streak reward button if streak >= 3 and download exact 2400x1260 PNG card', async ({ page }) => {
    // 1. Verify button is NOT visible when streak is < 3 (e.g., streakCount = 2)
    await page.route('**/api/chat-limit*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          limitReached: false,
          currentCount: 0,
          allowedLimit: 7,
          streakCount: 2,
          streakBonus: 4
        })
      });
    });

    await page.goto('/');
    await page.locator('.trend-item').first().click();

    const btn = page.locator('#btn-download-streak-reward');
    await expect(btn).toBeHidden();

    // 2. Mock 7-day streak (streakCount = 7)
    await page.route('**/api/chat-limit*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          limitReached: false,
          currentCount: 0,
          allowedLimit: 17,
          streakCount: 7,
          streakBonus: 14
        })
      });
    });

    await page.reload();
    await page.locator('.trend-item').first().click();

    // Set nickname in local storage to test nickname rendering / fallback
    await page.evaluate(() => localStorage.setItem('trivia-nickname', 'StreakMaster'));

    await expect(btn).toBeVisible();

    // Intercept download event
    const downloadPromise = page.waitForEvent('download');
    await btn.click();
    const download = await downloadPromise;

    // Verify filename matching streak-reward-card-*.png
    expect(download.suggestedFilename()).toMatch(/^streak-reward-card-.*\.png$/);

    const downloadPath = path.resolve(__dirname, `../test-results/${download.suggestedFilename()}`);
    await download.saveAs(downloadPath);

    // Verify PNG dimensions are exactly 2400x1260
    const { width, height } = getPngDimensions(downloadPath);
    expect(width).toBe(2400);
    expect(height).toBe(1260);

    // Clean up downloaded file
    fs.unlinkSync(downloadPath);
  });

  // ==========================================
  // [AC-3] Interactive Trivia Score Milestones & Badges
  // ==========================================
  test('[AC-3] should display trophy milestones and badges on results screen based on score', async ({ page }) => {
    const mockTriviaResponse = [
      { question: "Q1", options: ["A", "B", "C"], correctAnswer: 1, explanation: "E1" },
      { question: "Q2", options: ["A", "B", "C"], correctAnswer: 2, explanation: "E2" },
      { question: "Q3", options: ["A", "B", "C"], correctAnswer: 1, explanation: "E3" }
    ];

    await page.route('**/api/trivia', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockTriviaResponse)
      });
    });

    // Mock API trivia score endpoint to succeed
    await page.route('**/api/trivia/score', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, allowedLimit: 8, currentCount: 0, limitReached: false, rewardCount: 5 })
      });
    });

    await page.goto('/');
    await page.locator('.trend-item').first().click();

    // Start trivia
    const container = page.locator('#trivia-card-container');
    await container.locator('#btn-start-trivia').click();

    const gameplayScreen = container.locator('.trivia-gameplay-screen');
    const options = gameplayScreen.locator('.trivia-option-btn');
    const nextBtn = gameplayScreen.locator('.trivia-nav-btn');

    // Answer all 3 questions correctly to get 3/3
    await options.nth(1).click();
    await nextBtn.click();
    await options.nth(2).click();
    await nextBtn.click();
    await options.nth(1).click();
    await nextBtn.click();

    // Check Results screen elements for 3/3 "Brainiac Mastermind" with emoji "🏆"
    const titleEl = page.locator('#trivia-milestone-title');
    const badgeEl = page.locator('#trivia-milestone-badge');
    await expect(titleEl).toBeVisible();
    await expect(badgeEl).toBeVisible();
    await expect(titleEl).toHaveText('Brainiac Mastermind');
    await expect(badgeEl).toHaveText('🏆');
  });

  // ==========================================
  // [AC-4] Shareable Canvas Trivia Milestone Card
  // ==========================================
  test('[AC-4] should display download trivia reward button on results screen and download 2400x1260 PNG card', async ({ page }) => {
    const mockTriviaResponse = [
      { question: "Q1", options: ["A", "B", "C"], correctAnswer: 1, explanation: "E1" },
      { question: "Q2", options: ["A", "B", "C"], correctAnswer: 2, explanation: "E2" },
      { question: "Q3", options: ["A", "B", "C"], correctAnswer: 1, explanation: "E3" }
    ];

    await page.route('**/api/trivia', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockTriviaResponse)
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
    await page.locator('.trend-item').first().click();

    // Set nickname
    await page.evaluate(() => localStorage.setItem('trivia-nickname', 'TriviaChampion'));

    // Start trivia
    const container = page.locator('#trivia-card-container');
    await container.locator('#btn-start-trivia').click();

    const gameplayScreen = container.locator('.trivia-gameplay-screen');
    const options = gameplayScreen.locator('.trivia-option-btn');
    const nextBtn = gameplayScreen.locator('.trivia-nav-btn');

    // Answer 2 questions correctly to get 2/3 ("Sharp Challenger" / "🥈")
    await options.nth(1).click(); // correct
    await nextBtn.click();
    await options.nth(2).click(); // correct
    await nextBtn.click();
    await options.nth(0).click(); // incorrect (correct is index 1)
    await nextBtn.click();

    // Verify Results screen
    const resultsScreen = container.locator('.trivia-results-screen');
    await expect(resultsScreen).toBeVisible();

    const titleEl = page.locator('#trivia-milestone-title');
    const badgeEl = page.locator('#trivia-milestone-badge');
    await expect(titleEl).toHaveText('Sharp Challenger');
    await expect(badgeEl).toHaveText('🥈');

    // Verify download trivia reward button exists and trigger download
    const triviaBtn = resultsScreen.locator('#btn-download-trivia-reward');
    await expect(triviaBtn).toBeVisible();

    const downloadPromise = page.waitForEvent('download');
    await triviaBtn.click();
    const download = await downloadPromise;

    // Verify filename matching trivia-reward-card-*.png
    expect(download.suggestedFilename()).toMatch(/^trivia-reward-card-.*\.png$/);

    const downloadPath = path.resolve(__dirname, `../test-results/${download.suggestedFilename()}`);
    await download.saveAs(downloadPath);

    // Verify PNG dimensions are exactly 2400x1260
    const { width, height } = getPngDimensions(downloadPath);
    expect(width).toBe(2400);
    expect(height).toBe(1260);

    // Clean up
    fs.unlinkSync(downloadPath);
  });

  // ==========================================
  // [AC-5] Caching, Case-Insensitive Normalization & Robustness
  // ==========================================
  test('[AC-5] should verify client ID and Trend casing normalization handles mixed-case without duplicates', async ({ request }) => {
    const uniqueSuffix = Date.now() + '-' + Math.floor(Math.random() * 1000000);
    const mixedTrend = `GoOgLe GeMiNi-${uniqueSuffix}`;
    const lowerTrend = `google gemini-${uniqueSuffix}`;

    // Clear any potential previous scores for test clients
    const db = new DatabaseSync(dbPath);
    db.exec('PRAGMA busy_timeout = 5000;');
    db.exec('PRAGMA journal_mode = WAL;');
    try {
      db.prepare('DELETE FROM client_trivia_scores WHERE client_id IN (?, ?) AND trend = ?').run('ClIeNt-1', 'client-1', lowerTrend);
    } catch (e) {} finally {
      db.close();
    }

    // Submit a score with mixed casing: ClIeNt-1 and GoOgLe GeMiNi
    const scoreRes1 = await request.post('/api/trivia/score', {
      data: {
        clientId: 'ClIeNt-1',
        trend: mixedTrend,
        score: 3
      }
    });
    expect(scoreRes1.status()).toBe(200);

    // Submit another score with lowercase casing: client-1 and google gemini but different score
    // If normalization works, this should overwrite/update the previous record, not create a duplicate
    const scoreRes2 = await request.post('/api/trivia/score', {
      data: {
        clientId: 'client-1',
        trend: lowerTrend,
        score: 2
      }
    });
    expect(scoreRes2.status()).toBe(200);

    // Query leaderboard for mixed-case trend and client
    const lbRes = await request.get(`/api/trivia/leaderboard?trend=${mixedTrend}&clientId=ClIeNt-1`);
    expect(lbRes.status()).toBe(200);
    const lbData = await lbRes.json();
    expect(lbData.success).toBe(true);

    // Find our client in the leaderboard. It should only appear ONCE.
    const userEntries = lbData.leaderboard.filter(e => e.client_id === 'client-1' || e.client_id === 'ClIeNt-1');
    expect(userEntries.length).toBe(1);
    expect(userEntries[0].score).toBe(2); // Since it was overwritten by score 2
  });
});
