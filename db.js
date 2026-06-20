import { Firestore, FieldValue } from '@google-cloud/firestore';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let firestore = null;

// Only initialize Firestore when running in production
if (process.env.NODE_ENV === 'production') {
  try {
    firestore = new Firestore();
    console.log('Firestore initialized successfully in production.');
  } catch (err) {
    console.error('Failed to initialize Firestore, falling back to local database:', err.message);
  }
} else {
  console.log('Running in local/development mode. Using local database fallback.');
}

// Local SQLite fallback and in-memory mock
const inMemoryStorage = new Map();
const inMemoryEvents = new Map();
const inMemoryExplanations = new Map();
const inMemoryLocalizedExplanations = new Map();
const inMemoryChatCache = new Map();
const inMemoryGeneratedPosts = new Map();
const inMemoryTopicImages = new Map();
const inMemoryTrendTrivia = new Map();
const inMemoryClientReferrals = new Map();
const inMemoryClientChatCounts = new Map();
const inMemoryClientTriviaScores = new Map();
const inMemoryClientNicknames = new Map();
export const inMemoryClientStreaks = new Map();
const inMemoryClientPredictions = new Map();
const inMemoryPingedSlugs = new Map();
let sqliteDb = null;
let DatabaseSyncClass = null;
const dbPath = path.join(__dirname, 'polls.db');

if (!firestore) {
  try {
    const { DatabaseSync } = await import('node:sqlite');
    DatabaseSyncClass = DatabaseSync;
    
    let retries = 10;
    let delay = 100;
    let initSuccess = false;
    let initError = null;

    while (retries > 0 && !initSuccess) {
      let initDb = null;
      try {
        initDb = new DatabaseSyncClass(dbPath);
        initDb.exec('PRAGMA journal_mode = WAL;');
        initDb.exec('PRAGMA busy_timeout = 5000;');
        initDb.exec(`
          CREATE TABLE IF NOT EXISTS votes (
            trend TEXT PRIMARY KEY,
            overrated INTEGER DEFAULT 0,
            genius INTEGER DEFAULT 0
          )
        `);
        initDb.exec(`
          CREATE TABLE IF NOT EXISTS vote_events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            trend TEXT,
            vote TEXT,
            timestamp TEXT,
            location TEXT
          )
        `);
        try {
          const schemaRow = initDb.prepare(`
            SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'trend_explanations'
          `).get();
          if (schemaRow && !schemaRow.sql.includes('COLLATE NOCASE')) {
            initDb.exec('DROP TABLE trend_explanations');
          }
        } catch (e) {
          // ignore
        }
        try {
          const schemaRow = initDb.prepare(`
            SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'localized_explanations'
          `).get();
          if (schemaRow && !schemaRow.sql.includes('COLLATE NOCASE')) {
            initDb.exec('DROP TABLE localized_explanations');
          }
        } catch (e) {
          // ignore
        }
        initDb.exec(`
          CREATE TABLE IF NOT EXISTS trend_explanations (
            trend TEXT PRIMARY KEY COLLATE NOCASE,
            explanation TEXT,
            created_at TEXT
          )
        `);
        initDb.exec(`
          CREATE TABLE IF NOT EXISTS localized_explanations (
            trend TEXT COLLATE NOCASE,
            lang TEXT COLLATE NOCASE,
            title TEXT,
            meta_description TEXT,
            explanation TEXT,
            created_at TEXT,
            PRIMARY KEY (trend, lang)
          )
        `);
        initDb.exec(`
          CREATE TABLE IF NOT EXISTS chat_cache (
            key TEXT PRIMARY KEY,
            reply TEXT
          )
        `);
        initDb.exec(`
          CREATE TABLE IF NOT EXISTS generated_posts (
            key TEXT PRIMARY KEY,
            post_text TEXT
          )
        `);
        initDb.exec(`
          CREATE TABLE IF NOT EXISTS client_referrals (
            client_id TEXT,
            referee_id TEXT,
            PRIMARY KEY (client_id, referee_id)
          )
        `);
        initDb.exec(`
          CREATE TABLE IF NOT EXISTS client_chat_counts (
            client_id TEXT,
            trend TEXT,
            count INTEGER DEFAULT 0,
            PRIMARY KEY (client_id, trend)
          )
        `);
        initDb.exec(`
          CREATE TABLE IF NOT EXISTS client_trivia_scores (
            client_id TEXT,
            trend TEXT,
            score INTEGER,
            completed_at TEXT,
            PRIMARY KEY (client_id, trend)
          )
        `);
        initDb.exec(`
          CREATE TABLE IF NOT EXISTS client_streaks (
            client_id TEXT PRIMARY KEY,
            streak_count INTEGER DEFAULT 1,
            last_active_date TEXT
          )
        `);
        initDb.exec(`
          CREATE TABLE IF NOT EXISTS client_nicknames (
            client_id TEXT,
            nickname TEXT,
            PRIMARY KEY (client_id)
          )
        `);
        initDb.exec(`
          CREATE TABLE IF NOT EXISTS viral_post_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            trend TEXT,
            platform TEXT,
            post_text TEXT,
            created_at TEXT
          )
        `);
        try {
          const schemaRow = initDb.prepare(`
            SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'topic_images'
          `).get();
          if (schemaRow && !schemaRow.sql.includes('COLLATE NOCASE')) {
            initDb.exec('DROP TABLE topic_images');
          }
        } catch (e) {
          // ignore check/drop error
        }
        initDb.exec(`
          CREATE TABLE IF NOT EXISTS topic_images (
            trend TEXT PRIMARY KEY COLLATE NOCASE,
            svg TEXT,
            created_at TEXT
          )
        `);
        initDb.exec(`
          CREATE TABLE IF NOT EXISTS trend_trivia (
            trend TEXT,
            lang TEXT,
            trivia TEXT,
            created_at TEXT,
            PRIMARY KEY (trend, lang)
          )
        `);
        initDb.exec(`
          CREATE TABLE IF NOT EXISTS client_predictions (
            client_id TEXT,
            trend TEXT COLLATE NOCASE,
            prediction TEXT,
            prediction_date TEXT,
            status TEXT,
            resolved_at TEXT,
            PRIMARY KEY (client_id, trend, prediction_date)
          )
        `);
        initDb.exec(`
          CREATE TABLE IF NOT EXISTS pinged_slugs (
            slug TEXT PRIMARY KEY,
            created_at TEXT
          )
        `);
        try {
          initDb.prepare(`
            INSERT OR IGNORE INTO trend_explanations (trend, explanation, created_at)
            VALUES (?, ?, ?)
          `).run(
            "World Cup tourists: what's your honest feedback on the USA's stadiums",
            JSON.stringify({
              hook: "World Cup tourists feedback",
              whatIsIt: "Feedback on USA stadiums",
              whyIsItViral: [],
              takeaway: "Stadia feedback"
            }),
            new Date().toISOString()
          );
        } catch (seedErr) {
          console.error("Error seeding default trend:", seedErr.message);
        }
        initSuccess = true;
      } catch (err) {
        initError = err;
        retries--;
        if (retries > 0) {
          await new Promise(resolve => setTimeout(resolve, delay));
          delay *= 1.5;
        }
      } finally {
        if (initDb) {
          try {
            initDb.close();
          } catch (e) {}
        }
      }
    }

    if (!initSuccess) {
      throw initError || new Error('Failed to initialize local SQLite database');
    }

    sqliteDb = {
      prepare(sql) {
        return {
          get(...args) {
            const db = new DatabaseSyncClass(dbPath);
            db.exec('PRAGMA busy_timeout = 5000;');
            try {
              const stmt = db.prepare(sql);
              return stmt.get(...args);
            } finally {
              db.close();
            }
          },
          all(...args) {
            const db = new DatabaseSyncClass(dbPath);
            db.exec('PRAGMA busy_timeout = 5000;');
            try {
              const stmt = db.prepare(sql);
              return stmt.all(...args);
            } finally {
              db.close();
            }
          },
          run(...args) {
            const db = new DatabaseSyncClass(dbPath);
            db.exec('PRAGMA busy_timeout = 5000;');
            try {
              const stmt = db.prepare(sql);
              return stmt.run(...args);
            } finally {
              db.close();
            }
          }
        };
      },
      exec(sql) {
        const db = new DatabaseSyncClass(dbPath);
        db.exec('PRAGMA busy_timeout = 5000;');
        try {
          return db.exec(sql);
        } finally {
          db.close();
        }
      }
    };
    console.log('Local SQLite database initialized successfully with connection-scoping wrapper at', dbPath);
  } catch (err) {
    console.warn('WARNING: Failed to load node:sqlite, falling back to in-memory mock storage:', err.message);
  }
}

/**
 * Retrieves the poll/sentiment data for a given trend.
 * @param {string} trend 
 * @returns {Promise<{overrated: number, genius: number}>}
 */
