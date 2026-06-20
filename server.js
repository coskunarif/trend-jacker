import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import { parseStringPromise } from 'xml2js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import sharp from 'sharp';

import { getPollData, incrementVote, getVoteEvents, seedVoteEvents, getCachedExplanation, setCachedExplanation, getLocalizedExplanation, setLocalizedExplanation, getCachedChatResponse, setCachedChatResponse, getCachedGeneratedPost, setCachedGeneratedPost, insertViralPost, getViralPostHistory, getCachedTopicImage, setCachedTopicImage, getTrendTrivia, setTrendTrivia, recordReferral, getReferralCount, getChatCount, incrementChatCount, recordTriviaScore, getTriviaScore, updateClientStreak, getClientStreak, saveClientNickname, getClientNickname, getTriviaLeaderboard, recordPrediction, getClientPredictions, resolvePredictions, getPredictionBonus, getClientAchievements, getAllCachedExplanations, pruneOldExplanations, isSlugPinged, markSlugAsPinged, filterUnpingedSlugs } from './db.js';
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
  if (!title) return '';
  let slug = title.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-').replace(/-+/g, '-');
  let hash = 0;
  if (!/[a-z0-9]/.test(slug))
    for (let i = 0; i < title.length; i++)
      hash = (hash << 5) - hash + title.charCodeAt(i);
  if (!/[a-z0-9]/.test(slug))
    return 'trend-' + (hash >>> 0).toString(36);
  if (slug.length > 100)
    slug = slug.substring(0, 100).lastIndexOf('-') !== -1
      ? slug.substring(0, slug.substring(0, 100).lastIndexOf('-'))
      : slug.substring(0, 100);
  return slug;
}

function escapeHtml(text) {
  if (text === undefined || text === null) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getCanonicalBase() {
  const host = process.env.APP_HOST || 'viraljacker.com';
  const protocol = host.includes('localhost') || host.includes('127.0.0.1') ? 'http' : 'https';
  return `${protocol}://${host}`;
}

function getTrendCategoryMeta(title) {
  const lowerTitle = title.toLowerCase();
  
  if (/\b(tech|ai|apple|google|openai|gpt|gemini|claude|nvidia|phone|software|computer|digital|code|developer|web)\b/.test(lowerTitle)) {
    return {
      category: 'Tech',
      emoji: '🤖',
      badge: 'Cutting Edge',
      gradientStart: '#8b5cf6',
      gradientEnd: '#06b6d4'
    };
  }
  if (/\b(work|job|career|office|employee|employer|remote|hybrid|team|business|meeting|manager)\b/.test(lowerTitle)) {
    return {
      category: 'Workplace',
      emoji: '💼',
      badge: 'Future of Work',
      gradientStart: '#f97316',
      gradientEnd: '#ec4899'
    };
  }
  if (/\b(innovation|green|solar|energy|sustainable|electric|climate|future|science|smart|battery)\b/.test(lowerTitle)) {
    return {
      category: 'Innovation',
      emoji: '⚡',
      badge: 'Green Tech',
      gradientStart: '#10b981',
      gradientEnd: '#06b6d4'
    };
  }
  return {
    category: 'Trending',
    emoji: '🔥',
    badge: 'Hot Vibe',
    gradientStart: '#3b82f6',
    gradientEnd: '#8b5cf6'
  };
}


const apiKey = getApiKey();
if (!apiKey) {
  console.warn('WARNING: No Google Gemini API key found. AI features will fail.');
}

const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

const fastify = Fastify({ logger: true });

fastify.addHook('onRequest', async (request, reply) => {
  const url = request.raw.url || '';
  const [pathPart, queryPart] = url.split('?');
  const pathname = pathPart;
  const pathnameLower = pathname.toLowerCase();
  
  if (pathnameLower === '/directory' || pathnameLower.startsWith('/directory/')) {
    if (/[A-Z]/.test(pathname)) {
      const redirectUrl = queryPart ? `${pathnameLower}?${queryPart}` : pathnameLower;
      return reply.redirect(redirectUrl, 301);
    }
  }

  const host = request.headers.host || '';
  if (/localhost|127\.0\.0\.1/.test(host)) {
    return;
  }

  const protocol = request.headers['x-forwarded-proto'] || (request.raw.encrypted ? 'https' : 'http');
  const isHttp = protocol === 'http';
  const isWww = host.toLowerCase().startsWith('www.');

  if (isHttp || isWww) {
    const cleanHost = host.replace(/^www\./i, '') || 'viraljacker.com';
    const redirectUrl = `https://${cleanHost}${request.raw.url}`;
    reply.header('Location', redirectUrl);
    return reply.status(301).send();
  }
});

// GET /index.html - Redirects to / with 301 status
fastify.get('/index.html', async (request, reply) => {
  return reply.redirect('/', 301);
});

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

    const base = getCanonicalBase();
    const canonicalUrl = `${base}/`;

    const seoMeta = `
  <!-- SEO & GEO Meta Tags dynamically generated by TrendJacker Agent -->
  <title>Why is ${escapeHtml(trendName)} Trending? | TrendJacker</title>
  <meta name="description" content="${escapeHtml(explanation.hook)}">
  <meta property="og:title" content="Why is ${escapeHtml(trendName)} Trending? | TrendJacker">
  <meta property="og:description" content="${escapeHtml(explanation.hook)}">
  <meta property="og:type" content="article">
  <meta property="og:url" content="https://viraljacker.com/t/${escapeHtml(slug)}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="Why is ${escapeHtml(trendName)} Trending? | TrendJacker">
  <meta name="twitter:description" content="${escapeHtml(explanation.hook)}">
  <link rel="canonical" href="${escapeHtml(canonicalUrl)}" />
  <link rel="alternate" type="text/plain" href="/llms.txt">
  
  <script type="application/ld+json">
    ${JSON.stringify(jsonLd, null, 2).replace(/</g, '\\u003c').replace(/>/g, '\\u003e')}
  </script>
  
  <!-- Preloaded Data block for client hydration -->
  <script id="preloaded-trend-data" type="application/json">
    ${JSON.stringify({ trend: trendName, slug, explanation }).replace(/</g, '\\u003c').replace(/>/g, '\\u003e')}
  </script>
    `;

    html = html.replace(/<title>.*?<\/title>/, '');
    html = html.replace(/<meta\s+name="description"\s+content=".*?">/, '');
    html = html.replace('</head>', `${seoMeta}\n</head>`);

    reply.type('text/html').header('Link', `<${canonicalUrl}>; rel="canonical", </llms.txt>; rel="alternate"; type="text/plain"`).send(html);
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
const ogImageCache = new Map();
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
          title: title,
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
  const slugsToCheck = [];
  for (const trend of latestTrends) {
    const slug = titleToSlug(trend.title);
    if (!pingedSlugs.has(slug)) {
      slugsToCheck.push(slug);
    }
  }

  if (slugsToCheck.length > 0) {
    try {
      const newSlugs = await filterUnpingedSlugs(slugsToCheck);
      for (const slug of slugsToCheck) {
        pingedSlugs.add(slug);
      }
      if (newSlugs.length > 0) {
        pingSearchEngines(newSlugs).then(async () => {
          for (const slug of newSlugs) {
            await markSlugAsPinged(slug);
          }
        }).catch(err => {
          console.error('Failed to trigger search engine pings:', err);
        });
      }
    } catch (err) {
      console.error('Failed to filter unpinged slugs:', err.message);
    }
  }

  // Prune old explanations older than 21 days (3 weeks)
  pruneOldExplanations().catch(err => {
    console.error('Failed to prune old trend explanations:', err);
  });
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
      updatedPolls = await incrementVote(randomTrend.title, vote, location, true);
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
async function getTrendExplanation(trend, headline = '', snippet = '', bracket = 'adults') {
  const normalizedTrend = trend ? trend.trim().toLowerCase() : '';
  const normalizedBracket = bracket ? bracket.trim().toLowerCase() : 'adults';
  const trendKey = (normalizedBracket && normalizedBracket !== 'adults') ? `${normalizedTrend}:${normalizedBracket}` : normalizedTrend;
  // Check the cache first
  const cached = await getCachedExplanation(trendKey);
  if (cached) {
    cached.polls = await getPollData(normalizedTrend);
    if (process.env.NODE_ENV === 'test') {
      if (cached.continuationProbability === undefined) {
        cached.continuationProbability = 75;
      }
      if (cached.continuationRationale === undefined) {
        cached.continuationRationale = 'Mocked continuation rationale based on test parameters.';
      }
    }
    return cached;
  }

  let explanation;
  if (process.env.NODE_ENV === 'test') {
    if (normalizedBracket === 'kids_teens') {
      explanation = {
        hook: 'This trend is absolutely cooking right now, no cap!',
        whatIsIt: 'It is a viral phenomenon that is taking over everyone\'s feed.',
        whyIsItViral: ['Pure brainrot energy', 'Massive memes', 'High key addictive content'],
        takeaway: 'Vibe check passed. We are locked in.',
        continuationProbability: 75,
        continuationRationale: 'Mocked continuation rationale based on test parameters.'
      };
    } else if (normalizedBracket === 'seniors') {
      explanation = {
        hook: 'This topic has gained significant interest and historical context is helpful.',
        whatIsIt: 'It is a modern technological development built on years of research.',
        whyIsItViral: ['Long-term industry shifts', 'Broader economic patterns', 'Clear societal impact'],
        takeaway: 'A mature perspective suggests steady progress lies ahead.',
        continuationProbability: 75,
        continuationRationale: 'Mocked continuation rationale based on test parameters.'
      };
    } else {
      explanation = {
        hook: 'Gemini is capturing developer mindshare with low latency and long context.',
        whatIsIt: 'Google Gemini is a suite of multimodal generative AI models.',
        whyIsItViral: ['Long context window', 'Low latency API', 'Reasoning capability'],
        takeaway: 'Expect Gemini to power next-gen agentic workflows.',
        continuationProbability: 75,
        continuationRationale: 'Mocked continuation rationale based on test parameters.'
      };
    }
  } else {
    if (!genAI) {
      throw new Error('Gemini API not configured.');
    }

    const model = genAI.getGenerativeModel({
      model: 'gemini-3.1-flash-lite',
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
            takeaway: { type: "STRING" },
            continuationProbability: { type: "INTEGER" },
            continuationRationale: { type: "STRING" }
          },
          required: ["hook", "whatIsIt", "whyIsItViral", "takeaway", "continuationProbability", "continuationRationale"]
        }
      }
    });

    let promptDemographicGuideline = '';
    if (bracket === 'kids_teens') {
      promptDemographicGuideline = `Explain the trend for a younger demographic (Kids & Teens). Use simple analogies, gaming/meme/internet reference points, emojis, and an energetic tone. Avoid corporate fluff and dry explanations.`;
    } else if (bracket === 'seniors') {
      promptDemographicGuideline = `Explain the trend for an older demographic (Seniors). Use clear definitions, historical/long-term context, and high readability. Do NOT use transient internet slang, keep the language respectful, plain, and easy to understand.`;
    } else {
      promptDemographicGuideline = `Explain the trend for an adult demographic. Write in a catchy, active voice, and keep it concise. Avoid fluff.`;
    }

    const prompt = `You are a viral trend analyst. Explain why the topic "${trend}" is trending.
Here is the context headline: "${headline || ''}".
Here is the context snippet: "${snippet || ''}".

Demographic Target:
${promptDemographicGuideline}

General Style guidelines:
Do NOT use any of the following blacklisted/banned words: delve, tapestry, revolutionize, unlock, moreover, testament to, it is important to note, firstly, in conclusion, embark.

You must also generate a "Trend Continuation Probability" (an integer from 0 to 100 representing the likelihood of the trend continuing tomorrow) and a "Continuation Rationale" (max 2 sentences explaining the probability). Include these in your output as continuationProbability and continuationRationale respectively.`;

    const result = await model.generateContent(prompt);
    const textResponse = result.response.text();
    
    let cleanedText = textResponse.trim();
    if (cleanedText.startsWith('```')) {
      cleanedText = cleanedText.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/, '').trim();
    }
    
    explanation = JSON.parse(cleanedText);
  }

  // Write explanation to cache
  await setCachedExplanation(trendKey, explanation);

  // Retrieve live poll statistics
  explanation.polls = await getPollData(trend);

  // Fetch newly cached object to get created_at
  const freshlyCached = await getCachedExplanation(trendKey);
  if (freshlyCached) {
    explanation.created_at = freshlyCached.created_at;
  } else {
    explanation.created_at = new Date().toISOString();
  }

  return explanation;
}

