import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import { parseStringPromise } from 'xml2js';
import { GoogleGenerativeAI } from '@google/generative-ai';

import { getPollData, incrementVote } from './db.js';

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

// Register static files
fastify.register(fastifyStatic, {
  root: path.join(__dirname, 'public'),
  prefix: '/',
});

// Database initialized via db.js module

// GET /api/trends - Fetches and parses Google Trends RSS feed
fastify.get('/api/trends', async (request, reply) => {
  try {
    const response = await fetch('https://trends.google.com/trending/rss?geo=US');
    if (!response.ok) {
      throw new Error(`Failed to fetch Google Trends RSS: ${response.status}`);
    }
    const xmlText = await response.text();
    const result = await parseStringPromise(xmlText);
    
    const items = result.rss.channel[0].item || [];
    const trends = items.map((item, index) => {
      // Safely parse custom namespaces
      const traffic = item['ht:approx_traffic'] ? item['ht:approx_traffic'][0] : 'N/A';
      const newsItem = item['ht:news_item'] ? item['ht:news_item'][0] : null;
      
      const snippet = newsItem && newsItem['ht:news_item_snippet'] ? newsItem['ht:news_item_snippet'][0] : '';
      const headline = newsItem && newsItem['ht:news_item_title'] ? newsItem['ht:news_item_title'][0] : '';
      const newsUrl = newsItem && newsItem['ht:news_item_url'] ? newsItem['ht:news_item_url'][0] : '';
      const newsSource = newsItem && newsItem['ht:news_item_source'] ? newsItem['ht:news_item_source'][0] : '';

      return {
        id: index + 1,
        title: item.title[0],
        traffic,
        description: item.description ? item.description[0] : '',
        news: {
          headline,
          snippet,
          url: newsUrl,
          source: newsSource
        }
      };
    });

    return trends.slice(0, 15);
  } catch (err) {
    fastify.log.error(err);
    return reply.status(500).send({ error: 'Failed to fetch trending topics.' });
  }
});

// Helper to get explanation from Gemini
async function getTrendExplanation(trend, headline = '', snippet = '') {
  if (!genAI) {
    throw new Error('Gemini API not configured.');
  }

  const model = genAI.getGenerativeModel({
    model: 'gemini-3.5-flash',
    generationConfig: { 
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
Here is the context snippet: "${snippet || ''}".`;

  const result = await model.generateContent(prompt);
  const textResponse = result.response.text();
  
  let cleanedText = textResponse.trim();
  if (cleanedText.startsWith('```')) {
    cleanedText = cleanedText.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/, '').trim();
  }
  
  const explanation = JSON.parse(cleanedText);
  explanation.polls = await getPollData(trend);
  return explanation;
}

// POST /api/explain - Explains a trend using Gemini
fastify.post('/api/explain', async (request, reply) => {
  const { trend, snippet, headline } = request.body || {};
  if (!trend) {
    return reply.status(400).send({ error: 'Trend name is required.' });
  }

  try {
    const explanation = await getTrendExplanation(trend, headline, snippet);
    return explanation;
  } catch (err) {
    fastify.log.error(err);
    return reply.status(500).send({ error: 'Failed to generate trend explanation.' });
  }
});

// GET /t/:slug - Dynamically renders a trend explainer page with SEO/GEO metadata
fastify.get('/t/:slug', async (request, reply) => {
  const { slug } = request.params;
  if (!slug) {
    return reply.redirect('/');
  }

  // Determine standard name from slug
  let trendName = slug.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  let headline = '';
  let snippet = '';

  try {
    const response = await fetch('https://trends.google.com/trending/rss?geo=US');
    if (response.ok) {
      const xmlText = await response.text();
      const result = await parseStringPromise(xmlText);
      const items = result.rss.channel[0].item || [];
      const match = items.find(item => titleToSlug(item.title[0]) === slug);
      if (match) {
        trendName = match.title[0];
        const newsItem = match['ht:news_item'] ? match['ht:news_item'][0] : null;
        snippet = newsItem && newsItem['ht:news_item_snippet'] ? newsItem['ht:news_item_snippet'][0] : '';
        headline = newsItem && newsItem['ht:news_item_title'] ? newsItem['ht:news_item_title'][0] : '';
      }
    }
  } catch (err) {
    console.error('Error matching slug against live trends:', err.message);
  }

  let explanation;
  try {
    explanation = await getTrendExplanation(trendName, headline, snippet);
  } catch (err) {
    fastify.log.error(err);
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

    const jsonLd = {
      "@context": "https://schema.org",
      "@type": "NewsArticle",
      "headline": `Why is ${trendName} Trending? Genius vs Overrated Explanation`,
      "description": explanation.hook,
      "articleBody": `${explanation.whatIsIt} Takeaway: ${explanation.takeaway}`,
      "author": {
        "@type": "Organization",
        "name": "TrendJacker"
      }
    };

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
    return reply.status(500).send({ error: 'Failed to render trend page.' });
  }
});

// GET /sitemap.xml - Dynamic sitemap generator
fastify.get('/sitemap.xml', async (request, reply) => {
  try {
    const response = await fetch('https://trends.google.com/trending/rss?geo=US');
    let slugs = [];
    if (response.ok) {
      const xmlText = await response.text();
      const result = await parseStringPromise(xmlText);
      const items = result.rss.channel[0].item || [];
      slugs = items.map(item => titleToSlug(item.title[0]));
    }

    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;
    
    // Add homepage
    xml += `  <url>\n`;
    xml += `    <loc>https://viraljacker.com/</loc>\n`;
    xml += `    <changefreq>daily</changefreq>\n`;
    xml += `    <priority>1.0</priority>\n`;
    xml += `  </url>\n`;
    
    // Add trend pages
    for (const slug of slugs) {
      xml += `  <url>\n`;
      xml += `    <loc>https://viraljacker.com/t/${slug}</loc>\n`;
      xml += `    <changefreq>daily</changefreq>\n`;
      xml += `    <priority>0.8</priority>\n`;
      xml += `  </url>\n`;
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

Conversation history:
${historyText}

User query: ${query}

Response:`;

    const result = await model.generateContent(prompt);
    const replyText = result.response.text();
    return { reply: replyText.trim() };
  } catch (err) {
    fastify.log.error(err);
    return reply.status(500).send({ error: 'Failed to generate chat response.' });
  }
});

// POST /api/poll - Records a sentiment vote for a trend
fastify.post('/api/poll', async (request, reply) => {
  const { trend, vote } = request.body || {};
  if (!trend || !['overrated', 'genius'].includes(vote)) {
    return reply.status(400).send({ error: 'Valid trend and vote (overrated/genius) are required.' });
  }

  return await incrementVote(trend, vote);
});

// Start the Fastify server
const port = process.env.PORT || 3000;
fastify.listen({ port, host: '0.0.0.0' }, (err) => {
  if (err) {
    fastify.log.error(err);
    process.exit(1);
  }
  console.log(`Trend-Jacker PoC running at http://localhost:${port}`);
});