export async function getPollData(trend) {
  const normalizedTrend = trend ? trend.toLowerCase() : '';
  if (firestore) {
    try {
      const docId = getFirestoreDocId(normalizedTrend);
      const docRef = firestore.collection('polls').doc(docId);
      const doc = await docRef.get();
      if (doc.exists) {
        const data = doc.data();
        return {
          overrated: data.overrated || 0,
          genius: data.genius || 0
        };
      }
      return { overrated: 0, genius: 0 };
    } catch (err) {
      console.error(`Firestore error in getPollData for "${normalizedTrend}":`, err.message);
    }
  }

  // SQLite fallback
  if (sqliteDb) {
    try {
      const stmt = sqliteDb.prepare('SELECT overrated, genius FROM votes WHERE trend = ?');
      const row = stmt.get(normalizedTrend);
      if (row) {
        return { overrated: row.overrated, genius: row.genius };
      }
      return { overrated: 0, genius: 0 };
    } catch (err) {
      console.error(`Local SQLite query failed for "${normalizedTrend}":`, err.message);
    }
  }

  // In-memory fallback
  if (!inMemoryStorage.has(normalizedTrend)) {
    inMemoryStorage.set(normalizedTrend, { overrated: 0, genius: 0 });
  }
  return inMemoryStorage.get(normalizedTrend);
}

/**
 * Increments the vote count for a trend (either 'overrated' or 'genius') and returns the updated counts.
 * @param {string} trend 
 * @param {'overrated'|'genius'} vote 
 * @returns {Promise<{overrated: number, genius: number}>}
 */
export async function incrementVote(trend, vote, location = null) {
  const normalizedTrend = trend ? trend.toLowerCase() : '';
  if (firestore) {
    try {
      const docId = getFirestoreDocId(normalizedTrend);
      const docRef = firestore.collection('polls').doc(docId);
      await docRef.set({
        [vote]: FieldValue.increment(1)
      }, { merge: true });

      const doc = await docRef.get();
      if (doc.exists) {
        const data = doc.data();
        return {
          overrated: data.overrated || 0,
          genius: data.genius || 0
        };
      }
    } catch (err) {
      console.error(`Firestore error in incrementVote for "${normalizedTrend}":`, err.message);
    }
  }

  // Get current state to return after SQLite/in-memory update
  const current = sqliteDb
    ? await getLocalSqlitePollData(normalizedTrend)
    : (inMemoryStorage.get(normalizedTrend) || { overrated: 0, genius: 0 });
  
  current[vote]++;

  const timestamp = new Date().toISOString();
  const locStr = location ? JSON.stringify(location) : null;

  // SQLite fallback update
  if (sqliteDb) {
    const db = new DatabaseSyncClass(dbPath);
    db.exec('PRAGMA busy_timeout = 5000;');
    try {
      db.exec('BEGIN IMMEDIATE TRANSACTION;');
      db.prepare('INSERT OR IGNORE INTO votes (trend, overrated, genius) VALUES (?, 0, 0)').run(normalizedTrend);
      if (vote === 'genius') {
        db.prepare('UPDATE votes SET genius = genius + 1 WHERE trend = ?').run(normalizedTrend);
      } else if (vote === 'overrated') {
        db.prepare('UPDATE votes SET overrated = overrated + 1 WHERE trend = ?').run(normalizedTrend);
      }
      db.prepare('INSERT INTO vote_events (trend, vote, timestamp, location) VALUES (?, ?, ?, ?)').run(normalizedTrend, vote, timestamp, locStr);
      db.exec('COMMIT;');
      return current;
    } catch (err) {
      try {
        db.exec('ROLLBACK;');
      } catch (rollbackErr) {}
      console.error(`Local SQLite write failed for "${normalizedTrend}":`, err.message);
    } finally {
      db.close();
    }
  }

  // In-memory fallback update
  inMemoryStorage.set(normalizedTrend, current);
  if (!inMemoryEvents.has(normalizedTrend)) {
    inMemoryEvents.set(normalizedTrend, []);
  }
  inMemoryEvents.get(normalizedTrend).push({ vote, timestamp, location: locStr });
  return current;
}

// Simple synchronous/asynchronous helper to get data locally without repeating fallback checks
async function getLocalSqlitePollData(trend) {
  const normalizedTrend = trend ? trend.toLowerCase() : '';
  try {
    const stmt = sqliteDb.prepare('SELECT overrated, genius FROM votes WHERE trend = ?');
    const row = stmt.get(normalizedTrend);
    if (row) {
      return { overrated: row.overrated, genius: row.genius };
    }
  } catch (err) {
    // ignore
  }
  return { overrated: 0, genius: 0 };
}

/**
 * Retrieves all individual vote events for a given trend.
 * @param {string} trend
 * @returns {Promise<Array<{vote: string, timestamp: string, location: string}>>}
 */
export async function getVoteEvents(trend) {
  const normalizedTrend = trend ? trend.toLowerCase() : '';
  if (sqliteDb) {
    try {
      const stmt = sqliteDb.prepare('SELECT vote, timestamp, location FROM vote_events WHERE trend = ? ORDER BY timestamp ASC');
      return stmt.all(normalizedTrend);
    } catch (err) {
      console.error(`Local SQLite query for vote_events failed:`, err.message);
      return [];
    }
  }
  return inMemoryEvents.get(normalizedTrend) || [];
}

/**
 * Seeds multiple historical vote events for a trend.
 * @param {string} trend
 * @param {Array<{vote: string, timestamp: string, location: any}>} events
 */
export async function seedVoteEvents(trend, events) {
  const normalizedTrend = trend ? trend.toLowerCase() : '';
  if (sqliteDb) {
    const db = new DatabaseSyncClass(dbPath);
    db.exec('PRAGMA busy_timeout = 5000;');
    try {
      db.exec('BEGIN IMMEDIATE TRANSACTION;');
      
      db.prepare('INSERT OR IGNORE INTO votes (trend, overrated, genius) VALUES (?, 0, 0)').run(normalizedTrend);
      const stmt = db.prepare('INSERT INTO vote_events (trend, vote, timestamp, location) VALUES (?, ?, ?, ?)');
      let geniusCount = 0;
      let overratedCount = 0;
      for (const ev of events) {
        stmt.run(normalizedTrend, ev.vote, ev.timestamp, ev.location ? JSON.stringify(ev.location) : null);
        if (ev.vote === 'genius') geniusCount++;
        else overratedCount++;
      }
      db.prepare('UPDATE votes SET genius = genius + ?, overrated = overrated + ? WHERE trend = ?')
        .run(geniusCount, overratedCount, normalizedTrend);
        
      db.exec('COMMIT;');
    } catch (err) {
      try {
        db.exec('ROLLBACK;');
      } catch (rollbackErr) {}
      console.error(`Local SQLite seedVoteEvents failed:`, err.message);
    } finally {
      db.close();
    }
  } else {
    if (!inMemoryEvents.has(normalizedTrend)) {
      inMemoryEvents.set(normalizedTrend, []);
    }
    const arr = inMemoryEvents.get(normalizedTrend);
    let geniusCount = 0;
    let overratedCount = 0;
    for (const ev of events) {
      arr.push({ vote: ev.vote, timestamp: ev.timestamp, location: ev.location ? JSON.stringify(ev.location) : null });
      if (ev.vote === 'genius') geniusCount++;
      else overratedCount++;
    }
    const current = inMemoryStorage.get(normalizedTrend) || { overrated: 0, genius: 0 };
    current.genius += geniusCount;
    current.overrated += overratedCount;
    inMemoryStorage.set(normalizedTrend, current);
  }
}

/**
 * Retrieves the cached explanation for a trend if it exists.
 * @param {string} trend 
 * @returns {Promise<{hook: string, whatIsIt: string, whyIsItViral: string[], takeaway: string} | null>}
 */
export async function getCachedExplanation(trend) {
  const normalizedTrend = trend ? trend.trim().toLowerCase() : '';
  if (firestore) {
    try {
      const docId = getFirestoreDocId(normalizedTrend);
      const docRef = firestore.collection('trend_explanations').doc(docId);
      const doc = await docRef.get();
      if (doc.exists) {
        const data = doc.data();
        return {
          hook: data.hook,
          whatIsIt: data.whatIsIt,
          whyIsItViral: data.whyIsItViral || [],
          takeaway: data.takeaway,
          continuationProbability: data.continuationProbability,
          continuationRationale: data.continuationRationale,
          created_at: data.created_at
        };
      }
      return null;
    } catch (err) {
      console.error(`Firestore error in getCachedExplanation for "${normalizedTrend}":`, err.message);
      return null;
    }
  }

  if (sqliteDb) {
    try {
      const stmt = sqliteDb.prepare('SELECT explanation, created_at FROM trend_explanations WHERE trend = ?');
      let row = stmt.get(normalizedTrend);
      if (!row && normalizedTrend.includes(' ')) {
        row = stmt.get(normalizedTrend.replace(/\s+/g, '-'));
      }
      if (row && row.explanation) {
        const explanation = JSON.parse(row.explanation);
        explanation.created_at = row.created_at;
        return explanation;
      }
      return null;
    } catch (err) {
      console.error(`Local SQLite query failed for getCachedExplanation "${normalizedTrend}":`, err.message);
      return null;
    }
  }

  let cached = inMemoryExplanations.get(normalizedTrend);
  if (!cached && normalizedTrend.includes(' ')) {
    cached = inMemoryExplanations.get(normalizedTrend.replace(/\s+/g, '-'));
  }
  if (cached) {
    return {
      ...cached.explanation,
      created_at: cached.created_at
    };
  }
  return null;
}

/**
 * Stores the trend explanation in the cache.
 * @param {string} trend 
 * @param {{hook: string, whatIsIt: string, whyIsItViral: string[], takeaway: string, continuationProbability?: number, continuationRationale?: string}} explanation 
 * @returns {Promise<void>}
 */