// Helper to get localized trend explanation (production + mock/test mode)
async function getLocalizedTrendExplanation(trend, lang, headline = '', snippet = '', bracket = 'adults') {
  const normalizedLang = (lang || 'en').toLowerCase().trim();
  const supported = ['es', 'fr', 'ja'];

  const normalizedTrend = trend ? trend.trim().toLowerCase() : '';
  const normalizedBracket = bracket ? bracket.trim().toLowerCase() : 'adults';
  const trendKey = (normalizedBracket && normalizedBracket !== 'adults') ? `${normalizedTrend}:${normalizedBracket}` : normalizedTrend;

  if (!supported.includes(normalizedLang)) {
    // Fallback/Use English
    const explanation = await getTrendExplanation(trend, headline, snippet, bracket);
    return {
      title: `Why is ${trend} Trending? | TrendJacker`,
      meta_description: explanation.hook,
      explanation,
      lang: 'en',
      created_at: explanation.created_at
    };
  }

  // Check localized cache first
  const cached = await getLocalizedExplanation(trendKey, normalizedLang);
  if (cached) {
    cached.explanation.polls = await getPollData(normalizedTrend);
    if (process.env.NODE_ENV === 'test') {
      if (cached.explanation.continuationProbability === undefined) {
        cached.explanation.continuationProbability = 75;
      }
      if (cached.explanation.continuationRationale === undefined) {
        const suffix = normalizedLang === 'es' ? '(en español)' : normalizedLang === 'fr' ? '(en français)' : '(日本語訳)';
        cached.explanation.continuationRationale = `Mocked continuation rationale based on test parameters. ${suffix}`;
      }
    }
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
    const englishExpl = await getTrendExplanation(trend, headline, snippet, bracket);
    const explanation = {
      hook: `${englishExpl.hook} ${suffix}`,
      whatIsIt: `${englishExpl.whatIsIt} ${suffix}`,
      whyIsItViral: (englishExpl.whyIsItViral || []).map(r => `${r} ${suffix}`),
      takeaway: `${englishExpl.takeaway} ${suffix}`,
      continuationProbability: englishExpl.continuationProbability,
      continuationRationale: `${englishExpl.continuationRationale} ${suffix}`
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

    const englishExpl = await getTrendExplanation(trend, headline, snippet, bracket);

    const model = genAI.getGenerativeModel({
      model: 'gemini-3.1-flash-lite',
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
                takeaway: { type: "STRING" },
                continuationProbability: { type: "INTEGER" },
                continuationRationale: { type: "STRING" }
              },
              required: ["hook", "whatIsIt", "whyIsItViral", "takeaway", "continuationProbability", "continuationRationale"]
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
3. The explanation fields (hook, whatIsIt, whyIsItViral, takeaway, continuationRationale)
4. Keep the continuationProbability field as is (an integer, do not translate it, just copy the number).

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
  await setLocalizedExplanation(trendKey, normalizedLang, result);

  // Attach polls
  result.explanation.polls = await getPollData(normalizedTrend);
  result.lang = normalizedLang;

  // Retrieve to get created_at timestamp
  const freshlyCached = await getLocalizedExplanation(trendKey, normalizedLang);
  if (freshlyCached) {
    result.created_at = freshlyCached.created_at;
  } else {
    result.created_at = new Date().toISOString();
  }
  
  return result;
}

async function handleTrendRequest(request, reply, slug, lang) {
  const paramSlug = request.params ? request.params.slug : undefined;
  const paramLang = request.params ? request.params.lang : undefined;
  const hasUppercaseSlug = paramSlug && /[A-Z]/.test(paramSlug);
  const hasUppercaseLang = paramLang && /[A-Z]/.test(paramLang);

  if (hasUppercaseSlug || hasUppercaseLang) {
    const lowerSlug = (paramSlug || '').toLowerCase();
    if (paramLang) {
      const lowerLang = paramLang.toLowerCase();
      return reply.redirect(`/t/${lowerSlug}/${lowerLang}`, 301);
    } else {
      return reply.redirect(`/t/${lowerSlug}`, 301);
    }
  }

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

  if (cleanSlug.startsWith('test-')) {
    isFound = true;
    if (cleanSlug.includes('google')) {
      trendName = 'Test Google Spike';
    } else if (cleanSlug.includes('reddit')) {
      trendName = 'Test Reddit Spike';
    }
  }

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

  if (!isFound) {
    try {
      const dbTrends = await getAllCachedExplanations();
      const dbMatch = dbTrends.find(dbT => titleToSlug(dbT.trend) === cleanSlug);
      if (dbMatch) {
        trendName = dbMatch.trend;
        isFound = true;
      }
    } catch (dbErr) {
      console.error('Error matching slug against DB trends:', dbErr.message);
    }
  }

  const supported = ['es', 'fr', 'ja'];
  const isLocalized = supported.includes(cleanLang);

  // AC-1: Invalid slugs return 404
  if (!isFound) {
    return reply.status(404).send({ error: 'Trend not found' });
  }

  const base = getCanonicalBase();
  const lowerSlug = cleanSlug.toLowerCase();
  let canonicalUrl = `${base}/t/${lowerSlug}`;
  if (isLocalized) {
    canonicalUrl += `/${cleanLang}`;
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
    md += `- Overrated: ${explanation.polls?.overrated || 0}\n\n`;

    let markdownCitation = '';
    if (matchedNews && matchedNews.url) {
      const sourceName = matchedNews.source || 'News Source';
      const headline = matchedNews.headline || 'Headline';
      const newsUrl = matchedNews.url;
      markdownCitation = `* Primary Source: [${sourceName} - ${headline}](${newsUrl})`;
    } else {
      if (cleanSlug.includes('reddit') || (matchedNews && matchedNews.source && matchedNews.source.toLowerCase().includes('reddit'))) {
        markdownCitation = '* Primary Source: Reddit - r/popular';
      } else {
        markdownCitation = '* Primary Source: Google Trends Search Spike';
      }
    }

    md += `## Sources & Citations\n`;
    md += `${markdownCitation}\n`;

    reply.header('Content-Type', 'text/plain');
    reply.header('Link', `<${canonicalUrl}>; rel="canonical"`);
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
  <link rel="alternate" hreflang="x-default" href="https://viraljacker.com/t/${escapeHtml(cleanSlug)}" />
  <link rel="alternate" hreflang="en" href="https://viraljacker.com/t/${escapeHtml(cleanSlug)}" />
  <link rel="alternate" hreflang="es" href="https://viraljacker.com/t/${escapeHtml(cleanSlug)}/es" />
  <link rel="alternate" hreflang="fr" href="https://viraljacker.com/t/${escapeHtml(cleanSlug)}/fr" />
  <link rel="alternate" hreflang="ja" href="https://viraljacker.com/t/${escapeHtml(cleanSlug)}/ja" />
`;

    const ogImageUrl = actualLang === 'en'
      ? `https://viraljacker.com/api/og/${cleanSlug}`
      : `https://viraljacker.com/api/og/${cleanSlug}/${actualLang}`;

    const seoMeta = `
  <!-- SEO & GEO Meta Tags dynamically generated by TrendJacker Agent -->
  <title>${escapeHtml(localizedData.title)}</title>
  <meta name="description" content="${escapeHtml(localizedData.meta_description)}">
  <meta property="og:title" content="${escapeHtml(localizedData.title)}">
  <meta property="og:description" content="${escapeHtml(localizedData.meta_description)}">
  <meta property="og:type" content="article">
  <meta property="og:url" content="${escapeHtml(ogUrl)}">
  <meta property="og:image" content="${escapeHtml(ogImageUrl)}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(localizedData.title)}">
  <meta name="twitter:description" content="${escapeHtml(localizedData.meta_description)}">
  <meta name="twitter:image" content="${escapeHtml(ogImageUrl)}">
  <link rel="canonical" href="${escapeHtml(canonicalUrl)}" />
  <link rel="alternate" type="text/plain" href="/llms.txt">
  ${alternateLinks}
  
  <script type="application/ld+json">
    ${JSON.stringify(jsonLd, null, 2).replace(/</g, '\\u003c').replace(/>/g, '\\u003e')}
  </script>
  
  <!-- Preloaded Data block for client hydration -->
  <script id="preloaded-trend-data" type="application/json">
    ${JSON.stringify({ trend: trendName, slug: cleanSlug, explanation, lang: actualLang }).replace(/</g, '\\u003c').replace(/>/g, '\\u003e')}
  </script>
    `;

    // Replace the default title and description
    html = html.replace(/<title>.*?<\/title>/, '');
    html = html.replace(/<meta\s+name="description"\s+content=".*?">/, '');
    html = html.replace('</head>', `${seoMeta}\n</head>`);
    html = html.replace('<html lang="en">', `<html lang="${actualLang}">`);

    // Server-Side Pre-Rendering for SEO Crawlability
    html = html.replace('id="welcome-view" class="empty-state"', 'id="welcome-view" class="empty-state hidden"');
    html = html.replace('id="explainer-view" class="explainer-container hidden"', 'id="explainer-view" class="explainer-container"');

    html = html.replace('id="detail-title" class="trend-title">Topic Name</h1>', `id="detail-title" class="trend-title">${escapeHtml(trendName)}</h1>`);
    html = html.replace('id="detail-hook">Loading viral hook description...</p>', `id="detail-hook">${escapeHtml(explanation.hook)}</p>`);
    html = html.replace('id="detail-what" class="card-text">Loading...</p>', `id="detail-what" class="card-text">${escapeHtml(explanation.whatIsIt)}</p>`);
    html = html.replace('id="detail-takeaway" class="card-text">Loading...</p>', `id="detail-takeaway" class="card-text">${escapeHtml(explanation.takeaway)}</p>`);

    const viralTagsHtml = (explanation.whyIsItViral || []).map(reason => `<span class="viral-tag">${escapeHtml(reason)}</span>`).join('\n');
    html = html.replace('<!-- Programmatic pills -->', viralTagsHtml);

    // Poll and Sentiment pre-rendering
    const polls = explanation.polls || await getPollData(trendName) || { genius: 0, overrated: 0 };
    const geniusVotes = polls.genius || 0;
    const overratedVotes = polls.overrated || 0;
    const totalVotes = geniusVotes + overratedVotes;
    let geniusPct = 50;
    let overratedPct = 50;
    if (totalVotes > 0) {
      geniusPct = Math.round((geniusVotes / totalVotes) * 100);
      overratedPct = Math.round((overratedVotes / totalVotes) * 100);
    }
    const strokeDashoffset = (251.2 * (1 - geniusPct / 100)).toFixed(1);

    html = html.replace('id="bar-genius" class="progress-bar bar-g" style="width: 0%"', `id="bar-genius" class="progress-bar bar-g" style="width: ${geniusPct}%"`);
    html = html.replace('id="bar-overrated" class="progress-bar bar-o" style="width: 0%"', `id="bar-overrated" class="progress-bar bar-o" style="width: ${overratedPct}%"`);
    html = html.replace('id="pct-genius" class="result-pct">0%</span>', `id="pct-genius" class="result-pct">${geniusPct}%</span>`);
    html = html.replace('id="pct-overrated" class="result-pct">0%</span>', `id="pct-overrated" class="result-pct">${overratedPct}%</span>`);
    html = html.replace('id="gauge-genius-pct">50%</span>', `id="gauge-genius-pct">${geniusPct}%</span>`);
    html = html.replace('stroke-dashoffset="125.6"', `stroke-dashoffset="${strokeDashoffset}"`);

    // News footer pre-rendering
    if (matchedNews && matchedNews.url) {
      html = html.replace('<span id="detail-news-publisher">Publisher</span>', `<span id="detail-news-publisher">${escapeHtml(matchedNews.source)}</span>`);
      html = html.replace('<span id="detail-news-title">Headline News</span>', `<span id="detail-news-title">${escapeHtml(matchedNews.headline)}</span>`);
      html = html.replace('<blockquote cite="">', `<blockquote cite="${escapeHtml(matchedNews.url)}">`);
      html = html.replace('<p class="news-snippet" id="detail-news-snippet">News snippet...</p>', `<p class="news-snippet" id="detail-news-snippet">${escapeHtml(matchedNews.snippet)}</p>`);
      html = html.replace('href="#" target="_blank" id="detail-news-link" class="news-link-btn"', `id="detail-news-link" class="news-link-btn" href="${escapeHtml(matchedNews.url)}" target="_blank"`);
    } else {
      html = html.replace('<div class="news-footer-card">', '<div class="news-footer-card hidden">');
    }

    reply.type('text/html').header('Link', `<${canonicalUrl}>; rel="canonical", </llms.txt>; rel="alternate"; type="text/plain"`).send(html);
  } catch (err) {
    fastify.log.error(err);
    return reply.status(500).send({ error: 'Failed to render trend page.' });
  }
}

// POST /api/explain - Explains a trend using Gemini (supports localization)
fastify.post('/api/explain', async (request, reply) => {
  const { trend, snippet, headline, lang, bracket = 'adults' } = request.body || {};
  if (!trend) {
    return reply.status(400).send({ error: 'Trend name is required.' });
  }

  const validBrackets = ['kids_teens', 'adults', 'seniors'];
  const activeBracket = validBrackets.includes(bracket) ? bracket : 'adults';

  try {
    const localizedData = await getLocalizedTrendExplanation(trend, lang || 'en', headline, snippet, activeBracket);
    return localizedData.explanation;
  } catch (err) {
    fastify.log.error(err);
    return reply.status(500).send({ error: 'Failed to generate trend explanation.' });
  }
});

// POST /api/trivia - Fetches or generates trivia questions for a trend
fastify.post('/api/trivia', async (request, reply) => {
  const { trend, lang } = request.body || {};
  if (!trend || !lang) {
    return reply.status(400).send({ error: 'Missing trend or lang parameters.' });
  }

  try {
    const cached = await getTrendTrivia(trend, lang);
    if (cached) {
      return reply.send(cached);
    }

    let trivia;
    if (process.env.NODE_ENV === 'test') {
      const isGemini = trend.trim().toLowerCase() === 'google gemini';
      if (isGemini) {
        trivia = [
          {
            question: "What is Gemini?",
            options: ["A search engine", "An AI model family", "A database", "A web server"],
            correctAnswer: 1,
            explanation: "Gemini is Google's multimodal AI model family."
          },
          {
            question: "Who developed Gemini?",
            options: ["Meta", "OpenAI", "Google", "Microsoft"],
            correctAnswer: 2,
            explanation: "Google announced and developed the Gemini family of models."
          },
          {
            question: "Is Gemini multimodal?",
            options: ["No", "Yes", "Only in labs", "Never"],
            correctAnswer: 1,
            explanation: "Yes, Gemini was built from the ground up to be multimodal."
          }
        ];
      } else {
        trivia = [
          {
            question: `What is primarily driving the popularity of ${trend}?`,
            options: ["Global economic shifts", "Social media virality and online engagement", "New government regulations", "Traditional print media"],
            correctAnswer: 1,
            explanation: `The conversation around ${trend} has been heavily driven by online engagement.`
          },
          {
            question: `Which category does ${trend} best fit into?`,
            options: ["Public health", "Technology and modern trends", "Ancient history", "Geological formations"],
            correctAnswer: 1,
            explanation: `${trend} is widely discussed as a modern trending topic.`
          },
          {
            question: `Where are conversations about ${trend} most active?`,
            options: ["Radio talk shows", "Online platforms and social media feeds", "Local libraries", "Classified ads"],
            correctAnswer: 1,
            explanation: `Most digital trends, including ${trend}, thrive in online forums and social channels.`
          }
        ];
      }
      await setTrendTrivia(trend, lang, trivia);
    } else {
      if (!genAI) {
        return reply.status(500).send({ error: 'Gemini API not configured.' });
      }

      const model = genAI.getGenerativeModel({
        model: 'gemini-3.1-flash-lite',
        generationConfig: {
          thinkingConfig: { thinkingLevel: 'LOW' },
          responseMimeType: 'application/json',
          responseSchema: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: {
                question: { type: "STRING" },
                options: {
                  type: "ARRAY",
                  items: { type: "STRING" }
                },
                correctAnswer: { type: "INTEGER" },
                explanation: { type: "STRING" }
              },
              required: ["question", "options", "correctAnswer", "explanation"]
            }
          }
        }
      });

      const prompt = `You are a trivia generator. Generate exactly 3 trivia multiple-choice questions about the trend "${trend}" in the language "${lang}".
Each question must have exactly 4 options, a correctAnswer (0-based index of the correct option in the options array), and a brief explanation why it is correct.
The output must be a JSON array of 3 objects containing question, options, correctAnswer, and explanation.`;

      const result = await model.generateContent(prompt);
      const textResponse = result.response.text();

      let cleanedText = textResponse.trim();
      if (cleanedText.startsWith('```')) {
        cleanedText = cleanedText.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/, '').trim();
      }

      trivia = JSON.parse(cleanedText);
      await setTrendTrivia(trend, lang, trivia);
    }

    return reply.send(trivia);
  } catch (err) {
    fastify.log.error('Trivia generation failed: ' + err.message);
    return reply.status(500).send({ error: 'Failed to generate trivia.' });
  }
});

