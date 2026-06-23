import { test, expect } from '@playwright/test';
import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Resolve database path
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.resolve(__dirname, '../polls.db');

test.describe('Firestore Optimization and Gemini Chat Capping', () => {

  // ==========================================
  // [AC-1] Zero-Read Session Caching
  // ==========================================

  test('[AC-1] Nickname caching: should bypass SQLite read if cached', async () => {
    const dbModule = await import('../db.js');
    const { getClientNickname, saveClientNickname } = dbModule;
    if (typeof saveClientNickname !== 'function' || typeof getClientNickname !== 'function') {
      throw new Error('saveClientNickname or getClientNickname not implemented');
    }

    const clientId = `test-cache-nick-${Date.now()}`;
    
    // 1. Initial write
    await saveClientNickname(clientId, 'FirstNick');

    // 2. Modify direct SQLite table to 'ModdedNick' to test cache hit
    const db = new DatabaseSync(dbPath);
    try {
      db.prepare('UPDATE client_nicknames SET nickname = ? WHERE client_id = ?').run('ModdedNick', clientId);
    } finally {
      db.close();
    }

    // 3. Read nickname - should return 'FirstNick' (cached, 0 database reads)
    const nick = await getClientNickname(clientId);
    expect(nick).toBe('FirstNick');

    // 4. Invalidate via saveClientNickname
    await saveClientNickname(clientId, 'SecondNick');
    const nick2 = await getClientNickname(clientId);
    expect(nick2).toBe('SecondNick');

    // 5. Test TTL expiry (5 minutes = 300,000 ms)
    const db2 = new DatabaseSync(dbPath);
    try {
      db2.prepare('UPDATE client_nicknames SET nickname = ? WHERE client_id = ?').run('ThirdNick', clientId);
    } finally {
      db2.close();
    }

    const originalNow = Date.now;
    try {
      Date.now = () => originalNow() + 300001; // > 5 minutes later
      const nick3 = await getClientNickname(clientId);
      expect(nick3).toBe('ThirdNick'); // should read from SQLite because cache expired
    } finally {
      Date.now = originalNow;
    }
  });

  test('[AC-1] Daily Streak caching: should bypass SQLite read if cached', async () => {
    const dbModule = await import('../db.js');
    const { getClientStreak, updateClientStreak } = dbModule;
    if (typeof updateClientStreak !== 'function' || typeof getClientStreak !== 'function') {
      throw new Error('updateClientStreak or getClientStreak not implemented');
    }

    const clientId = `test-cache-streak-${Date.now()}`;
    
    // 1. Initial write
    await updateClientStreak(clientId, '2026-06-23');

    // 2. Modify SQLite table directly to 999
    const db = new DatabaseSync(dbPath);
    try {
      db.prepare('UPDATE client_streaks SET streak_count = ? WHERE client_id = ?').run(999, clientId);
    } finally {
      db.close();
    }

    // 3. Read streak count - should return original count (1), not 999 (cached)
    const streak = await getClientStreak(clientId);
    expect(streak).toBeDefined();
    expect(streak.streak_count).toBe(1);

    // 4. Test TTL expiry
    const originalNow = Date.now;
    try {
      Date.now = () => originalNow() + 300001;
      const streakExpired = await getClientStreak(clientId);
      expect(streakExpired).toBeDefined();
      expect(streakExpired.streak_count).toBe(999); // read from DB
    } finally {
      Date.now = originalNow;
    }
  });

  test('[AC-1] Chat Count caching: should bypass SQLite read if cached', async () => {
    const dbModule = await import('../db.js');
    const { getChatCount, incrementChatCount } = dbModule;
    if (typeof incrementChatCount !== 'function' || typeof getChatCount !== 'function') {
      throw new Error('incrementChatCount or getChatCount not implemented');
    }

    const clientId = `test-cache-chat-${Date.now()}`;
    const trend = 'some-trend';

    // 1. Initial write
    await incrementChatCount(clientId, trend);

    // 2. Modify SQLite directly to 999
    const db = new DatabaseSync(dbPath);
    try {
      db.prepare('UPDATE client_chat_counts SET count = ? WHERE client_id = ? AND trend = ?').run(999, clientId, trend);
    } finally {
      db.close();
    }

    // 3. Read chat count - should return 1 (cached)
    const count = await getChatCount(clientId, trend);
    expect(count).toBe(1);

    // 4. Test TTL expiry
    const originalNow = Date.now;
    try {
      Date.now = () => originalNow() + 300001;
      const countExpired = await getChatCount(clientId, trend);
      expect(countExpired).toBe(999);
    } finally {
      Date.now = originalNow;
    }
  });

  test('[AC-1] Trivia Score caching: should bypass SQLite read if cached', async () => {
    const dbModule = await import('../db.js');
    const { getTriviaScore, recordTriviaScore } = dbModule;
    if (typeof recordTriviaScore !== 'function' || typeof getTriviaScore !== 'function') {
      throw new Error('recordTriviaScore or getTriviaScore not implemented');
    }

    const clientId = `client-test-cache-trivia-${Date.now()}`;
    const trend = 'some-trend';

    // 1. Initial write
    await recordTriviaScore(clientId, trend, 3);

    // 2. Modify SQLite directly to 999
    const db = new DatabaseSync(dbPath);
    try {
      db.prepare('UPDATE client_trivia_scores SET score = ? WHERE client_id = ? AND trend = ?').run(999, clientId, trend);
    } finally {
      db.close();
    }

    // 3. Read trivia score - should return 3 (cached)
    const score = await getTriviaScore(clientId, trend);
    expect(score).toBe(3);

    // 4. Test TTL expiry
    const originalNow = Date.now;
    try {
      Date.now = () => originalNow() + 300001;
      const scoreExpired = await getTriviaScore(clientId, trend);
      expect(scoreExpired).toBe(999);
    } finally {
      Date.now = originalNow;
    }
  });

  test('[AC-1] Aggregate Achievements Trivia Scores caching: should bypass SQLite read if cached', async () => {
    const dbModule = await import('../db.js');
    const { getClientAchievements, recordTriviaScore } = dbModule;
    if (typeof getClientAchievements !== 'function' || typeof recordTriviaScore !== 'function') {
      throw new Error('getClientAchievements or recordTriviaScore not implemented');
    }

    const clientId = `client-test-cache-achiev-${Date.now()}`;
    const trend = 'some-trend';

    // 1. Record score
    await recordTriviaScore(clientId, trend, 2);

    // 2. Modify SQLite directly
    const db = new DatabaseSync(dbPath);
    try {
      db.prepare('UPDATE client_trivia_scores SET score = ? WHERE client_id = ?').run(999, clientId);
    } finally {
      db.close();
    }

    // 3. Fetch Achievements - trivia should show score of 2 (cached list)
    const ach = await getClientAchievements(clientId);
    expect(ach.trivia.maxScore).toBe(2);

    // 4. Test TTL expiry
    const originalNow = Date.now;
    try {
      Date.now = () => originalNow() + 300001;
      const achExpired = await getClientAchievements(clientId);
      expect(achExpired.trivia.maxScore).toBe(999);
    } finally {
      Date.now = originalNow;
    }
  });

  // ==========================================
  // [AC-2] Dynamic Cache Invalidation
  // ==========================================

  test('[AC-2] Dynamic Cache Invalidation: should keep global explanations cache indefinitely and invalidate strictly on update/vote/prune', async () => {
    const dbModule = await import('../db.js');
    const { getAllCachedExplanations, setCachedExplanation, incrementVote, pruneOldExplanations } = dbModule;
    if (
      typeof getAllCachedExplanations !== 'function' ||
      typeof setCachedExplanation !== 'function' ||
      typeof incrementVote !== 'function' ||
      typeof pruneOldExplanations !== 'function'
    ) {
      throw new Error('Global explanation caching functions not fully implemented');
    }

    // Let's seed an initial trend
    const trend1 = `global-trend-1-${Date.now()}`;
    const explanation = { hook: 'hook', whatIsIt: 'what', whyIsItViral: [], takeaway: 'take' };
    await setCachedExplanation(trend1, explanation);

    // Get all cached explanations (warms the cache)
    const initialList = await getAllCachedExplanations();
    const initialLength = initialList.length;

    // Modify database directly by inserting a trend behind the cache's back
    const db = new DatabaseSync(dbPath);
    const trend2 = `global-trend-2-${Date.now()}`;
    try {
      db.prepare(`
        INSERT INTO trend_explanations (trend, explanation, created_at)
        VALUES (?, ?, ?)
      `).run(trend2, JSON.stringify(explanation), new Date().toISOString());
    } finally {
      db.close();
    }

    // Get explanations again: it should be cached indefinitely (so trend2 is NOT in the list)
    const cachedList = await getAllCachedExplanations();
    expect(cachedList.length).toBe(initialLength);
    expect(cachedList.find(x => x.trend === trend2)).toBeUndefined();

    // Test that setting time far in the future doesn't expire the cache (indefinite caching)
    const originalNow = Date.now;
    try {
      Date.now = () => originalNow() + 1000 * 60 * 60 * 24 * 365; // 1 year later
      const listAfterOneYear = await getAllCachedExplanations();
      expect(listAfterOneYear.length).toBe(initialLength); // still cached
    } finally {
      Date.now = originalNow;
    }

    // Operation 1: Explanation Ingestion (setCachedExplanation) -> should invalidate cache
    const trend3 = `global-trend-3-${Date.now()}`;
    await setCachedExplanation(trend3, explanation);
    const listAfterIngestion = await getAllCachedExplanations();
    expect(listAfterIngestion.find(x => x.trend === trend2)).toBeDefined();
    expect(listAfterIngestion.find(x => x.trend === trend3)).toBeDefined();

    // Operation 2: Sentiment Voting (incrementVote) -> should invalidate cache
    // Modify DB directly first
    const db3 = new DatabaseSync(dbPath);
    const trend4 = `global-trend-4-${Date.now()}`;
    try {
      db3.prepare(`
        INSERT INTO trend_explanations (trend, explanation, created_at)
        VALUES (?, ?, ?)
      `).run(trend4, JSON.stringify(explanation), new Date().toISOString());
    } finally {
      db3.close();
    }

    // Get explanations (warms cache, trend4 is NOT there yet)
    const cachedList2 = await getAllCachedExplanations();
    expect(cachedList2.find(x => x.trend === trend4)).toBeUndefined();

    // Vote -> invalidates cache
    await incrementVote(trend1, 'genius');
    const listAfterVote = await getAllCachedExplanations();
    expect(listAfterVote.find(x => x.trend === trend4)).toBeDefined();

    // Operation 3: Historical Pruning (pruneOldExplanations) -> should invalidate cache
    // Modify DB directly first
    const db4 = new DatabaseSync(dbPath);
    const trend5 = `global-trend-5-${Date.now()}`;
    try {
      db4.prepare(`
        INSERT INTO trend_explanations (trend, explanation, created_at)
        VALUES (?, ?, ?)
      `).run(trend5, JSON.stringify(explanation), new Date().toISOString());
    } finally {
      db4.close();
    }

    // Get explanations (warms cache, trend5 is NOT there yet)
    const cachedList3 = await getAllCachedExplanations();
    expect(cachedList3.find(x => x.trend === trend5)).toBeUndefined();

    // Prune -> invalidates cache
    await pruneOldExplanations();
    const listAfterPrune = await getAllCachedExplanations();
    expect(listAfterPrune.find(x => x.trend === trend5)).toBeDefined();
  });

  // ==========================================
  // [AC-3] Gemini Chat Abuse Cap
  // ==========================================

  test('[AC-3] Schema Verification: SQLite table client_gemini_chat_counts exists and has correct columns', async () => {
    const db = new DatabaseSync(dbPath);
    try {
      const stmt = db.prepare(`
        SELECT sql FROM sqlite_master 
        WHERE type = 'table' AND name = 'client_gemini_chat_counts'
      `);
      const row = stmt.get();
      expect(row).toBeDefined();
      expect(row.sql).toContain('client_id TEXT');
      expect(row.sql).toContain('trend TEXT');
      expect(row.sql).toContain('count INTEGER DEFAULT 0');
      expect(row.sql).toContain('PRIMARY KEY (client_id, trend)');
    } finally {
      db.close();
    }
  });

  test('[AC-3] DB helpers: getGeminiChatCount and incrementGeminiChatCount', async () => {
    const dbModule = await import('../db.js');
    const { getGeminiChatCount, incrementGeminiChatCount } = dbModule;
    
    if (typeof getGeminiChatCount !== 'function' || typeof incrementGeminiChatCount !== 'function') {
      throw new Error('getGeminiChatCount or incrementGeminiChatCount is not exported from db.js');
    }

    const clientId = `client-gemini-db-${Date.now()}`;
    const trend = 'test-gemini-trend';

    // Initial count is 0
    const initial = await getGeminiChatCount(clientId, trend);
    expect(initial).toBe(0);

    // Increment 1
    await incrementGeminiChatCount(clientId, trend);
    expect(await getGeminiChatCount(clientId, trend)).toBe(1);

    // Increment 4 more times (total 5)
    for (let i = 0; i < 4; i++) {
      await incrementGeminiChatCount(clientId, trend);
    }
    expect(await getGeminiChatCount(clientId, trend)).toBe(5);
  });

  test('[AC-3] API Integration: Gemini chat cap on POST /api/chat', async ({ request }) => {
    const clientId = `client-gemini-api-${Date.now()}`;
    const trend = 'test-api-trend';

    // Call 1-5 should succeed when x-enforce-gemini-cap is true
    for (let i = 1; i <= 5; i++) {
      const res = await request.post('/api/chat', {
        headers: { 'x-enforce-gemini-cap': 'true' },
        data: { trend, query: `Query ${i}`, clientId }
      });
      expect(res.ok()).toBe(true);
      const data = await res.json();
      expect(data.reply).toBeDefined();
    }

    // 6th call should return 403 Forbidden with limit_reached
    const res6 = await request.post('/api/chat', {
      headers: { 'x-enforce-gemini-cap': 'true' },
      data: { trend, query: 'Query 6', clientId }
    });
    expect(res6.status()).toBe(403);
    const errData = await res6.json();
    expect(errData.error).toBe('limit_reached');
    expect(errData.allowedLimit).toBe(5);

    // A different client ID should not be capped yet
    const otherClientId = `client-gemini-api-other-${Date.now()}`;
    const resOther = await request.post('/api/chat', {
      headers: { 'x-enforce-gemini-cap': 'true' },
      data: { trend, query: 'Query other', clientId: otherClientId }
    });
    expect(resOther.ok()).toBe(true);
  });

});