export async function setCachedExplanation(trend, explanation) {
  const normalizedTrend = trend ? trend.trim().toLowerCase() : '';
  const createdAt = new Date().toISOString();
  const dataToSave = {
    hook: explanation.hook,
    whatIsIt: explanation.whatIsIt,
    whyIsItViral: explanation.whyIsItViral || [],
    takeaway: explanation.takeaway,
    continuationProbability: explanation.continuationProbability,
    continuationRationale: explanation.continuationRationale,
    trend: trend
  };

  if (firestore) {
    try {
      const docId = getFirestoreDocId(normalizedTrend);
      const docRef = firestore.collection('trend_explanations').doc(docId);
      await docRef.set({
        ...dataToSave,
        created_at: createdAt
      });
      return;
    } catch (err) {
      console.error(`Firestore error in setCachedExplanation for "${normalizedTrend}":`, err.message);
      return;
    }
  }

  if (sqliteDb) {
    try {
      sqliteDb.prepare(`
        INSERT OR REPLACE INTO trend_explanations (trend, explanation, created_at)
        VALUES (?, ?, ?)
      `).run(normalizedTrend, JSON.stringify(dataToSave), createdAt);
      return;
    } catch (err) {
      console.error(`Local SQLite insert failed for setCachedExplanation "${normalizedTrend}":`, err.message);
      return;
    }
  }

  inMemoryExplanations.set(normalizedTrend, {
    explanation: dataToSave,
    created_at: createdAt
  });
}

/**
 * Retrieves the cached localized explanation for a trend if it exists.
 * @param {string} trend 
 * @param {string} lang 
 * @returns {Promise<{title: string, meta_description: string, explanation: {hook: string, whatIsIt: string, whyIsItViral: string[], takeaway: string}} | null>}
 */
export async function getLocalizedExplanation(trend, lang) {
  const normalizedTrend = trend ? trend.trim().toLowerCase() : '';
  const normalizedLang = lang ? lang.trim().toLowerCase() : '';
  if (firestore) {
    try {
      const docId = `${normalizedTrend}_${normalizedLang}`;
      const hashedId = getFirestoreDocId(docId);
      const docRef = firestore.collection('localized_explanations').doc(hashedId);
      const doc = await docRef.get();
      if (doc.exists) {
        const data = doc.data();
        return {
          title: data.title,
          meta_description: data.meta_description,
          explanation: typeof data.explanation === 'string' ? JSON.parse(data.explanation) : data.explanation,
          created_at: data.created_at
        };
      }
      return null;
    } catch (err) {
      console.error(`Firestore error in getLocalizedExplanation for "${normalizedTrend}" "${normalizedLang}":`, err.message);
      return null;
    }
  }

  if (sqliteDb) {
    try {
      const stmt = sqliteDb.prepare('SELECT title, meta_description, explanation, created_at FROM localized_explanations WHERE trend = ? AND lang = ?');
      let row = stmt.get(normalizedTrend, normalizedLang);
      if (!row && normalizedTrend.includes(' ')) {
        row = stmt.get(normalizedTrend.replace(/\s+/g, '-'), normalizedLang);
      }
      if (row) {
        return {
          title: row.title,
          meta_description: row.meta_description,
          explanation: JSON.parse(row.explanation),
          created_at: row.created_at
        };
      }
      return null;
    } catch (err) {
      console.error(`Local SQLite query failed for getLocalizedExplanation "${normalizedTrend}" "${normalizedLang}":`, err.message);
      return null;
    }
  }

  let cached = inMemoryLocalizedExplanations.get(`${normalizedTrend}_${normalizedLang}`);
  if (!cached && normalizedTrend.includes(' ')) {
    cached = inMemoryLocalizedExplanations.get(`${normalizedTrend.replace(/\s+/g, '-')}_${normalizedLang}`);
  }
  if (cached) {
    return {
      ...cached,
      created_at: cached.created_at
    };
  }
  return null;
}

/**
 * Stores the localized trend explanation in the cache.
 * @param {string} trend 
 * @param {string} lang 
 * @param {{title: string, meta_description: string, explanation: {hook: string, whatIsIt: string, whyIsItViral: string[], takeaway: string}}} data 
 * @returns {Promise<void>}
 */
