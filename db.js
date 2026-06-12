import { Firestore, FieldValue } from '@google-cloud/firestore';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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
let sqliteDb = null;

if (!firestore) {
  try {
    const { DatabaseSync } = await import('node:sqlite');
    const dbPath = path.join(__dirname, 'polls.db');
    sqliteDb = new DatabaseSync(dbPath);
    sqliteDb.exec(`
      CREATE TABLE IF NOT EXISTS votes (
        trend TEXT PRIMARY KEY,
        overrated INTEGER DEFAULT 0,
        genius INTEGER DEFAULT 0
      )
    `);
    sqliteDb.exec(`
      CREATE TABLE IF NOT EXISTS vote_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        trend TEXT,
        vote TEXT,
        timestamp TEXT,
        location TEXT
      )
    `);
    sqliteDb.exec(`
      CREATE TABLE IF NOT EXISTS trend_explanations (
        trend TEXT PRIMARY KEY,
        explanation TEXT,
        created_at TEXT
      )
    `);
    sqliteDb.exec(`
      CREATE TABLE IF NOT EXISTS localized_explanations (
        trend TEXT,
        lang TEXT,
        title TEXT,
        meta_description TEXT,
        explanation TEXT,
        created_at TEXT,
        PRIMARY KEY (trend, lang)
      )
    `);
    console.log('Local SQLite database initialized successfully at', dbPath);
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
  if (firestore) {
    try {
      const docRef = firestore.collection('polls').doc(trend);
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
      console.error(`Firestore error in getPollData for "${trend}":`, err.message);
    }
  }

  // SQLite fallback
  if (sqliteDb) {
    try {
      const stmt = sqliteDb.prepare('SELECT overrated, genius FROM votes WHERE trend = ?');
      const row = stmt.get(trend);
      if (row) {
        return { overrated: row.overrated, genius: row.genius };
      }
      return { overrated: 0, genius: 0 };
    } catch (err) {
      console.error(`Local SQLite query failed for "${trend}":`, err.message);
    }
  }

  // In-memory fallback
  if (!inMemoryStorage.has(trend)) {
    inMemoryStorage.set(trend, { overrated: 0, genius: 0 });
  }
  return inMemoryStorage.get(trend);
}

/**
 * Increments the vote count for a trend (either 'overrated' or 'genius') and returns the updated counts.
 * @param {string} trend 
 * @param {'overrated'|'genius'} vote 
 * @returns {Promise<{overrated: number, genius: number}>}
 */
export async function incrementVote(trend, vote, location = null) {
  if (firestore) {
    try {
      const docRef = firestore.collection('polls').doc(trend);
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
      console.error(`Firestore error in incrementVote for "${trend}":`, err.message);
    }
  }

  // Get current state to return after SQLite/in-memory update
  const current = sqliteDb
    ? await getLocalSqlitePollData(trend)
    : (inMemoryStorage.get(trend) || { overrated: 0, genius: 0 });
  
  current[vote]++;

  const timestamp = new Date().toISOString();
  const locStr = location ? JSON.stringify(location) : null;

  // SQLite fallback update
  if (sqliteDb) {
    try {
      sqliteDb.prepare('INSERT OR IGNORE INTO votes (trend, overrated, genius) VALUES (?, 0, 0)').run(trend);
      if (vote === 'genius') {
        sqliteDb.prepare('UPDATE votes SET genius = genius + 1 WHERE trend = ?').run(trend);
      } else if (vote === 'overrated') {
        sqliteDb.prepare('UPDATE votes SET overrated = overrated + 1 WHERE trend = ?').run(trend);
      }
      sqliteDb.prepare('INSERT INTO vote_events (trend, vote, timestamp, location) VALUES (?, ?, ?, ?)').run(trend, vote, timestamp, locStr);
      return current;
    } catch (err) {
      console.error(`Local SQLite write failed for "${trend}":`, err.message);
    }
  }

  // In-memory fallback update
  inMemoryStorage.set(trend, current);
  if (!inMemoryEvents.has(trend)) {
    inMemoryEvents.set(trend, []);
  }
  inMemoryEvents.get(trend).push({ vote, timestamp, location: locStr });
  return current;
}

// Simple synchronous/asynchronous helper to get data locally without repeating fallback checks
async function getLocalSqlitePollData(trend) {
  try {
    const stmt = sqliteDb.prepare('SELECT overrated, genius FROM votes WHERE trend = ?');
    const row = stmt.get(trend);
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
  if (sqliteDb) {
    try {
      const stmt = sqliteDb.prepare('SELECT vote, timestamp, location FROM vote_events WHERE trend = ? ORDER BY timestamp ASC');
      return stmt.all(trend);
    } catch (err) {
      console.error(`Local SQLite query for vote_events failed:`, err.message);
      return [];
    }
  }
  return inMemoryEvents.get(trend) || [];
}

/**
 * Seeds multiple historical vote events for a trend.
 * @param {string} trend
 * @param {Array<{vote: string, timestamp: string, location: any}>} events
 */
export async function seedVoteEvents(trend, events) {
  if (sqliteDb) {
    try {
      sqliteDb.prepare('INSERT OR IGNORE INTO votes (trend, overrated, genius) VALUES (?, 0, 0)').run(trend);
      const stmt = sqliteDb.prepare('INSERT INTO vote_events (trend, vote, timestamp, location) VALUES (?, ?, ?, ?)');
      let geniusCount = 0;
      let overratedCount = 0;
      for (const ev of events) {
        stmt.run(trend, ev.vote, ev.timestamp, ev.location ? JSON.stringify(ev.location) : null);
        if (ev.vote === 'genius') geniusCount++;
        else overratedCount++;
      }
      sqliteDb.prepare('UPDATE votes SET genius = genius + ?, overrated = overrated + ? WHERE trend = ?')
        .run(geniusCount, overratedCount, trend);
    } catch (err) {
      console.error(`Local SQLite seedVoteEvents failed:`, err.message);
    }
  } else {
    if (!inMemoryEvents.has(trend)) {
      inMemoryEvents.set(trend, []);
    }
    const arr = inMemoryEvents.get(trend);
    let geniusCount = 0;
    let overratedCount = 0;
    for (const ev of events) {
      arr.push({ vote: ev.vote, timestamp: ev.timestamp, location: ev.location ? JSON.stringify(ev.location) : null });
      if (ev.vote === 'genius') geniusCount++;
      else overratedCount++;
    }
    const current = inMemoryStorage.get(trend) || { overrated: 0, genius: 0 };
    current.genius += geniusCount;
    current.overrated += overratedCount;
    inMemoryStorage.set(trend, current);
  }
}

/**
 * Retrieves the cached explanation for a trend if it exists.
 * @param {string} trend 
 * @returns {Promise<{hook: string, whatIsIt: string, whyIsItViral: string[], takeaway: string} | null>}
 */
export async function getCachedExplanation(trend) {
  if (firestore) {
    try {
      const docRef = firestore.collection('trend_explanations').doc(trend);
      const doc = await docRef.get();
      if (doc.exists) {
        const data = doc.data();
        return {
          hook: data.hook,
          whatIsIt: data.whatIsIt,
          whyIsItViral: data.whyIsItViral || [],
          takeaway: data.takeaway
        };
      }
      return null;
    } catch (err) {
      console.error(`Firestore error in getCachedExplanation for "${trend}":`, err.message);
      return null;
    }
  }

  if (sqliteDb) {
    try {
      const stmt = sqliteDb.prepare('SELECT explanation FROM trend_explanations WHERE trend = ?');
      const row = stmt.get(trend);
      if (row && row.explanation) {
        return JSON.parse(row.explanation);
      }
      return null;
    } catch (err) {
      console.error(`Local SQLite query failed for getCachedExplanation "${trend}":`, err.message);
      return null;
    }
  }

  const cached = inMemoryExplanations.get(trend);
  if (cached) {
    return cached.explanation;
  }
  return null;
}

/**
 * Stores the trend explanation in the cache.
 * @param {string} trend 
 * @param {{hook: string, whatIsIt: string, whyIsItViral: string[], takeaway: string}} explanation 
 * @returns {Promise<void>}
 */
export async function setCachedExplanation(trend, explanation) {
  const createdAt = new Date().toISOString();
  const dataToSave = {
    hook: explanation.hook,
    whatIsIt: explanation.whatIsIt,
    whyIsItViral: explanation.whyIsItViral || [],
    takeaway: explanation.takeaway
  };

  if (firestore) {
    try {
      const docRef = firestore.collection('trend_explanations').doc(trend);
      await docRef.set({
        ...dataToSave,
        created_at: createdAt
      });
      return;
    } catch (err) {
      console.error(`Firestore error in setCachedExplanation for "${trend}":`, err.message);
      return;
    }
  }

  if (sqliteDb) {
    try {
      sqliteDb.prepare(`
        INSERT OR REPLACE INTO trend_explanations (trend, explanation, created_at)
        VALUES (?, ?, ?)
      `).run(trend, JSON.stringify(dataToSave), createdAt);
      return;
    } catch (err) {
      console.error(`Local SQLite insert failed for setCachedExplanation "${trend}":`, err.message);
      return;
    }
  }

  inMemoryExplanations.set(trend, {
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
  if (firestore) {
    try {
      const docId = `${trend}_${lang}`;
      const docRef = firestore.collection('localized_explanations').doc(docId);
      const doc = await docRef.get();
      if (doc.exists) {
        const data = doc.data();
        return {
          title: data.title,
          meta_description: data.meta_description,
          explanation: typeof data.explanation === 'string' ? JSON.parse(data.explanation) : data.explanation
        };
      }
      return null;
    } catch (err) {
      console.error(`Firestore error in getLocalizedExplanation for "${trend}" "${lang}":`, err.message);
      return null;
    }
  }

  if (sqliteDb) {
    try {
      const stmt = sqliteDb.prepare('SELECT title, meta_description, explanation FROM localized_explanations WHERE trend = ? AND lang = ?');
      const row = stmt.get(trend, lang);
      if (row) {
        return {
          title: row.title,
          meta_description: row.meta_description,
          explanation: JSON.parse(row.explanation)
        };
      }
      return null;
    } catch (err) {
      console.error(`Local SQLite query failed for getLocalizedExplanation "${trend}" "${lang}":`, err.message);
      return null;
    }
  }

  const cached = inMemoryLocalizedExplanations.get(`${trend}_${lang}`);
  if (cached) {
    return cached;
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
  const createdAt = new Date().toISOString();
  const { title, meta_description, explanation } = data;

  if (firestore) {
    try {
      const docId = `${trend}_${lang}`;
      const docRef = firestore.collection('localized_explanations').doc(docId);
      await docRef.set({
        trend,
        lang,
        title,
        meta_description,
        explanation,
        created_at: createdAt
      });
      return;
    } catch (err) {
      console.error(`Firestore error in setLocalizedExplanation for "${trend}" "${lang}":`, err.message);
      return;
    }
  }

  if (sqliteDb) {
    try {
      sqliteDb.prepare(`
        INSERT OR REPLACE INTO localized_explanations (trend, lang, title, meta_description, explanation, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(trend, lang, title, meta_description, JSON.stringify(explanation), createdAt);
      return;
    } catch (err) {
      console.error(`Local SQLite insert failed for setLocalizedExplanation "${trend}" "${lang}":`, err.message);
      return;
    }
  }

  inMemoryLocalizedExplanations.set(`${trend}_${lang}`, {
    title,
    meta_description,
    explanation
  });
}




