import { test, expect } from '@playwright/test';
import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Resolve database path
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.resolve(__dirname, '../polls.db');

test.describe('Database Explanation Caching [AC-2]', () => {
  let getCachedExplanation;
  let setCachedExplanation;

  test.beforeAll(async () => {
    // Attempt to import the required database functions.
    // In the initial red test phase, they might not be exported/implemented yet,
    // which serves as a correct failure indicator.
    try {
      const dbModule = await import('../db.js');
      getCachedExplanation = dbModule.getCachedExplanation;
      setCachedExplanation = dbModule.setCachedExplanation;
    } catch (err) {
      console.warn('Could not import caching functions from db.js:', err.message);
    }
  });

  // [AC-2] Schema Verification: SQLite table trend_explanations exists and has correct columns
  test('should have the trend_explanations table created in SQLite with correct schema', async () => {
    const db = new DatabaseSync(dbPath);
    db.exec('PRAGMA busy_timeout = 5000;');
    db.exec('PRAGMA journal_mode = WAL;');
    try {
      const stmt = db.prepare(`
        SELECT sql FROM sqlite_master 
        WHERE type = 'table' AND name = 'trend_explanations'
      `);
      const row = stmt.get();
      expect(row).toBeDefined();
      expect(row.sql).toContain('trend TEXT PRIMARY KEY');
      expect(row.sql).toContain('explanation TEXT');
      expect(row.sql).toContain('created_at TEXT');
    } finally {
      db.close();
    }
  });

  // [AC-2] getCachedExplanation and setCachedExplanation unit tests
  test('should write and retrieve a trend explanation from the database', async () => {
    if (typeof setCachedExplanation !== 'function' || typeof getCachedExplanation !== 'function') {
      throw new Error('getCachedExplanation or setCachedExplanation is not exported from db.js');
    }

    const testTrend = `test-trend-${Date.now()}`;
    const testExpl = {
      hook: 'Test Hook text',
      whatIsIt: 'Test WhatIsIt text',
      whyIsItViral: ['Reason A', 'Reason B'],
      takeaway: 'Test Takeaway text'
    };

    // Store explanation in cache
    await setCachedExplanation(testTrend, testExpl);

    // Retrieve directly from SQLite table to confirm serialization
    const db = new DatabaseSync(dbPath);
    db.exec('PRAGMA busy_timeout = 5000;');
    db.exec('PRAGMA journal_mode = WAL;');
    try {
      const checkStmt = db.prepare('SELECT explanation, created_at FROM trend_explanations WHERE trend = ?');
      const dbRow = checkStmt.get(testTrend);
      expect(dbRow).toBeDefined();
      const parsed = JSON.parse(dbRow.explanation);
      expect(parsed).toEqual(testExpl);
      expect(dbRow.created_at).toBeDefined();
    } finally {
      db.close();
    }

    // Retrieve via getCachedExplanation function
    const cached = await getCachedExplanation(testTrend);
    expect(cached).toBeDefined();
    expect(cached.hook).toBe(testExpl.hook);
    expect(cached.whatIsIt).toBe(testExpl.whatIsIt);
    expect(cached.whyIsItViral).toEqual(testExpl.whyIsItViral);
    expect(cached.takeaway).toBe(testExpl.takeaway);
  });

  // [AC-2] Retrieve non-existent trend returns null/undefined
  test('should return null or undefined for non-cached trends', async () => {
    if (typeof getCachedExplanation !== 'function') {
      throw new Error('getCachedExplanation is not exported from db.js');
    }
    const nonExistentTrend = `non-cached-${Date.now()}`;
    const result = await getCachedExplanation(nonExistentTrend);
    expect(result).toBeFalsy();
  });
});

