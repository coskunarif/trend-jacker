import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test.describe('SEO Canonical Redirects and Sitemap Ping Tests', () => {

  /**
   * [AC-1] Protocol Redirect (HTTP to HTTPS)
   * - Accessing the application via HTTP must trigger a 301 permanent redirect to the corresponding HTTPS URL.
   * - Verified by sending GET request with 'X-Forwarded-Proto: http' and checking for 301 status and correct Location.
   */
  test('[AC-1] Protocol Redirect (HTTP to HTTPS) - root path', async ({ request }) => {
    const response = await request.get('/', {
      headers: {
        'X-Forwarded-Proto': 'http',
        'Host': 'viraljacker.com'
      },
      maxRedirects: 0
    });
    expect(response.status()).toBe(301);
    expect(response.headers()['location']).toBe('https://viraljacker.com/');
  });

  /**
   * [AC-1] Protocol Redirect (HTTP to HTTPS)
   * - Accessing a sub-path via HTTP must trigger a 301 permanent redirect to the corresponding HTTPS URL.
   */
  test('[AC-1] Protocol Redirect (HTTP to HTTPS) - sub-path', async ({ request }) => {
    const response = await request.get('/t/google-gemini', {
      headers: {
        'X-Forwarded-Proto': 'http',
        'Host': 'viraljacker.com'
      },
      maxRedirects: 0
    });
    expect(response.status()).toBe(301);
    expect(response.headers()['location']).toBe('https://viraljacker.com/t/google-gemini');
  });

  /**
   * [AC-2] Hostname Redirect (WWW to non-WWW)
   * - Accessing the application via www.viraljacker.com must trigger a 301 permanent redirect to the corresponding canonical root domain.
   * - Verified by sending GET request with Host: www.viraljacker.com.
   */
  test('[AC-2] Hostname Redirect (WWW to non-WWW) - root path', async ({ request }) => {
    const response = await request.get('/', {
      headers: {
        'Host': 'www.viraljacker.com'
      },
      maxRedirects: 0
    });
    expect(response.status()).toBe(301);
    expect(response.headers()['location']).toBe('https://viraljacker.com/');
  });

  /**
   * [AC-2] Hostname Redirect (WWW to non-WWW)
   * - Accessing a sub-path via www.viraljacker.com must trigger a 301 permanent redirect to the corresponding canonical root domain.
   */
  test('[AC-2] Hostname Redirect (WWW to non-WWW) - sub-path', async ({ request }) => {
    const response = await request.get('/t/google-gemini', {
      headers: {
        'Host': 'www.viraljacker.com'
      },
      maxRedirects: 0
    });
    expect(response.status()).toBe(301);
    expect(response.headers()['location']).toBe('https://viraljacker.com/t/google-gemini');
  });

  /**
   * [AC-3] Combined Protocol and Hostname Redirect preserving Path and Query
   * - Incoming requests on non-canonical hostnames (e.g., WWW) and non-canonical protocols (HTTP) must be permanently redirected (301) to canonical root domain.
   * - Verified by checking that path and query parameters are preserved in Location.
   */
  test('[AC-3] Combined Protocol and Hostname Redirect preserving Path and Query', async ({ request }) => {
    const response = await request.get('/t/google-gemini?ref=viral&utm_source=test', {
      headers: {
        'Host': 'www.viraljacker.com',
        'X-Forwarded-Proto': 'http'
      },
      maxRedirects: 0
    });
    expect(response.status()).toBe(301);
    expect(response.headers()['location']).toBe('https://viraljacker.com/t/google-gemini?ref=viral&utm_source=test');
  });

  /**
   * [AC-4] Local Development and Test Bypass
   * - Requests containing localhost or 127.0.0.1 in the Host header must bypass redirect logic to ensure local development, manual verification, and local automated test suites run without redirecting to production.
   */
  test('[AC-4] Local Development and Test Bypass - localhost', async ({ request }) => {
    const response = await request.get('/', {
      headers: {
        'Host': 'localhost:3001'
      },
      maxRedirects: 0
    });
    expect(response.status()).not.toBe(301);
  });

  test('[AC-4] Local Development and Test Bypass - 127.0.0.1', async ({ request }) => {
    const response = await request.get('/', {
      headers: {
        'Host': '127.0.0.1:3001'
      },
      maxRedirects: 0
    });
    expect(response.status()).not.toBe(301);
  });

  test('[AC-4] Local Development and Test Bypass - localhost with HTTP proto header', async ({ request }) => {
    const response = await request.get('/', {
      headers: {
        'Host': 'localhost:3001',
        'X-Forwarded-Proto': 'http'
      },
      maxRedirects: 0
    });
    expect(response.status()).not.toBe(301);
  });

  /**
   * [AC-3] Google Indexing API Integration
   * - The file indexing.js must contain reference to indexing.googleapis.com.
   */
  test('[AC-3] Google Indexing API Integration - Static Check', async () => {
    const indexingFilePath = path.resolve(__dirname, '../indexing.js');
    const content = fs.readFileSync(indexingFilePath, 'utf8');
    
    expect(content).toContain('indexing.googleapis.com');
  });

  /**
   * [AC-3] Google Indexing API Integration
   * - Execution of the pingSearchEngines function in test mode must trigger POST requests to Google Indexing API.
   * - Preserves IndexNow API submissions.
   */
  test('[AC-3] Google Indexing API Integration - Invocation Check', async () => {
    const helperFilePath = path.join(__dirname, 'temp-ping-test.js');
    
    // Write dynamic runner script to call pingSearchEngines in a separate Node.js process
    const helperScript = `
import { pingSearchEngines } from '../indexing.js';
import http from 'node:http';
import https from 'node:https';
import { EventEmitter } from 'node:events';
import { Readable } from 'node:stream';

const requests = [];
const consoleLogs = [];
const consoleWarns = [];

const originalLog = console.log;
const originalWarn = console.warn;

console.log = (...args) => {
  consoleLogs.push(args.join(' '));
};
console.warn = (...args) => {
  consoleWarns.push(args.join(' '));
};

const createMockRequest = (url, options, cb) => {
  requests.push({ url, method: options.method || 'GET' });
  const req = new EventEmitter();
  req.write = () => {};
  req.end = () => {
    const res = Readable.from(Buffer.from('{"success":true}'));
    res.statusCode = 200;
    res.headers = { 'content-type': 'application/json' };
    res.setEncoding = () => {};
    process.nextTick(() => {
      if (typeof cb === 'function') cb(res);
      req.emit('response', res);
    });
  };
  req.setTimeout = () => {};
  req.abort = () => {};
  req.destroy = () => {};
  return req;
};

const getUrlFromArgs = (protocol, args) => {
  if (typeof args[0] === 'string') {
    return args[0];
  }
  if (args[0] && typeof args[0] === 'object' && args[0].href) {
    return args[0].href;
  }
  if (args[0] && args[0].toString && (args[0] instanceof URL || args[0].constructor.name === 'URL')) {
    return args[0].toString();
  }
  const options = args.find(arg => typeof arg === 'object') || {};
  const host = options.host || options.hostname || '';
  const pathStr = options.path || '';
  return \`\${protocol}//\${host}\${pathStr}\`;
};

http.request = function(...args) {
  const cb = args.find(arg => typeof arg === 'function');
  const options = args.find(arg => typeof arg === 'object') || {};
  const url = getUrlFromArgs('http:', args);
  return createMockRequest(url, options, cb);
};

https.request = function(...args) {
  const cb = args.find(arg => typeof arg === 'function');
  const options = args.find(arg => typeof arg === 'object') || {};
  const url = getUrlFromArgs('https:', args);
  return createMockRequest(url, options, cb);
};

globalThis.fetch = async (url, options) => {
  const urlStr = url.toString();
  requests.push({
    url: urlStr,
    method: options?.method || 'GET',
    headers: options?.headers || {},
    body: options?.body ? JSON.parse(options.body) : null
  });
  return {
    ok: true,
    status: 200,
    text: async () => '{"success":true}',
    json: async () => ({ success: true }),
  };
};

try {
  const result = await pingSearchEngines(['google-gemini']);
  originalLog('RESULT_JSON:' + JSON.stringify({
    success: result.success,
    requests,
    logs: consoleLogs,
    warns: consoleWarns
  }));
} catch (err) {
  originalWarn('ERROR:' + err.message);
  process.exit(1);
}
`;

    fs.writeFileSync(helperFilePath, helperScript, 'utf8');

    try {
      // Execute the helper script in test mode (NODE_ENV: test)
      const stdout = execSync('node temp-ping-test.js', {
        cwd: __dirname,
        env: {
          ...process.env,
          NODE_ENV: 'test'
        }
      }).toString();

      console.log('Child process stdout:', stdout);
      const resultLine = stdout.split('\n').find(line => line.startsWith('RESULT_JSON:'));
      expect(resultLine).toBeDefined();

      const result = JSON.parse(resultLine.replace('RESULT_JSON:', ''));
      expect(result.success).toBe(true);

      // Verify IndexNow ping was sent
      const indexNowRequest = result.requests.find(r => r.url.includes('indexnow.org'));
      expect(indexNowRequest).toBeDefined();

      // Verify Google Indexing API POST request was sent
      const googleIndexingRequest = result.requests.find(r => r.url.includes('indexing.googleapis.com'));
      expect(googleIndexingRequest).toBeDefined();
      expect(googleIndexingRequest.method).toBe('POST');
      expect(googleIndexingRequest.body).toBeDefined();
      expect(googleIndexingRequest.body.url).toContain('/t/google-gemini');
      expect(googleIndexingRequest.body.type).toBe('URL_UPDATED');

    } finally {
      // Cleanup the helper script file
      if (fs.existsSync(helperFilePath)) {
        fs.unlinkSync(helperFilePath);
      }
    }
  });

});
