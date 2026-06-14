import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test.describe('Social Previews & Search Indexing Coverage Spec', () => {

  /**
   * [AC-1] Dynamic OG PNG Preview Cards
   * Send a HTTP GET request to /api/og/google-gemini and /api/og/google-gemini/es.
   * Verify HTTP status is 200, Content-Type is exactly image/png.
   * Parse the response binary buffer to verify PNG signature and dimensions (1200x630).
   */
  test('[AC-1] Should serve rasterized PNG image of exactly 1200x630 for default lang og endpoint', async ({ request }) => {
    const response = await request.get('/api/og/google-gemini');
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toBe('image/png');

    const body = await response.body();
    
    // PNG file signature validation: 89 50 4E 47 0D 0A 1A 0A
    const pngSignature = body.slice(0, 8).toString('hex');
    expect(pngSignature).toBe('89504e470d0a1a0a');

    // Width is a 32-bit big-endian integer at offset 16
    const width = body.readUInt32BE(16);
    // Height is a 32-bit big-endian integer at offset 20
    const height = body.readUInt32BE(20);

    expect(width).toBe(1200);
    expect(height).toBe(630);
  });

  test('[AC-1] Should serve rasterized PNG image of exactly 1200x630 for localized lang og endpoint', async ({ request }) => {
    const response = await request.get('/api/og/google-gemini/es');
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toBe('image/png');

    const body = await response.body();
    
    // PNG file signature validation: 89 50 4E 47 0D 0A 1A 0A
    const pngSignature = body.slice(0, 8).toString('hex');
    expect(pngSignature).toBe('89504e470d0a1a0a');

    const width = body.readUInt32BE(16);
    const height = body.readUInt32BE(20);

    expect(width).toBe(1200);
    expect(height).toBe(630);
  });

  /**
   * [AC-2] Case-Insensitive Cache Lookup & Storage
   * Call /api/og/Google-Gemini and /api/og/GOOGLE-GEMINI successively.
   * Ensure response returns the same cached PNG binary data.
   */
  test('[AC-2] Should serve identical cached PNG binary data for case-insensitive URL lookups', async ({ request }) => {
    const res1 = await request.get('/api/og/Google-Gemini');
    expect(res1.status()).toBe(200);
    const body1 = await res1.body();

    const res2 = await request.get('/api/og/GOOGLE-GEMINI');
    expect(res2.status()).toBe(200);
    const body2 = await res2.body();

    // Verify both buffers are identical
    expect(body1.equals(body2)).toBe(true);
  });

  test('[AC-2] Server implementation should normalize cache keys to lowercase', async () => {
    // Statically check server.js implementation code to ensure the key is normalized to lowercase
    const serverPath = path.resolve(__dirname, '../server.js');
    const serverContent = fs.readFileSync(serverPath, 'utf8');
    
    // Check that there is an OG/OpenGraph image cache variable defined (e.g. ogCache or ogImageCache)
    const hasOgCache = /ogCache|ogImageCache/i.test(serverContent);
    expect(hasOgCache).toBe(true);

    // Check that keys are normalized to lowercase
    const hasLowercaseLookup = serverContent.includes('.toLowerCase()') && 
                               (serverContent.includes('slug') || serverContent.includes('lang'));
    expect(hasLowercaseLookup).toBe(true);
  });

  /**
   * [AC-3] Thematic Dynamic Category Styling
   * Assert category-specific text and badge/style rendering matches the category rules.
   */
  test('[AC-3] Topic image endpoint should serve Tech badge and emoji for google-gemini', async ({ request }) => {
    const response = await request.get('/api/topic-image/google-gemini');
    expect(response.status()).toBe(200);
    const text = await response.text();

    expect(text).toContain('Cutting Edge');
    expect(text).toContain('🤖');
  });

  test('[AC-3] Topic image endpoint should serve Workplace badge and emoji for remote-job', async ({ request }) => {
    const response = await request.get('/api/topic-image/remote-job');
    expect(response.status()).toBe(200);
    const text = await response.text();

    expect(text).toContain('Future of Work');
    expect(text).toContain('💼');
  });

  test('[AC-3] Topic image endpoint should serve Innovation badge and emoji for solar-energy', async ({ request }) => {
    const response = await request.get('/api/topic-image/solar-energy');
    expect(response.status()).toBe(200);
    const text = await response.text();

    expect(text).toContain('Green Tech');
    expect(text).toContain('⚡');
  });

  test('[AC-3] Topic image endpoint should serve Default badge and emoji for unknown slug', async ({ request }) => {
    const response = await request.get('/api/topic-image/arbitrary-unknown-slug');
    expect(response.status()).toBe(200);
    const text = await response.text();

    expect(text).toContain('Hot Vibe');
    expect(text).toContain('🔥');
  });

  test('[AC-3] Server code should apply the same thematic category styling to /api/og SVG templates', async () => {
    const serverPath = path.resolve(__dirname, '../server.js');
    const serverContent = fs.readFileSync(serverPath, 'utf8');
    
    // Verify og generator doesn't use hardcoded 'Vibe Badge: AI/Tech'
    expect(serverContent).not.toContain('Vibe Badge: AI/Tech');
  });

  /**
   * [AC-4] Multi-Language Search Engine Indexing
   * Assert that pingSearchEngines dispatches all localized variants of the URL list.
   */
  test('[AC-4] Should ping IndexNow with English and localized URL variants for new trends', async () => {
    const indexingModule = await import('../indexing.js');
    expect(typeof indexingModule.pingSearchEngines).toBe('function');

    const result = await indexingModule.pingSearchEngines(['openai-gpt']);
    expect(result).toBeDefined();
    expect(result.success).toBe(true);
    expect(result.urls).toBeDefined();
    
    // Assert all 4 language variants are returned
    expect(result.urls).toContain('https://viraljacker.com/t/openai-gpt');
    expect(result.urls).toContain('https://viraljacker.com/t/openai-gpt/es');
    expect(result.urls).toContain('https://viraljacker.com/t/openai-gpt/fr');
    expect(result.urls).toContain('https://viraljacker.com/t/openai-gpt/ja');
  });

});