test.describe('Trend Explanation API Caching [AC-1]', () => {
  // [AC-1] Caching of Trend Explanations
  test('should serve explanation from cache on subsequent API calls (verified via DB modification)', async ({ request }) => {
    const testTrend = `api-test-trend-${Date.now()}`;
    
    // 1. First request: should trigger initial generation (storing in cache database)
    const res1 = await request.post('/api/explain', {
      data: { trend: testTrend, headline: 'Gemini News', snippet: 'Gemini released' }
    });
    expect(res1.ok()).toBe(true);
    const data1 = await res1.json();
    expect(data1.hook).toBeDefined();

    // Verify it exists in SQLite database
    const db = new DatabaseSync(dbPath);
    db.exec('PRAGMA busy_timeout = 5000;');
    db.exec('PRAGMA journal_mode = WAL;');
    try {
      const checkStmt = db.prepare('SELECT explanation FROM trend_explanations WHERE trend = ?');
      const rowBefore = checkStmt.get(testTrend);
      expect(rowBefore).toBeDefined();

      // 2. Modify database record directly to set specific custom text
      const customExplanation = {
        hook: 'Custom Cached Hook',
        whatIsIt: 'Custom Cached Explanation text',
        whyIsItViral: ['Custom reason 1', 'Custom reason 2'],
        takeaway: 'Custom Cached Takeaway'
      };
      const updateStmt = db.prepare('UPDATE trend_explanations SET explanation = ? WHERE trend = ?');
      updateStmt.run(JSON.stringify(customExplanation), testTrend);
    } finally {
      db.close();
    }

    // 3. Second request: should load from cache, and thus return our custom modification
    const res2 = await request.post('/api/explain', {
      data: { trend: testTrend, headline: 'Gemini News', snippet: 'Gemini released' }
    });
    expect(res2.ok()).toBe(true);
    const data2 = await res2.json();
    
    expect(data2.hook).toBe('Custom Cached Hook');
    expect(data2.whatIsIt).toBe('Custom Cached Explanation text');
    expect(data2.whyIsItViral).toEqual(['Custom reason 1', 'Custom reason 2']);
    expect(data2.takeaway).toBe('Custom Cached Takeaway');
  });
});

test.describe('Live Dynamic Sentiment Poll Integration [AC-3]', () => {
  // [AC-3] Live Dynamic Sentiment Poll Integration
  test('should merge dynamic poll/vote counts with the cached explanation', async ({ request }) => {
    const testTrend = `poll-test-trend-${Date.now()}`;

    // 1. Manually seed SQLite table with a cached explanation to bypass Gemini API call
    const db = new DatabaseSync(dbPath);
    db.exec('PRAGMA busy_timeout = 5000;');
    db.exec('PRAGMA journal_mode = WAL;');
    try {
      const customExplanation = {
        hook: 'Static Cached Hook',
        whatIsIt: 'Static Cached Explanation text',
        whyIsItViral: ['Static reason'],
        takeaway: 'Static Cached Takeaway'
      };
      
      const insertStmt = db.prepare(`
        INSERT OR REPLACE INTO trend_explanations (trend, explanation, created_at)
        VALUES (?, ?, ?)
      `);
      insertStmt.run(testTrend, JSON.stringify(customExplanation), new Date().toISOString());

      // Initialize/seed poll votes
      db.prepare('INSERT OR REPLACE INTO votes (trend, overrated, genius) VALUES (?, 10, 20)').run(testTrend);
    } finally {
      db.close();
    }

    // 2. First explanation request: should return static explanation merged with the initial votes
    const res1 = await request.post('/api/explain', {
      data: { trend: testTrend }
    });
    expect(res1.ok()).toBe(true);
    const data1 = await res1.json();
    expect(data1.hook).toBe('Static Cached Hook');
    expect(data1.polls).toBeDefined();
    expect(data1.polls.overrated).toBe(10);
    expect(data1.polls.genius).toBe(20);

    // 3. Cast a vote to dynamically increment count
    const voteRes = await request.post('/api/poll', {
      data: { trend: testTrend, vote: 'genius', clientId: 'test-client-caching' }
    });
    expect(voteRes.ok()).toBe(true);

    // 4. Second explanation request: should retrieve static cached fields but updated dynamic votes
    const res2 = await request.post('/api/explain', {
      data: { trend: testTrend }
    });
    expect(res2.ok()).toBe(true);
    const data2 = await res2.json();
    expect(data2.hook).toBe('Static Cached Hook');
    expect(data2.polls.overrated).toBe(10);
    expect(data2.polls.genius).toBe(21); // live updated count
  });
});
