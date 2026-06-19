import fetch from 'node-fetch'; // Fastify/Node 20+ has fetch globally, but we can just use the global fetch

const INDEXNOW_KEY = process.env.INDEXNOW_KEY || 'trendjackerkey2026';
const APP_HOST = process.env.APP_HOST || 'viraljacker.com';

/**
 * Pings IndexNow API with the newly discovered trend slugs.
 * @param {string[]} slugs Array of trend slugs to ping
 */
export async function pingSearchEngines(slugs) {
  if (!slugs || slugs.length === 0) return { success: true, urls: [] };

  const isTest = process.env.NODE_ENV === 'test';
  const protocol = APP_HOST.includes('localhost') || APP_HOST.includes('127.0.0.1') ? 'http' : 'https';
  
  // Normalize and deduplicate slugs
  const normalizedSlugs = [...new Set(slugs.map(s => s.trim().toLowerCase()))];
  
  // Format full URLs with all localized language variants
  const urlList = [];
  for (const slug of normalizedSlugs) {
    urlList.push(`${protocol}://${APP_HOST}/t/${slug}`);
    urlList.push(`${protocol}://${APP_HOST}/t/${slug}/es`);
    urlList.push(`${protocol}://${APP_HOST}/t/${slug}/fr`);
    urlList.push(`${protocol}://${APP_HOST}/t/${slug}/ja`);
  }
  
  console.log(`[Indexing] Attempting to ping ${urlList.length} URL(s) to IndexNow:`, urlList);

  const sitemapUrl = `${protocol}://${APP_HOST}/sitemap.xml`;
  const googlePingUrl = `https://www.google.com/ping?sitemap=${encodeURIComponent(sitemapUrl)}`;

  if (isTest) {
    console.log('[Indexing] Running in test mode. Skipping actual external HTTP pings.');
    console.log(`Mock: Google sitemap ping for URL: ${sitemapUrl}`);
    return { success: true, mocked: true, urls: urlList, googlePinged: true };
  }

  // Google sitemap ping (run asynchronously/non-blocking)
  const fetchFn = typeof globalThis.fetch === 'function' ? globalThis.fetch : fetch;
  fetchFn(googlePingUrl)
    .then(res => {
      console.log(`[Indexing] Google sitemap ping response status: ${res.status}`);
    })
    .catch(err => {
      console.warn(`[Indexing] Google sitemap ping failed gracefully: ${err.message}`);
    });

  try {
    // 1. Submit to IndexNow API
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
    } else {
      const errorText = await response.text();
      console.warn(`[Indexing] IndexNow submission returned error (Status: ${response.status}):`, errorText);
    }

    return { success: response.ok, urls: urlList, googlePinged: true };
  } catch (err) {
    console.error('[Indexing] Error pinging search engines:', err.message);
    return { success: false, error: err.message, urls: urlList, googlePinged: true };
  }
}

export function getIndexNowKey() {
  return INDEXNOW_KEY;
}
