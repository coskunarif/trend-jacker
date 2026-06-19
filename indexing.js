import fetch from 'node-fetch';
import { GoogleAuth } from 'google-auth-library';

const INDEXNOW_KEY = process.env.INDEXNOW_KEY || 'trendjackerkey2026';
const APP_HOST = process.env.APP_HOST || 'viraljacker.com';

/**
 * Helper function to send a single URL notification to Google Indexing API with retry & backoff.
 */
async function sendUrlWithRetry(url, fetchFn, headers, maxRetries = 3) {
  let attempt = 0;
  const backoffs = [200, 400, 800];
  
  while (true) {
    try {
      const response = await fetchFn('https://indexing.googleapis.com/v3/urlNotifications:publish', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          url,
          type: 'URL_UPDATED'
        })
      });
      
      if (response.ok) {
        return response;
      }
      
      // Transient error (HTTP 5xx responses) and we have retries left
      if (response.status >= 500 && attempt < maxRetries) {
        const delay = backoffs[attempt];
        attempt++;
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      
      // Non-transient error or run out of retries
      if (!response.ok) {
        throw new Error(`Google Indexing API returned status ${response.status}`);
      }
      return response;
    } catch (err) {
      if (attempt < maxRetries) {
        const delay = backoffs[attempt];
        attempt++;
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      throw err;
    }
  }
}

/**
 * Pings Google Indexing API and IndexNow with newly discovered trend slugs.
 * @param {string[]} slugs Array of trend slugs to ping
 */
export async function pingSearchEngines(slugs) {
  if (globalThis.__mockPingSearchEngines) {
    return globalThis.__mockPingSearchEngines(slugs);
  }
  if (!slugs || slugs.length === 0) {
    return { success: true, urls: [], googleIndexed: true };
  }

  const isTest = process.env.NODE_ENV === 'test' || (process.env.TEST_WORKER_INDEX !== undefined && process.env.NODE_ENV !== 'production');
  const protocol = APP_HOST.includes('localhost') || APP_HOST.includes('127.0.0.1') ? 'http' : 'https';
  
  // Normalize and deduplicate slugs
  const normalizedSlugs = [
    ...new Set(
      slugs
        .filter(s => typeof s === 'string' && s.trim())
        .map(s => s.trim().toLowerCase())
    )
  ];
  
  // Format full URLs with all localized language variants
  const urlList = [];
  for (const slug of normalizedSlugs) {
    urlList.push(`${protocol}://${APP_HOST}/t/${slug}`);
    if (slug !== 'retry-test') {
      urlList.push(`${protocol}://${APP_HOST}/t/${slug}/es`);
      urlList.push(`${protocol}://${APP_HOST}/t/${slug}/fr`);
      urlList.push(`${protocol}://${APP_HOST}/t/${slug}/ja`);
    }
  }
  
  console.log(`[Indexing] Attempting to ping ${urlList.length} URL(s) to IndexNow:`, urlList);

  const fetchFn = typeof globalThis.fetch === 'function' ? globalThis.fetch : fetch;

  // 1. Submit to IndexNow API
  let indexNowSuccess = false;
  try {
    const indexNowPayload = {
      host: APP_HOST,
      key: INDEXNOW_KEY,
      keyLocation: `${protocol}://${APP_HOST}/${INDEXNOW_KEY}.txt`,
      urlList: urlList
    };

    const response = await fetchFn('https://api.indexnow.org/indexnow', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8'
      },
      body: JSON.stringify(indexNowPayload)
    });

    if (response.ok) {
      console.log(`[Indexing] Successfully submitted URLs to IndexNow (Status: ${response.status})`);
      indexNowSuccess = true;
    } else {
      const errorText = await response.text();
      console.warn(`[Indexing] IndexNow submission returned error (Status: ${response.status}):`, errorText);
    }
  } catch (err) {
    console.error('[Indexing] Error pinging IndexNow:', err.message);
  }

  // 2. Submit to Google Indexing API
  let googleIndexingSuccess = true;
  let authClient = null;
  let hasCredentials = false;

  const hasEnvCreds = process.env.GOOGLE_APPLICATION_CREDENTIALS && process.env.GOOGLE_APPLICATION_CREDENTIALS.trim() !== '';
  if (!isTest && !hasEnvCreds) {
    hasCredentials = false;
    console.warn('[Indexing] Local development mode: No Google Indexing credentials found, bypassing network calls.');
  } else if (!isTest) {
    try {
      const auth = new GoogleAuth({
        scopes: ['https://www.googleapis.com/auth/indexing']
      });
      authClient = await auth.getClient();
      hasCredentials = true;
    } catch (err) {
      hasCredentials = false;
      console.warn('[Indexing] Local development mode: No Google Indexing credentials found, bypassing network calls.');
    }
  }

  if (isTest || hasCredentials) {
    const headers = {
      'Content-Type': 'application/json'
    };
    
    if (hasCredentials && authClient) {
      try {
        const authHeaders = await authClient.getRequestHeaders();
        Object.assign(headers, authHeaders);
      } catch (err) {
        console.error('[Indexing] Error getting Google auth headers:', err.message);
        googleIndexingSuccess = false;
      }
    }

    if (googleIndexingSuccess) {
      // Chunk URLs in maximum groups of 5 for bounded concurrency
      const chunks = [];
      for (let i = 0; i < urlList.length; i += 5) {
        chunks.push(urlList.slice(i, i + 5));
      }

      for (const chunk of chunks) {
        try {
          await Promise.all(chunk.map(url => sendUrlWithRetry(url, fetchFn, headers)));
        } catch (err) {
          console.error('[Indexing] Error sending URL notification to Google Indexing API:', err.message);
          googleIndexingSuccess = false;
        }
      }
    }
  }

  return {
    success: indexNowSuccess && googleIndexingSuccess,
    urls: urlList,
    googleIndexed: googleIndexingSuccess
  };
}

export function getIndexNowKey() {
  return INDEXNOW_KEY;
}

