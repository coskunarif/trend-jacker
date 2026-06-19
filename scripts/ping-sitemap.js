import { pingSearchEngines } from '../indexing.js';

const appHost = process.env.APP_HOST || 'viraljacker.com';
const isTest = process.env.NODE_ENV === 'test';

if (isTest) {
  console.log(`Mock: Google sitemap ping request for host ${appHost} completed.`);
  process.exit(0);
}

const protocol = appHost.includes('localhost') || appHost.includes('127.0.0.1') ? 'http' : 'https';
const sitemapUrl = `${protocol}://${appHost}/sitemap.xml`;
const googlePingUrl = `https://www.google.com/ping?sitemap=${encodeURIComponent(sitemapUrl)}`;

try {
  console.log(`Pinging Google sitemap at: ${googlePingUrl}`);
  const response = await fetch(googlePingUrl);
  console.log(`Google ping response: ${response.status}`);
} catch (err) {
  console.error(`Google sitemap ping failed: ${err.message}`);
}
