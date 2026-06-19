import { pingSearchEngines } from '../indexing.js';
import fetch from 'node-fetch';

const appHost = process.env.APP_HOST || 'viraljacker.com';
const isTest = process.env.NODE_ENV === 'test';

if (isTest) {
  console.log(`Mock: Google sitemap ping request completed in test mode.`);
  process.exit(0);
}

const protocol = appHost.includes('localhost') || appHost.includes('127.0.0.1') ? 'http' : 'https';
const sitemapUrl = `${protocol}://${appHost}/sitemap.xml`;

try {
  console.log(`Fetching sitemap from: ${sitemapUrl}`);
  const fetchFn = typeof globalThis.fetch === 'function' ? globalThis.fetch : fetch;
  const response = await fetchFn(sitemapUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch sitemap: Status ${response.status}`);
  }
  const xmlText = await response.text();
  
  // Extract all <loc> content
  const locRegex = /<loc>([^<]+)<\/loc>/g;
  let match;
  const uniqueSlugs = [];
  const seenSlugs = new Set();
  
  while ((match = locRegex.exec(xmlText)) !== null) {
    const loc = match[1].trim();
    try {
      const urlObj = new URL(loc);
      const pathname = urlObj.pathname;
      const pathMatch = pathname.match(/^\/t\/([^\/]+)/);
      if (pathMatch) {
        const slug = pathMatch[1];
        if (!seenSlugs.has(slug)) {
          seenSlugs.add(slug);
          uniqueSlugs.push(slug);
        }
      }
    } catch (urlErr) {
      const pathMatch = loc.match(/\/t\/([^\/\?#]+)/);
      if (pathMatch) {
        const slug = pathMatch[1];
        if (!seenSlugs.has(slug)) {
          seenSlugs.add(slug);
          uniqueSlugs.push(slug);
        }
      }
    }
  }

  // Cap at 15 most recent trends
  const trendsToSubmit = uniqueSlugs.slice(0, 15);
  
  console.log(`Found ${uniqueSlugs.length} trend slugs. Submitting top ${trendsToSubmit.length} to Google Indexing API...`);
  
  const result = await pingSearchEngines(trendsToSubmit);
  console.log(`Google Indexing API submission result:`, result);
} catch (err) {
  console.error(`Sitemap parsing / ping failed: ${err.message}`);
  process.exit(1);
}

