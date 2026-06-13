import { test, expect } from '@playwright/test';
import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Resolve database path
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.resolve(__dirname, '../polls.db');

test.describe('Chat Limiting and Referral Loops Suite', () => {

  // =========================================================================
  // [AC-1] Lowercase Caching Keys
  // Requirement: Normalize database cache lookup and insertion keys for chat
  // responses (`chat_cache`) and generated social posts (`generated_posts`)
  // to lowercase.
  // =========================================================================
  test('should normalize cache keys to lowercase for chat cache and generated posts', async () => {
    let getCachedChatResponse, setCachedChatResponse;
    let getCachedGeneratedPost, setCachedGeneratedPost;

    try {
      const dbModule = await import('../db.js');
      getCachedChatResponse = dbModule.getCachedChatResponse;
      setCachedChatResponse = dbModule.setCachedChatResponse;
      getCachedGeneratedPost = dbModule.getCachedGeneratedPost;
      setCachedGeneratedPost = dbModule.setCachedGeneratedPost;
    } catch (err) {
      throw new Error(`Failed to import db functions: ${err.message}`);
    }

    const trendMixed = 'Trend-Casing-Test';
    const queryMixed = 'Query-Casing-Test';
    const history = [{ role: 'user', content: 'Test history' }];
    const reply = 'Hooray, it cached!';

    // Store with mixed casing
    await setCachedChatResponse(trendMixed, queryMixed, history, reply);

    // Retrieve with lowercase casing
    const cached1 = await getCachedChatResponse(trendMixed.toLowerCase(), queryMixed.toLowerCase(), history);
    expect(cached1).toBe(reply);

    // Retrieve with mixed/uppercase casing
    const cached2 = await getCachedChatResponse(trendMixed.toUpperCase(), queryMixed.toUpperCase(), history);
    expect(cached2).toBe(reply);

    // Check database to verify the stored key is actually lowercase
    const db = new DatabaseSync(dbPath);
    try {
      const checkStmt = db.prepare('SELECT key FROM chat_cache WHERE reply = ?');
      const row = checkStmt.get(reply);
      expect(row).toBeDefined();
      expect(row.key).toBe(row.key.toLowerCase());
    } finally {
      db.close();
    }

    // Now test generated_posts
    const postTrend = 'Social-Casing-Trend';
    const platform = 'LinkedIn';
    const contextType = 'Professional';
    const postText = 'My awesome post content!';

    await setCachedGeneratedPost(postTrend, platform, contextType, postText);

    // Retrieve with lowercase casing
    const postCached1 = await getCachedGeneratedPost(postTrend.toLowerCase(), platform.toLowerCase(), contextType.toLowerCase());
    expect(postCached1).toBe(postText);

    // Retrieve with uppercase casing
    const postCached2 = await getCachedGeneratedPost(postTrend.toUpperCase(), platform.toUpperCase(), contextType.toUpperCase());
    expect(postCached2).toBe(postText);

    // Check DB key is lowercase
    const db2 = new DatabaseSync(dbPath);
    try {
      const checkStmt = db2.prepare('SELECT key FROM generated_posts WHERE post_text = ?');
      const row = checkStmt.get(postText);
      expect(row).toBeDefined();
      expect(row.key).toBe(row.key.toLowerCase());
    } finally {
      db2.close();
    }
  });

  // =========================================================================
  // [AC-2] Persistent Client ID
  // Requirement: The frontend client ID (`localClientId`) must be persisted
  // in `localStorage` so that page reloads do not reset the identifier.
  // =========================================================================
  test('should persist localClientId in localStorage and keep it across page reloads', async ({ page }) => {
    await page.goto('/');

    // Get client ID on initial load
    const clientId1 = await page.evaluate(() => localStorage.getItem('clientId'));
    expect(clientId1).toBeDefined();
    expect(typeof clientId1).toBe('string');
    expect(clientId1.length).toBeGreaterThan(0);

    // Reload the page
    await page.reload();

    // Verify it is still the same after reload
    const clientId2 = await page.evaluate(() => localStorage.getItem('clientId'));
    expect(clientId2).toBe(clientId1);
  });

  // =========================================================================
  // [AC-3] Chat message Tracking & Referral Storage (Backend)
  // Requirement: SQLite schema should declare client_referrals and client_chat_counts.
  // =========================================================================
  test('should create client_referrals and client_chat_counts tables with correct schemas', async () => {
    const db = new DatabaseSync(dbPath);
    try {
      // Check client_referrals table
      const referralsStmt = db.prepare(`
        SELECT sql FROM sqlite_master 
        WHERE type = 'table' AND name = 'client_referrals'
      `);
      const referralsRow = referralsStmt.get();
      expect(referralsRow).toBeDefined();
      expect(referralsRow.sql).toContain('client_id');
      expect(referralsRow.sql).toContain('referee_id');

      // Check client_chat_counts table
      const countsStmt = db.prepare(`
        SELECT sql FROM sqlite_master 
        WHERE type = 'table' AND name = 'client_chat_counts'
      `);
      const countsRow = countsStmt.get();
      expect(countsRow).toBeDefined();
      expect(countsRow.sql).toContain('client_id');
      expect(countsRow.sql).toContain('trend');
      expect(countsRow.sql).toContain('count');
    } finally {
      db.close();
    }
  });

  // =========================================================================
  // [AC-3] HTTP Endpoints
  // Requirement: Expose GET /api/chat-limit and POST /api/referral.
  // =========================================================================
  test('should expose GET /api/chat-limit and POST /api/referral endpoints', async ({ request }) => {
    const clientId = `test-client-ac3-${Date.now()}`;
    const trend = 'Test Trend AC3';

    // Verify initial chat limit state
    const limitRes = await request.get(`/api/chat-limit?clientId=${clientId}&trend=${trend}`);
    expect(limitRes.status()).toBe(200);
    const limitData = await limitRes.json();
    expect(limitData.limitReached).toBe(false);
    expect(limitData.currentCount).toBe(0);
    expect(limitData.allowedLimit).toBe(3);

    // Record a referral
    const refereeId = `referee-ac3-${Date.now()}`;
    const refRes = await request.post('/api/referral', {
      data: { client_id: clientId, referee_id: refereeId }
    });
    expect(refRes.status()).toBe(200);
    const refData = await refRes.json();
    expect(refData.success).toBe(true);

    // Verify updated allowedLimit is now 8
    const limitResUpdated = await request.get(`/api/chat-limit?clientId=${clientId}&trend=${trend}`);
    expect(limitResUpdated.status()).toBe(200);
    const limitDataUpdated = await limitResUpdated.json();
    expect(limitDataUpdated.allowedLimit).toBe(8);
    expect(limitDataUpdated.limitReached).toBe(false);
  });

  // =========================================================================
  // [AC-4] Enforcing Chat Limits on Chat Endpoint
  // Requirement: Intercept POST /api/chat calls to verify the client's message
  // count against computed limit. Return 403 Forbidden on limit reach.
  // =========================================================================
  test('should enforce chat limit on POST /api/chat when x-enforce-limits is set', async ({ request }) => {
    const clientId = `test-client-ac4-${Date.now()}`;
    const trend = 'Test Trend AC4';
    const query = 'Hello AI';
    const history = [];

    // Trigger POST /api/chat 3 times under limit (with x-enforce-limits header)
    for (let i = 0; i < 3; i++) {
      const res = await request.post('/api/chat', {
        headers: { 'x-enforce-limits': 'true' },
        data: { trend, query, history, clientId }
      });
      expect(res.status()).toBe(200);
      const data = await res.json();
      expect(data.reply).toBeDefined();
    }

    // Verify count in DB is 3
    const limitRes = await request.get(`/api/chat-limit?clientId=${clientId}&trend=${trend}`);
    const limitData = await limitRes.json();
    expect(limitData.currentCount).toBe(3);
    expect(limitData.limitReached).toBe(true);

    // 4th request should return 403 Forbidden
    const res4 = await request.post('/api/chat', {
      headers: { 'x-enforce-limits': 'true' },
      data: { trend, query, history, clientId }
    });
    expect(res4.status()).toBe(403);
    const data4 = await res4.json();
    expect(data4).toEqual({
      error: 'limit_reached',
      allowedLimit: 3
    });

    // Verify limit check is bypassed if x-enforce-limits is not set (default test mode)
    const resBypassed = await request.post('/api/chat', {
      data: { trend, query, history, clientId }
    });
    expect(resBypassed.status()).toBe(200);
  });

  // =========================================================================
  // [AC-5] Chat Limit UI & Locked State (Frontend)
  // Requirement: Hide the chat input form #chat-form and display styled
  // #chat-lock-container inside the AI Q&A card when the user hits their limit.
  // =========================================================================
  test('should lock the chat input and display locked UI overlay on limit reach', async ({ page }) => {
    await page.goto('/');

    // Setup network interception to enforce limits in the browser
    await page.route('**/api/chat', async (route) => {
      const headers = {
        ...route.request().headers(),
        'x-enforce-limits': 'true'
      };
      await route.continue({ headers });
    });

    // Click on the first trend to load it
    await page.locator('.trend-item').first().click();

    // Dynamically retrieve the allowed limit for this client
    const clientId = await page.evaluate(() => localStorage.getItem('clientId'));
    const limitRes = await page.request.get(`/api/chat-limit?clientId=${clientId}&trend=any-trend`);
    const limitData = await limitRes.json();
    const allowedLimit = limitData.allowedLimit;

    // Send chat message allowedLimit times
    const chatInput = page.locator('#chat-input');
    const chatForm = page.locator('#chat-form');

    for (let i = 0; i < allowedLimit; i++) {
      await expect(chatForm).toBeVisible();
      await chatInput.fill(`Message ${i}`);
      await chatInput.press('Enter');
      // Wait for response/reply to appear before typing next
      await page.waitForResponse(response => response.url().includes('/api/chat') && response.status() === 200);
    }

    // After messages, verify the chat-form is hidden and lock container is shown
    await expect(chatForm).toBeHidden();
    
    const lockContainer = page.locator('#chat-lock-container');
    await expect(lockContainer).toBeVisible();

    // Verify the lock container content
    await expect(lockContainer).toContainText(`${allowedLimit}/${allowedLimit} messages`);
    await expect(lockContainer.locator('a[href*="?ref="]')).toBeVisible();
    await expect(page.locator('#check-status-btn')).toBeVisible();
  });

  // =========================================================================
  // [AC-6] Referral Visit Loop Execution
  // Requirement: URL ?ref=clientId records referral in db. Clicking "Check Status"
  // on Client XYZ's screen unlocks their chat.
  // =========================================================================
  test('should record referral from URL param and unlock chat on check status', async ({ context, page }) => {
    // 1. Client A gets locked out
    const pageA = await context.newPage();
    await pageA.goto('/');
    
    // Setup route interception for pageA
    await pageA.route('**/api/chat', async (route) => {
      const headers = { ...route.request().headers(), 'x-enforce-limits': 'true' };
      await route.continue({ headers });
    });

    await pageA.locator('.trend-item').first().click();
    const clientIdA = await pageA.evaluate(() => localStorage.getItem('clientId'));

    // Dynamically retrieve the allowed limit for Client A
    const limitRes = await pageA.request.get(`/api/chat-limit?clientId=${clientIdA}&trend=any-trend`);
    const limitData = await limitRes.json();
    const allowedLimit = limitData.allowedLimit;

    // Send allowedLimit messages to lock it
    const chatInputA = pageA.locator('#chat-input');
    for (let i = 0; i < allowedLimit; i++) {
      await chatInputA.fill(`Msg ${i}`);
      await chatInputA.press('Enter');
      await pageA.waitForResponse(response => response.url().includes('/api/chat') && response.status() === 200);
    }

    // Confirm Client A is locked
    await expect(pageA.locator('#chat-form')).toBeHidden();
    await expect(pageA.locator('#chat-lock-container')).toBeVisible();

    // 2. Client B visits using Client A's referral link
    const contextB = await page.context().browser().newContext();
    const pageB = await contextB.newPage();
    
    // Visit with ref parameter
    await pageB.goto(`/?ref=${clientIdA}`);
    
    // Check Client B's client ID is different from Client A's
    const clientIdB = await pageB.evaluate(() => localStorage.getItem('clientId'));
    expect(clientIdB).not.toBe(clientIdA);

    // Wait a brief moment or check the database/API to ensure the referral is recorded
    const db = new DatabaseSync(dbPath);
    try {
      const stmt = db.prepare('SELECT * FROM client_referrals WHERE client_id = ? AND referee_id = ?');
      const row = stmt.get(clientIdA, clientIdB);
      expect(row).toBeDefined();
    } finally {
      db.close();
    }

    // 3. Client A clicks "Check Status" to unlock their chat
    const checkStatusBtn = pageA.locator('#check-status-btn');
    await checkStatusBtn.click();

    // Verify Client A's chat is now unlocked and the lock container is hidden
    await expect(pageA.locator('#chat-form')).toBeVisible();
    await expect(pageA.locator('#chat-lock-container')).toBeHidden();

    await contextB.close();
  });
});