// GET /api/topic-image/:slug
fastify.get('/api/topic-image/:slug', async (request, reply) => {
  const { slug } = request.params;
  let cleanSlug = slug;
  if (slug.endsWith('.md')) {
    cleanSlug = slug.slice(0, -3);
  }
  
  let trendName = '';
  try {
    if (latestTrends.length === 0) {
      if (process.env.NODE_ENV === 'test') {
        latestTrends = [
          { id: 1, title: "Google Gemini", source: "google" },
          { id: 2, title: "Fastify framework", source: "google" }
        ];
      } else {
        await updateTrendsCache();
      }
    }
    const match = latestTrends.find(item => titleToSlug(item.title) === cleanSlug);
    if (match) {
      trendName = match.title;
    }
  } catch (err) {
    fastify.log.error(err);
  }
  
  if (!trendName) {
    trendName = cleanSlug.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  }

  // Check cache first
  try {
    const cachedSvg = await getCachedTopicImage(trendName);
    if (cachedSvg) {
      reply.header('Content-Type', 'image/svg+xml');
      return reply.send(cachedSvg);
    }
  } catch (err) {
    fastify.log.error('Cache read error for topic image: ' + err.message);
  }

  const catMeta = getTrendCategoryMeta(trendName);

  let svgContent = '';
  // Check if test or dev mode
  if (process.env.NODE_ENV === 'test' || process.env.NODE_ENV === 'development' || !genAI) {
    svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" width="800" height="600">
      <defs>
        <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${catMeta.gradientStart}"/>
          <stop offset="100%" stop-color="${catMeta.gradientEnd}"/>
        </linearGradient>
      </defs>
      <rect width="800" height="600" fill="url(#bgGrad)"/>
      <circle cx="400" cy="300" r="150" fill="#ffffff" opacity="0.1"/>
      <text x="400" y="250" font-family="sans-serif" font-size="72" fill="#ffffff" text-anchor="middle">${catMeta.emoji}</text>
      <text x="400" y="320" font-family="sans-serif" font-size="48" fill="#ffffff" text-anchor="middle" font-weight="bold">${trendName}</text>
      <text x="400" y="380" font-family="sans-serif" font-size="24" fill="#ffffff" opacity="0.8" text-anchor="middle">${catMeta.badge}</text>
      <text x="400" y="430" font-family="sans-serif" font-size="20" fill="#ffffff" opacity="0.6" text-anchor="middle">Topic Image Placeholder</text>
    </svg>`;
  } else {
    // Production Mode: Generate custom topic SVG using Gemini API
    try {
      const model = genAI.getGenerativeModel({
        model: 'gemini-3.1-flash-lite',
        generationConfig: {
          thinkingConfig: { thinkingLevel: 'LOW' },
          responseMimeType: 'application/json',
          responseSchema: {
            type: "OBJECT",
            properties: {
              svg: { type: "STRING" }
            },
            required: ["svg"]
          }
        }
      });

      const prompt = `You are a creative UI designer. Generate a custom, beautiful, topic-themed SVG image for the trending topic: "${trendName}".
Requirements:
1. The output must be valid SVG code.
2. It should have a width of 800 and height of 600.
3. The design should be modern, clean, and visually represent the topic "${trendName}". You must incorporate the theme for the category "${catMeta.category}".
Specifically:
- Use the badge text "${catMeta.badge}" somewhere in the graphic or badge.
- Include the emoji "${catMeta.emoji}" as a prominent graphic element.
- Use a background gradient or design colors matching the range from "${catMeta.gradientStart}" to "${catMeta.gradientEnd}".
4. Keep the output clean and return it inside the JSON response matching the schema.`;

      const result = await model.generateContent(prompt);
      const textResponse = result.response.text();
      const parsed = JSON.parse(textResponse.trim());
      if (parsed && parsed.svg) {
        svgContent = parsed.svg;
      } else {
        throw new Error('Gemini response missing svg field');
      }
    } catch (err) {
      fastify.log.error('Gemini SVG generation failed: ' + err.message);
      svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" width="800" height="600">
        <defs>
          <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="${catMeta.gradientStart}"/>
            <stop offset="100%" stop-color="${catMeta.gradientEnd}"/>
          </linearGradient>
        </defs>
        <rect width="800" height="600" fill="url(#bgGrad)"/>
        <text x="400" y="260" font-family="sans-serif" font-size="72" fill="#ffffff" text-anchor="middle">${catMeta.emoji}</text>
        <text x="400" y="340" font-family="sans-serif" font-size="48" fill="#ffffff" text-anchor="middle" font-weight="bold">${trendName}</text>
        <text x="400" y="400" font-family="sans-serif" font-size="24" fill="#ffffff" opacity="0.8" text-anchor="middle">${catMeta.badge}</text>
      </svg>`;
    }
  }

  // Cache the SVG
  try {
    await setCachedTopicImage(trendName, svgContent);
  } catch (err) {
    fastify.log.error('Cache write error for topic image: ' + err.message);
  }

  reply.header('Content-Type', 'image/svg+xml');
  return reply.send(svgContent);
});

