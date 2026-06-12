import { test, expect } from '@playwright/test';
import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

// Resolve database path
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.resolve(__dirname, '../polls.db');

test.describe('LLM Caching and Content Optimization Tests', () => {
  let getCachedChatResponse;
  let setCachedChatResponse;
  let getCachedGeneratedPost;
  let setCachedGeneratedPost;

  test.beforeAll(async () => {
    // Attempt to import the required database functions.
    // In the initial red test phase, they might not be exported/implemented yet,
    // which serves as a correct failure indicator.
    try {
      const dbModule = await import('../db.js');
      getCachedChatResponse = dbModule.getCachedChatResponse;
      setCachedChatResponse = dbModule.setCachedChatResponse;
      getCachedGeneratedPost = dbModule.getCachedGeneratedPost;
      setCachedGeneratedPost = dbModule.setCachedGeneratedPost;
    } catch (err) {
      console.warn('Could not import caching functions from db.js:', err.message);
    }
  });

  // --- AC-1: Chat Q&A API Caching ---

  // [AC-1] Schema Verification: SQLite table chat_cache exists
  test('should have the chat_cache table created in SQLite with correct schema', async () => {
    const localDb = new DatabaseSync(dbPath);
    try {
      const stmt = localDb.prepare(`
        SELECT sql FROM sqlite_master 
        WHERE type = 'table' AND name = 'chat_cache'
      `);
      const row = stmt.get();
      expect(row).toBeDefined();
      expect(row.sql).toContain('key TEXT PRIMARY KEY');
      expect(row.sql).toContain('reply TEXT');
    } finally {
      localDb.close();
    }
  });

  // [AC-1] getCachedChatResponse and setCachedChatResponse unit tests
  test('should write and retrieve a chat response from the database cache helper', async () => {
    if (typeof setCachedChatResponse !== 'function' || typeof getCachedChatResponse !== 'function') {
      throw new Error('getCachedChatResponse or setCachedChatResponse is not exported from db.js');
    }

    const testTrend = `test-trend-${Date.now()}`;
    const testQuery = `test-query-${Date.now()}`;
    const testHistory = [{ role: 'user', content: 'hello' }];
    const testReply = 'This is a cached chat reply.';

    // Store in cache
    await setCachedChatResponse(testTrend, testQuery, testHistory, testReply);

    // Retrieve via helper
    const cached = await getCachedChatResponse(testTrend, testQuery, testHistory);
    expect(cached).toBe(testReply);
  });

  // [AC-1] API Integration: /api/chat caching verified via DB mutation
  test('should serve chat response from cache on subsequent API calls (verified via DB modification)', async ({ request }) => {
    const testTrend = `chat-api-trend-${Date.now()}`;
    const testQuery = `chat-api-query-${Date.now()}`;
    const testHistory = [{ role: 'user', content: 'tell me more' }];

    // Clean existing database records just in case to ensure starting clean
    let localDb = new DatabaseSync(dbPath);
    try {
      localDb.prepare('DELETE FROM chat_cache').run();
    } catch (err) {
      // Ignored if table doesn't exist yet
    } finally {
      localDb.close();
    }

    // 1. First request: should trigger generation/mock reply and cache it
    const res1 = await request.post('/api/chat', {
      data: { trend: testTrend, query: testQuery, history: testHistory }
    });
    expect(res1.ok()).toBe(true);
    const data1 = await res1.json();
    expect(data1.reply).toBeDefined();

    // Verify it exists in SQLite database chat_cache table and modify directly
    localDb = new DatabaseSync(dbPath);
    const customReply = 'This is custom hacked reply text from cache!';
    try {
      const checkStmt = localDb.prepare('SELECT * FROM chat_cache WHERE key LIKE ?');
      const rows = checkStmt.all(`${testTrend}:%`);
      expect(rows.length).toBe(1);
      const cachedRow = rows[0];
      expect(cachedRow.key).toBeDefined();

      // 2. Modify database record directly to set specific custom text
      const updateStmt = localDb.prepare('UPDATE chat_cache SET reply = ? WHERE key = ?');
      updateStmt.run(customReply, cachedRow.key);
    } finally {
      localDb.close();
    }

    // 3. Second request: should load from cache, and return our custom modification
    const res2 = await request.post('/api/chat', {
      data: { trend: testTrend, query: testQuery, history: testHistory }
    });
    expect(res2.ok()).toBe(true);
    const data2 = await res2.json();
    expect(data2.reply).toBe(customReply);
  });


  // --- AC-2: Social Media Post Generator Caching ---

  // [AC-2] Schema Verification: SQLite table generated_posts exists
  test('should have the generated_posts table created in SQLite with correct schema', async () => {
    const localDb = new DatabaseSync(dbPath);
    try {
      const stmt = localDb.prepare(`
        SELECT sql FROM sqlite_master 
        WHERE type = 'table' AND name = 'generated_posts'
      `);
      const row = stmt.get();
      expect(row).toBeDefined();
      expect(row.sql).toContain('key TEXT PRIMARY KEY');
      expect(row.sql).toContain('post_text TEXT');
    } finally {
      localDb.close();
    }
  });

  // [AC-2] getCachedGeneratedPost and setCachedGeneratedPost unit tests
  test('should write and retrieve a generated post from the database cache helper', async () => {
    if (typeof setCachedGeneratedPost !== 'function' || typeof getCachedGeneratedPost !== 'function') {
      throw new Error('getCachedGeneratedPost or setCachedGeneratedPost is not exported from db.js');
    }

    const testTitle = `trend-title-${Date.now()}`;
    const testPlatform = 'linkedin';
    const testContext = 'developer';
    const testPostText = 'This is a cached social post text.';

    // Store in cache
    await setCachedGeneratedPost(testTitle, testPlatform, testContext, testPostText);

    // Retrieve via helper
    const cached = await getCachedGeneratedPost(testTitle, testPlatform, testContext);
    expect(cached).toBe(testPostText);
  });

  // [AC-2] API Integration: /api/generate-post caching verified via DB mutation
  test('should serve generated post from cache on subsequent API calls (verified via DB modification)', async ({ request }) => {
    const testTitle = `post-api-title-${Date.now()}`;
    const testPlatform = 'x';
    const testContext = 'funny';

    // Clean existing database records to ensure starting clean
    let localDb = new DatabaseSync(dbPath);
    try {
      localDb.prepare('DELETE FROM generated_posts').run();
    } catch (err) {
      // Ignored if table doesn't exist yet
    } finally {
      localDb.close();
    }

    // 1. First request: should trigger generation/mock post and cache it
    const res1 = await request.post('/api/generate-post', {
      data: { trendTitle: testTitle, platform: testPlatform, contextType: testContext }
    });
    expect(res1.ok()).toBe(true);
    const data1 = await res1.json();
    expect(data1.postText).toBeDefined();

    // Verify it exists in SQLite database generated_posts table and modify directly
    localDb = new DatabaseSync(dbPath);
    const customPost = 'This is custom hacked post text from cache!';
    try {
      const checkStmt = localDb.prepare('SELECT * FROM generated_posts WHERE key LIKE ?');
      const rows = checkStmt.all(`${testTitle}:%`);
      expect(rows.length).toBe(1);
      const cachedRow = rows[0];
      expect(cachedRow.key).toBeDefined();

      // 2. Modify database record directly to set specific custom text
      const updateStmt = localDb.prepare('UPDATE generated_posts SET post_text = ? WHERE key = ?');
      updateStmt.run(customPost, cachedRow.key);
    } finally {
      localDb.close();
    }

    // 3. Second request: should load from cache, and return our custom modification
    const res2 = await request.post('/api/generate-post', {
      data: { trendTitle: testTitle, platform: testPlatform, contextType: testContext }
    });
    expect(res2.ok()).toBe(true);
    const data2 = await res2.json();
    expect(data2.postText).toBe(customPost);
  });


  // --- AC-3: LLM Prompt Quality and Style Optimization ---

  // [AC-3] Prompt Guidelines Verification
  test('should refine all four Gemini prompt templates with style rules and banned words list', async () => {
    const serverJsPath = path.resolve(__dirname, '../server.js');
    const serverJsContent = fs.readFileSync(serverJsPath, 'utf8');

    // Extract the four segments corresponding to the templates
    const getTrendExplanationStart = serverJsContent.indexOf('async function getTrendExplanation(');
    const getLocalizedTrendExplanationStart = serverJsContent.indexOf('async function getLocalizedTrendExplanation(');
    const handleTrendRequestStart = serverJsContent.indexOf('async function handleTrendRequest(');

    expect(getTrendExplanationStart).not.toBe(-1);
    expect(getLocalizedTrendExplanationStart).not.toBe(-1);
    expect(handleTrendRequestStart).not.toBe(-1);

    const getTrendExplanationSection = serverJsContent.slice(getTrendExplanationStart, getLocalizedTrendExplanationStart);
    const getLocalizedTrendExplanationSection = serverJsContent.slice(getLocalizedTrendExplanationStart, handleTrendRequestStart);

    const chatRouteStart = serverJsContent.indexOf("fastify.post('/api/chat',");
    const pollRouteStart = serverJsContent.indexOf("fastify.post('/api/poll',");
    expect(chatRouteStart).not.toBe(-1);
    expect(pollRouteStart).not.toBe(-1);
    const chatRouteSection = serverJsContent.slice(chatRouteStart, pollRouteStart);

    const generatePostRouteStart = serverJsContent.indexOf("fastify.post('/api/generate-post',");
    expect(generatePostRouteStart).not.toBe(-1);
    const generatePostRouteSection = serverJsContent.slice(generatePostRouteStart);

    const bannedWords = [
      'delve',
      'tapestry',
      'revolutionize',
      'unlock',
      'moreover',
      'testament to',
      'it is important to note',
      'firstly',
      'in conclusion',
      'embark'
    ];

    const sections = [
      { name: 'getTrendExplanation', content: getTrendExplanationSection },
      { name: 'getLocalizedTrendExplanation', content: getLocalizedTrendExplanationSection },
      { name: 'chatRoute', content: chatRouteSection },
      { name: 'generatePostRoute', content: generatePostRouteSection }
    ];

    for (const section of sections) {
      // Style assertions: catchy, active voice, fluff-free
      const hasStyleDirectives = 
        section.content.toLowerCase().includes('fluff') || 
        section.content.toLowerCase().includes('catchy') ||
        section.content.toLowerCase().includes('active voice') ||
        section.content.toLowerCase().includes('concise');

      expect(hasStyleDirectives).toBe(true);

      // Check blacklisted words
      for (const word of bannedWords) {
        expect(section.content.toLowerCase()).toContain(word.toLowerCase());
      }
    }
  });
});
