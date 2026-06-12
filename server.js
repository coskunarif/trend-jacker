import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import { parseStringPromise } from 'xml2js';
import { GoogleGenerativeAI } from '@google/generative-ai';

import { getPollData, incrementVote, getVoteEvents, seedVoteEvents, getCachedExplanation, setCachedExplanation, getLocalizedExplanation, setLocalizedExplanation, getCachedChatResponse, setCachedChatResponse, getCachedGeneratedPost, setCachedGeneratedPost } from './db.js';
import { pingSearchEngines, getIndexNowKey } from './indexing.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper to load Gemini API key from api-keys.env or environment variables
function getApiKey() {
  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY;
  if (process.env.GOOGLE_PROFITHELM_FREE_KEY) return process.env.GOOGLE_PROFITHELM_FREE_KEY;

  try {
    const envPath = '/home/ubuntuadmin/projects/api-keys.env';
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf8');
      const match = content.match(/GOOGLE_PROFITHELM_FREE_KEY=([^\s]+)/);
      if (match && match[1]) {
        return match[1].trim();
      }
    }
  } catch (err) {
    console.error('Error reading api-keys.env:', err);
  }
  return null;
}

function titleToSlug(title) {
  return title.toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

const apiKey = getApiKey();
if (!apiKey) {
  console.warn('WARNING: No Google Gemini API key found. AI features will fail.');
}

const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

const fastify = Fastify({ logger: true });

// GET / - Serves the main page with the first trend preloaded for instant hydration
fastify.get('/', async (request, reply) => {
  try {
    if (latestTrends.length === 0) {
      if (process.env.NODE_ENV === 'test') {
        latestTrends = [
          {
            id: 1,
            title: "Google Gemini",
            traffic: "100K+",
            description: "The latest AI models from Google.",
            source: "google",
            news: {
              headline: "Google announces Gemini 3.5",
              snippet: "Gemini 3.5 is now live with advanced reasoning capabilities.",
              url: "https://blog.google/gemini-3.5",
              source: "Google Blog",
              ogImage: "https://blog.google/static/images/gemini-hero.png",
              favicon: "https://blog.google/favicon.ico"
            }
          },
          {
            id: 2,
            title: "Fastify framework",
            traffic: "20K+",
            description: "High performance web framework for Node.js.",
            source: "google",
            news: {
              headline: "Fastify v5 released",
              snippet: "Fastify v5 introduces improved plugin loading and security features.",
              url: "https://fastify.io/v5-release",
              source: "Fastify Blog",
              ogImage: null,
              favicon: "https://www.google.com/s2/favicons?domain=fastify.io&sz=32"
            }
          }
        ];
      } else {
        await updateTrendsCache();
      }
    }
  } catch (err) {
    console.error('Failed to populate trends cache for home page:', err);
  }

  const trendName = latestTrends.length > 0 ? latestTrends[0].title : "Google Gemini";
  const slug = titleToSlug(trendName);

  let explanation;
  try {
    explanation = await getTrendExplanation(trendName, '', '');
  } catch (err) {
    explanation = {
      hook: `Why is everyone talking about ${trendName}?`,
      whatIsIt: `Trending search topic: ${trendName}.`,
      whyIsItViral: [`High volume search interest on Google Trends.`],
      takeaway: `Keep an eye on this trend as it develops.`,
      polls: await getPollData(trendName)
    };
  }

  try {
    const indexPath = path.join(__dirname, 'public', 'index.html');
    let html = fs.readFileSync(indexPath, 'utf-8');

    const trendItem = latestTrends.length > 0 ? latestTrends[0] : null;
    let citation = undefined;
    if (trendItem && trendItem.news && trendItem.news.url) {
      citation = {
        "@type": "CreativeWork",
        "headline": trendItem.news.headline || undefined,
        "url": trendItem.news.url,
        "publisher": trendItem.news.source ? {
          "@type": "Organization",
          "name": trendItem.news.source
        } : undefined
      };
      if (!citation.headline) delete citation.headline;
      if (!citation.publisher) delete citation.publisher;
    }

    const jsonLd = {
      "@context": "https://schema.org",
      "@type": "NewsArticle",
      "headline": `Why is ${trendName} Trending? Genius vs Overrated Explanation`,
      "description": explanation.hook,
      "articleBody": `${explanation.whatIsIt} Takeaway: ${explanation.takeaway}`,
      "mainEntityOfPage": "https://viraljacker.com/",
      "publisher": {
        "@type": "Organization",
        "name": "TrendJacker",
        "url": "https://viraljacker.com",
        "logo": {
          "@type": "ImageObject",
          "url": "https://viraljacker.com/favicon.ico"
        }
      },
      "author": {
        "@type": "Organization",
        "name": "TrendJacker",
        "url": "https://viraljacker.com"
      },
      "datePublished": explanation.created_at || new Date().toISOString(),
      "dateModified": explanation.created_at || new Date().toISOString()
    };
    if (citation) {
      jsonLd.citation = citation;
    }

    const seoMeta = `
  <!-- SEO & GEO Meta Tags dynamically generated by TrendJacker Agent -->
  <title>Why is ${trendName} Trending? | TrendJacker</title>
  <meta name="description" content="${explanation.hook}">
  <meta property="og:title" content="Why is ${trendName} Trending? | TrendJacker">
  <meta property="og:description" content="${explanation.hook}">
  <meta property="og:type" content="article">
  <meta property="og:url" content="https://viraljacker.com/t/${slug}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="Why is ${trendName} Trending? | TrendJacker">
  <meta name="twitter:description" content="${explanation.hook}">
  <link rel="alternate" type="text/markdown" href="/llms.txt">
  
  <script type="application/ld+json">
    ${JSON.stringify(jsonLd, null, 2)}
  </script>
  
  <!-- Preloaded Data block for client hydration -->
  <script id="preloaded-trend-data" type="application/json">
    ${JSON.stringify({ trend: trendName, slug, explanation })}
  </script>
    `;

    html = html.replace(/<title>.*?<\/title>/, '');
    html = html.replace(/<meta\s+name="description"\s+content=".*?">/, '');
    html = html.replace('</head>', `${seoMeta}\n</head>`);

    reply.type('text/html').send(html);
  } catch (err) {
    fastify.log.error(err);
    return reply.status(500).send({ error: 'Failed to render home page.' });
  }
});

// Register static files
fastify.register(fastifyStatic, {
  root: path.join(__dirname, 'public'),
  prefix: '/',
});

// Database initialized via db.js module

// Locations for simulated votes
const LOCATIONS = [
  { city: 'Tokyo', country: 'Japan', flag: '🇯🇵' },
  { city: 'Paris', country: 'France', flag: '🇫🇷' },
  { city: 'New York', country: 'United States', flag: '🇺🇸' },
  { city: 'London', country: 'United Kingdom', flag: '🇬🇧' },
  { city: 'Sydney', country: 'Australia', flag: '🇦🇺' },
  { city: 'Berlin', country: 'Germany', flag: '🇩🇪' },
  { city: 'Toronto', country: 'Canada', flag: '🇨🇦' },
  { city: 'Mumbai', country: 'India', flag: '🇮🇳' },
  { city: 'São Paulo', country: 'Brazil', flag: '🇧🇷' },
  { city: 'Cape Town', country: 'South Africa', flag: '🇿🇦' },
  { city: 'Singapore', country: 'Singapore', flag: '🇸🇬' },
  { city: 'Seoul', country: 'South Korea', flag: '🇰🇷' },
  { city: 'Mexico City', country: 'Mexico', flag: '🇲🇽' },
  { city: 'Dubai', country: 'United Arab Emirates', flag: '🇦🇪' },
  { city: 'Stockholm', country: 'Sweden', flag: '🇸🇪' }
];

const DEFAULT_TRENDS = [
  { title: "AI Agent", traffic: "100K+", description: "Autonomous software agents taking over tasks." },
  { title: "Apple Vision Pro", traffic: "50K+", description: "Spatial computing and virtual reality headset." },
  { title: "ChatGPT", traffic: "200K+", description: "Conversational language model by OpenAI." },
  { title: "Claude 3.5", traffic: "100K+", description: "Anthropic's latest state-of-the-art model." },
  { title: "Remote Work", traffic: "20K+", description: "The shifting landscape of work environments." },
  { title: "Electric Vehicles", traffic: "50K+", description: "Transition from internal combustion engines." },
  { title: "Self-Driving Cars", traffic: "30K+", description: "Autonomous vehicle technology updates." },
  { title: "Quantum Computing", traffic: "10K+", description: "Computing using quantum-mechanical phenomena." },
  { title: "Fusion Energy", traffic: "10K+", description: "Clean power generation technology." },
  { title: "Web3", traffic: "20K+", description: "Decentralized web technologies and blockchain." }
];

let latestTrends = [];
const pingedSlugs = new Set();
let recentActivityLog = [];
const MAX_ACTIVITY_LOG_SIZE = 15;

function logActivity(activity) {
  recentActivityLog.unshift(activity);
  if (recentActivityLog.length > MAX_ACTIVITY_LOG_SIZE) {
    recentActivityLog = recentActivityLog.slice(0, MAX_ACTIVITY_LOG_SIZE);
  }
}

function seedRecentActivityLog() {
  const trendsList = latestTrends.length > 0 ? latestTrends : DEFAULT_TRENDS;
  recentActivityLog = [];
  const now = Date.now();
  for (let i = 0; i < 10; i++) {
    const randomTrend = trendsList[Math.floor(Math.random() * trendsList.length)];
    const location = LOCATIONS[Math.floor(Math.random() * LOCATIONS.length)];
    const vote = i % 2 === 0 ? 'genius' : 'overrated';
    recentActivityLog.push({
      trend: randomTrend.title,
      vote,
      location,
      clientId: `mock-client-${i}`,
      timestamp: now - i * 90000
    });
  }
  console.log(`Seeded recentActivityLog with ${recentActivityLog.length} items.`);
}

// Scraper helper to fetch metadata
async function fetchMetadata(url) {
  if (!url) return { ogImage: null, favicon: null };
  try {
    const parsedUrl = new URL(url);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const html = await response.text();
    
    // Parse ogImage
    let ogImage = null;
    const ogImageMatch = html.match(/<meta[^>]*?(?:property|name)=["']og:image["'][^>]*?content=["']([^"']+)["']/i) ||
                         html.match(/<meta[^>]*?content=["']([^"']+)["'][^>]*?(?:property|name)=["']og:image["']/i);
    if (ogImageMatch) {
      ogImage = ogImageMatch[1];
    } else {
      const twitterImageMatch = html.match(/<meta[^>]*?(?:property|name)=["']twitter:image["'][^>]*?content=["']([^"']+)["']/i) ||
                                html.match(/<meta[^>]*?content=["']([^"']+)["'][^>]*?(?:property|name)=["']twitter:image["']/i);
      if (twitterImageMatch) {
        ogImage = twitterImageMatch[1];
      }
    }

    if (ogImage && !ogImage.startsWith('http')) {
      ogImage = new URL(ogImage, parsedUrl.origin).href;
    }

    // Parse favicon
    let favicon = null;
    const faviconMatch = html.match(/<link[^>]*?rel=["'](?:shortcut\s+)?icon["'][^>]*?href=["']([^"']+)["']/i) ||
                         html.match(/<link[^>]*?href=["']([^"']+)["'][^>]*?rel=["'](?:shortcut\s+)?icon["']/i);
    if (faviconMatch) {
      favicon = faviconMatch[1];
    }

    if (favicon && !favicon.startsWith('http')) {
      favicon = new URL(favicon, parsedUrl.origin).href;
    }

    if (!favicon) {
      favicon = `https://www.google.com/s2/favicons?domain=${parsedUrl.hostname}&sz=32`;
    }

    return { ogImage, favicon };
  } catch (err) {
    let fallbackFavicon = null;
    try {
      const parsedUrl = new URL(url);
      fallbackFavicon = `https://www.google.com/s2/favicons?domain=${parsedUrl.hostname}&sz=32`;
    } catch (_) {}
    return { ogImage: null, favicon: fallbackFavicon };
  }
}

// Helper to fetch trends and populate cache
async function updateTrendsCache() {
  if (process.env.NODE_ENV === 'test') {
    latestTrends = [
      {
        id: 1,
        title: "Google Gemini",
        traffic: "100K+",
        description: "The latest AI models from Google.",
        source: "google",
        news: {
          headline: "Google announces Gemini 3.5",
          snippet: "Gemini 3.5 is now live with advanced reasoning capabilities.",
          url: "https://blog.google/gemini-3.5",
          source: "Google Blog",
          ogImage: "https://blog.google/static/images/gemini-hero.png",
          favicon: "https://blog.google/favicon.ico"
        }
      },
      {
        id: 2,
        title: "Fastify framework",
        traffic: "20K+",
        description: "High performance web framework for Node.js.",
        source: "google",
        news: {
          headline: "Fastify v5 released",
          snippet: "Fastify v5 introduces improved plugin loading and security features.",
          url: "https://fastify.io/v5-release",
          source: "Fastify Blog",
          ogImage: null,
          favicon: "https://www.google.com/s2/favicons?domain=fastify.io&sz=32"
        }
      }
    ];
    return;
  }

  let googleTrends = [];
  let redditTrends = [];

  // 1. Fetch Google Trends RSS
  try {
    const googleResponse = await fetch('https://trends.google.com/trending/rss?geo=US');
    if (googleResponse.ok) {
      const xmlText = await googleResponse.text();
      const result = await parseStringPromise(xmlText);
      const items = result.rss.channel[0].item || [];
      googleTrends = items.map((item, index) => {
        const traffic = item['ht:approx_traffic'] ? item['ht:approx_traffic'][0] : 'N/A';
        const newsItem = item['ht:news_item'] ? item['ht:news_item'][0] : null;
        
        const snippet = newsItem && newsItem['ht:news_item_snippet'] ? newsItem['ht:news_item_snippet'][0] : '';
        const headline = newsItem && newsItem['ht:news_item_title'] ? newsItem['ht:news_item_title'][0] : '';
        const newsUrl = newsItem && newsItem['ht:news_item_url'] ? newsItem['ht:news_item_url'][0] : '';
        const newsSource = newsItem && newsItem['ht:news_item_source'] ? newsItem['ht:news_item_source'][0] : '';

        return {
          id: `google-${index}`,
          title: item.title[0],
          traffic,
          description: item.description ? item.description[0] : '',
          source: 'google',
          news: {
            headline,
            snippet,
            url: newsUrl,
            source: newsSource
          }
        };
      });
    } else {
      console.error(`Failed to fetch Google Trends RSS: ${googleResponse.status}`);
    }
  } catch (err) {
    console.error('Failed to fetch Google Trends RSS:', err.message);
  }

  // 2. Fetch Reddit Popular RSS
  try {
    const redditResponse = await fetch('https://www.reddit.com/r/popular.rss', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Cache-Control': 'max-age=0'
      }
    });

    if (redditResponse.ok) {
      const xmlText = await redditResponse.text();
      const result = await parseStringPromise(xmlText);
      const entries = (result.feed && result.feed.entry) || [];
      redditTrends = entries.map((entry, index) => {
        const title = entry.title ? entry.title[0] : 'Reddit Thread';
        const link = (entry.link && entry.link[0] && entry.link[0].$) ? entry.link[0].$.href : '';
        const category = (entry.category && entry.category[0] && entry.category[0].$) 
          ? (entry.category[0].$.label || entry.category[0].$.term || 'r/popular')
          : 'r/popular';

        return {
          id: `reddit-${index}`,
          title: title.length > 60 ? title.substring(0, 60) + '...' : title,
          traffic: 'Reddit Spike',
          description: `Hot post on ${category}`,
          source: 'reddit',
          news: {
            headline: title,
            snippet: `Early interest spike on Reddit in the ${category} community.`,
            url: link,
            source: category
          }
        };
      });
    } else {
      console.error(`Failed to fetch Reddit RSS: ${redditResponse.status}`);
    }
  } catch (err) {
    console.error('Failed to fetch Reddit RSS:', err.message);
  }

  // 3. Merge and Deduplicate by Title Slug
  const merged = [];
  const seenSlugs = new Set();

  // Add Google trends first
  for (const item of googleTrends) {
    const slug = titleToSlug(item.title);
    if (!seenSlugs.has(slug)) {
      seenSlugs.add(slug);
      merged.push(item);
    }
  }

  // Add Reddit spikes next if not already seen
  for (const item of redditTrends) {
    const slug = titleToSlug(item.title);
    if (!seenSlugs.has(slug)) {
      seenSlugs.add(slug);
      merged.push(item);
    }
  }

  // If both failed, use default trends
  if (merged.length === 0) {
    console.warn('Both Google and Reddit RSS failed. Using fallbacks.');
  } else {
    if (merged.length > 0) {
      const metadataPromises = merged.map(async (item) => {
        if (item.news && item.news.url) {
          const meta = await fetchMetadata(item.news.url);
          item.news.ogImage = meta.ogImage;
          item.news.favicon = meta.favicon;
        } else if (item.news) {
          item.news.ogImage = null;
          item.news.favicon = null;
        }
      });
      await Promise.all(metadataPromises);
    }
    latestTrends = merged;
    console.log(`Successfully cached ${latestTrends.length} blended trends.`);
  }

  // Trigger search engine indexing pings for newly discovered trends
  const newSlugs = [];
  for (const trend of latestTrends) {
    const slug = titleToSlug(trend.title);
    if (!pingedSlugs.has(slug)) {
      pingedSlugs.add(slug);
      newSlugs.push(slug);
    }
  }
  if (newSlugs.length > 0) {
    pingSearchEngines(newSlugs).catch(err => {
      console.error('Failed to trigger search engine pings:', err);
    });
  }
}

// GET /api/trends - Fetches and parses Google Trends RSS feed
fastify.get('/api/trends', async (request, reply) => {
  try {
    if (latestTrends.length === 0) {
      await updateTrendsCache();
    }
    return latestTrends.slice(0, 15);
  } catch (err) {
    fastify.log.error(err);
    return reply.status(500).send({ error: 'Failed to fetch trending topics.' });
  }
});

// GET /<INDEXNOW_KEY>.txt - Serves verification key for IndexNow API ownership checks
const indexNowKey = getIndexNowKey();
fastify.get(`/${indexNowKey}.txt`, async (request, reply) => {
  reply.header('Content-Type', 'text/plain');
  return indexNowKey;
});

// Server-Sent Events Clients for live sentiment feed
const sseClients = new Set();
let globalSimulationInterval = null;

function broadcastSSE(data) {
  const message = `data: ${JSON.stringify(data)}\n\n`;
  for (const client of sseClients) {
    try {
      client.write(message);
    } catch (err) {
      // Client disconnected
    }
  }
}

function startGlobalSimulation() {
  if (globalSimulationInterval) return;
  console.log('Starting global sentiment simulation timer.');
  globalSimulationInterval = setInterval(async () => {
    if (sseClients.size === 0) {
      stopGlobalSimulation();
      return;
    }

    const trendsList = latestTrends.length > 0 ? latestTrends : DEFAULT_TRENDS;
    const randomTrend = trendsList[Math.floor(Math.random() * trendsList.length)];
    const vote = Math.random() > 0.55 ? 'genius' : 'overrated';
    const location = LOCATIONS[Math.floor(Math.random() * LOCATIONS.length)];

    let updatedPolls = null;
    try {
      updatedPolls = await incrementVote(randomTrend.title, vote, location);
    } catch (err) {
      console.error(`Failed to increment simulated vote for "${randomTrend.title}":`, err.message);
    }

    const timestamp = new Date().toISOString();
    const activity = {
      trend: randomTrend.title,
      vote,
      location,
      clientId: 'simulated-client',
      timestamp
    };

    logActivity(activity);

    broadcastSSE({
      ...activity,
      updatedPolls
    });
  }, 4000); // Simulated vote broadcasted every 4 seconds
}

function stopGlobalSimulation() {
  if (globalSimulationInterval) {
    clearInterval(globalSimulationInterval);
    globalSimulationInterval = null;
    console.log('Stopped global sentiment simulation (no clients connected).');
  }
}

// GET /api/sentiment-stream - SSE endpoint for global activity feed
fastify.get('/api/sentiment-stream', (request, reply) => {
  reply.raw.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*'
  });

  reply.raw.write(`event: hydration\ndata: ${JSON.stringify(recentActivityLog)}\n\n`);
  reply.raw.write('retry: 5000\n\n');
  sseClients.add(reply.raw);
  startGlobalSimulation();

  request.raw.on('close', () => {
    sseClients.delete(reply.raw);
    if (sseClients.size === 0) {
      stopGlobalSimulation();
    }
  });
});

// Helper to get explanation from Gemini
async function getTrendExplanation(trend, headline = '', snippet = '') {
  // Check the cache first
  const cached = await getCachedExplanation(trend);
  if (cached) {
    cached.polls = await getPollData(trend);
    return cached;
  }

  let explanation;
  if (process.env.NODE_ENV === 'test') {
    explanation = {
      hook: 'Gemini is capturing developer mindshare with low latency and long context.',
      whatIsIt: 'Google Gemini is a suite of multimodal generative AI models.',
      whyIsItViral: ['Long context window', 'Low latency API', 'Reasoning capability'],
      takeaway: 'Expect Gemini to power next-gen agentic workflows.'
    };
  } else {
    if (!genAI) {
      throw new Error('Gemini API not configured.');
    }

    const model = genAI.getGenerativeModel({
      model: 'gemini-3.5-flash',
      generationConfig: { 
        thinkingConfig: { thinkingLevel: 'LOW' },
        responseMimeType: 'application/json',
        responseSchema: {
          type: "OBJECT",
          properties: {
            hook: { type: "STRING" },
            whatIsIt: { type: "STRING" },
            whyIsItViral: {
              type: "ARRAY",
              items: { type: "STRING" }
            },
            takeaway: { type: "STRING" }
          },
          required: ["hook", "whatIsIt", "whyIsItViral", "takeaway"]
        },
        thinkingConfig: { thinkingLevel: 'LOW' }
      }
    });

    const prompt = `You are a viral trend analyst. Explain why the topic "${trend}" is trending.
Here is the context headline: "${headline || ''}".
Here is the context snippet: "${snippet || ''}".

Style guidelines:
Write in a catchy, active voice, and keep it concise. Avoid fluff.
Do NOT use any of the following blacklisted/banned words: delve, tapestry, revolutionize, unlock, moreover, testament to, it is important to note, firstly, in conclusion, embark.`;

    const result = await model.generateContent(prompt);
    const textResponse = result.response.text();
    
    let cleanedText = textResponse.trim();
    if (cleanedText.startsWith('```')) {
      cleanedText = cleanedText.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/, '').trim();
    }
    
    explanation = JSON.parse(cleanedText);
  }

  // Write explanation to cache
  await setCachedExplanation(trend, explanation);

  // Retrieve live poll statistics
  explanation.polls = await getPollData(trend);

  // Fetch newly cached object to get created_at
  const freshlyCached = await getCachedExplanation(trend);
  if (freshlyCached) {
    explanation.created_at = freshlyCached.created_at;
  } else {
    explanation.created_at = new Date().toISOString();
  }

  return explanation;
}

// Helper to get localized trend explanation (production + mock/test mode)
async function getLocalizedTrendExplanation(trend, lang, headline = '', snippet = '') {
  const normalizedLang = (lang || 'en').toLowerCase().trim();
  const supported = ['es', 'fr', 'ja'];

  if (!supported.includes(normalizedLang)) {
    // Fallback/Use English
    const explanation = await getTrendExplanation(trend, headline, snippet);
    return {
      title: `Why is ${trend} Trending? | TrendJacker`,
      meta_description: explanation.hook,
      explanation,
      lang: 'en',
      created_at: explanation.created_at
    };
  }

  // Check localized cache first
  const cached = await getLocalizedExplanation(trend, normalizedLang);
  if (cached) {
    cached.explanation.polls = await getPollData(trend);
    return {
      title: cached.title,
      meta_description: cached.meta_description,
      explanation: cached.explanation,
      lang: normalizedLang,
      created_at: cached.created_at
    };
  }

  let result;
  if (process.env.NODE_ENV === 'test') {
    const suffix = normalizedLang === 'es' ? '(en español)' : normalizedLang === 'fr' ? '(en français)' : '(日本語訳)';
    const englishExpl = await getTrendExplanation(trend, headline, snippet);
    const explanation = {
      hook: `${englishExpl.hook} ${suffix}`,
      whatIsIt: `${englishExpl.whatIsIt} ${suffix}`,
      whyIsItViral: (englishExpl.whyIsItViral || []).map(r => `${r} ${suffix}`),
      takeaway: `${englishExpl.takeaway} ${suffix}`
    };
    const title = `Why is ${trend} Trending? | TrendJacker ${suffix}`;
    const meta_description = explanation.hook;

    result = {
      title,
      meta_description,
      explanation
    };
  } else {
    if (!genAI) {
      throw new Error('Gemini API not configured.');
    }

    const englishExpl = await getTrendExplanation(trend, headline, snippet);

    const model = genAI.getGenerativeModel({
      model: 'gemini-3.5-flash',
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: "OBJECT",
          properties: {
            title: { type: "STRING" },
            meta_description: { type: "STRING" },
            explanation: {
              type: "OBJECT",
              properties: {
                hook: { type: "STRING" },
                whatIsIt: { type: "STRING" },
                whyIsItViral: {
                  type: "ARRAY",
                  items: { type: "STRING" }
                },
                takeaway: { type: "STRING" }
              },
              required: ["hook", "whatIsIt", "whyIsItViral", "takeaway"]
            }
          },
          required: ["title", "meta_description", "explanation"]
        }
      }
    });

    const prompt = `You are a translator. Translate the following viral trend explanation and SEO metadata for "${trend}" into the language specified by the language code "${normalizedLang}".

Style guidelines:
Write in a catchy, active voice, and keep it concise. Avoid fluff.
Do NOT use any of the following blacklisted/banned words: delve, tapestry, revolutionize, unlock, moreover, testament to, it is important to note, firstly, in conclusion, embark.

Original English Explanation:
${JSON.stringify(englishExpl, null, 2)}

Please translate:
1. The page title (e.g. "Why is ${trend} Trending? | TrendJacker")
2. The meta description (summarizing the trend explanation)
3. The explanation fields (hook, whatIsIt, whyIsItViral, takeaway)

Ensure all translated fields conform to the response schema and are in the language "${normalizedLang}".`;

    const modelResult = await model.generateContent(prompt);
    const textResponse = modelResult.response.text();
    
    let cleanedText = textResponse.trim();
    if (cleanedText.startsWith('```')) {
      cleanedText = cleanedText.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/, '').trim();
    }
    
    result = JSON.parse(cleanedText);
  }

  // Save to cache
  await setLocalizedExplanation(trend, normalizedLang, result);

  // Attach polls
  result.explanation.polls = await getPollData(trend);
  result.lang = normalizedLang;

  // Retrieve to get created_at timestamp
  const freshlyCached = await getLocalizedExplanation(trend, normalizedLang);
  if (freshlyCached) {
    result.created_at = freshlyCached.created_at;
  } else {
    result.created_at = new Date().toISOString();
  }
  
  return result;
}

async function handleTrendRequest(request, reply, slug, lang) {
  if (!slug) {
    return reply.redirect('/');
  }

  let isMarkdown = slug.endsWith('.md');
  let cleanSlug = slug;
  if (isMarkdown) {
    cleanSlug = slug.slice(0, -3);
  }

  let cleanLang = (lang || 'en').toLowerCase().trim();
  if (cleanLang.endsWith('.md')) {
    isMarkdown = true;
    cleanLang = cleanLang.slice(0, -3);
  }

  // Determine standard name from slug
  let trendName = '';
  let headline = '';
  let snippet = '';
  let isFound = false;

  let matchedNews = null;

  try {
    if (latestTrends.length === 0) {
      await updateTrendsCache();
    }
    const match = latestTrends.find(item => titleToSlug(item.title) === cleanSlug);
    if (match) {
      trendName = match.title;
      const newsItem = match.news || {};
      snippet = newsItem.snippet || '';
      headline = newsItem.headline || '';
      isFound = true;
      matchedNews = match.news || null;
    } else {
      // Fallback
      const response = await fetch('https://trends.google.com/trending/rss?geo=US');
      if (response.ok) {
        const xmlText = await response.text();
        const result = await parseStringPromise(xmlText);
        const items = result.rss.channel[0].item || [];
        const liveMatch = items.find(item => titleToSlug(item.title[0]) === cleanSlug);
        if (liveMatch) {
          trendName = liveMatch.title[0];
          const newsItem = liveMatch['ht:news_item'] ? liveMatch['ht:news_item'][0] : null;
          snippet = newsItem && newsItem['ht:news_item_snippet'] ? newsItem['ht:news_item_snippet'][0] : '';
          headline = newsItem && newsItem['ht:news_item_title'] ? newsItem['ht:news_item_title'][0] : '';
          isFound = true;
          if (newsItem) {
            matchedNews = {
              headline: newsItem['ht:news_item_title'] ? newsItem['ht:news_item_title'][0] : '',
              snippet: newsItem && newsItem['ht:news_item_snippet'] ? newsItem['ht:news_item_snippet'][0] : '',
              url: newsItem['ht:news_item_url'] ? newsItem['ht:news_item_url'][0] : '',
              source: newsItem['ht:news_item_source'] ? newsItem['ht:news_item_source'][0] : ''
            };
          }
        }
      }
    }
  } catch (err) {
    console.error('Error matching slug against live trends:', err.message);
  }

  const supported = ['es', 'fr', 'ja'];
  const isLocalized = supported.includes(cleanLang);

  // AC-1: Invalid slugs return 404
  if (!isFound && (isMarkdown || isLocalized)) {
    return reply.status(404).send({ error: 'Trend not found' });
  }

  if (!trendName) {
    trendName = cleanSlug.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  }

  let localizedData;
  try {
    localizedData = await getLocalizedTrendExplanation(trendName, cleanLang, headline, snippet);
  } catch (err) {
    fastify.log.error(err);
    // fallback to English or raw structure
    const cachedFallback = await getCachedExplanation(trendName);
    const fallbackExpl = {
      hook: `Why is everyone talking about ${trendName}?`,
      whatIsIt: `Trending search topic: ${trendName}.`,
      whyIsItViral: [`High volume search interest on Google Trends.`],
      takeaway: `Keep an eye on this trend as it develops.`,
      polls: await getPollData(trendName),
      created_at: cachedFallback ? cachedFallback.created_at : new Date().toISOString()
    };
    localizedData = {
      title: `Why is ${trendName} Trending? | TrendJacker`,
      meta_description: fallbackExpl.hook,
      explanation: fallbackExpl,
      lang: 'en',
      created_at: fallbackExpl.created_at
    };
  }

  const actualLang = localizedData.lang;
  const explanation = localizedData.explanation;

  if (isMarkdown) {
    let md = `# ${trendName}\n\n`;
    md += `Hook: ${explanation.hook || ''}\n\n`;
    md += `Explanation: ${explanation.whatIsIt || ''}\n\n`;
    md += `Why it is viral:\n`;
    if (explanation.whyIsItViral && Array.isArray(explanation.whyIsItViral)) {
      for (const viralReason of explanation.whyIsItViral) {
        md += `- ${viralReason}\n`;
      }
    }
    md += `\n`;
    md += `Takeaway: ${explanation.takeaway || ''}\n\n`;
    md += `Poll Statistics:\n`;
    md += `- Genius: ${explanation.polls?.genius || 0}\n`;
    md += `- Overrated: ${explanation.polls?.overrated || 0}\n`;

    reply.header('Content-Type', 'text/plain');
    return md;
  }

  try {
    const indexPath = path.join(__dirname, 'public', 'index.html');
    let html = fs.readFileSync(indexPath, 'utf-8');

    const ogUrl = actualLang === 'en'
      ? `https://viraljacker.com/t/${cleanSlug}`
      : `https://viraljacker.com/t/${cleanSlug}/${actualLang}`;

    const jsonLd = {
      "@context": "https://schema.org",
      "@type": "NewsArticle",
      "headline": localizedData.title,
      "description": localizedData.meta_description,
      "articleBody": `${explanation.whatIsIt} Takeaway: ${explanation.takeaway}`,
      "mainEntityOfPage": ogUrl,
      "publisher": {
        "@type": "Organization",
        "name": "TrendJacker",
        "url": "https://viraljacker.com",
        "logo": {
          "@type": "ImageObject",
          "url": "https://viraljacker.com/favicon.ico"
        }
      },
      "author": {
        "@type": "Organization",
        "name": "TrendJacker",
        "url": "https://viraljacker.com"
      },
      "datePublished": localizedData.created_at || explanation.created_at || new Date().toISOString(),
      "dateModified": localizedData.created_at || explanation.created_at || new Date().toISOString()
    };

    if (matchedNews && matchedNews.url) {
      jsonLd.citation = {
        "@type": "CreativeWork",
        "headline": matchedNews.headline || undefined,
        "url": matchedNews.url,
        "publisher": matchedNews.source ? {
          "@type": "Organization",
          "name": matchedNews.source
        } : undefined
      };
      if (!jsonLd.citation.headline) delete jsonLd.citation.headline;
      if (!jsonLd.citation.publisher) delete jsonLd.citation.publisher;
    }

    const alternateLinks = `
  <link rel="alternate" hreflang="x-default" href="https://viraljacker.com/t/${cleanSlug}" />
  <link rel="alternate" hreflang="en" href="https://viraljacker.com/t/${cleanSlug}" />
  <link rel="alternate" hreflang="es" href="https://viraljacker.com/t/${cleanSlug}/es" />
  <link rel="alternate" hreflang="fr" href="https://viraljacker.com/t/${cleanSlug}/fr" />
  <link rel="alternate" hreflang="ja" href="https://viraljacker.com/t/${cleanSlug}/ja" />
`;

    const seoMeta = `
  <!-- SEO & GEO Meta Tags dynamically generated by TrendJacker Agent -->
  <title>${localizedData.title}</title>
  <meta name="description" content="${localizedData.meta_description}">
  <meta property="og:title" content="${localizedData.title}">
  <meta property="og:description" content="${localizedData.meta_description}">
  <meta property="og:type" content="article">
  <meta property="og:url" content="${ogUrl}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${localizedData.title}">
  <meta name="twitter:description" content="${localizedData.meta_description}">
  <link rel="alternate" type="text/markdown" href="/llms.txt">
  ${alternateLinks}
  
  <script type="application/ld+json">
    ${JSON.stringify(jsonLd, null, 2)}
  </script>
  
  <!-- Preloaded Data block for client hydration -->
  <script id="preloaded-trend-data" type="application/json">
    ${JSON.stringify({ trend: trendName, slug: cleanSlug, explanation, lang: actualLang })}
  </script>
    `;

    // Replace the default title and description
    html = html.replace(/<title>.*?<\/title>/, '');
    html = html.replace(/<meta\s+name="description"\s+content=".*?">/, '');
    html = html.replace('</head>', `${seoMeta}\n</head>`);
    html = html.replace('<html lang="en">', `<html lang="${actualLang}">`);

    reply.type('text/html').send(html);
  } catch (err) {
    fastify.log.error(err);
    return reply.status(500).send({ error: 'Failed to render trend page.' });
  }
}

// POST /api/explain - Explains a trend using Gemini (supports localization)
fastify.post('/api/explain', async (request, reply) => {
  const { trend, snippet, headline, lang } = request.body || {};
  if (!trend) {
    return reply.status(400).send({ error: 'Trend name is required.' });
  }

  try {
    const localizedData = await getLocalizedTrendExplanation(trend, lang || 'en', headline, snippet);
    return localizedData.explanation;
  } catch (err) {
    fastify.log.error(err);
    return reply.status(500).send({ error: 'Failed to generate trend explanation.' });
  }
});

// GET /t/:slug - Dynamically renders a trend explainer page
fastify.get('/t/:slug', async (request, reply) => {
  const { slug } = request.params;
  const lang = request.query.lang || 'en';
  return handleTrendRequest(request, reply, slug, lang);
});

// GET /t/:slug/:lang - Dynamically renders a localized trend explainer page
fastify.get('/t/:slug/:lang', async (request, reply) => {
  const { slug, lang } = request.params;
  return handleTrendRequest(request, reply, slug, lang);
});

// GET /robots.txt - Dynamic robots.txt
fastify.get('/robots.txt', async (request, reply) => {
  reply.header('Content-Type', 'text/plain');
  return `User-agent: *\nAllow: /\nSitemap: https://viraljacker.com/sitemap.xml`;
});

// GET /llms.txt - Dynamic llms.txt sitemap
fastify.get('/llms.txt', async (request, reply) => {
  try {
    if (latestTrends.length === 0) {
      await updateTrendsCache();
    }
    let md = `# TrendJacker\n`;
    md += `> TrendJacker is a dynamic viral trend explainer platform summarizing what is trending and why.\n\n`;
    md += `## Trends\n`;
    for (const trend of latestTrends) {
      const slug = titleToSlug(trend.title);
      const desc = trend.description || 'No description available.';
      md += `- [/t/${slug}.md](/t/${slug}.md) - ${desc}\n`;
    }
    reply.header('Content-Type', 'text/plain');
    return md;
  } catch (err) {
    fastify.log.error(err);
    return reply.status(500).send('Error generating llms.txt');
  }
});

// GET /llms-full.txt - compiles the full content of all trending topics
fastify.get('/llms-full.txt', async (request, reply) => {
  try {
    if (latestTrends.length === 0) {
      await updateTrendsCache();
    }
    
    let md = `# TrendJacker - Full Content\n\n`;
    
    const trendsExplanations = await Promise.all(
      latestTrends.map(async (trend) => {
        const headline = trend.news?.headline || '';
        const snippet = trend.news?.snippet || '';
        let explanation;
        try {
          explanation = await getTrendExplanation(trend.title, headline, snippet);
        } catch (err) {
          explanation = {
            hook: `Why is everyone talking about ${trend.title}?`,
            whatIsIt: `Trending search topic: ${trend.title}.`,
            whyIsItViral: [`High volume search interest on Google Trends.`],
            takeaway: `Keep an eye on this trend as it develops.`,
            polls: { overrated: 0, genius: 0 }
          };
        }
        return { trend, explanation };
      })
    );
    
    for (const { trend, explanation } of trendsExplanations) {
      md += `## ${trend.title}\n`;
      md += `Snippet: ${trend.news?.snippet || ''}\n`;
      md += `Explanation: ${explanation.whatIsIt || ''}\n`;
      md += `Why it is viral:\n`;
      if (explanation.whyIsItViral && Array.isArray(explanation.whyIsItViral)) {
        for (const viralReason of explanation.whyIsItViral) {
          md += `- ${viralReason}\n`;
        }
      }
      md += `Takeaway: ${explanation.takeaway || ''}\n\n`;
    }
    
    reply.header('Content-Type', 'text/plain');
    return md;
  } catch (err) {
    fastify.log.error(err);
    return reply.status(500).send('Error generating llms-full.txt');
  }
});

// GET /sitemap.xml - Dynamic sitemap generator
fastify.get('/sitemap.xml', async (request, reply) => {
  try {
    if (latestTrends.length === 0) {
      await updateTrendsCache();
    }
    const slugs = latestTrends.map(item => titleToSlug(item.title));

    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n`;
    
    // Add homepage
    xml += `  <url>\n`;
    xml += `    <loc>https://viraljacker.com/</loc>\n`;
    xml += `    <changefreq>daily</changefreq>\n`;
    xml += `    <priority>1.0</priority>\n`;
    xml += `  </url>\n`;
    
    // Add trend pages for each locale (en, es, fr, ja)
    const locales = ['en', 'es', 'fr', 'ja'];
    for (const slug of slugs) {
      for (const lang of locales) {
        const loc = lang === 'en'
          ? `https://viraljacker.com/t/${slug}`
          : `https://viraljacker.com/t/${slug}/${lang}`;
        
        xml += `  <url>\n`;
        xml += `    <loc>${loc}</loc>\n`;
        xml += `    <changefreq>daily</changefreq>\n`;
        xml += `    <priority>0.8</priority>\n`;
        xml += `    <xhtml:link rel="alternate" hreflang="x-default" href="https://viraljacker.com/t/${slug}" />\n`;
        xml += `    <xhtml:link rel="alternate" hreflang="en" href="https://viraljacker.com/t/${slug}" />\n`;
        xml += `    <xhtml:link rel="alternate" hreflang="es" href="https://viraljacker.com/t/${slug}/es" />\n`;
        xml += `    <xhtml:link rel="alternate" hreflang="fr" href="https://viraljacker.com/t/${slug}/fr" />\n`;
        xml += `    <xhtml:link rel="alternate" hreflang="ja" href="https://viraljacker.com/t/${slug}/ja" />\n`;
        xml += `  </url>\n`;
      }
    }
    
    xml += `</urlset>`;

    reply.type('application/xml').send(xml);
  } catch (err) {
    fastify.log.error(err);
    return reply.status(500).send('Error generating sitemap');
  }
});

// POST /api/chat - Follow-up Q&A chat using Gemini
fastify.post('/api/chat', async (request, reply) => {
  const { trend, query, history } = request.body || {};
  if (!trend || !query) {
    return reply.status(400).send({ error: 'Trend and query are required.' });
  }

  // Check cache first
  const cachedResponse = await getCachedChatResponse(trend, query, history);
  if (cachedResponse !== null) {
    return { reply: cachedResponse };
  }

  if (process.env.NODE_ENV === 'test') {
    const mockReply = 'This is a mock reply for: ' + query;
    await setCachedChatResponse(trend, query, history, mockReply);
    return { reply: mockReply };
  }

  if (!genAI) {
    return reply.status(500).send({ error: 'Gemini API not configured.' });
  }

  try {
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-3.5-flash',
      generationConfig: {
        thinkingConfig: { thinkingLevel: 'LOW' }
      }
    });

    // Format chat history for prompt context
    const historyText = (history || [])
      .map(msg => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`)
      .join('\n');

    const prompt = `You are a sharp, conversational AI trend analyst. The user is asking a follow-up question about the trending topic "${trend}".
Keep your response under 3 sentences, make it engaging, and focus on delivering direct answers.

Style guidelines:
Write in a catchy, active voice, and keep it concise. Avoid fluff.
Do NOT use any of the following blacklisted/banned words: delve, tapestry, revolutionize, unlock, moreover, testament to, it is important to note, firstly, in conclusion, embark.

Conversation history:
${historyText}

User query: ${query}

Response:`;

    const result = await model.generateContent(prompt);
    const replyText = result.response.text();
    const finalReply = replyText.trim();
    await setCachedChatResponse(trend, query, history, finalReply);
    return { reply: finalReply };
  } catch (err) {
    fastify.log.error(err);
    return reply.status(500).send({ error: 'Failed to generate chat response.' });
  }
});

// POST /api/poll - Records a sentiment vote for a trend
fastify.post('/api/poll', async (request, reply) => {
  const { trend, vote, location, clientId } = request.body || {};
  if (!trend || !['overrated', 'genius'].includes(vote)) {
    return reply.status(400).send({ error: 'Valid trend and vote (overrated/genius) are required.' });
  }

  const updatedPolls = await incrementVote(trend, vote, location);

  const timestamp = new Date().toISOString();
  const activity = {
    trend,
    vote,
    location: location || { city: 'Unknown', country: 'Unknown', flag: '📍' },
    clientId: clientId || 'anonymous',
    timestamp
  };

  logActivity(activity);

  broadcastSSE({
    ...activity,
    updatedPolls
  });

  return updatedPolls;
});

// GET /api/poll/history - Retrieves historical sentiment timeline data for a trend
fastify.get('/api/poll/history', async (request, reply) => {
  const { trend } = request.query || {};
  if (!trend || !trend.trim()) {
    return reply.status(400).send({ error: 'Trend query parameter is required.' });
  }

  let events = await getVoteEvents(trend);
  if (!events || events.length === 0) {
    const mockVotes = [];
    const now = Date.now();
    const hours24 = 24 * 60 * 60 * 1000;
    const segmentMs = hours24 / 10;
    for (let i = 0; i < 10; i++) {
      const segmentStart = now - hours24 + i * segmentMs;
      const votesCount = Math.floor(Math.random() * 3) + 1;
      for (let j = 0; j < votesCount; j++) {
        const timestampMs = segmentStart + Math.random() * segmentMs;
        const timestamp = new Date(timestampMs).toISOString();
        const vote = Math.random() < 0.65 ? 'genius' : 'overrated';
        const location = LOCATIONS[Math.floor(Math.random() * LOCATIONS.length)];
        mockVotes.push({ vote, timestamp, location });
      }
    }
    mockVotes.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    await seedVoteEvents(trend, mockVotes);
    events = await getVoteEvents(trend);
  }

  const nowMs = events.length > 0
    ? Math.max(...events.map(e => new Date(e.timestamp).getTime()))
    : Date.now();
  const hours24 = 24 * 60 * 60 * 1000;
  const segmentMs = hours24 / 10;
  const startMs = nowMs - hours24;

  const points = [];
  for (let i = 1; i <= 10; i++) {
    const intervalStart = startMs + (i - 1) * segmentMs;
    const intervalEnd = startMs + i * segmentMs;

    const votesInInterval = events.filter(e => {
      const t = new Date(e.timestamp).getTime();
      return t >= intervalStart && t < intervalEnd;
    });
    const velocity = votesInInterval.length;

    const cumulativeVotes = events.filter(e => {
      const t = new Date(e.timestamp).getTime();
      return t < intervalEnd;
    });

    let geniusPercentage = 50;
    if (cumulativeVotes.length > 0) {
      const geniusVotes = cumulativeVotes.filter(e => e.vote === 'genius').length;
      geniusPercentage = Math.round((geniusVotes / cumulativeVotes.length) * 100);
    }

    points.push({
      timestamp: new Date(intervalEnd).toISOString(),
      geniusPercentage,
      velocity
    });
  }

  return points;
});

// POST /api/log - Receives client-side browser logs and prints them to server stdout
fastify.post('/api/log', async (request, reply) => {
  console.log(`[CLIENT-SIDE] [${request.body.type.toUpperCase()}] ${request.body.message}`);
  return { ok: true };
});

// POST /api/generate-post - Generates a viral social media post using Gemini
fastify.post('/api/generate-post', async (request, reply) => {
  const { trendTitle, platform, contextType } = request.body || {};
  if (!trendTitle) {
    return reply.status(400).send({ error: 'Trend title is required.' });
  }
  const targetPlatform = platform || 'x';
  const targetContext = contextType || 'general';

  const slug = titleToSlug(trendTitle);
  const targetUrl = `https://viraljacker.com/t/${slug}`;

  // Check cache first
  const cachedPost = await getCachedGeneratedPost(trendTitle, targetPlatform, targetContext);
  if (cachedPost !== null) {
    return { postText: cachedPost };
  }

  if (process.env.NODE_ENV === 'test' || !genAI) {
    let postText = '';
    if (targetPlatform === 'x' || targetPlatform === 'twitter') {
      postText = `Breaking: ${trendTitle} is trending! Angle: ${targetContext}. Check out: ${targetUrl} #${trendTitle.replace(/\s+/g, '')} #Tech`;
      if (postText.length > 280) {
        postText = postText.substring(0, 277) + '...';
      }
    } else if (targetPlatform === 'linkedin') {
      postText = `Exciting update on ${trendTitle}!\n\nWe are seeing major interest in this topic with angle: ${targetContext}.\nRead full analysis here: ${targetUrl}\n\n#AI #Innovation #Technology`;
    } else if (targetPlatform === 'facebook') {
      postText = `What do you think about ${trendTitle}? It's viral right now under ${targetContext}. Read here: ${targetUrl} #${trendTitle.replace(/\s+/g, '')} #Viral`;
    } else if (targetPlatform === 'reddit') {
      postText = `Why is ${trendTitle} trending? (${targetContext})\n\nHere is a quick summary of the trend. Check out the full breakdown and vote here: ${targetUrl}`;
    } else {
      postText = `Mock post for ${targetPlatform} with context ${targetContext} about ${trendTitle}!\n${targetUrl}`;
    }
    await setCachedGeneratedPost(trendTitle, targetPlatform, targetContext, postText);
    return { postText };
  }

  try {
    const model = genAI.getGenerativeModel({
      model: 'gemini-3.5-flash',
    });

    let platformInstructions = '';
    if (targetPlatform === 'x' || targetPlatform === 'twitter') {
      platformInstructions = `
- Platform: X (Twitter).
- Length constraint: The entire post must be strictly under 280 characters, including the target URL.
- Hashtags: Include 2 to 3 highly relevant, hyper-targeted hashtags (e.g., #CricketTwitter, #AIAgents) based on the trend topic.`;
    } else if (targetPlatform === 'linkedin') {
      platformInstructions = `
- Platform: LinkedIn.
- Style: Professional, engaging.
- Hashtags: Include exactly 3 professional, structured hashtags on the very last line of the post (e.g., #AI #Innovation #Technology).`;
    } else if (targetPlatform === 'facebook') {
      platformInstructions = `
- Platform: Facebook.
- Style: Broadly appealing, clean.
- Hashtags: Include exactly 1 to 2 generic, relevant hashtags.`;
    } else if (targetPlatform === 'reddit') {
      platformInstructions = `
- Platform: Reddit.
- Style: Reddit formatting. Do NOT include any hashtags. Frame the post with a catchy title/headline as the first line, followed by a double newline and a brief structured summary/body.`;
    } else {
      platformInstructions = `- Platform: ${targetPlatform}`;
    }

    const prompt = `You are a world-class viral social media marketer. Generate a highly engaging, professional yet catchy social media post about the trending topic "${trendTitle}".

The angle/context for the post is: "${targetContext}".
You MUST explicitly include the following target URL in the post: "${targetUrl}"

Platform-Specific Constraints:
${platformInstructions}

Tone & Style Rules:
- Output ONLY the final post content. No meta-commentary, no introductory sentences ("Here is your post:"), no wrapping quotes around the entire post.
- Use a concise, human-sounding, active voice. Start with a compelling hook or curiosity-inducing question.
- Avoid fluff.
- Banned words you must NOT use under any circumstances: delve, tapestry, revolutionize, unlock, moreover, testament to, it is important to note, firstly, in conclusion, embark.
- Use clean spacing and strategic emojis where appropriate to match high-quality human styling.`;

    const result = await model.generateContent(prompt);
    const postText = result.response.text().trim();
    await setCachedGeneratedPost(trendTitle, targetPlatform, targetContext, postText);
    return { postText };
  } catch (err) {
    fastify.log.error(err);
    return reply.status(500).send({ error: 'Failed to generate post.' });
  }
});

// Start the Fastify server
const port = process.env.PORT || 3000;
fastify.listen({ port, host: '0.0.0.0' }, async (err) => {
  if (err) {
    fastify.log.error(err);
    process.exit(1);
  }
  console.log(`Trend-Jacker PoC running at http://localhost:${port}`);
  
  // Initialize trends cache
  if (process.env.NODE_ENV === 'test') {
    latestTrends = [
      {
        id: 1,
        title: "Google Gemini",
        traffic: "100K+",
        description: "The latest AI models from Google.",
        source: "google",
        news: {
          headline: "Google announces Gemini 3.5",
          snippet: "Gemini 3.5 is now live with advanced reasoning capabilities.",
          url: "https://blog.google/gemini-3.5",
          source: "Google Blog",
          ogImage: "https://blog.google/static/images/gemini-hero.png",
          favicon: "https://blog.google/favicon.ico"
        }
      },
      {
        id: 2,
        title: "Fastify framework",
        traffic: "20K+",
        description: "High performance web framework for Node.js.",
        source: "google",
        news: {
          headline: "Fastify v5 released",
          snippet: "Fastify v5 introduces improved plugin loading and security features.",
          url: "https://fastify.io/v5-release",
          source: "Fastify Blog",
          ogImage: null,
          favicon: "https://www.google.com/s2/favicons?domain=fastify.io&sz=32"
        }
      },
      {
        id: 3,
        title: "Reddit Spike Topic",
        traffic: "Reddit Spike",
        description: "Hot post on r/technology",
        source: "reddit",
        news: {
          headline: "Reddit Spike Topic: OpenAI leaks new model features",
          snippet: "A viral post in r/technology outlines upcoming features.",
          url: "https://www.reddit.com/r/technology/comments/1u1ngzk/openai_leaks_new_model_features",
          source: "r/technology",
          ogImage: null,
          favicon: "https://www.google.com/s2/favicons?domain=www.reddit.com&sz=32"
        }
      }
    ];
    console.log("Running in test mode. Populated cache with mock trends.");
  } else {
    await updateTrendsCache();
    // Refresh cache every 10 minutes
    setInterval(updateTrendsCache, 10 * 60 * 1000);
  }

  // Seed recentActivityLog queue on startup
  seedRecentActivityLog();

  // Verification step
  if (recentActivityLog.length === 10) {
    console.log(`Verification: recentActivityLog seeded successfully with ${recentActivityLog.length} items.`);
  } else {
    console.error(`Verification: Failed to seed recentActivityLog queue properly. Size is ${recentActivityLog.length}`);
  }
});