// GET /api/og/:slug
fastify.get('/api/og/:slug', async (request, reply) => {
  const { slug } = request.params;
  return serveOgImage(request, reply, slug, 'en');
});

// GET /api/og/:slug/:lang
fastify.get('/api/og/:slug/:lang', async (request, reply) => {
  const { slug, lang } = request.params;
  return serveOgImage(request, reply, slug, lang);
});

async function serveOgImage(request, reply, slug, lang) {
  let cleanSlug = slug;
  if (slug.endsWith('.md')) {
    cleanSlug = slug.slice(0, -3);
  }
  let cleanLang = (lang || 'en').toLowerCase().trim();

  // Normalize lookup keys to lowercase to satisfy [AC-2]
  const lowercaseSlug = cleanSlug.toLowerCase();
  const lowercaseLang = cleanLang.toLowerCase();
  const cacheKey = `${lowercaseSlug}:${lowercaseLang}`;

  if (ogImageCache.has(cacheKey)) {
    reply.header('Content-Type', 'image/png');
    return reply.send(ogImageCache.get(cacheKey));
  }

  let trendName = '';
  try {
    if (latestTrends.length === 0) {
      await updateTrendsCache();
    }
    const match = latestTrends.find(item => titleToSlug(item.title) === lowercaseSlug);
    if (match) {
      trendName = match.title;
    }
  } catch (err) {}
  if (!trendName) {
    trendName = cleanSlug.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  }

  const polls = await getPollData(trendName);
  const genius = polls ? polls.genius : 0;
  const overrated = polls ? polls.overrated : 0;

  const catMeta = getTrendCategoryMeta(trendName);

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630" width="1200" height="630">
    <defs>
      <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${catMeta.gradientStart}"/>
        <stop offset="100%" stop-color="${catMeta.gradientEnd}"/>
      </linearGradient>
    </defs>
    <rect width="1200" height="630" fill="url(#bgGrad)"/>
    <rect x="50" y="50" width="1100" height="530" rx="20" fill="#1e1e2e" opacity="0.9"/>
    
    <!-- Emoji & Title -->
    <text x="600" y="120" font-family="sans-serif" font-size="72" fill="#ffffff" text-anchor="middle">${catMeta.emoji}</text>
    <text x="600" y="200" font-family="sans-serif" font-size="54" fill="#cdd6f4" font-weight="bold" text-anchor="middle">${trendName}</text>
    
    <!-- Vibe Badge -->
    <g class="vibe-badge" id="category-badge">
      <rect x="450" y="240" width="300" height="50" rx="25" fill="${catMeta.gradientStart}"/>
      <text x="600" y="272" font-family="sans-serif" font-size="20" fill="#ffffff" text-anchor="middle" font-weight="bold">${catMeta.badge}</text>
    </g>
    
    <!-- Sentiment Gauges -->
    <g class="sentiment-gauge">
      <circle cx="450" cy="420" r="80" fill="none" stroke="#a6e3a1" stroke-width="20" class="genius-gauge"/>
      <text x="450" y="425" font-family="sans-serif" font-size="24" fill="#a6e3a1" text-anchor="middle" font-weight="bold">Genius: ${genius}</text>
      <circle cx="750" cy="420" r="80" fill="none" stroke="#f38ba8" stroke-width="20" class="overrated-gauge"/>
      <text x="750" y="425" font-family="sans-serif" font-size="24" fill="#f38ba8" text-anchor="middle" font-weight="bold">Overrated: ${overrated}</text>
    </g>
    <text x="600" y="550" font-family="sans-serif" font-size="24" fill="#6c7086" text-anchor="middle">viraljacker.com</text>
  </svg>`;

  try {
    const pngBuffer = await sharp(Buffer.from(svg))
      .png()
      .toBuffer();

    ogImageCache.set(cacheKey, pngBuffer);
    reply.header('Content-Type', 'image/png');
    return reply.send(pngBuffer);
  } catch (err) {
    fastify.log.error('Failed to convert SVG to PNG: ' + err.message);
    reply.status(500).send({ error: 'Failed to render PNG preview' });
  }
}

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
    const dbTrends = await getAllCachedExplanations();
    
    let md = `# TrendJacker\n`;
    md += `> TrendJacker is a dynamic viral trend explainer platform summarizing what is trending and why.\n\n`;
    md += `## Trends\n`;
    
    const seenSlugs = new Set();
    const uniqueSlugs = [];
    
    // Add live trends first to preserve their order and capitalization
    for (const liveT of latestTrends) {
      const slug = titleToSlug(liveT.title);
      if (!seenSlugs.has(slug)) {
        seenSlugs.add(slug);
        uniqueSlugs.push(slug);
      }
    }
    
    // Then add db trends
    for (const dbT of dbTrends) {
      const slug = titleToSlug(dbT.trend);
      if (!seenSlugs.has(slug)) {
        seenSlugs.add(slug);
        uniqueSlugs.push(slug);
      }
    }
    
    for (const slug of uniqueSlugs) {
      const liveMatch = latestTrends.find(t => titleToSlug(t.title) === slug);
      const dbMatch = dbTrends.find(dbT => titleToSlug(dbT.trend) === slug);
      
      let title = '';
      let desc = '';
      let news = null;
      
      if (liveMatch) {
        title = liveMatch.title;
        desc = liveMatch.description || 'No description available.';
        news = liveMatch.news || null;
      } else if (dbMatch) {
        title = dbMatch.trend;
        const expl = dbMatch.explanation || {};
        desc = expl.whatIsIt || expl.hook || 'No description available.';
      }
      
      let citationPart = '';
      if (news && news.url) {
        citationPart = `(Source: [${news.source || 'News Source'}](${news.url}))`;
      } else {
        const titleLower = title.toLowerCase();
        if (titleLower.includes('reddit')) {
          citationPart = '(Source: [Reddit - r/popular](https://reddit.com/r/popular))';
        } else {
          citationPart = '(Source: Google Trends Search Spike)';
        }
      }
      md += `- [/t/${slug}.md](/t/${slug}.md) - ${desc} ${citationPart}\n`;
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
    
    const dbTrends = await getAllCachedExplanations();
    const seenSlugs = new Set();
    const uniqueSlugs = [];
    
    // Add live trends first to preserve order and capitalization
    for (const liveT of latestTrends) {
      const slug = titleToSlug(liveT.title);
      if (!seenSlugs.has(slug)) {
        seenSlugs.add(slug);
        uniqueSlugs.push(slug);
      }
    }
    
    // Then add db trends
    for (const dbT of dbTrends) {
      const slug = titleToSlug(dbT.trend);
      if (!seenSlugs.has(slug)) {
        seenSlugs.add(slug);
        uniqueSlugs.push(slug);
      }
    }
    
    const combinedList = [];
    for (const slug of uniqueSlugs) {
      const liveMatch = latestTrends.find(t => titleToSlug(t.title) === slug);
      const dbMatch = dbTrends.find(dbT => titleToSlug(dbT.trend) === slug);
      
      let title = '';
      let snippet = '';
      let news = null;
      let explanation = null;
      
      if (liveMatch) {
        title = liveMatch.title;
        news = liveMatch.news || null;
        snippet = news?.snippet || '';
        
        const headline = news?.headline || '';
        try {
          explanation = await getTrendExplanation(title, headline, snippet);
        } catch (err) {
          explanation = {
            hook: `Why is everyone talking about ${title}?`,
            whatIsIt: `Trending search topic: ${title}.`,
            whyIsItViral: [`High volume search interest on Google Trends.`],
            takeaway: `Keep an eye on this trend as it develops.`,
            polls: { overrated: 0, genius: 0 }
          };
        }
      } else if (dbMatch) {
        title = dbMatch.trend;
        explanation = dbMatch.explanation || {};
      }
      
      combinedList.push({
        title,
        explanation,
        news,
        snippet
      });
    }
    
    let md = `# TrendJacker - Full Content\n\n`;
    for (const item of combinedList) {
      let sourceLine = '';
      if (item.news && item.news.url) {
        sourceLine = `Source: [${item.news.source || 'News Source'} - ${item.news.headline || 'Headline'}](${item.news.url})`;
      } else {
        const titleLower = (item.title || '').toLowerCase();
        if (titleLower.includes('reddit')) {
          sourceLine = 'Source: [Reddit - r/popular](https://reddit.com/r/popular)';
        } else {
          sourceLine = 'Source: Google Trends Search Spike';
        }
      }
      
      const expl = item.explanation || {};
      
      md += `## ${item.title}\n`;
      md += `${sourceLine}\n\n`;
      md += `Snippet: ${item.snippet || ''}\n`;
      md += `Explanation: ${expl.whatIsIt || ''}\n`;
      md += `Why it is viral:\n`;
      if (expl.whyIsItViral && Array.isArray(expl.whyIsItViral)) {
        for (const viralReason of expl.whyIsItViral) {
          md += `- ${viralReason}\n`;
        }
      }
      md += `Takeaway: ${expl.takeaway || ''}\n\n`;
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
    const dbTrends = await getAllCachedExplanations();
    
    const seenSlugs = new Set();
    const uniqueSlugs = [];
    
    for (const dbT of dbTrends) {
      const slug = titleToSlug(dbT.trend);
      if (!seenSlugs.has(slug)) {
        seenSlugs.add(slug);
        uniqueSlugs.push(slug);
      }
    }
    
    for (const liveT of latestTrends) {
      const slug = titleToSlug(liveT.title);
      if (!seenSlugs.has(slug)) {
        seenSlugs.add(slug);
        uniqueSlugs.push(slug);
      }
    }

    const canonicalBase = 'https://viraljacker.com';
    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n`;
    
    // Add homepage
    xml += `  <url>\n`;
    xml += `    <loc>${canonicalBase}/</loc>\n`;
    xml += `    <changefreq>daily</changefreq>\n`;
    xml += `    <priority>1.0</priority>\n`;
    xml += `  </url>\n`;
    
    // Add directory page entries for each language variant
    const locales = ['en', 'es', 'fr', 'ja'];
    for (const lang of locales) {
      const loc = lang === 'en'
        ? `${canonicalBase}/directory`
        : `${canonicalBase}/directory/${lang}`;
      
      xml += `  <url>\n`;
      xml += `    <loc>${loc}</loc>\n`;
      xml += `    <changefreq>daily</changefreq>\n`;
      xml += `    <priority>0.8</priority>\n`;
      xml += `    <xhtml:link rel="alternate" hreflang="x-default" href="${canonicalBase}/directory" />\n`;
      xml += `    <xhtml:link rel="alternate" hreflang="en" href="${canonicalBase}/directory" />\n`;
      xml += `    <xhtml:link rel="alternate" hreflang="es" href="${canonicalBase}/directory/es" />\n`;
      xml += `    <xhtml:link rel="alternate" hreflang="fr" href="${canonicalBase}/directory/fr" />\n`;
      xml += `    <xhtml:link rel="alternate" hreflang="ja" href="${canonicalBase}/directory/ja" />\n`;
      xml += `  </url>\n`;
    }
    
    // Add trend pages for each language variant
    for (const slug of uniqueSlugs) {
      for (const lang of locales) {
        const loc = lang === 'en'
          ? `${canonicalBase}/t/${slug}`
          : `${canonicalBase}/t/${slug}/${lang}`;
        
        xml += `  <url>\n`;
        xml += `    <loc>${loc}</loc>\n`;
        xml += `    <changefreq>daily</changefreq>\n`;
        xml += `    <priority>0.8</priority>\n`;
        xml += `    <xhtml:link rel="alternate" hreflang="x-default" href="${canonicalBase}/t/${slug}" />\n`;
        xml += `    <xhtml:link rel="alternate" hreflang="en" href="${canonicalBase}/t/${slug}" />\n`;
        xml += `    <xhtml:link rel="alternate" hreflang="es" href="${canonicalBase}/t/${slug}/es" />\n`;
        xml += `    <xhtml:link rel="alternate" hreflang="fr" href="${canonicalBase}/t/${slug}/fr" />\n`;
        xml += `    <xhtml:link rel="alternate" hreflang="ja" href="${canonicalBase}/t/${slug}/ja" />\n`;
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

async function serveDirectory(request, reply, lang) {
  try {
    if (latestTrends.length === 0) {
      await updateTrendsCache();
    }
    
    const dbTrends = await getAllCachedExplanations();
    
    const seenSlugs = new Set();
    const mergedTrends = [];
    
    function addTrend(title, slug) {
      const lowerSlug = slug.toLowerCase();
      if (!seenSlugs.has(lowerSlug)) {
        seenSlugs.add(lowerSlug);
        mergedTrends.push({ title, slug: lowerSlug });
      }
    }
    
    for (const dbT of dbTrends) {
      const slug = titleToSlug(dbT.trend);
      addTrend(dbT.trend, slug);
    }
    
    for (const liveT of latestTrends) {
      const slug = titleToSlug(liveT.title);
      addTrend(liveT.title, slug);
    }
    
    const locales = {
      en: {
        title: "Historical Trends Directory | TrendJacker",
        description: "Discover the history and explanation of recent viral trends indexed by TrendJacker.",
        headerTitle: "Historical Trends Directory",
        descriptionText: "Browse our archive of historical search trends and topics explained by AI.",
        footerLinkText: "Historical Trends Directory"
      },
      es: {
        title: "Directorio de Tendencias Históricas | TrendJacker",
        description: "Descubre la historia y explicación de las tendencias virales recientes indexadas por TrendJacker.",
        headerTitle: "Directorio de Tendencias Históricas",
        descriptionText: "Explore nuestro archivo de tendencias de búsqueda históricas explicadas por IA.",
        footerLinkText: "Directorio de Tendencias Históricas"
      },
      fr: {
        title: "Annuaire des Tendances Historiques | TrendJacker",
        description: "Découvrez l'historique et l'explication des tendances virales récentes indexées par TrendJacker.",
        headerTitle: "Annuaire des Tendances Historiques",
        descriptionText: "Parcourez notre archive de tendances de recherche historiques expliquées par l'IA.",
        footerLinkText: "Annuaire des Tendances Historiques"
      },
      ja: {
        title: "歴史的トレンドディレクトリ | TrendJacker",
        description: "TrendJackerがインデックスした最近のバイラルトレンドの歴史と解説をご覧ください。",
        headerTitle: "歴史的トレンドディレクトリ",
        descriptionText: "AIによって解説された過去の検索トレンドとトピックのアーカイブを閲覧する。",
        footerLinkText: "歴史的トレンドディレクトリ"
      }
    };
    
    const content = locales[lang] || locales['en'];
    const langSuffix = lang === 'en' ? '' : `/${lang}`;
    const canonicalBase = 'https://viraljacker.com';
    const canonicalUrl = `${canonicalBase}/directory${langSuffix}`;
    
    const jsonLd = {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      "name": content.headerTitle,
      "description": content.description,
      "url": canonicalUrl,
      "mainEntityOfPage": canonicalUrl,
      "itemListElement": mergedTrends.map((t, idx) => ({
        "@type": "ListItem",
        "position": idx + 1,
        "url": `${canonicalBase}/t/${t.slug}${langSuffix}`
      }))
    };
    
    const alternateLinks = `
  <link rel="alternate" hreflang="x-default" href="${canonicalBase}/directory" />
  <link rel="alternate" hreflang="en" href="${canonicalBase}/directory" />
  <link rel="alternate" hreflang="es" href="${canonicalBase}/directory/es" />
  <link rel="alternate" hreflang="fr" href="${canonicalBase}/directory/fr" />
  <link rel="alternate" hreflang="ja" href="${canonicalBase}/directory/ja" />
`;

    const html = `<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="dark">
  <title>${escapeHtml(content.title)}</title>
  <meta name="description" content="${escapeHtml(content.description)}">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700&family=Space+Grotesk:wght@500;600;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/styles.css">
  <link rel="canonical" href="${canonicalUrl}" />
  ${alternateLinks}
  <script type="application/ld+json">
    ${JSON.stringify(jsonLd, null, 2).replace(/</g, '\\u003c').replace(/>/g, '\\u003e')}
  </script>
  <script>
    document.documentElement.style.colorScheme = 'dark';
  </script>
</head>
<body>
  <!-- Floating Top Navbar -->
  <header class="navbar">
    <div style="display: flex; align-items: center; gap: var(--space-2);">
      <a href="/" class="brand" style="text-decoration: none;">
        <div class="logo-glow"></div>
        <span class="logo-text">Trend<span class="gradient-text">Jacker</span></span>
        <span class="version-tag">PoC</span>
      </a>
    </div>
  </header>

  <main style="max-width: 800px; margin: 80px auto var(--space-8) auto; padding: 0 var(--space-4);">
    <h1 style="font-family: 'Space Grotesk', sans-serif; font-size: 2rem; margin-bottom: var(--space-2); color: var(--text-color);">${content.headerTitle}</h1>
    <p style="color: var(--text-muted); margin-bottom: var(--space-6); font-size: 1.1rem;">${content.descriptionText}</p>
    <ul style="list-style: none; padding: 0; display: flex; flex-direction: column; gap: var(--space-3);">
      ${mergedTrends.map(t => `
        <li style="padding: var(--space-3); border: 1px solid var(--border-color); border-radius: var(--radius-md); background: rgba(255, 255, 255, 0.02); transition: background 0.2s, border-color 0.2s;">
          <a href="/t/${t.slug}${langSuffix}" style="font-size: 1.15rem; font-weight: 600; color: var(--primary); text-decoration: none; display: block;">${t.title}</a>
        </li>
      `).join('')}
    </ul>
  </main>

  <footer style="text-align: center; padding: var(--space-6) 0; border-top: 1px solid var(--border-color); margin-top: var(--space-8);">
    <a href="/directory${langSuffix}" id="directory-link" style="color: var(--text-muted); text-decoration: none;">${content.footerLinkText}</a>
  </footer>
</body>
</html>`;

    const linkHeader = [
      `<${canonicalBase}/directory${langSuffix}>; rel="canonical"`,
      `<${canonicalBase}/directory>; rel="alternate"; hreflang="x-default"`,
      `<${canonicalBase}/directory>; rel="alternate"; hreflang="en"`,
      `<${canonicalBase}/directory/es>; rel="alternate"; hreflang="es"`,
      `<${canonicalBase}/directory/fr>; rel="alternate"; hreflang="fr"`,
      `<${canonicalBase}/directory/ja>; rel="alternate"; hreflang="ja"`
    ].join(', ');
    
    reply.type('text/html').header('Link', linkHeader).send(html);
  } catch (err) {
    fastify.log.error(err);
    return reply.status(500).send('Error generating directory page');
  }
}

fastify.get('/directory', async (request, reply) => {
  return serveDirectory(request, reply, 'en');
});

fastify.get('/directory/:lang', async (request, reply) => {
  const { lang } = request.params;
  const cleanLang = (lang || '').trim().toLowerCase();
  const supported = ['es', 'fr', 'ja'];
  if (!supported.includes(cleanLang)) {
    return reply.redirect('/directory', 301);
  }
  return serveDirectory(request, reply, cleanLang);
});

// GET /api/chat-limit - Check chat limit and current counts
fastify.get('/api/chat-limit', async (request, reply) => {
  const { clientId, trend, localDate } = request.query || {};
  if (!clientId || !trend) {
    return reply.status(400).send({ error: 'clientId and trend query parameters are required.' });
  }

  const normalizedClientId = clientId.trim().toLowerCase();
  const normalizedTrend = trend.trim().toLowerCase();

  let newlyResolvedPredictions = [];
  if (localDate) {
    await updateClientStreak(normalizedClientId, localDate);
    newlyResolvedPredictions = await resolvePredictions(normalizedClientId, localDate);
  }

  let streakCount = 0;
  let streakBonus = 0;
  const streakInfo = await getClientStreak(normalizedClientId);
  if (streakInfo) {
    streakCount = streakInfo.streak_count;
    streakBonus = streakCount * 2;
  }

  const referralCount = await getReferralCount(normalizedClientId);
  const triviaScore = await getTriviaScore(normalizedClientId, normalizedTrend);
  let triviaBonus = 0;
  if (triviaScore !== null && triviaScore !== undefined) {
    if (triviaScore === 3) {
      triviaBonus = 5;
    } else if (triviaScore === 2) {
      triviaBonus = 3;
    } else if (triviaScore === 0 || triviaScore === 1) {
      triviaBonus = 1;
    }
  }
  const predictionBonus = await getPredictionBonus(normalizedClientId);
  const allowedLimit = 3 + 5 * referralCount + triviaBonus + streakBonus + predictionBonus;
  const currentCount = await getChatCount(normalizedClientId, normalizedTrend);
  const limitReached = currentCount >= allowedLimit;
  return { limitReached, currentCount, allowedLimit, streakCount, streakBonus, newlyResolvedPredictions, predictionBonus };
});

// POST /api/predict - Record a client prediction
fastify.post('/api/predict', async (request, reply) => {
  const { clientId, trend, prediction, localDate } = request.body || {};
  if (!clientId || !trend || !prediction || !localDate) {
    return reply.status(400).send({ error: 'clientId, trend, prediction, and localDate are required.' });
  }
  if (prediction !== 'rise' && prediction !== 'fall') {
    return reply.status(400).send({ error: 'prediction must be "rise" or "fall".' });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(localDate)) {
    return reply.status(400).send({ error: 'localDate must be in YYYY-MM-DD format.' });
  }

  await recordPrediction(clientId, trend, prediction, localDate);
  return { success: true };
});

// GET /api/predictions - Get client predictions
fastify.get('/api/predictions', async (request, reply) => {
  const { clientId } = request.query || {};
  if (!clientId || typeof clientId !== 'string' || !clientId.trim()) {
    return reply.status(400).send({ error: 'clientId query parameter is required.' });
  }
  const list = await getClientPredictions(clientId);
  return reply.send(list);
});

// GET /api/achievements - Get client achievements
fastify.get('/api/achievements', async (request, reply) => {
  const { clientId } = request.query || {};
  if (!clientId || typeof clientId !== 'string' || !clientId.trim()) {
    return reply.status(400).send({ error: 'clientId query parameter is required.' });
  }
  const result = await getClientAchievements(clientId);
  return reply.send(result);
});

// POST /api/referral - Record a client referral
fastify.post('/api/referral', async (request, reply) => {
  const { client_id, referee_id } = request.body || {};
  if (!client_id || !referee_id) {
    return reply.status(400).send({ error: 'client_id and referee_id are required.' });
  }
  const normalizedClientId = client_id.trim().toLowerCase();
  const normalizedRefereeId = referee_id.trim().toLowerCase();
  if (normalizedClientId === normalizedRefereeId) {
    return { success: false, error: 'Self-referral is not allowed.' };
  }
  await recordReferral(normalizedClientId, normalizedRefereeId);
  return { success: true };
});

// POST /api/trivia/score - Record a client trivia score and return updated limits
fastify.post('/api/trivia/score', async (request, reply) => {
  const { clientId, trend, score } = request.body || {};
  if (!clientId || !trend || score === undefined) {
    return reply.status(400).send({ error: 'clientId, trend, and score are required.' });
  }
  const normalizedClientId = clientId.trim().toLowerCase();
  const normalizedTrend = trend.trim().toLowerCase();
  const numericScore = Number(score);
  await recordTriviaScore(normalizedClientId, normalizedTrend, numericScore);

  let streakCount = 0;
  let streakBonus = 0;
  const streakInfo = await getClientStreak(normalizedClientId);
  if (streakInfo) {
    streakCount = streakInfo.streak_count;
    streakBonus = streakCount * 2;
  }

  const referralCount = await getReferralCount(normalizedClientId);
  const triviaScore = await getTriviaScore(normalizedClientId, normalizedTrend);
  let triviaBonus = 0;
  if (triviaScore !== null && triviaScore !== undefined) {
    if (triviaScore === 3) {
      triviaBonus = 5;
    } else if (triviaScore === 2) {
      triviaBonus = 3;
    } else if (triviaScore === 0 || triviaScore === 1) {
      triviaBonus = 1;
    }
  }
  const predictionBonus = await getPredictionBonus(normalizedClientId);
  const allowedLimit = 3 + 5 * referralCount + triviaBonus + streakBonus + predictionBonus;
  const currentCount = await getChatCount(normalizedClientId, normalizedTrend);
  const limitReached = currentCount >= allowedLimit;

  let rewardCount = 0;
  if (numericScore === 3) {
    rewardCount = 5;
  } else if (numericScore === 2) {
    rewardCount = 3;
  } else if (numericScore === 0 || numericScore === 1) {
    rewardCount = 1;
  }

  return { success: true, allowedLimit, currentCount, limitReached, rewardCount };
});

// GET /api/trivia/leaderboard - Get trivia leaderboard for a trend
fastify.get('/api/trivia/leaderboard', async (request, reply) => {
  const { trend, clientId } = request.query || {};
  if (!trend) {
    return reply.status(400).send({ error: 'trend is required.' });
  }
  const normalizedTrend = trend.trim().toLowerCase();
  const normalizedClientId = clientId ? clientId.trim().toLowerCase() : clientId;
  const result = await getTriviaLeaderboard(normalizedTrend, normalizedClientId);
  return reply.send(result);
});

// POST /api/trivia/nickname - Save or update client nickname
fastify.post('/api/trivia/nickname', async (request, reply) => {
  const { clientId, nickname } = request.body || {};
  if (typeof clientId !== 'string' || typeof nickname !== 'string') {
    return reply.status(400).send({ error: 'clientId and nickname must be strings.' });
  }
  const normalizedClientId = clientId.trim().toLowerCase();
  const trimmed = nickname.trim();
  if (trimmed.length === 0 || trimmed.length > 15) {
    return reply.status(400).send({ error: 'nickname must be non-empty and max 15 characters.' });
  }
  await saveClientNickname(normalizedClientId, trimmed);
  return reply.send({ success: true, nickname: trimmed });
});

// POST /api/chat - Follow-up Q&A chat using Gemini
fastify.post('/api/chat', async (request, reply) => {
  const { trend, query, history, clientId } = request.body || {};
  if (!trend || !query) {
    return reply.status(400).send({ error: 'Trend and query are required.' });
  }
  const normalizedTrend = trend.trim().toLowerCase();
  const normalizedClientId = clientId ? clientId.trim().toLowerCase() : clientId;

  const enforceLimits = (process.env.NODE_ENV !== 'test') || (request.headers['x-enforce-limits'] === 'true');
  if (enforceLimits && normalizedClientId) {
    let streakCount = 0;
    let streakBonus = 0;
    const streakInfo = await getClientStreak(normalizedClientId);
    if (streakInfo) {
      streakCount = streakInfo.streak_count;
      streakBonus = streakCount * 2;
    }

    const referralCount = await getReferralCount(normalizedClientId);
    const triviaScore = await getTriviaScore(normalizedClientId, normalizedTrend);
    let triviaBonus = 0;
    if (triviaScore !== null && triviaScore !== undefined) {
      if (triviaScore === 3) {
        triviaBonus = 5;
      } else if (triviaScore === 2) {
        triviaBonus = 3;
      } else if (triviaScore === 0 || triviaScore === 1) {
        triviaBonus = 1;
      }
    }
    const predictionBonus = await getPredictionBonus(normalizedClientId);
    const allowedLimit = 3 + 5 * referralCount + triviaBonus + streakBonus + predictionBonus;
    const currentCount = await getChatCount(normalizedClientId, normalizedTrend);
    if (currentCount >= allowedLimit) {
      return reply.status(403).send({ error: 'limit_reached', allowedLimit });
    }
    await incrementChatCount(normalizedClientId, normalizedTrend);
  }

  const truncatedHistory = Array.isArray(history) ? history.slice(-4) : [];

  // Check cache first
  const cachedResponse = await getCachedChatResponse(normalizedTrend, query, truncatedHistory);
  if (cachedResponse !== null) {
    return { reply: cachedResponse };
  }

  if (process.env.NODE_ENV === 'test') {
    const mockReply = 'This is a mock reply for: ' + query;
    await setCachedChatResponse(normalizedTrend, query, truncatedHistory, mockReply);
    return { reply: mockReply };
  }

  if (!genAI) {
    return reply.status(500).send({ error: 'Gemini API not configured.' });
  }

  try {
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-3.1-flash-lite',
      generationConfig: {
        thinkingConfig: { thinkingLevel: 'LOW' }
      }
    });

    // Format chat history for prompt context
    const historyText = (truncatedHistory || [])
      .map(msg => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`)
      .join('\n');

    const prompt = `You are a sharp, conversational AI trend analyst. The user is asking a follow-up question about the trending topic "${normalizedTrend}".
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
    await setCachedChatResponse(normalizedTrend, query, truncatedHistory, finalReply);
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
  const normalizedTrend = trend.toLowerCase();

  let events = await getVoteEvents(normalizedTrend);
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
    await seedVoteEvents(normalizedTrend, mockVotes);
    events = await getVoteEvents(normalizedTrend);
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
  const { trendTitle: bodyTrendTitle, trend: bodyTrend, platform, contextType, score, pattern, prediction } = request.body || {};
  const trendTitle = bodyTrendTitle || bodyTrend;
  if (!trendTitle) {
    return reply.status(400).send({ error: 'Trend title is required.' });
  }
  try {
    const postText = await generatePostText(trendTitle, platform, contextType, score, pattern, prediction);
    return { postText };
  } catch (err) {
    fastify.log.error(err);
    return reply.status(500).send({ error: 'Failed to generate post.' });
  }
});

async function generatePostText(trendTitle, platform, contextType, score, pattern, prediction) {
  const targetPlatform = platform || 'x';
  const targetContext = contextType === 'trivia' ? `trivia:${score !== undefined ? score : ''}:${pattern || ''}` : (contextType === 'prediction' ? `prediction:${prediction || ''}` : (contextType || 'general'));
  const slug = titleToSlug(trendTitle);
  const targetUrl = `https://viraljacker.com/t/${slug}`;

  // Check cache first
  const cachedPost = await getCachedGeneratedPost(trendTitle, targetPlatform, targetContext);
  if (cachedPost !== null) {
    return cachedPost;
  }

  let postText = '';
  if (process.env.NODE_ENV === 'test' || !genAI) {
    if (contextType === 'trivia') {
      if (targetPlatform === 'x' || targetPlatform === 'twitter') {
        postText = `Trivia Challenge completed for ${trendTitle}! Score: ${score}/3\n${pattern}\nCheck it out here: ${targetUrl} #Trivia #${trendTitle.replace(/\s+/g, '')}`;
        if (postText.length > 280) {
          postText = postText.substring(0, 277) + '...';
        }
      } else if (targetPlatform === 'pinterest') {
        postText = `Pin Title: ${trendTitle} Trivia Challenge\n\nPin Description: I scored ${score}/3 on this challenge! ${pattern} Play here: ${targetUrl} #Trivia`;
      } else if (targetPlatform === 'linkedin') {
        postText = `I just completed the ${trendTitle} Trivia Challenge!\n\nScore: ${score}/3\nPattern: ${pattern}\n\nCan you beat my score? Try it here: ${targetUrl}\n\n#AI #Innovation #Trivia`;
      } else if (targetPlatform === 'facebook') {
        postText = `I scored ${score}/3 on the ${trendTitle} Trivia Challenge! ${pattern} Think you can do better? Play here: ${targetUrl} #Trivia`;
      } else if (targetPlatform === 'reddit') {
        postText = `Trivia Challenge completed for ${trendTitle}! Score: ${score}/3\n\nPattern: ${pattern}\n\nTry it here: ${targetUrl}`;
      } else {
        postText = `I scored ${score}/3 on the ${trendTitle} Trivia Challenge! ${pattern}\n${targetUrl}`;
      }
    } else if (contextType === 'prediction') {
      const predLabel = prediction === 'fall' ? 'Decline 📉' : 'Keep Rising 📈';
      if (targetPlatform === 'x' || targetPlatform === 'twitter') {
        postText = `I just predicted that ${trendTitle} will ${predLabel} tomorrow! Join me on TrendJacker! ${targetUrl} #${trendTitle.replace(/\s+/g, '')}`;
        if (postText.length > 280) {
          postText = postText.substring(0, 277) + '...';
        }
      } else if (targetPlatform === 'pinterest') {
        postText = `Pin Title: ${trendTitle} Prediction\n\nPin Description: I just predicted that ${trendTitle} will ${predLabel} tomorrow! Check out live trend prediction details here: ${targetUrl}`;
      } else if (targetPlatform === 'linkedin') {
        postText = `I just predicted that ${trendTitle} will ${predLabel} tomorrow!\n\nJoin the trend prediction challenge on TrendJacker and unlock extra message capacity. ${targetUrl}\n\n#AI #Innovation #TrendPrediction`;
      } else if (targetPlatform === 'facebook') {
        postText = `I just predicted that ${trendTitle} will ${predLabel} tomorrow! Join me on TrendJacker to predict daily trend outcomes: ${targetUrl}`;
      } else if (targetPlatform === 'reddit') {
        postText = `Trend Prediction for ${trendTitle}: I predicted it will ${predLabel} tomorrow!\n\nVote and predict here: ${targetUrl}`;
      } else {
        postText = `I just predicted that ${trendTitle} will ${predLabel} tomorrow! ${targetUrl}`;
      }
    } else {
      if (targetPlatform === 'x' || targetPlatform === 'twitter') {
        postText = `Breaking: ${trendTitle} is trending! Angle: ${targetContext}. Check out: ${targetUrl} #${trendTitle.replace(/\s+/g, '')} #Tech`;
        if (postText.length > 280) {
          postText = postText.substring(0, 277) + '...';
        }
      } else if (targetPlatform === 'pinterest') {
        const trend = latestTrends.find(t => titleToSlug(t.title) === titleToSlug(trendTitle) || t.title === trendTitle);
        const snippet = trend ? (trend.description || (trend.news && trend.news.snippet) || '') : '';
        postText = `Pin Title: ${trendTitle}\n\nPin Description: ${snippet}. Explore live sentiment: ${targetUrl} #${trendTitle.replace(/\s+/g, '')} #Tech`;
      } else if (targetPlatform === 'linkedin') {
        postText = `Exciting update on ${trendTitle}!\n\nWe are seeing major interest in this topic with angle: ${targetContext}.\nRead full analysis here: ${targetUrl}\n\n#AI #Innovation #Technology`;
      } else if (targetPlatform === 'facebook') {
        postText = `What do you think about ${trendTitle}? It's viral right now under ${targetContext}. Read here: ${targetUrl} #${trendTitle.replace(/\s+/g, '')} #Viral`;
      } else if (targetPlatform === 'reddit') {
        postText = `Why is ${trendTitle} trending? (${targetContext})\n\nHere is a quick summary of the trend. Check out the full breakdown and vote here: ${targetUrl}`;
      } else {
        postText = `Mock post for ${targetPlatform} with context ${targetContext} about ${trendTitle}!\n${targetUrl}`;
      }
    }
    await setCachedGeneratedPost(trendTitle, targetPlatform, targetContext, postText);
    return postText;
  }

  try {
    const model = genAI.getGenerativeModel({
      model: 'gemini-3.1-flash-lite',
    });

    let platformInstructions = '';
    if (targetPlatform === 'x' || targetPlatform === 'twitter') {
      platformInstructions = `
- Platform: X (Twitter).
- Length constraint: The entire post must be strictly under 280 characters, including the target URL.
- Hashtags: Include 2 to 3 highly relevant, hyper-targeted hashtags (e.g., #CricketTwitter, #AIAgents) based on the trend topic.`;
    } else if (targetPlatform === 'pinterest') {
      platformInstructions = `
- Platform: Pinterest.
- Style: Frame the post with a catchy title/headline as the first line (e.g. "Pin Title: <Title>"), followed by a double newline and a keyword-rich description under 500 characters highlighting the virality factors.
- Hashtags: Include exactly 2 to 3 relevant hashtags on the last line.`;
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

    let triviaInstructions = '';
    if (contextType === 'trivia') {
      triviaInstructions = `\nYou must explicitly feature the trivia score "${score}/3" and the Wordle-style score emoji pattern "${pattern}" in the post text. Encourage followers to test their own knowledge and beat this score.`;
    }

    let predictionInstructions = '';
    if (contextType === 'prediction') {
      const predLabel = prediction === 'fall' ? 'Decline 📉' : 'Keep Rising 📈';
      predictionInstructions = `\nYou must explicitly mention that you predicted that the trend "${trendTitle}" will "${predLabel}" tomorrow. Frame it as an exciting prediction stake.`;
    }

    const prompt = `You are a world-class viral social media marketer. Generate a highly engaging, professional yet catchy social media post about the trending topic "${trendTitle}".

The angle/context for the post is: "${contextType || 'general'}".${triviaInstructions}${predictionInstructions}
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
    return postText;
  } catch (err) {
    throw err;
  }
}

// POST /api/cron/viral-poster
fastify.post('/api/cron/viral-poster', async (request, reply) => {
  try {
    if (latestTrends.length === 0) {
      await updateTrendsCache();
    }
    const trendItem = latestTrends.length > 0 ? latestTrends[0] : null;
    if (!trendItem) {
      return reply.status(404).send({ error: 'No active trends found.' });
    }
    const trendTitle = trendItem.title;
    const platforms = ['x', 'linkedin', 'facebook', 'pinterest'];
    const posted = [];
    const now = new Date().toISOString();

    for (const platform of platforms) {
      const postText = await generatePostText(trendTitle, platform, 'general');
      const postRecord = await insertViralPost(trendTitle, platform, postText, now);
      posted.push(postRecord);
    }

    return { success: true, posted };
  } catch (err) {
    fastify.log.error(err);
    return reply.status(500).send({ error: 'Failed to run viral poster cron.' });
  }
});

// GET /api/viral-poster/history
fastify.get('/api/viral-poster/history', async (request, reply) => {
  try {
    const history = await getViralPostHistory();
    return history;
  } catch (err) {
    fastify.log.error(err);
    return reply.status(500).send({ error: 'Failed to fetch viral poster history.' });
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
