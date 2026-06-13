import { test, expect } from '@playwright/test';
import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Resolve database path
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.resolve(__dirname, '../polls.db');

test.describe('Interactive AI-Generated Trivia Challenge', () => {

  // ==========================================
  // [AC-2] On-Demand Trivia Generation / Loading & DB Caching
  // ==========================================
  test.describe('Database Trivia Cache Table & Helper Unit Tests', () => {
    let getTrendTrivia;
    let setTrendTrivia;

    test.beforeAll(async () => {
      try {
        const dbModule = await import('../db.js');
        getTrendTrivia = dbModule.getTrendTrivia;
        setTrendTrivia = dbModule.setTrendTrivia;
      } catch (err) {
        console.warn('Could not import trivia caching functions from db.js:', err.message);
      }
    });

    // Verify SQLite Schema existence and details
    test('should have trend_trivia table created in SQLite with correct schema', async () => {
      const db = new DatabaseSync(dbPath);
      try {
        const stmt = db.prepare(`
          SELECT sql FROM sqlite_master 
          WHERE type = 'table' AND name = 'trend_trivia'
        `);
        const row = stmt.get();
        expect(row).toBeDefined();
        expect(row.sql).toContain('trend TEXT');
        expect(row.sql).toContain('lang TEXT');
        expect(row.sql).toContain('trivia TEXT');
        expect(row.sql).toContain('created_at TEXT');
        expect(row.sql).toContain('PRIMARY KEY (trend, lang)');
      } finally {
        db.close();
      }
    });

    // Verify helper functions save/retrieve trivia properly
    test('should write and retrieve a trend trivia from the database', async () => {
      if (typeof setTrendTrivia !== 'function' || typeof getTrendTrivia !== 'function') {
        throw new Error('getTrendTrivia or setTrendTrivia is not exported from db.js');
      }

      const testTrend = `trivia-trend-${Date.now()}`;
      const testLang = 'en';
      const testTriviaData = [
        {
          question: "Test Question 1",
          options: ["Opt 1", "Opt 2", "Opt 3", "Opt 4"],
          correctAnswer: 0,
          explanation: "Explanation 1"
        },
        {
          question: "Test Question 2",
          options: ["Opt A", "Opt B", "Opt C", "Opt D"],
          correctAnswer: 1,
          explanation: "Explanation 2"
        },
        {
          question: "Test Question 3",
          options: ["Yes", "No", "Maybe", "Never"],
          correctAnswer: 2,
          explanation: "Explanation 3"
        }
      ];

      // Cache trivia
      await setTrendTrivia(testTrend, testLang, testTriviaData);

      // Verify db insertion directly
      const db = new DatabaseSync(dbPath);
      try {
        const checkStmt = db.prepare('SELECT trivia, created_at FROM trend_trivia WHERE trend = ? AND lang = ?');
        const dbRow = checkStmt.get(testTrend, testLang);
        expect(dbRow).toBeDefined();
        const parsed = JSON.parse(dbRow.trivia);
        expect(parsed).toEqual(testTriviaData);
        expect(dbRow.created_at).toBeDefined();
      } finally {
        db.close();
      }

      // Retrieve via helper
      const cached = await getTrendTrivia(testTrend, testLang);
      expect(cached).toBeDefined();
      expect(cached).toEqual(testTriviaData);
    });

    test('should return null or undefined for non-cached trend trivia', async () => {
      if (typeof getTrendTrivia !== 'function') {
        throw new Error('getTrendTrivia is not exported from db.js');
      }
      const result = await getTrendTrivia('non-existent-trivia-trend', 'en');
      expect(result).toBeFalsy();
    });
  });

  // ==========================================
  // [AC-2] On-Demand Trivia Generation / Loading & DB Caching
  // ==========================================
  test.describe('Trivia Generation API', () => {
    test('POST /api/trivia should return trivia payload for valid trend and lang', async ({ request }) => {
      const response = await request.post('/api/trivia', {
        data: {
          trend: 'Google Gemini',
          lang: 'en'
        }
      });
      expect(response.status()).toBe(200);
      const data = await response.json();
      expect(Array.isArray(data)).toBe(true);
      expect(data).toHaveLength(3);
      
      for (const item of data) {
        expect(typeof item.question).toBe('string');
        expect(Array.isArray(item.options)).toBe(true);
        expect(item.options).toHaveLength(4);
        for (const option of item.options) {
          expect(typeof option).toBe('string');
        }
        expect(typeof item.correctAnswer).toBe('number');
        expect(item.correctAnswer).toBeGreaterThanOrEqual(0);
        expect(item.correctAnswer).toBeLessThan(4);
        expect(typeof item.explanation).toBe('string');
      }
    });

    test('POST /api/trivia should fail with 400 for missing trend or lang', async ({ request }) => {
      const responseNoTrend = await request.post('/api/trivia', {
        data: { lang: 'en' }
      });
      expect(responseNoTrend.status()).toBe(400);

      const responseNoLang = await request.post('/api/trivia', {
        data: { trend: 'Google Gemini' }
      });
      expect(responseNoLang.status()).toBe(400);
    });
  });

  // ==========================================
  // [AC-5] Wordle Score Card Social Share & Unified Modal Integration
  // ==========================================
  test.describe('Generate Post API (Trivia Context)', () => {
    test('POST /api/generate-post should support trivia context and construct text templates', async ({ request }) => {
      const response = await request.post('/api/generate-post', {
        data: {
          trend: 'Google Gemini',
          lang: 'en',
          platform: 'x',
          contextType: 'trivia',
          score: 2,
          pattern: '🟩🟥🟩'
        }
      });
      expect(response.status()).toBe(200);
      const data = await response.json();
      expect(data.postText).toBeDefined();
      expect(data.postText).toContain('🟩🟥🟩');
      expect(data.postText).toContain('2/3');
      expect(data.postText).toContain('Google Gemini');
    });
  });

  // ==========================================
  // [AC-1] Trivia Card UI Component
  // ==========================================
  test.describe('Frontend Trivia UI Component & Initial State', () => {
    test('should render trivia card container below interactive-grid in start screen state', async ({ page }) => {
      await page.goto('/');
      
      // Select the first trend to load explainer-view
      // Check `#trivia-card-container` existence
      const container = page.locator('#trivia-card-container');
      await expect(container).toBeVisible();
      
      // Styled using glassmorphism (glass-card)
      await expect(container).toHaveClass(/glass-card/);
      
      // Displays active trend's title and "Start Trivia Challenge" button
      const startScreen = container.locator('.trivia-start-screen');
      await expect(startScreen).toBeVisible();
      
      const startTitle = startScreen.locator('.trivia-title');
      await expect(startTitle).toContainText('Google Gemini');
      
      const startBtn = startScreen.locator('#btn-start-trivia');
      await expect(startBtn).toBeVisible();
      await expect(startBtn).toContainText('Start Trivia Challenge');
    });
  });

  // ==========================================
  // [AC-3] Interactive Trivia Gameplay
  // [AC-4] Wordle-style Score Card & Results Screen
  // [AC-5] Wordle Score Card Social Share & Unified Modal Integration
  // ==========================================
  test.describe('Interactive Trivia Gameplay Loop E2E', () => {
    const mockTriviaResponse = [
      {
        question: "What is Gemini?",
        options: ["A search engine", "An AI model family", "A database", "A web server"],
        correctAnswer: 1, // index 1 is correct
        explanation: "Gemini is Google's multimodal AI model family."
      },
      {
        question: "Who developed Gemini?",
        options: ["Meta", "OpenAI", "Google", "Microsoft"],
        correctAnswer: 2, // index 2 is correct
        explanation: "Google announced and developed the Gemini family of models."
      },
      {
        question: "Is Gemini multimodal?",
        options: ["No", "Yes", "Only in labs", "Never"],
        correctAnswer: 1, // index 1 is correct
        explanation: "Yes, Gemini was built from the ground up to be multimodal."
      }
    ];

    test.beforeEach(async ({ page }) => {
      // Intercept the /api/trivia endpoint to return a predictable set of trivia questions
      await page.route('**/api/trivia', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockTriviaResponse),
        });
      });
    });

    test('should progress through trivia gameplay, show results, and reset correctly', async ({ page }) => {
      await page.goto('/');

      const container = page.locator('#trivia-card-container');
      await expect(container).toBeVisible();

      // Click "Start Trivia Challenge"
      const startBtn = container.locator('#btn-start-trivia');
      await startBtn.click();

      // Transition to Question Screen (Question 1)
      const gameplayScreen = container.locator('.trivia-gameplay-screen');
      await expect(gameplayScreen).toBeVisible();

      // Check progress text
      const progressLabel = gameplayScreen.locator('.trivia-progress');
      await expect(progressLabel).toHaveText('Question 1 of 3');

      // Check question text
      const questionText = gameplayScreen.locator('.trivia-question-text');
      await expect(questionText).toHaveText('What is Gemini?');

      // Check 4 options
      const options = gameplayScreen.locator('.trivia-option-btn');
      await expect(options).toHaveCount(4);

      // Select wrong answer (option index 0: "A search engine")
      await options.nth(0).click();

      // Assert option buttons are disabled after click
      for (let i = 0; i < 4; i++) {
        await expect(options.nth(i)).toBeDisabled();
      }

      // Assert explanation block is revealed and correct/incorrect feedback shown
      const explanationBlock = gameplayScreen.locator('.trivia-explanation-block');
      await expect(explanationBlock).toBeVisible();
      await expect(explanationBlock.locator('.trivia-feedback')).toContainText('Incorrect! 🟥');
      await expect(explanationBlock.locator('.trivia-correct-answer')).toContainText('Correct Answer: An AI model family');
      await expect(explanationBlock.locator('.trivia-explanation-text')).toHaveText("Gemini is Google's multimodal AI model family.");

      // Check navigation button is "Next Question"
      const nextBtn = gameplayScreen.locator('.trivia-nav-btn');
      await expect(nextBtn).toHaveText('Next Question');

      // Proceed to Question 2
      await nextBtn.click();

      // Question 2 screen checks
      await expect(progressLabel).toHaveText('Question 2 of 3');
      await expect(questionText).toHaveText('Who developed Gemini?');

      // Select correct answer (option index 2: "Google")
      await options.nth(2).click();

      // Check feedback
      await expect(explanationBlock).toBeVisible();
      await expect(explanationBlock.locator('.trivia-feedback')).toContainText('Correct! 🟩');
      await expect(explanationBlock.locator('.trivia-explanation-text')).toHaveText("Google announced and developed the Gemini family of models.");
      await expect(nextBtn).toHaveText('Next Question');

      // Proceed to Question 3
      await nextBtn.click();

      // Question 3 screen checks
      await expect(progressLabel).toHaveText('Question 3 of 3');
      await expect(questionText).toHaveText('Is Gemini multimodal?');

      // Select correct answer (option index 1: "Yes")
      await options.nth(1).click();

      // Check feedback
      await expect(explanationBlock).toBeVisible();
      await expect(explanationBlock.locator('.trivia-feedback')).toContainText('Correct! 🟩');
      await expect(explanationBlock.locator('.trivia-explanation-text')).toHaveText("Yes, Gemini was built from the ground up to be multimodal.");

      // Check navigation button is "See Results"
      await expect(nextBtn).toHaveText('See Results');

      // Finish gameplay and go to results
      await nextBtn.click();

      // Transition to Results Screen
      const resultsScreen = container.locator('.trivia-results-screen');
      await expect(resultsScreen).toBeVisible();
      await expect(gameplayScreen).toBeHidden();

      // Verify final score and Wordle-style pattern
      await expect(resultsScreen.locator('.trivia-results-title')).toHaveText('Challenge Completed!');
      await expect(resultsScreen.locator('.trivia-results-score')).toContainText('You scored 2 out of 3');
      
      const emojiPattern = resultsScreen.locator('.trivia-emoji-pattern');
      await expect(emojiPattern).toHaveText('🟥🟩🟩');

      // [AC-4] "Play Again" button resets state
      const playAgainBtn = resultsScreen.locator('#btn-play-again');
      await expect(playAgainBtn).toBeVisible();
      await playAgainBtn.click();

      // Assert we are back to Start Screen
      await expect(container.locator('.trivia-start-screen')).toBeVisible();
      await expect(resultsScreen).toBeHidden();
    });

    test('should copy score to clipboard and open Unified Share Modal with pre-populated text', async ({ page, context }) => {
      // Grant clipboard permissions
      await context.grantPermissions(['clipboard-read', 'clipboard-write']);

      await page.goto('/');

      // Intercept generate-post API
      let generatePostPayload = null;
      await page.route('**/api/generate-post', async (route) => {
        generatePostPayload = route.request().postDataJSON();
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            postText: `Mock Share Post: ${generatePostPayload.pattern} - Score ${generatePostPayload.score}/3`
          }),
        });
      });

      const container = page.locator('#trivia-card-container');
      await container.locator('#btn-start-trivia').click();

      const gameplayScreen = container.locator('.trivia-gameplay-screen');
      const options = gameplayScreen.locator('.trivia-option-btn');
      const nextBtn = gameplayScreen.locator('.trivia-nav-btn');

      // Question 1: correct (opt index 1)
      await options.nth(1).click();
      await nextBtn.click();

      // Question 2: incorrect (opt index 0)
      await options.nth(0).click();
      await nextBtn.click();

      // Question 3: correct (opt index 1)
      await options.nth(1).click();
      await nextBtn.click(); // See Results

      // Results Screen
      const resultsScreen = container.locator('.trivia-results-screen');
      await expect(resultsScreen).toBeVisible();

      // Click "Share Score" button
      const shareScoreBtn = resultsScreen.locator('#btn-share-score');
      await expect(shareScoreBtn).toBeVisible();
      await shareScoreBtn.click();

      // Verify clipboard content
      // Should contain emoji grid (🟩🟥🟩), score (2 out of 3), and trend link
      const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
      expect(clipboardText).toContain('🟩🟥🟩');
      expect(clipboardText).toContain('2 out of 3');
      expect(clipboardText).toContain('/t/google-gemini');

      // Verify Unified Share Modal is visible
      const shareModal = page.locator('#share-modal');
      await expect(shareModal).toBeVisible();

      // Verify modal dropdown option "Trivia Score" exists and is selected
      const contextSelect = page.locator('#share-context-select');
      await expect(contextSelect.locator('option[value="trivia"]')).toHaveText('Trivia Score');
      await expect(contextSelect).toHaveValue('trivia');

      // Verify post textarea is preloaded with the score card text
      const previewTextarea = page.locator('#share-preview-text');
      await expect(previewTextarea).toHaveValue(/Mock Share Post/);
      await expect(previewTextarea).toHaveValue(/🟩🟥🟩/);
      await expect(previewTextarea).toHaveValue(/Score 2\/3/);

      // Verify character counter works
      const charCounter = page.locator('#share-char-counter');
      await expect(charCounter).not.toHaveText('0');
    });
  });

  // ==========================================
  // Client-Side Localization Support (via translateUI / index.html changes)
  // ==========================================
  test.describe('Client-Side Localization for Trivia Challenge', () => {
    test('should translate trivia components when page language dropdown is switched', async ({ page }) => {
      await page.goto('/');

      const select = page.locator('#lang-select');
      await expect(select).toBeVisible();

      // Intercept api explain and api trivia for Spanish
      await page.route('**/api/trivia', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([
            {
              question: "Pregunta 1",
              options: ["Opción 1", "Opción 2", "Opción 3", "Opción 4"],
              correctAnswer: 0,
              explanation: "Explicación 1"
            },
            {
              question: "Pregunta 2",
              options: ["Opción A", "Opción B", "Opción C", "Opción D"],
              correctAnswer: 1,
              explanation: "Explicación 2"
            },
            {
              question: "Pregunta 3",
              options: ["Sí", "No", "Tal vez", "Nunca"],
              correctAnswer: 2,
              explanation: "Explicación 3"
            }
          ]),
        });
      });

      // Switch language to Spanish
      await select.selectOption('es');

      // Wait for Spanish translation logic
      const container = page.locator('#trivia-card-container');
      const startScreen = container.locator('.trivia-start-screen');
      const startBtn = startScreen.locator('#btn-start-trivia');
      
      // Confirm the Start button translation to Spanish (e.g. "Iniciar Trivia" / "Comenzar Desafío de Trivia")
      await expect(async () => {
        const text = await startBtn.textContent();
        expect(text).not.toBe('Start Trivia Challenge');
      }).toPass();

      // Start gameplay in Spanish
      await startBtn.click();

      // Verify question progress is translated (e.g. "Pregunta 1 de 3")
      const gameplayScreen = container.locator('.trivia-gameplay-screen');
      const progressLabel = gameplayScreen.locator('.trivia-progress');
      await expect(async () => {
        const text = await progressLabel.textContent();
        expect(text).toContain('1 de 3');
      }).toPass();

      // Answer question to see correctness label and next button translated
      const options = gameplayScreen.locator('.trivia-option-btn');
      await options.nth(0).click();

      const explanationBlock = gameplayScreen.locator('.trivia-explanation-block');
      await expect(explanationBlock).toBeVisible();
      await expect(async () => {
        const text = await explanationBlock.locator('.trivia-feedback').textContent();
        expect(text).not.toContain('Correct! 🟩');
        expect(text).not.toContain('Incorrect! 🟥');
      }).toPass();

      const nextBtn = gameplayScreen.locator('.trivia-nav-btn');
      await expect(async () => {
        const text = await nextBtn.textContent();
        expect(text).not.toBe('Next Question');
      }).toPass();
    });
  });
});