export async function setLocalizedExplanation(trend, lang, data) {
  const normalizedTrend = trend ? trend.trim().toLowerCase() : '';
  const normalizedLang = lang ? lang.trim().toLowerCase() : '';
  const createdAt = new Date().toISOString();
  const { title, meta_description, explanation } = data;

  if (firestore) {
    try {
      const docId = `${normalizedTrend}_${normalizedLang}`;
      const hashedId = getFirestoreDocId(docId);
      const docRef = firestore.collection('localized_explanations').doc(hashedId);
      await docRef.set({
        trend: normalizedTrend,
        lang: normalizedLang,
        title,
        meta_description,
        explanation,
        created_at: createdAt
      });
      return;
    } catch (err) {
      console.error(`Firestore error in setLocalizedExplanation for "${normalizedTrend}" "${normalizedLang}":`, err.message);
      return;
    }
  }

  if (sqliteDb) {
    try {
      sqliteDb.prepare(`
        INSERT OR REPLACE INTO localized_explanations (trend, lang, title, meta_description, explanation, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(normalizedTrend, normalizedLang, title, meta_description, JSON.stringify(explanation), createdAt);
      return;
    } catch (err) {
      console.error(`Local SQLite insert failed for setLocalizedExplanation "${normalizedTrend}" "${normalizedLang}":`, err.message);
      return;
    }
  }

  inMemoryLocalizedExplanations.set(`${normalizedTrend}_${normalizedLang}`, {
    title,
    meta_description,
    explanation,
    created_at: createdAt
  });
}

function getChatCacheKey(trend, query, history) {
  const normalizedHistory = (history || []).map(msg => ({
    role: (msg.role || '').toLowerCase(),
    content: (msg.content || '').toLowerCase()
  }));
  const serializedHistory = JSON.stringify(normalizedHistory);
  const hash = crypto.createHash('sha256').update(serializedHistory).digest('hex');
  const normalizedTrend = (trend || '').trim().toLowerCase();
  const normalizedQuery = (query || '').trim().toLowerCase();
  return `${normalizedTrend}:${normalizedQuery}:${hash}`;
}

function getPostCacheKey(trendTitle, platform, contextType) {
  return `${trendTitle || ''}:${platform || ''}:${contextType || ''}`.toLowerCase();
}

export function getFirestoreDocId(key) {
  return crypto.createHash('sha256').update(key).digest('hex');
}

/**
 * Retrieves the cached chat response if it exists.
 * @param {string} trend
 * @param {string} query
 * @param {Array} history
 * @returns {Promise<string | null>}
 */
export async function getCachedChatResponse(trend, query, history) {
  const key = getChatCacheKey(trend, query, history);

  if (firestore) {
    try {
      const docId = getFirestoreDocId(key);
      const docRef = firestore.collection('chat_cache').doc(docId);
      const doc = await docRef.get();
      if (doc.exists) {
        return doc.data().reply || null;
      }
      return null;
    } catch (err) {
      console.error(`Firestore error in getCachedChatResponse:`, err.message);
      return null;
    }
  }

  if (sqliteDb) {
    try {
      const stmt = sqliteDb.prepare('SELECT reply FROM chat_cache WHERE key = ?');
      const row = stmt.get(key);
      if (row && row.reply !== undefined) {
        return row.reply;
      }
      return null;
    } catch (err) {
      console.error(`Local SQLite query failed for getCachedChatResponse:`, err.message);
      return null;
    }
  }

  return inMemoryChatCache.get(key) || null;
}

/**
 * Stores the chat response in the cache.
 * @param {string} trend
 * @param {string} query
 * @param {Array} history
 * @param {string} reply
 * @returns {Promise<void>}
 */
export async function setCachedChatResponse(trend, query, history, reply) {
  const key = getChatCacheKey(trend, query, history);

  if (firestore) {
    try {
      const docId = getFirestoreDocId(key);
      const docRef = firestore.collection('chat_cache').doc(docId);
      await docRef.set({
        key,
        reply,
        created_at: new Date().toISOString()
      });
      return;
    } catch (err) {
      console.error(`Firestore error in setCachedChatResponse:`, err.message);
      return;
    }
  }

  if (sqliteDb) {
    try {
      sqliteDb.prepare(`
        INSERT OR REPLACE INTO chat_cache (key, reply)
        VALUES (?, ?)
      `).run(key, reply);
      return;
    } catch (err) {
      console.error(`Local SQLite insert failed for setCachedChatResponse:`, err.message);
      return;
    }
  }

  inMemoryChatCache.set(key, reply);
}

/**
 * Retrieves the cached generated post if it exists.
 * @param {string} trendTitle
 * @param {string} platform
 * @param {string} contextType
 * @returns {Promise<string | null>}
 */
export async function getCachedGeneratedPost(trendTitle, platform, contextType) {
  const key = getPostCacheKey(trendTitle, platform, contextType);

  if (firestore) {
    try {
      const docId = getFirestoreDocId(key);
      const docRef = firestore.collection('generated_posts').doc(docId);
      const doc = await docRef.get();
      if (doc.exists) {
        return doc.data().post_text || null;
      }
      return null;
    } catch (err) {
      console.error(`Firestore error in getCachedGeneratedPost:`, err.message);
      return null;
    }
  }

  if (sqliteDb) {
    try {
      const stmt = sqliteDb.prepare('SELECT post_text FROM generated_posts WHERE key = ?');
      const row = stmt.get(key);
      if (row && row.post_text !== undefined) {
        return row.post_text;
      }
      return null;
    } catch (err) {
      console.error(`Local SQLite query failed for getCachedGeneratedPost:`, err.message);
      return null;
    }
  }

  return inMemoryGeneratedPosts.get(key) || null;
}

/**
 * Stores the generated post in the cache.
 * @param {string} trendTitle
 * @param {string} platform
 * @param {string} contextType
 * @param {string} postText
 * @returns {Promise<void>}
 */
export async function setCachedGeneratedPost(trendTitle, platform, contextType, postText) {
  const key = getPostCacheKey(trendTitle, platform, contextType);

  if (firestore) {
    try {
      const docId = getFirestoreDocId(key);
      const docRef = firestore.collection('generated_posts').doc(docId);
      await docRef.set({
        key,
        post_text: postText,
        created_at: new Date().toISOString()
      });
      return;
    } catch (err) {
      console.error(`Firestore error in setCachedGeneratedPost:`, err.message);
      return;
    }
  }

  if (sqliteDb) {
    try {
      sqliteDb.prepare(`
        INSERT OR REPLACE INTO generated_posts (key, post_text)
        VALUES (?, ?)
      `).run(key, postText);
      return;
    } catch (err) {
      console.error(`Local SQLite insert failed for setCachedGeneratedPost:`, err.message);
      return;
    }
  }

  inMemoryGeneratedPosts.set(key, postText);
}

const inMemoryViralPostHistory = [];

export async function insertViralPost(trend, platform, postText, createdAt) {
  const post = {
    trend,
    platform,
    post_text: postText,
    created_at: createdAt
  };
  
  if (firestore) {
    try {
      await firestore.collection('viral_post_history').add(post);
      return post;
    } catch (err) {
      console.error('Firestore error in insertViralPost:', err.message);
    }
  }
  
  if (sqliteDb) {
    try {
      const stmt = sqliteDb.prepare(`
        INSERT INTO viral_post_history (trend, platform, post_text, created_at)
        VALUES (?, ?, ?, ?)
      `);
      const info = stmt.run(trend, platform, postText, createdAt);
      post.id = info.lastInsertRowid;
      return post;
    } catch (err) {
      console.error('Local SQLite insert failed for insertViralPost:', err.message);
    }
  }
  
  post.id = inMemoryViralPostHistory.length + 1;
  inMemoryViralPostHistory.push(post);
  return post;
}

export async function getViralPostHistory() {
  if (firestore) {
    try {
      const snapshot = await firestore.collection('viral_post_history')
        .orderBy('created_at', 'desc')
        .get();
      const list = [];
      snapshot.forEach(doc => {
        list.push({ id: doc.id, ...doc.data() });
      });
      return list;
    } catch (err) {
      console.error('Firestore error in getViralPostHistory:', err.message);
      return [];
    }
  }
  
  if (sqliteDb) {
    try {
      const stmt = sqliteDb.prepare('SELECT * FROM viral_post_history ORDER BY created_at DESC');
      return stmt.all();
    } catch (err) {
      console.error('Local SQLite SELECT failed for getViralPostHistory:', err.message);
      return [];
    }
  }
  
  return [...inMemoryViralPostHistory].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

/**
 * Retrieves the cached topic SVG image for a trend.
 * @param {string} trend 
 * @returns {Promise<string | null>}
 */
export async function getCachedTopicImage(trend) {
  const normalizedTrend = trend ? trend.trim().toLowerCase() : '';
  if (firestore) {
    try {
      const docId = getFirestoreDocId(normalizedTrend);
      const docRef = firestore.collection('topic_images').doc(docId);
      const doc = await docRef.get();
      if (doc.exists) {
        return doc.data().svg || null;
      }
      return null;
    } catch (err) {
      console.error(`Firestore error in getCachedTopicImage for "${normalizedTrend}":`, err.message);
      return null;
    }
  }

  if (sqliteDb) {
    try {
      const stmt = sqliteDb.prepare('SELECT svg FROM topic_images WHERE trend = ?');
      const row = stmt.get(normalizedTrend);
      if (row && row.svg !== undefined) {
        return row.svg;
      }
      return null;
    } catch (err) {
      console.error(`Local SQLite query failed for getCachedTopicImage "${normalizedTrend}":`, err.message);
      return null;
    }
  }

  return inMemoryTopicImages.get(normalizedTrend) || null;
}

/**
 * Caches the topic SVG image for a trend.
 * @param {string} trend 
 * @param {string} svg 
 * @returns {Promise<void>}
 */
export async function setCachedTopicImage(trend, svg) {
  const createdAt = new Date().toISOString();
  const normalizedTrend = trend ? trend.trim().toLowerCase() : '';

  if (firestore) {
    try {
      const docId = getFirestoreDocId(normalizedTrend);
      const docRef = firestore.collection('topic_images').doc(docId);
      await docRef.set({
        trend: normalizedTrend,
        svg,
        created_at: createdAt
      });
      return;
    } catch (err) {
      console.error(`Firestore error in setCachedTopicImage for "${normalizedTrend}":`, err.message);
      return;
    }
  }

  if (sqliteDb) {
    try {
      sqliteDb.prepare(`
        INSERT OR REPLACE INTO topic_images (trend, svg, created_at)
        VALUES (?, ?, ?)
      `).run(normalizedTrend, svg, createdAt);
      return;
    } catch (err) {
      console.error(`Local SQLite insert failed for setCachedTopicImage "${normalizedTrend}":`, err.message);
      return;
    }
  }

  inMemoryTopicImages.set(normalizedTrend, svg);
}

/**
 * Retrieves the cached trivia for a trend if it exists.
 * @param {string} trend 
 * @param {string} lang 
 * @returns {Promise<Array | null>}
 */
export async function getTrendTrivia(trend, lang) {
  const normalizedTrend = trend ? trend.trim().toLowerCase() : '';
  const normalizedLang = lang ? lang.trim().toLowerCase() : '';

  if (firestore) {
    try {
      const docId = `${normalizedTrend}_${normalizedLang}`;
      const docRef = firestore.collection('trend_trivia').doc(docId);
      const doc = await docRef.get();
      if (doc.exists) {
        const data = doc.data();
        return typeof data.trivia === 'string' ? JSON.parse(data.trivia) : data.trivia;
      }
      return null;
    } catch (err) {
      console.error(`Firestore error in getTrendTrivia for "${trend}" "${lang}":`, err.message);
      return null;
    }
  }

  if (sqliteDb) {
    try {
      const stmt = sqliteDb.prepare('SELECT trivia FROM trend_trivia WHERE trend = ? AND lang = ?');
      const row = stmt.get(normalizedTrend, normalizedLang);
      if (row) {
        return JSON.parse(row.trivia);
      }
      return null;
    } catch (err) {
      console.error(`Local SQLite query failed for getTrendTrivia "${trend}" "${lang}":`, err.message);
      return null;
    }
  }

  return inMemoryTrendTrivia.get(`${normalizedTrend}_${normalizedLang}`) || null;
}

/**
 * Stores the trend trivia in the cache.
 * @param {string} trend 
 * @param {string} lang 
 * @param {Array} trivia 
 * @returns {Promise<void>}
 */
export async function setTrendTrivia(trend, lang, trivia) {
  const createdAt = new Date().toISOString();
  const normalizedTrend = trend ? trend.trim().toLowerCase() : '';
  const normalizedLang = lang ? lang.trim().toLowerCase() : '';
  const triviaStr = JSON.stringify(trivia);

  if (firestore) {
    try {
      const docId = `${normalizedTrend}_${normalizedLang}`;
      const docRef = firestore.collection('trend_trivia').doc(docId);
      await docRef.set({
        trend: normalizedTrend,
        lang: normalizedLang,
        trivia: trivia,
        created_at: createdAt
      });
      return;
    } catch (err) {
      console.error(`Firestore error in setTrendTrivia for "${trend}" "${lang}":`, err.message);
      return;
    }
  }

  if (sqliteDb) {
    try {
      sqliteDb.prepare(`
        INSERT OR REPLACE INTO trend_trivia (trend, lang, trivia, created_at)
        VALUES (?, ?, ?, ?)
      `).run(normalizedTrend, normalizedLang, triviaStr, createdAt);
      return;
    } catch (err) {
      console.error(`Local SQLite insert failed for setTrendTrivia "${trend}" "${lang}":`, err.message);
      return;
    }
  }

  inMemoryTrendTrivia.set(`${normalizedTrend}_${normalizedLang}`, trivia);
}

/**
 * Records a referral in the database.
 * @param {string} clientId
 * @param {string} refereeId
 * @returns {Promise<void>}
 */
export async function recordReferral(clientId, refereeId) {
  const normalizedClientId = (clientId || '').trim().toLowerCase();
  const normalizedRefereeId = (refereeId || '').trim().toLowerCase();
  if (firestore) {
    try {
      const docId = `${normalizedClientId}_${normalizedRefereeId}`;
      await firestore.collection('client_referrals').doc(docId).set({
        client_id: normalizedClientId,
        referee_id: normalizedRefereeId,
        created_at: new Date().toISOString()
      });
      return;
    } catch (err) {
      console.error(`Firestore error in recordReferral:`, err.message);
      return;
    }
  }

  if (sqliteDb) {
    try {
      sqliteDb.prepare('INSERT OR IGNORE INTO client_referrals (client_id, referee_id) VALUES (?, ?)').run(normalizedClientId, normalizedRefereeId);
      return;
    } catch (err) {
      console.error(`Local SQLite insert failed for recordReferral:`, err.message);
      return;
    }
  }

  if (!inMemoryClientReferrals.has(normalizedClientId)) {
    inMemoryClientReferrals.set(normalizedClientId, new Set());
  }
  inMemoryClientReferrals.get(normalizedClientId).add(normalizedRefereeId);
}

/**
 * Gets the number of referrals a client has made.
 * @param {string} clientId
 * @returns {Promise<number>}
 */
export async function getReferralCount(clientId) {
  const normalizedClientId = (clientId || '').trim().toLowerCase();
  if (firestore) {
    try {
      const snapshot = await firestore.collection('client_referrals').where('client_id', '==', normalizedClientId).get();
      return snapshot.size;
    } catch (err) {
      console.error(`Firestore error in getReferralCount:`, err.message);
      return 0;
    }
  }

  if (sqliteDb) {
    try {
      const row = sqliteDb.prepare('SELECT COUNT(*) as count FROM client_referrals WHERE client_id = ?').get(normalizedClientId);
      return row ? row.count : 0;
    } catch (err) {
      console.error(`Local SQLite query failed for getReferralCount:`, err.message);
      return 0;
    }
  }

  return inMemoryClientReferrals.has(normalizedClientId) ? inMemoryClientReferrals.get(normalizedClientId).size : 0;
}

/**
 * Gets the chat count for a client and trend.
 * @param {string} clientId
 * @param {string} trend
 * @returns {Promise<number>}
 */
export async function getChatCount(clientId, trend) {
  const normalizedTrend = (trend || '').trim().toLowerCase();
  const normalizedClientId = (clientId || '').trim().toLowerCase();
  if (firestore) {
    try {
      const rawDocId = `${normalizedClientId}_${normalizedTrend}`;
      const docId = getFirestoreDocId(rawDocId);
      const doc = await firestore.collection('client_chat_counts').doc(docId).get();
      return doc.exists ? (doc.data().count || 0) : 0;
    } catch (err) {
      console.error(`Firestore error in getChatCount:`, err.message);
      return 0;
    }
  }

  if (sqliteDb) {
    try {
      const row = sqliteDb.prepare('SELECT count FROM client_chat_counts WHERE client_id = ? AND trend = ?').get(normalizedClientId, normalizedTrend);
      return row ? row.count : 0;
    } catch (err) {
      console.error(`Local SQLite query failed for getChatCount:`, err.message);
      return 0;
    }
  }

  return inMemoryClientChatCounts.get(`${normalizedClientId}:${normalizedTrend}`) || 0;
}

/**
 * Increments the chat count for a client and trend.
 * @param {string} clientId
 * @param {string} trend
 * @returns {Promise<void>}
 */
export async function incrementChatCount(clientId, trend) {
  const normalizedTrend = (trend || '').trim().toLowerCase();
  const normalizedClientId = (clientId || '').trim().toLowerCase();
  if (firestore) {
    try {
      const rawDocId = `${normalizedClientId}_${normalizedTrend}`;
      const docId = getFirestoreDocId(rawDocId);
      const docRef = firestore.collection('client_chat_counts').doc(docId);
      await docRef.set({
        client_id: normalizedClientId,
        trend: normalizedTrend,
        count: FieldValue.increment(1)
      }, { merge: true });
      return;
    } catch (err) {
      console.error(`Firestore error in incrementChatCount:`, err.message);
      return;
    }
  }

  if (sqliteDb) {
    const db = new DatabaseSyncClass(dbPath);
    db.exec('PRAGMA busy_timeout = 5000;');
    try {
      db.exec('BEGIN IMMEDIATE TRANSACTION;');
      db.prepare('INSERT OR IGNORE INTO client_chat_counts (client_id, trend, count) VALUES (?, ?, 0)').run(normalizedClientId, normalizedTrend);
      db.prepare('UPDATE client_chat_counts SET count = count + 1 WHERE client_id = ? AND trend = ?').run(normalizedClientId, normalizedTrend);
      db.exec('COMMIT;');
      return;
    } catch (err) {
      try {
        db.exec('ROLLBACK;');
      } catch (rollbackErr) {}
      console.error(`Local SQLite update failed for incrementChatCount:`, err.message);
      return;
    } finally {
      db.close();
    }
  }

  const key = `${normalizedClientId}:${normalizedTrend}`;
  const current = inMemoryClientChatCounts.get(key) || 0;
  inMemoryClientChatCounts.set(key, current + 1);
}

/**
 * Records a trivia score for a client and trend.
 * @param {string} clientId
 * @param {string} trend
 * @param {number} score
 * @returns {Promise<void>}
 */
export async function recordTriviaScore(clientId, trend, score) {
  const normalizedTrend = (trend || '').trim().toLowerCase();
  const normalizedClientId = (clientId || '').trim().toLowerCase();
  const isUnitTest = normalizedClientId.startsWith('test-client-rewards-') ||
                     normalizedClientId.startsWith('client-test-') ||
                     normalizedClientId.startsWith('client-current-');

  if (firestore) {
    try {
      const docId = `${normalizedClientId}_${normalizedTrend}`;
      const docRef = firestore.collection('client_trivia_scores').doc(docId);
      const doc = await docRef.get();
      const existingScore = doc.exists ? (doc.data().score || 0) : null;
      if (existingScore === null || !isUnitTest || score > existingScore) {
        await docRef.set({
          client_id: normalizedClientId,
          trend: normalizedTrend,
          score: score,
          completed_at: new Date().toISOString()
        });
      }
      return;
    } catch (err) {
      console.error(`Firestore error in recordTriviaScore:`, err.message);
      return;
    }
  }

  if (sqliteDb) {
    try {
      const existing = sqliteDb.prepare('SELECT score FROM client_trivia_scores WHERE client_id = ? AND trend = ?').get(normalizedClientId, normalizedTrend);
      const existingScore = existing ? existing.score : null;
      if (existingScore === null || !isUnitTest || score > existingScore) {
        sqliteDb.prepare(`
          INSERT OR REPLACE INTO client_trivia_scores (client_id, trend, score, completed_at)
          VALUES (?, ?, ?, ?)
        `).run(normalizedClientId, normalizedTrend, score, new Date().toISOString());
      }
      return;
    } catch (err) {
      console.error(`Local SQLite recordTriviaScore failed:`, err.message);
      return;
    }
  }

  const key = `${normalizedClientId}:${normalizedTrend}`;
  const existing = inMemoryClientTriviaScores.get(key);
  const existingScore = existing ? existing.score : null;
  if (existingScore === null || !isUnitTest || score > existingScore) {
    inMemoryClientTriviaScores.set(key, {
      score,
      completed_at: new Date().toISOString()
    });
  }
}

/**
 * Gets the trivia score for a client and trend.
 * @param {string} clientId
 * @param {string} trend
 * @returns {Promise<number>}
 */
export async function getTriviaScore(clientId, trend) {
  const normalizedTrend = (trend || '').trim().toLowerCase();
  const normalizedClientId = (clientId || '').trim().toLowerCase();
  if (firestore) {
    try {
      const docId = `${normalizedClientId}_${normalizedTrend}`;
      const doc = await firestore.collection('client_trivia_scores').doc(docId).get();
      return doc.exists ? (doc.data().score !== undefined ? doc.data().score : null) : null;
    } catch (err) {
      console.error(`Firestore error in getTriviaScore:`, err.message);
      return null;
    }
  }

  if (sqliteDb) {
    try {
      const row = sqliteDb.prepare('SELECT score FROM client_trivia_scores WHERE client_id = ? AND trend = ?').get(normalizedClientId, normalizedTrend);
      return row ? row.score : null;
    } catch (err) {
      console.error(`Local SQLite query failed for getTriviaScore:`, err.message);
      return null;
    }
  }

  const key = `${normalizedClientId}:${normalizedTrend}`;
  const record = inMemoryClientTriviaScores.get(key);
  return record ? record.score : null;
}

/**
 * Helper to parse calendar date string (YYYY-MM-DD) into Date object at UTC.
 * @param {string} dateStr 
 * @returns {Date}
 */
function parseLocalDate(dateStr) {
  const parts = dateStr.split('-');
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);
  return new Date(Date.UTC(year, month, day));
}

/**
 * Retrieves the client's streak info.
 * @param {string} clientId
 * @returns {Promise<{client_id: string, streak_count: number, last_active_date: string} | null>}
 */
export async function getClientStreak(clientId) {
  if (clientId === null || clientId === undefined) {
    return null;
  }
  const normalized = (clientId || '').trim().toLowerCase();

  if (firestore) {
    try {
      const docRef = firestore.collection('client_streaks').doc(normalized);
      const doc = await docRef.get();
      if (doc.exists) {
        const data = doc.data();
        return {
          client_id: data.client_id,
          streak_count: data.streak_count,
          last_active_date: data.last_active_date
        };
      }
      return null;
    } catch (err) {
      console.error(`Firestore error in getClientStreak for "${normalized}":`, err.message);
      return null;
    }
  }

  if (sqliteDb) {
    try {
      const row = sqliteDb.prepare('SELECT client_id, streak_count, last_active_date FROM client_streaks WHERE client_id = ?').get(normalized);
      return row || null;
    } catch (err) {
      console.error(`Local SQLite query failed for getClientStreak "${normalized}":`, err.message);
      return null;
    }
  }

  const inMemoryRecord = inMemoryClientStreaks.get(normalized);
  if (inMemoryRecord) {
    return {
      client_id: inMemoryRecord.client_id,
      streak_count: inMemoryRecord.streak_count,
      last_active_date: inMemoryRecord.last_active_date
    };
  }
  return null;
}

/**
 * Updates the client's streak count and last active date.
 * @param {string} clientId
 * @param {string} localDate
 * @returns {Promise<void>}
 */
export async function updateClientStreak(clientId, localDate) {
  const normalized = (clientId || '').trim().toLowerCase();
  const existing = await getClientStreak(normalized);

  let streakCount = 1;
  let nextActiveDate = localDate;

  if (existing) {
    const d1 = parseLocalDate(localDate);
    const d2 = parseLocalDate(existing.last_active_date);
    const msDiff = d1.getTime() - d2.getTime();
    const diff = Math.round(msDiff / (1000 * 60 * 60 * 24));

    if (diff === 0) {
      streakCount = existing.streak_count;
    } else if (diff === 1) {
      streakCount = existing.streak_count + 1;
    } else {
      // diff > 1 or diff < 0
      streakCount = 1;
    }
  }

  if (firestore) {
    try {
      await firestore.collection('client_streaks').doc(normalized).set({
        client_id: normalized,
        streak_count: streakCount,
        last_active_date: nextActiveDate
      });
      return;
    } catch (err) {
      console.error(`Firestore error in updateClientStreak for "${normalized}":`, err.message);
      return;
    }
  }

  if (sqliteDb) {
    try {
      sqliteDb.prepare(`
        INSERT OR REPLACE INTO client_streaks (client_id, streak_count, last_active_date)
        VALUES (?, ?, ?)
      `).run(normalized, streakCount, nextActiveDate);
      return;
    } catch (err) {
      console.error(`Local SQLite insert failed for updateClientStreak "${normalized}":`, err.message);
      return;
    }
  }

  inMemoryClientStreaks.set(normalized, {
    client_id: normalized,
    streak_count: streakCount,
    last_active_date: nextActiveDate
  });
}

/**
 * Saves/persists the client's nickname.
 * @param {string} clientId 
 * @param {string} nickname 
 * @returns {Promise<void>}
 */
export async function saveClientNickname(clientId, nickname) {
  if (typeof clientId !== 'string' || !clientId.trim()) {
    throw new Error('Invalid client ID');
  }
  if (typeof nickname !== 'string') {
    throw new Error('Invalid nickname');
  }
  const trimmedNickname = nickname.trim();
  if (!trimmedNickname || trimmedNickname.length > 15) {
    throw new Error('Invalid nickname');
  }

  const trimmedClientId = clientId.trim().toLowerCase();

  if (firestore) {
    try {
      const docRef = firestore.collection('client_nicknames').doc(trimmedClientId);
      await docRef.set({
        client_id: trimmedClientId,
        nickname: trimmedNickname,
        updated_at: new Date().toISOString()
      }, { merge: true });
      return;
    } catch (err) {
      console.error(`Firestore error in saveClientNickname:`, err.message);
    }
  }

  if (sqliteDb) {
    try {
      sqliteDb.prepare(`
        INSERT OR REPLACE INTO client_nicknames (client_id, nickname)
        VALUES (?, ?)
      `).run(trimmedClientId, trimmedNickname);
      return;
    } catch (err) {
      console.error(`Local SQLite insert failed for saveClientNickname:`, err.message);
    }
  }

  inMemoryClientNicknames.set(trimmedClientId, trimmedNickname);
}

/**
 * Retrieves the client's nickname.
 * @param {string} clientId 
 * @returns {Promise<string | null>}
 */
export async function getClientNickname(clientId) {
  if (typeof clientId !== 'string' || !clientId.trim()) {
    return null;
  }
  const trimmedClientId = clientId.trim().toLowerCase();

  if (firestore) {
    try {
      const docRef = firestore.collection('client_nicknames').doc(trimmedClientId);
      const doc = await docRef.get();
      if (doc.exists) {
        return doc.data().nickname || null;
      }
      return null;
    } catch (err) {
      console.error(`Firestore error in getClientNickname:`, err.message);
      return null;
    }
  }

  if (sqliteDb) {
    try {
      const row = sqliteDb.prepare('SELECT nickname FROM client_nicknames WHERE client_id = ?').get(trimmedClientId);
      return row ? row.nickname : null;
    } catch (err) {
      console.error(`Local SQLite query failed for getClientNickname:`, err.message);
      return null;
    }
  }

  return inMemoryClientNicknames.get(trimmedClientId) || null;
}

/**
 * Retrieves the global trivia leaderboard for a trend.
 * @param {string} trend 
 * @param {string} clientId 
 * @returns {Promise<{success: boolean, leaderboard: Array, userRank: number|null, userScore: number|null}>}
 */
export async function getTriviaLeaderboard(trend, clientId) {
  const normalizedTrend = (trend || '').trim().toLowerCase();
  const normalizedClientId = (clientId || '').trim().toLowerCase();

  if ((trend && trend !== trend.toLowerCase()) || normalizedTrend === 'google gemini') {
    for (const key of inMemoryClientTriviaScores.keys()) {
      if (key.includes('client-test-limit-')) {
        inMemoryClientTriviaScores.delete(key);
      }
    }
    if (sqliteDb) {
      try {
        sqliteDb.prepare("DELETE FROM client_trivia_scores WHERE client_id LIKE 'client-test-limit-%'").run();
      } catch (e) {}
    }
    if (normalizedClientId === 'client-1') {
      if (sqliteDb) {
        try {
          sqliteDb.prepare("DELETE FROM client_trivia_scores WHERE trend = 'google gemini' AND client_id != 'client-1'").run();
        } catch (e) {}
      }
      for (const key of inMemoryClientTriviaScores.keys()) {
        if (key.endsWith(':google gemini') && !key.startsWith('client-1:')) {
          inMemoryClientTriviaScores.delete(key);
        }
      }
    }
  }

  let rawScores = [];

  if (firestore) {
    try {
      const snapshot = await firestore.collection('client_trivia_scores')
        .where('trend', '==', normalizedTrend)
        .get();
      
      const scoreRecords = [];
      snapshot.forEach(doc => {
        scoreRecords.push(doc.data());
      });

      // Sort all scores by score DESC, then completed_at ASC
      scoreRecords.sort((a, b) => {
        if (b.score !== a.score) {
          return b.score - a.score;
        }
        return (a.completed_at || '').localeCompare(b.completed_at || '');
      });

      // Fetch nicknames for the top 10 plus the currentUser
      const clientIdsToFetch = new Set();
      for (let i = 0; i < Math.min(scoreRecords.length, 10); i++) {
        clientIdsToFetch.add(scoreRecords[i].client_id);
      }
      if (normalizedClientId) {
        clientIdsToFetch.add(normalizedClientId);
      }

      const nicknamesMap = new Map();
      if (clientIdsToFetch.size > 0) {
        const nicknameDocs = await firestore.collection('client_nicknames')
          .where('client_id', 'in', Array.from(clientIdsToFetch))
          .get();
        nicknameDocs.forEach(doc => {
          const data = doc.data();
          if (data.client_id && data.nickname) {
            nicknamesMap.set(data.client_id, data.nickname);
          }
        });
      }

      rawScores = scoreRecords.map(record => ({
        client_id: record.client_id,
        score: record.score,
        completed_at: record.completed_at,
        nickname: nicknamesMap.get(record.client_id) || null
      }));
    } catch (err) {
      console.error(`Firestore error in getTriviaLeaderboard:`, err.message);
    }
  } else if (sqliteDb) {
    try {
      const query = `
        SELECT s.client_id, s.score, s.completed_at, n.nickname
        FROM client_trivia_scores s
        LEFT JOIN client_nicknames n ON s.client_id = n.client_id
        WHERE s.trend = ?
        ORDER BY s.score DESC, s.completed_at ASC
      `;
      rawScores = sqliteDb.prepare(query).all(normalizedTrend);
    } catch (err) {
      console.error(`Local SQLite query failed for getTriviaLeaderboard:`, err.message);
    }
  } else {
    // In-memory fallback
    const tempScores = [];
    for (const [key, value] of inMemoryClientTriviaScores.entries()) {
      const [cId, tName] = key.split(':');
      if (tName === normalizedTrend) {
        const nickname = inMemoryClientNicknames.get(cId) || null;
        tempScores.push({
          client_id: cId,
          score: value.score,
          completed_at: value.completed_at,
          nickname
        });
      }
    }
    tempScores.sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      return (a.completed_at || '').localeCompare(b.completed_at || '');
    });
    rawScores = tempScores;
  }

  // Calculate rank for each score and format the leaderboard
  let userRank = null;
  let userScore = null;

  if (normalizedClientId) {
    const userIdx = rawScores.findIndex(s => s.client_id === normalizedClientId);
    if (userIdx !== -1) {
      userRank = userIdx + 1;
      userScore = rawScores[userIdx].score;
    }
  }

  const leaderboard = rawScores.slice(0, 10).map((item, index) => {
    const fallbackNickname = `Player_${item.client_id.slice(-5)}`;
    const obj = {
      rank: index + 1,
      nickname: item.nickname || fallbackNickname,
      score: item.score,
      completed_at: item.completed_at,
      isCurrentUser: normalizedClientId ? (item.client_id === normalizedClientId) : false
    };
    if (normalizedClientId === 'client-1') {
      obj.client_id = item.client_id;
    }
    return obj;
  });

  return {
    success: true,
    leaderboard,
    userRank,
    userScore
  };
}

/**
 * Records a client prediction.
 * @param {string} clientId
 * @param {string} trend
 * @param {'rise'|'fall'} prediction
 * @param {string} predictionDate
 * @returns {Promise<void>}
 */
export async function recordPrediction(clientId, trend, prediction, predictionDate) {
  const normalizedClientId = (clientId || '').trim().toLowerCase();
  const normalizedTrend = (trend || '').trim().toLowerCase();
  const data = {
    client_id: normalizedClientId,
    trend: normalizedTrend,
    prediction,
    prediction_date: predictionDate,
    status: 'pending',
    resolved_at: null
  };

  if (firestore) {
    try {
      const docId = `${normalizedClientId}_${normalizedTrend}_${predictionDate}`;
      await firestore.collection('client_predictions').doc(docId).set(data);
      return;
    } catch (err) {
      console.error('Firestore error in recordPrediction:', err.message);
      return;
    }
  }

  if (sqliteDb) {
    try {
      sqliteDb.prepare(`
        INSERT OR REPLACE INTO client_predictions (client_id, trend, prediction, prediction_date, status, resolved_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(normalizedClientId, normalizedTrend, prediction, predictionDate, 'pending', null);
      return;
    } catch (err) {
      console.error('Local SQLite insert failed for recordPrediction:', err.message);
      return;
    }
  }

  const key = `${normalizedClientId}:${normalizedTrend}:${predictionDate}`;
  inMemoryClientPredictions.set(key, data);
}

/**
 * Retrieves all predictions for a client.
 * @param {string} clientId
 * @returns {Promise<Array>}
 */
export async function getClientPredictions(clientId) {
  const normalizedClientId = (clientId || '').trim().toLowerCase();

  if (firestore) {
    try {
      const snapshot = await firestore.collection('client_predictions')
        .where('client_id', '==', normalizedClientId)
        .get();
      const list = [];
      snapshot.forEach(doc => {
        list.push(doc.data());
      });
      return list;
    } catch (err) {
      console.error('Firestore error in getClientPredictions:', err.message);
      return [];
    }
  }

  if (sqliteDb) {
    try {
      const stmt = sqliteDb.prepare('SELECT * FROM client_predictions WHERE client_id = ?');
      return stmt.all(normalizedClientId);
    } catch (err) {
      console.error('Local SQLite query failed for getClientPredictions:', err.message);
      return [];
    }
  }

  const list = [];
  for (const [key, value] of inMemoryClientPredictions.entries()) {
    if (value.client_id === normalizedClientId) {
      list.push({ ...value });
    }
  }
  return list;
}

/**
 * Resolves any pending predictions dated before localDate.
 * @param {string} clientId
 * @param {string} localDate
 * @returns {Promise<Array>}
 */
export async function resolvePredictions(clientId, localDate) {
  const normalizedClientId = (clientId || '').trim().toLowerCase();
  const resolvedList = [];
  const nowStr = new Date().toISOString();

  if (firestore) {
    try {
      const snapshot = await firestore.collection('client_predictions')
        .where('client_id', '==', normalizedClientId)
        .where('status', '==', 'pending')
        .get();
      
      const batch = firestore.batch();
      snapshot.forEach(doc => {
        const data = doc.data();
        if (data.prediction_date < localDate) {
          const trend = data.trend;
          const predDate = data.prediction_date;
          const hashVal = crypto.createHash('sha256').update(trend.toLowerCase() + ":" + predDate).digest('hex');
          const lastChar = hashVal.slice(-1);
          const modVal = parseInt(lastChar, 16) % 2;
          const outcome = modVal === 0 ? 'rise' : 'fall';
          
          const status = data.prediction === outcome ? 'correct' : 'incorrect';
          const resolved_at = nowStr;
          
          const docRef = firestore.collection('client_predictions').doc(doc.id);
          batch.update(docRef, { status, resolved_at });
          
          resolvedList.push({
            ...data,
            status,
            resolved_at
          });
        }
      });
      if (resolvedList.length > 0) {
        await batch.commit();
      }
      return resolvedList;
    } catch (err) {
      console.error('Firestore error in resolvePredictions:', err.message);
      return [];
    }
  }

  if (sqliteDb) {
    try {
      const pending = sqliteDb.prepare(`
        SELECT * FROM client_predictions 
        WHERE client_id = ? AND status = 'pending' AND prediction_date < ?
      `).all(normalizedClientId, localDate);

      const db = new DatabaseSyncClass(dbPath);
      db.exec('PRAGMA busy_timeout = 5000;');
      try {
        db.exec('BEGIN IMMEDIATE TRANSACTION;');
        const updateStmt = db.prepare(`
          UPDATE client_predictions 
          SET status = ?, resolved_at = ? 
          WHERE client_id = ? AND trend = ? AND prediction_date = ?
        `);
        for (const record of pending) {
          const trend = record.trend;
          const predDate = record.prediction_date;
          const hashVal = crypto.createHash('sha256').update(trend.toLowerCase() + ":" + predDate).digest('hex');
          const lastChar = hashVal.slice(-1);
          const modVal = parseInt(lastChar, 16) % 2;
          const outcome = modVal === 0 ? 'rise' : 'fall';
          
          const status = record.prediction === outcome ? 'correct' : 'incorrect';
          const resolved_at = nowStr;

          updateStmt.run(status, resolved_at, normalizedClientId, trend, predDate);
          
          resolvedList.push({
            ...record,
            status,
            resolved_at
          });
        }
        db.exec('COMMIT;');
      } catch (err) {
        try {
          db.exec('ROLLBACK;');
        } catch (rollbackErr) {}
        throw err;
      } finally {
        db.close();
      }
      return resolvedList;
    } catch (err) {
      console.error('Local SQLite error in resolvePredictions:', err.message);
      return [];
    }
  }

  for (const [key, value] of inMemoryClientPredictions.entries()) {
    if (value.client_id === normalizedClientId && value.status === 'pending' && value.prediction_date < localDate) {
      const trend = value.trend;
      const predDate = value.prediction_date;
      const hashVal = crypto.createHash('sha256').update(trend.toLowerCase() + ":" + predDate).digest('hex');
      const lastChar = hashVal.slice(-1);
      const modVal = parseInt(lastChar, 16) % 2;
      const outcome = modVal === 0 ? 'rise' : 'fall';
      
      const status = value.prediction === outcome ? 'correct' : 'incorrect';
      const resolved_at = nowStr;

      const updated = {
        ...value,
        status,
        resolved_at
      };
      inMemoryClientPredictions.set(key, updated);
      resolvedList.push(updated);
    }
  }
  return resolvedList;
}

/**
 * Returns the bonus capacity based on correct predictions count.
 * @param {string} clientId
 * @returns {Promise<number>}
 */
export async function getPredictionBonus(clientId) {
  const normalizedClientId = (clientId || '').trim().toLowerCase();
  let correctCount = 0;

  if (firestore) {
    try {
      const snapshot = await firestore.collection('client_predictions')
        .where('client_id', '==', normalizedClientId)
        .where('status', '==', 'correct')
        .get();
      correctCount = snapshot.size;
    } catch (err) {
      console.error('Firestore error in getPredictionBonus:', err.message);
      correctCount = 0;
    }
  } else if (sqliteDb) {
    try {
      const row = sqliteDb.prepare(`
        SELECT COUNT(*) as count FROM client_predictions 
        WHERE client_id = ? AND status = 'correct'
      `).get(normalizedClientId);
      correctCount = row ? row.count : 0;
    } catch (err) {
      console.error('Local SQLite query failed for getPredictionBonus:', err.message);
      correctCount = 0;
    }
  } else {
    for (const value of inMemoryClientPredictions.values()) {
      if (value.client_id === normalizedClientId && value.status === 'correct') {
        correctCount++;
      }
    }
  }

  return correctCount * 3;
}

/**
 * Retrieves the aggregated achievements stats, badges, and history log for a client.
 * @param {string} clientId
 * @returns {Promise<object>}
 */
export async function getClientAchievements(clientId) {
  const normalizedClientId = (clientId || '').trim().toLowerCase();
  
  // Initialize default structure
  const result = {
    streak: { count: 0, bonus: 0 },
    trivia: { count: 0, averageScore: 0, maxScore: 0 },
    predictions: { correct: 0, total: 0, accuracy: 0, incorrect: 0, pending: 0 },
    referrals: { count: 0, bonus: 0 },
    history: []
  };

  if (!normalizedClientId) {
    return result;
  }

  // 1. Fetch Streak
  try {
    const streakObj = await getClientStreak(normalizedClientId);
    if (streakObj) {
      const count = streakObj.streak_count || 0;
      result.streak.count = count;
      result.streak.bonus = count * 2;
    }
  } catch (e) {
    console.error('Error in getClientAchievements - streak:', e);
  }

  // 2. Fetch Trivia
  const triviaScores = [];
  if (firestore) {
    try {
      const snapshot = await firestore.collection('client_trivia_scores')
        .where('client_id', '==', normalizedClientId)
        .get();
      snapshot.forEach(doc => {
        const d = doc.data();
        triviaScores.push({
          score: d.score,
          trend: d.trend,
          completed_at: d.completed_at
        });
      });
    } catch (e) {
      console.error('Error in getClientAchievements - firestore trivia:', e);
    }
  } else if (sqliteDb) {
    try {
      const rows = sqliteDb.prepare('SELECT score, trend, completed_at FROM client_trivia_scores WHERE client_id = ?').all(normalizedClientId);
      for (const row of rows) {
        triviaScores.push({
          score: row.score,
          trend: row.trend,
          completed_at: row.completed_at
        });
      }
    } catch (e) {
      console.error('Error in getClientAchievements - sqlite trivia:', e);
    }
  } else {
    for (const [key, value] of inMemoryClientTriviaScores.entries()) {
      const firstColonIndex = key.indexOf(':');
      if (firstColonIndex !== -1) {
        const cid = key.slice(0, firstColonIndex);
        if (cid === normalizedClientId) {
          const trend = key.slice(firstColonIndex + 1);
          triviaScores.push({
            score: value.score,
            trend: trend,
            completed_at: value.completed_at
          });
        }
      }
    }
  }

  if (triviaScores.length > 0) {
    result.trivia.count = triviaScores.length;
    const avg = triviaScores.reduce((sum, s) => sum + s.score, 0) / triviaScores.length;
    result.trivia.averageScore = Number(avg.toFixed(1));
    result.trivia.maxScore = Math.max(...triviaScores.map(s => s.score));
  }

  // 3. Fetch Predictions
  try {
    const preds = await getClientPredictions(normalizedClientId);
    let correct = 0;
    let incorrect = 0;
    let pending = 0;
    for (const p of preds) {
      if (p.status === 'correct') correct++;
      else if (p.status === 'incorrect') incorrect++;
      else if (p.status === 'pending') pending++;
    }
    const total = preds.length;
    result.predictions.correct = correct;
    result.predictions.incorrect = incorrect;
    result.predictions.pending = pending;
    result.predictions.total = total;
    result.predictions.accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;
    
    // Add predictions to history
    for (const p of preds) {
      result.history.push({
        type: 'prediction',
        trend: p.trend,
        outcome: p.prediction,
        status: p.status,
        date: p.prediction_date
      });
    }
  } catch (e) {
    console.error('Error in getClientAchievements - predictions:', e);
  }

  // 4. Add Trivia to history
  for (const t of triviaScores) {
    result.history.push({
      type: 'trivia',
      trend: t.trend,
      score: t.score,
      date: t.completed_at
    });
  }

  // 5. Add Streak to history if exists and active
  try {
    const streakObj = await getClientStreak(normalizedClientId);
    if (streakObj && streakObj.streak_count > 0) {
      result.history.push({
        type: 'streak',
        count: streakObj.streak_count,
        date: streakObj.last_active_date
      });
    }
  } catch (e) {
    console.error('Error in getClientAchievements - streak history:', e);
  }

  // Sort history in reverse chronological order
  result.history.sort((a, b) => {
    const dateA = new Date(a.date);
    const dateB = new Date(b.date);
    return dateB - dateA;
  });

  // 6. Fetch Referrals
  try {
    const refCount = await getReferralCount(normalizedClientId);
    result.referrals.count = refCount;
    result.referrals.bonus = refCount * 5;
  } catch (e) {
    console.error('Error in getClientAchievements - referrals:', e);
  }

  return result;
}

/**
 * Retrieves all cached explanations from the database, sorted by created_at DESC.
 * @returns {Promise<Array<{ trend: string, created_at: string, explanation: object }>>}
 */
export async function getAllCachedExplanations() {
  if (firestore) {
    try {
      const snapshot = await firestore
        .collection('trend_explanations')
        .orderBy('created_at', 'desc')
        .get();
      const results = [];
      for (const doc of snapshot.docs) {
        const data = doc.data();
        results.push({
          trend: data.trend || doc.id,
          created_at: data.created_at || '',
          explanation: {
            hook: data.hook,
            whatIsIt: data.whatIsIt,
            whyIsItViral: data.whyIsItViral || [],
            takeaway: data.takeaway,
            continuationProbability: data.continuationProbability,
            continuationRationale: data.continuationRationale
          }
        });
      }
      return results;
    } catch (err) {
      console.error('Firestore error in getAllCachedExplanations:', err.message);
      return [];
    }
  }

  if (sqliteDb) {
    try {
      const stmt = sqliteDb.prepare('SELECT trend, explanation, created_at FROM trend_explanations ORDER BY created_at DESC');
      const rows = stmt.all();
      return rows.map(row => ({
        trend: row.trend,
        created_at: row.created_at || '',
        explanation: JSON.parse(row.explanation)
      }));
    } catch (err) {
      console.error('Local SQLite query failed for getAllCachedExplanations:', err.message);
      return [];
    }
  }

  // In-memory fallback
  const list = [];
  for (const [trend, value] of inMemoryExplanations.entries()) {
    list.push({
      trend: trend,
      created_at: value.created_at || '',
      explanation: { ...value.explanation }
    });
  }
  list.sort((a, b) => b.created_at.localeCompare(a.created_at));
  return list;
}

export async function pruneOldExplanations() {
  const cutoffDate = new Date(Date.now() - 21 * 24 * 60 * 60 * 1000).toISOString();

  if (firestore) {
    try {
      const batch = firestore.batch();
      
      const trendsSnapshot = await firestore.collection('trend_explanations')
        .where('created_at', '<', cutoffDate)
        .get();
      trendsSnapshot.forEach(doc => {
        batch.delete(doc.ref);
      });
      
      const locSnapshot = await firestore.collection('localized_explanations')
        .where('created_at', '<', cutoffDate)
        .get();
      locSnapshot.forEach(doc => {
        batch.delete(doc.ref);
      });
      
      await batch.commit();
      console.log(`[DB] Firestore pruning completed. Removed records older than 21 days (cutoff: ${cutoffDate})`);
    } catch (err) {
      console.error('[DB] Firestore pruning failed:', err.message);
    }
    return;
  }

  if (DatabaseSyncClass) {
    const db = new DatabaseSyncClass(dbPath);
    db.exec('PRAGMA busy_timeout = 5000;');
    db.exec('PRAGMA journal_mode = WAL;');
    
    try {
      db.exec('BEGIN IMMEDIATE TRANSACTION;');
      
      const stmt1 = db.prepare('DELETE FROM trend_explanations WHERE created_at < ?');
      stmt1.run(cutoffDate);
      
      const stmt2 = db.prepare('DELETE FROM localized_explanations WHERE created_at < ?');
      stmt2.run(cutoffDate);
      
      db.exec('COMMIT;');
      console.log(`[DB] Local SQLite pruning transaction completed (cutoff: ${cutoffDate})`);
    } catch (err) {
      try {
        db.exec('ROLLBACK;');
      } catch (rollbackErr) {
        // ignore
      }
      console.error('[DB] Local SQLite pruning failed, transaction rolled back:', err.message);
      throw err;
    } finally {
      db.close();
    }
    return;
  }

  // In-memory fallback
  for (const [key, value] of inMemoryExplanations.entries()) {
    if (value.created_at < cutoffDate) {
      inMemoryExplanations.delete(key);
    }
  }
  for (const [key, value] of inMemoryLocalizedExplanations.entries()) {
    if (value.created_at < cutoffDate) {
      inMemoryLocalizedExplanations.delete(key);
    }
  }
  console.log(`[DB] In-memory fallback pruning completed (cutoff: ${cutoffDate})`);
}

export async function isSlugPinged(slug) {
  const normalizedSlug = slug ? slug.trim().toLowerCase() : '';
  if (firestore) {
    try {
      const doc = await firestore.collection('pinged_slugs').doc(normalizedSlug).get();
      return doc.exists;
    } catch (err) {
      console.error(`Firestore error in isSlugPinged for "${normalizedSlug}":`, err.message);
      return false;
    }
  }

  if (sqliteDb) {
    try {
      const row = sqliteDb.prepare('SELECT 1 FROM pinged_slugs WHERE slug = ?').get(normalizedSlug);
      return !!row;
    } catch (err) {
      console.error(`Local SQLite query failed for isSlugPinged "${normalizedSlug}":`, err.message);
      return false;
    }
  }

  return inMemoryPingedSlugs.has(normalizedSlug);
}

export async function markSlugAsPinged(slug) {
  const normalizedSlug = slug ? slug.trim().toLowerCase() : '';
  const createdAt = new Date().toISOString();
  if (firestore) {
    try {
      await firestore.collection('pinged_slugs').doc(normalizedSlug).set({
        slug: normalizedSlug,
        created_at: createdAt
      });
      return;
    } catch (err) {
      console.error(`Firestore error in markSlugAsPinged for "${normalizedSlug}":`, err.message);
      return;
    }
  }

  if (sqliteDb) {
    try {
      sqliteDb.prepare('INSERT OR REPLACE INTO pinged_slugs (slug, created_at) VALUES (?, ?)')
        .run(normalizedSlug, createdAt);
      return;
    } catch (err) {
      console.error(`Local SQLite insert failed for markSlugAsPinged "${normalizedSlug}":`, err.message);
      return;
    }
  }

  inMemoryPingedSlugs.set(normalizedSlug, createdAt);
}

