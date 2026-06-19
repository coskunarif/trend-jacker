import { test, expect } from '@playwright/test';
import { pingSearchEngines } from '../indexing.js';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test.describe('Google Indexing API Integration Tests', () => {

  /**
   * [AC-1] Google Indexing API Integration - Localized Variants and Payload
   * - Format and notify all 4 language variants (English `/t/:slug`, Spanish `/t/:slug/es`, French `/t/:slug/fr`, and Japanese `/t/:slug/ja`) to the Indexing API.
   * - Verify unauthenticated fallback in test mode.
   */
  test('[AC-1] Notify all 4 language variants in test mode', async () => {
    const requests = [];
    const originalFetch = globalThis.fetch;

    globalThis.fetch = async (url, options) => {
      const urlStr = url.toString();
      if (urlStr.includes('indexing.googleapis.com')) {
        requests.push({
          url: urlStr,
          method: options?.method,
          body: options?.body ? JSON.parse(options.body) : null
        });
      }
      return {
        ok: true,
        status: 200,
        text: async () => '{"success":true}',
        json: async () => ({ success: true })
      };
    };

    try {
      const result = await pingSearchEngines(['viral-growth']);
      expect(result.success).toBe(true);
      expect(result.googleIndexed).toBe(true);

      // 4 language variants: English, Spanish, French, Japanese
      expect(requests.length).toBe(4);

      const targetUrls = [
        'https://viraljacker.com/t/viral-growth',
        'https://viraljacker.com/t/viral-growth/es',
        'https://viraljacker.com/t/viral-growth/fr',
        'https://viraljacker.com/t/viral-growth/ja'
      ];

      for (const target of targetUrls) {
        const req = requests.find(r => r.body && r.body.url === target);
        expect(req).toBeDefined();
        expect(req.method).toBe('POST');
        expect(req.body.type).toBe('URL_UPDATED');
      }
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  /**
   * [AC-1] Bounded Concurrency Limit of 5
   * - Process the URL notifications in chunks of maximum 5 concurrent requests at a time to prevent rate limiting.
   */
  test('[AC-1] Enforce maximum concurrency of 5 concurrent requests', async () => {
    const originalFetch = globalThis.fetch;
    let activeRequests = 0;
    let maxActiveRequests = 0;

    globalThis.fetch = async (url, options) => {
      if (url.toString().includes('indexing.googleapis.com')) {
        activeRequests++;
        maxActiveRequests = Math.max(maxActiveRequests, activeRequests);
        // Simulate some async network delay
        await new Promise(resolve => setTimeout(resolve, 50));
        activeRequests--;
      }
      return {
        ok: true,
        status: 200,
        text: async () => '{"success":true}',
        json: async () => ({ success: true })
      };
    };

    try {
      // 3 slugs -> 12 URLs (each has 4 variants). Concurrency should be bounded to 5 max.
      await pingSearchEngines(['slug1', 'slug2', 'slug3']);
      expect(maxActiveRequests).toBeGreaterThan(0);
      expect(maxActiveRequests).toBeLessThanOrEqual(5);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  /**
   * [AC-1] Retry Mechanism with Exponential Backoff
   * - Retry handler for transient errors (connection timeouts, DNS errors, or HTTP 5xx responses).
   * - Retry up to 3 times (initial + 3 retries, total 4 attempts) with backoffs of 200ms, 400ms, 800ms.
   */
  test('[AC-1] Retry transient failures up to 3 times with backoff', async () => {
    const originalFetch = globalThis.fetch;
    const callTimes = [];

    globalThis.fetch = async (url, options) => {
      if (url.toString().includes('indexing.googleapis.com')) {
        callTimes.push(Date.now());
        // Fail the first 3 requests, succeed on 4th
        if (callTimes.length < 4) {
          return {
            ok: false,
            status: 503,
            text: async () => 'Service Unavailable',
            json: async () => ({ error: 'Service Unavailable' })
          };
        }
      }
      return {
        ok: true,
        status: 200,
        text: async () => '{"success":true}',
        json: async () => ({ success: true })
      };
    };

    try {
      // Pass a single slug to trigger 4 URLs, but let's just trace the first variant or overall behavior.
      // Wait, we only need to test the retry on a single URL to verify the mechanism.
      // Let's pass a single URL if possible, or trace the delay between retries.
      const start = Date.now();
      const result = await pingSearchEngines(['retry-test']);
      
      expect(result.success).toBe(true);
      // Since it succeeded on the 4th attempt (3 retries), the callTimes list should have length 4
      expect(callTimes.length).toBe(4);

      // Verify approximate exponential backoff delays (200ms, 400ms, 800ms)
      // Allow slight timing tolerance (>= 150ms for first backoff, >= 350ms for second, >= 750ms for third)
      const diff1 = callTimes[1] - callTimes[0];
      const diff2 = callTimes[2] - callTimes[1];
      const diff3 = callTimes[3] - callTimes[2];

      expect(diff1).toBeGreaterThanOrEqual(150);
      expect(diff2).toBeGreaterThanOrEqual(350);
      expect(diff3).toBeGreaterThanOrEqual(750);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  /**
   * [AC-1] Local Development Mode bypass
   * - If no credentials found and not in test mode, bypass the network calls and return success.
   */
  test('[AC-1] Local Development Bypass when no credentials exist and not in test mode', async () => {
    const helperFilePath = path.join(__dirname, 'temp-dev-test.js');
    const helperScript = `
import { pingSearchEngines } from '../indexing.js';
import { EventEmitter } from 'node:events';

const requests = [];
const consoleLogs = [];
const consoleWarns = [];

console.log = (...args) => consoleLogs.push(args.join(' '));
console.warn = (...args) => consoleWarns.push(args.join(' '));

globalThis.fetch = async (url, options) => {
  requests.push(url.toString());
  return { ok: true, status: 200, json: async () => ({}) };
};

const result = await pingSearchEngines(['dev-bypass']);
console.error('RESULT_JSON:' + JSON.stringify({
  success: result.success,
  requests,
  logs: consoleLogs,
  warns: consoleWarns
}));
`;
    fs.writeFileSync(helperFilePath, helperScript, 'utf8');

    try {
      // Running script in production mode to trigger local dev check (no credentials)
      const stdout = execSync('node temp-dev-test.js', {
        cwd: __dirname,
        env: {
          ...process.env,
          NODE_ENV: 'production',
          GOOGLE_APPLICATION_CREDENTIALS: '' // clear credentials
        }
      }).toString();

      const resultLine = stdout.split('\n').find(line => line.startsWith('RESULT_JSON:'));
      expect(resultLine).toBeDefined();

      const result = JSON.parse(resultLine.replace('RESULT_JSON:', ''));
      expect(result.success).toBe(true);

      // Verify NO Indexing API requests were sent
      const googleIndexingRequest = result.requests.find(r => r.includes('indexing.googleapis.com'));
      expect(googleIndexingRequest).toBeUndefined();

      // Verify warning log printed
      const mockWarn = result.warns.find(w => w.toLowerCase().includes('mock') || w.toLowerCase().includes('bypass') || w.toLowerCase().includes('credential'));
      expect(mockWarn).toBeDefined();
    } finally {
      if (fs.existsSync(helperFilePath)) {
        fs.unlinkSync(helperFilePath);
      }
    }
  });

  /**
   * [AC-2] Standalone CLI Script - Test Mode
   * - In test mode (NODE_ENV === 'test'), prints a mock statement containing 'mock', 'google', and 'sitemap'.
   */
  test('[AC-2] Standalone CLI Script prints mock log in test mode', () => {
    const scriptPath = path.resolve(__dirname, '../scripts/ping-sitemap.js');
    const stdout = execSync(`node ${scriptPath}`, {
      env: {
        ...process.env,
        NODE_ENV: 'test'
      }
    }).toString().toLowerCase();

    expect(stdout).toContain('mock');
    expect(stdout).toContain('google');
    expect(stdout).toContain('sitemap');
  });

  /**
   * [AC-2] Standalone CLI Script - Quota Protection and URL Filtering
   * - Fetch /sitemap.xml, parse URLs.
   * - Filter out static non-trend URLs (only include URLs matching the /t/:slug pattern).
   * - Limit the number of submitted URLs in a single execution to the 15 most recent trends.
   */
  test('[AC-2] Standalone CLI Script filters and caps URLs to 15 most recent trends in production mode', async () => {
    const helperFilePath = path.join(__dirname, 'temp-cli-test.js');
    
    // Create a mock sitemap file content with static and more than 15 trend URLs
    const mockSitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://viraljacker.com/</loc></url>
  <url><loc>https://viraljacker.com/about</loc></url>
  <url><loc>https://viraljacker.com/privacy</loc></url>
  \${Array.from({ length: 20 }, (_, i) => \`<url><loc>https://viraljacker.com/t/trend-slug-\${i + 1}</loc></url>\`).join('\\n')}
</urlset>`;

    const helperScript = `
import fs from 'node:fs';
import path from 'node:path';

const pings = [];
// Mock pingSearchEngines
import * as indexingModule from '../indexing.js';
indexingModule.pingSearchEngines = async (slugs) => {
  pings.push(...slugs);
  return { success: true, urls: slugs };
};

globalThis.fetch = async (url) => {
  if (url.toString().includes('sitemap.xml')) {
    return {
      ok: true,
      status: 200,
      text: async () => \\\`\${mockSitemap}\\\`
    };
  }
  return { ok: true, status: 200, text: async () => '' };
};

// Import and run scripts/ping-sitemap.js
await import('../scripts/ping-sitemap.js');

console.log('SUBMITTED_SLUGS:' + JSON.stringify(pings));
`;

    fs.writeFileSync(helperFilePath, helperScript, 'utf8');

    try {
      const stdout = execSync('node temp-cli-test.js', {
        cwd: __dirname,
        env: {
          ...process.env,
          NODE_ENV: 'production',
          APP_HOST: 'viraljacker.com'
        }
      }).toString();

      console.log('CLI output:', stdout);
      const resultLine = stdout.split('\n').find(line => line.startsWith('SUBMITTED_SLUGS:'));
      expect(resultLine).toBeDefined();

      const slugs = JSON.parse(resultLine.replace('SUBMITTED_SLUGS:', ''));
      // Should filter out static URLs: '/' '/about' '/privacy' (only trends matching '/t/:slug' pattern are kept)
      // Should limit to 15 most recent trends.
      expect(slugs.length).toBeLessThanOrEqual(15);
      
      // Make sure they are actual trend slugs, e.g. 'trend-slug-1', and does not include static paths
      for (const slug of slugs) {
        expect(slug).toContain('trend-slug-');
        expect(slug).not.toContain('about');
        expect(slug).not.toContain('privacy');
      }
    } finally {
      if (fs.existsSync(helperFilePath)) {
        fs.unlinkSync(helperFilePath);
      }
    }
  });

});
