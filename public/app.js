document.addEventListener('DOMContentLoaded', () => {
  const trendsListContainer = document.getElementById('trends-list');
  const welcomeView = document.getElementById('welcome-view');
  const explainerView = document.getElementById('explainer-view');
  
  // Detail elements
  const detailTitle = document.getElementById('detail-title');
  const detailTraffic = document.getElementById('detail-traffic');
  const detailHook = document.getElementById('detail-hook');
  const detailWhat = document.getElementById('detail-what');
  const detailTakeaway = document.getElementById('detail-takeaway');
  const detailViralTags = document.getElementById('detail-viral-tags');
  
  // Interactive poll elements
  const btnGenius = document.getElementById('btn-vote-genius');
  const btnOverrated = document.getElementById('btn-vote-overrated');
  const pollResults = document.getElementById('poll-results');
  const barGenius = document.getElementById('bar-genius');
  const barOverrated = document.getElementById('bar-overrated');
  const pctGenius = document.getElementById('pct-genius');
  const pctOverrated = document.getElementById('pct-overrated');
  const btnDownloadCard = document.getElementById('btn-download-card');
  
  // Chat elements
  const chatForm = document.getElementById('chat-form');
  const chatInput = document.getElementById('chat-input');
  const chatHistory = document.getElementById('chat-history');
  
  // News elements
  const newsTitle = document.getElementById('detail-news-title');
  const newsSnippet = document.getElementById('detail-news-snippet');
  const newsLink = document.getElementById('detail-news-link');

  let currentTrend = null;
  let chatMessages = [];
  let hasVotedCurrent = false;

  const btnShareTrend = document.getElementById('btn-share-trend');

  // Slug generator helper
  function titleToSlug(title) {
    return title.toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-');
  }

  // Hydration data loader
  const preloadedDataEl = document.getElementById('preloaded-trend-data');
  let preloadedData = null;
  if (preloadedDataEl) {
    try {
      preloadedData = JSON.parse(preloadedDataEl.textContent);
    } catch (err) {
      console.error('Error parsing preloaded data:', err);
    }
  }

  // Parse path slug
  const pathParts = window.location.pathname.split('/');
  const urlSlug = (pathParts[1] === 't' && pathParts[2]) ? pathParts[2] : null;

  // Track mouse movement for interactive ambient glow
  document.addEventListener('mousemove', (e) => {
    const x = (e.clientX / window.innerWidth) * 100;
    const y = (e.clientY / window.innerHeight) * 100;
    document.documentElement.style.setProperty('--glow-x', `${x}%`);
    document.documentElement.style.setProperty('--glow-y', `${y}%`);
  });

  // Share Explainer Handler
  btnShareTrend.addEventListener('click', async () => {
    if (!currentTrend) return;
    const shareUrl = window.location.origin + '/t/' + titleToSlug(currentTrend.title);
    const shareText = `Check out the viral trend explainer and vote on whether "${currentTrend.title}" is overrated or genius!`;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: `TrendJacker — ${currentTrend.title}`,
          text: shareText,
          url: shareUrl
        });
        return;
      } catch (err) {
        console.log("Navigator share failed, falling back to copy:", err);
      }
    }
    
    try {
      await navigator.clipboard.writeText(shareUrl);
      btnShareTrend.classList.add('copied');
      const originalHTML = btnShareTrend.innerHTML;
      btnShareTrend.innerHTML = `
        <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="share-icon"><polyline points="20 6 9 17 4 12"/></svg>
        Copied!
      `;
      setTimeout(() => {
        btnShareTrend.classList.remove('copied');
        btnShareTrend.innerHTML = originalHTML;
      }, 2000);
    } catch (err) {
      console.error('Failed to copy share link:', err);
    }
  });

  // Dynamic SEO & Schema.org JSON-LD updates
  function updateSEO(trend, data) {
    document.title = `TrendJacker — Why is ${trend.title} trending right now?`;

    let metaDesc = document.querySelector('meta[name="description"]');
    if (!metaDesc) {
      metaDesc = document.createElement('meta');
      metaDesc.name = 'description';
      document.head.appendChild(metaDesc);
    }
    metaDesc.content = data.hook || `Instant explanation for the trending topic: ${trend.title}.`;

    let jsonLdScript = document.getElementById('jsonld-schema');
    if (!jsonLdScript) {
      jsonLdScript = document.createElement('script');
      jsonLdScript.id = 'jsonld-schema';
      jsonLdScript.type = 'application/ld+json';
      document.head.appendChild(jsonLdScript);
    }
    const schemaData = {
      "@context": "https://schema.org",
      "@type": "NewsArticle",
      "headline": `Why is ${trend.title} trending? Just-in-time Explainer`,
      "description": data.hook,
      "datePublished": new Date().toISOString(),
      "about": {
        "@type": "Thing",
        "name": trend.title
      },
      "articleBody": `${data.whatIsIt} Takeaway: ${data.takeaway}. Why it's viral: ${(data.whyIsItViral || []).join(', ')}`,
      "publisher": {
        "@type": "Organization",
        "name": "TrendJacker",
        "logo": {
          "@type": "ImageObject",
          "url": window.location.origin + "/logo-glow"
        }
      },
      "author": {
        "@type": "Organization",
        "name": "TrendJacker AI"
      }
    };
    jsonLdScript.textContent = JSON.stringify(schemaData);
  }

  // Initialize: Load Trends
  fetchTrends();

  async function fetchTrends() {
    try {
      const res = await fetch('/api/trends');
      if (!res.ok) throw new Error('Failed to fetch trends');
      const trends = await res.json();
      
      renderTrends(trends);
    } catch (err) {
      console.error(err);
      trendsListContainer.innerHTML = `<p class="error-msg">Error loading live feeds. Please refresh.</p>`;
    }
  }

  function renderTrends(trends) {
    trendsListContainer.innerHTML = '';
    
    // Hydrate trends list with preloaded item if not already present
    if (preloadedData && !trends.some(t => titleToSlug(t.title) === preloadedData.slug)) {
      trends.unshift({
        title: preloadedData.trend,
        traffic: 'Breakout',
        description: preloadedData.explanation.hook,
        news: { headline: '', snippet: '', url: '' }
      });
    }

    if (trends.length === 0) {
      trendsListContainer.innerHTML = '<p class="empty-msg">No current trends found.</p>';
      return;
    }

    let activeItem = null;

    trends.forEach((trend, index) => {
      const a = document.createElement('a');
      a.className = 'trend-item';
      a.href = `/t/${titleToSlug(trend.title)}`;
      a.setAttribute('aria-current', 'false');
      a.innerHTML = `
        <div class="trend-item-info">
          <span class="trend-item-title">${trend.title}</span>
          <span class="trend-item-desc">${trend.description || (trend.news && trend.news.headline) || 'Tap to investigate'}</span>
        </div>
        <span class="trend-item-traffic">${trend.traffic}</span>
      `;
      
      const clickHandler = (skipPush = false) => {
        document.querySelectorAll('.trend-item').forEach(el => {
          el.classList.remove('active');
          el.setAttribute('aria-current', 'false');
        });
        a.classList.add('active');
        a.setAttribute('aria-current', 'true');

        if (!skipPush) {
          const newUrl = window.location.origin + '/t/' + titleToSlug(trend.title);
          window.history.pushState({ path: newUrl }, '', newUrl);
        }
        
        loadTrendDetails(trend);
      };

      a._clickHandler = clickHandler;
      a.addEventListener('click', (e) => {
        e.preventDefault();
        clickHandler(false);
      });
      trendsListContainer.appendChild(a);

      // Match path-based urlSlug or preloadedData slug, falling back to first
      const activeSlug = urlSlug || (preloadedData ? preloadedData.slug : null);
      if (activeSlug && titleToSlug(trend.title) === activeSlug) {
        activeItem = { element: a, handler: clickHandler };
      } else if (!activeSlug && index === 0) {
        activeItem = { element: a, handler: clickHandler };
      }
    });

    if (activeItem) {
      activeItem.element.classList.add('active');
      activeItem.element.setAttribute('aria-current', 'true');
      activeItem.handler(true); // skip pushing state since url is already correct
    } else if (urlSlug) {
      // Slug was provided in URL but is not in the active feed
      const mockTrend = {
        title: urlSlug.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' '),
        traffic: 'Rising',
        news: { headline: '', snippet: '', url: '' }
      };
      loadTrendDetails(mockTrend);
    }
  }

  // Back/forward navigation popstate handler
  window.addEventListener('popstate', () => {
    const pathParts = window.location.pathname.split('/');
    const activeSlug = (pathParts[1] === 't' && pathParts[2]) ? pathParts[2] : null;
    
    const items = Array.from(document.querySelectorAll('.trend-item'));
    let target = null;
    if (activeSlug) {
      target = items.find(item => {
        const title = item.querySelector('.trend-item-title').textContent.trim();
        return titleToSlug(title) === activeSlug;
      });
    } else {
      target = items[0];
    }

    if (target) {
      if (target._clickHandler) {
        target._clickHandler(true);
      } else {
        target.click();
      }
    }
  });

  async function loadTrendDetails(trend) {
    currentTrend = trend;
    chatMessages = [];
    hasVotedCurrent = false;
    
    // Smooth fade transition
    explainerView.classList.add('hidden');
    welcomeView.classList.add('hidden');
    
    try {
      let data;
      // Hydrate explanation if preloadedData matches
      if (preloadedData && preloadedData.slug === titleToSlug(trend.title)) {
        data = preloadedData.explanation;
        preloadedData = null; // Clear to allow future live fetches
      } else {
        const res = await fetch('/api/explain', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            trend: trend.title,
            snippet: trend.news ? trend.news.snippet : '',
            headline: trend.news ? trend.news.headline : ''
          })
        });
        
        if (!res.ok) throw new Error('API failed to explain');
        data = await res.json();
      }
      
      // Populate Details
      detailTitle.textContent = trend.title;
      detailTraffic.textContent = `${trend.traffic || 'Rising'} searches`;

      // Dynamic Velocity text based on traffic
      const trafficNum = parseInt((trend.traffic || '').replace(/[^0-9]/g, '')) || 0;
      let velocityText = 'Breakout Speed';
      let targetRotation = -90;
      
      if (trafficNum >= 100000) {
        velocityText = 'Parabolic Spikes 🔥';
        targetRotation = 60 + Math.min(25, ((trafficNum - 100000) / 100000) * 25);
      } else if (trafficNum >= 50000) {
        velocityText = 'High Velocity ⚡';
        targetRotation = 15 + ((trafficNum - 50000) / 50000) * 40;
      } else if (trafficNum >= 20000) {
        velocityText = 'Breakout Speed 📈';
        targetRotation = -30 + ((trafficNum - 20000) / 30000) * 45;
      } else {
        velocityText = 'Rising Velocity 📈';
        targetRotation = -90 + (Math.max(2000, trafficNum) / 20000) * 55;
      }
      
      document.getElementById('detail-velocity-text').textContent = velocityText;

      // Animate SVG Speedometer needle pointer
      const needle = document.getElementById('needle');
      if (needle) {
        needle.style.transform = `rotate(${targetRotation}deg)`;
      }

      // Animate Canvas Sparkline
      animateSparkline(trafficNum);

      detailHook.textContent = data.hook;
      detailWhat.textContent = data.whatIsIt;
      detailTakeaway.textContent = data.takeaway;

      // Update SEO tags and structured data
      updateSEO(trend, data);
      
      // Render viral tags
      detailViralTags.innerHTML = '';
      (data.whyIsItViral || []).forEach(reason => {
        const span = document.createElement('span');
        span.className = 'viral-tag';
        span.textContent = reason;
        detailViralTags.appendChild(span);
      });

      // Poll reset
      pollResults.classList.add('hidden');
      document.querySelector('.poll-prompt').classList.remove('hidden');
      document.querySelector('.poll-buttons').classList.remove('hidden');
      updatePollPercentages(data.polls);

      // Chat reset
      chatHistory.innerHTML = `
        <div class="chat-bubble bot">
          Ask me any follow-up question about the viral rise of <strong>${trend.title}</strong>.
        </div>
      `;

      // News Footer
      if (trend.news && trend.news.headline) {
        newsTitle.textContent = trend.news.headline;
        newsSnippet.textContent = trend.news.snippet || 'No snippet available.';
        newsLink.href = trend.news.url || '#';
        document.querySelector('.news-footer-card').classList.remove('hidden');
      } else {
        document.querySelector('.news-footer-card').classList.add('hidden');
      }
      
      // Show View
      explainerView.classList.remove('hidden');
    } catch (err) {
      console.error(err);
      alert('Had trouble generating AI explanation. Please try again.');
    }
  }

  // Poll Vote Logic
  btnGenius.addEventListener('click', () => submitVote('genius'));
  btnOverrated.addEventListener('click', () => submitVote('overrated'));
  btnDownloadCard.addEventListener('click', generateTrendCardImage);

  async function generateTrendCardImage() {
    if (!currentTrend) return;
    
    // Ensure custom fonts are loaded before drawing
    await document.fonts.ready;

    const canvas = document.createElement('canvas');
    canvas.width = 1200;
    canvas.height = 630;
    const ctx = canvas.getContext('2d');

    // 1. Background Gradient
    const bgGrad = ctx.createLinearGradient(0, 0, 1200, 630);
    bgGrad.addColorStop(0, '#0f1225');
    bgGrad.addColorStop(1, '#05070f');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, 1200, 630);

    // 2. Glowing Neon Border Accent
    const borderGrad = ctx.createLinearGradient(0, 0, 1200, 630);
    borderGrad.addColorStop(0, '#6366f1'); // Indigo
    borderGrad.addColorStop(0.5, '#06b6d4'); // Cyan
    borderGrad.addColorStop(1, '#6366f1');
    ctx.strokeStyle = borderGrad;
    ctx.lineWidth = 8;
    ctx.strokeRect(4, 4, 1192, 622);

    // 3. Logo/Brand
    ctx.font = "bold 26px 'Space Grotesk', sans-serif";
    ctx.fillStyle = "#ffffff";
    ctx.fillText("Trend", 80, 80);
    const trendTextWidth = ctx.measureText("Trend").width;
    
    const logoGrad = ctx.createLinearGradient(80 + trendTextWidth, 0, 80 + trendTextWidth + 100, 0);
    logoGrad.addColorStop(0, '#06b6d4');
    logoGrad.addColorStop(1, '#6366f1');
    ctx.fillStyle = logoGrad;
    ctx.fillText("Jacker", 80 + trendTextWidth, 80);

    // Live Badge
    ctx.fillStyle = "rgba(6, 182, 212, 0.1)";
    ctx.fillRect(1000, 56, 120, 32);
    ctx.lineWidth = 1;
    ctx.strokeStyle = "rgba(6, 182, 212, 0.3)";
    ctx.strokeRect(1000, 56, 120, 32);

    ctx.font = "bold 13px 'Space Grotesk', sans-serif";
    ctx.fillStyle = "#06b6d4";
    ctx.textAlign = "center";
    ctx.fillText("LIVE ANALYTICS", 1060, 76);
    ctx.textAlign = "left"; // Reset alignment

    // 4. Trend Header
    ctx.font = "bold 68px 'Space Grotesk', sans-serif";
    ctx.fillStyle = "#ffffff";
    ctx.fillText(currentTrend.title, 80, 175);

    // 5. The Hook Section
    ctx.font = "bold 15px 'Space Grotesk', sans-serif";
    ctx.fillStyle = "#6366f1";
    ctx.fillText("THE AI HOOK", 80, 225);

    // Hook background box
    ctx.fillStyle = "rgba(99, 102, 241, 0.04)";
    ctx.fillRect(80, 240, 1040, 120);
    
    ctx.fillStyle = "#6366f1";
    ctx.fillRect(80, 240, 6, 120);

    // Wrap hook text
    ctx.font = "500 20px 'Plus Jakarta Sans', sans-serif";
    ctx.fillStyle = "#cbd5e1";
    const hookText = detailHook.textContent || "";
    wrapText(ctx, hookText, 110, 275, 980, 32);

    // 6. Sentiment Poll Section
    ctx.font = "bold 15px 'Space Grotesk', sans-serif";
    ctx.fillStyle = "#cbd5e1";
    ctx.fillText("COMMUNITY SENTIMENT", 80, 410);

    // Get percentages
    const geniusText = pctGenius.textContent || '50%';
    const overratedText = pctOverrated.textContent || '50%';
    const geniusVal = parseInt(geniusText) || 50;
    const overratedVal = parseInt(overratedText) || 50;

    const barWidth = 1040;
    const barHeight = 16;
    const barX = 80;
    const barY = 430;

    // Draw background track
    ctx.fillStyle = "#1e293b";
    ctx.beginPath();
    ctx.roundRect(barX, barY, barWidth, barHeight, 8);
    ctx.fill();

    // Draw Genius (Emerald) section
    const gWidth = (geniusVal / 100) * barWidth;
    if (gWidth > 0) {
      ctx.fillStyle = "#10b981";
      ctx.beginPath();
      ctx.roundRect(barX, barY, gWidth, barHeight, [8, gWidth === barWidth ? 8 : 0, gWidth === barWidth ? 8 : 0, 8]);
      ctx.fill();
    }

    // Draw Overrated (Rose) section
    const oWidth = (overratedVal / 100) * barWidth;
    if (oWidth > 0) {
      ctx.fillStyle = "#f43f5e";
      ctx.beginPath();
      const oX = barX + gWidth;
      ctx.roundRect(oX, barY, oWidth, barHeight, [gWidth === 0 ? 8 : 0, 8, 8, gWidth === 0 ? 8 : 0]);
      ctx.fill();
    }

    // Labels under bar
    ctx.font = "bold 22px 'Space Grotesk', sans-serif";
    ctx.fillStyle = "#10b981";
    ctx.fillText(`Genius: ${geniusVal}%`, 80, 485);

    ctx.textAlign = "right";
    ctx.fillStyle = "#f43f5e";
    ctx.fillText(`Overrated: ${overratedVal}%`, 1120, 485);
    ctx.textAlign = "left"; // Reset

    // 7. Footer Call To Action
    ctx.font = "500 15px 'Plus Jakarta Sans', sans-serif";
    ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
    ctx.fillText("Vote live and investigate trends at viraljacker.com", 80, 560);

    // Trigger image download
    try {
      const dataUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `trend-card-${titleToSlug(currentTrend.title)}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error("Failed to generate and download card PNG:", err);
      alert("Could not download image. Please try again.");
    }
  }

  function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
    const words = text.split(' ');
    let line = '';
    let currentY = y;

    for (let n = 0; n < words.length; n++) {
      const testLine = line + words[n] + ' ';
      const metrics = ctx.measureText(testLine);
      const testWidth = metrics.width;
      if (testWidth > maxWidth && n > 0) {
        ctx.fillText(line, x, currentY);
        line = words[n] + ' ';
        currentY += lineHeight;
      } else {
        line = testLine;
      }
    }
    ctx.fillText(line, x, currentY);
  }

  function animateSparkline(trafficNum) {
    const canvas = document.getElementById('trend-sparkline');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    
    ctx.clearRect(0, 0, width, height);
    
    // Generate simulated data series that spikes near the end
    const pointsCount = 10;
    const data = [];
    let base = 5;
    for (let i = 0; i < pointsCount - 1; i++) {
      base += Math.random() * 4 - 1.5;
      data.push(Math.max(2, base));
    }
    
    let finalSpike = 12;
    if (trafficNum >= 100000) finalSpike = 24;
    else if (trafficNum >= 50000) finalSpike = 20;
    else if (trafficNum >= 20000) finalSpike = 16;
    data.push(finalSpike);
    
    const maxVal = Math.max(...data);
    const minVal = Math.min(...data);
    const range = maxVal - minVal || 1;
    
    const coords = data.map((val, idx) => {
      const x = (idx / (pointsCount - 1)) * (width - 10) + 5;
      const y = height - ((val - minVal) / range) * (height - 8) - 4;
      return { x, y };
    });
    
    let progress = 0;
    const drawFrame = () => {
      if (progress > 1) return;
      progress += 0.05;
      
      ctx.clearRect(0, 0, width, height);
      
      // Draw grid line
      ctx.strokeStyle = "rgba(255, 255, 255, 0.03)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, height / 2);
      ctx.lineTo(width, height / 2);
      ctx.stroke();
      
      // Draw line path
      ctx.lineWidth = 2.5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      
      const limit = Math.floor(progress * coords.length);
      if (limit < 1) {
        requestAnimationFrame(drawFrame);
        return;
      }
      
      const lineGrad = ctx.createLinearGradient(0, 0, width, 0);
      lineGrad.addColorStop(0, '#06b6d4');
      lineGrad.addColorStop(1, '#6366f1');
      ctx.strokeStyle = lineGrad;
      ctx.shadowBlur = 4;
      ctx.shadowColor = 'rgba(6, 182, 212, 0.4)';
      
      ctx.beginPath();
      ctx.moveTo(coords[0].x, coords[0].y);
      for (let i = 1; i < limit; i++) {
        ctx.lineTo(coords[i].x, coords[i].y);
      }
      if (limit < coords.length) {
        const pStart = coords[limit - 1];
        const pEnd = coords[limit];
        const interpX = pStart.x + (pEnd.x - pStart.x) * ((progress * coords.length) - limit);
        const interpY = pStart.y + (pEnd.y - pStart.y) * ((progress * coords.length) - limit);
        ctx.lineTo(interpX, interpY);
      }
      ctx.stroke();
      ctx.shadowBlur = 0;
      
      // Fill path
      ctx.fillStyle = ctx.createLinearGradient(0, 0, 0, height);
      ctx.fillStyle.addColorStop(0, 'rgba(6, 182, 212, 0.1)');
      ctx.fillStyle.addColorStop(1, 'rgba(6, 182, 212, 0.0)');
      ctx.beginPath();
      ctx.moveTo(coords[0].x, height);
      ctx.lineTo(coords[0].x, coords[0].y);
      for (let i = 1; i < limit; i++) {
        ctx.lineTo(coords[i].x, coords[i].y);
      }
      if (limit < coords.length) {
        const pStart = coords[limit - 1];
        const pEnd = coords[limit];
        const interpX = pStart.x + (pEnd.x - pStart.x) * ((progress * coords.length) - limit);
        const interpY = pStart.y + (pEnd.y - pStart.y) * ((progress * coords.length) - limit);
        ctx.lineTo(interpX, interpY);
        ctx.lineTo(interpX, height);
      } else {
        ctx.lineTo(coords[coords.length - 1].x, height);
      }
      ctx.closePath();
      ctx.fill();
      
      requestAnimationFrame(drawFrame);
    };
    
    requestAnimationFrame(drawFrame);
  }

  async function submitVote(choice) {
    if (hasVotedCurrent || !currentTrend) return;
    
    try {
      const res = await fetch('/api/poll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trend: currentTrend.title,
          vote: choice
        })
      });
      
      if (!res.ok) throw new Error('Failed to record vote');
      const newVotes = await res.json();
      
      updatePollPercentages(newVotes);
      
      // Visual transition to results page
      document.querySelector('.poll-prompt').classList.add('hidden');
      document.querySelector('.poll-buttons').classList.add('hidden');
      pollResults.classList.remove('hidden');
      hasVotedCurrent = true;
    } catch (err) {
      console.error(err);
    }
  }

  function updatePollPercentages(polls) {
    const total = (polls.genius || 0) + (polls.overrated || 0);
    let geniusPct = 0;
    let overratedPct = 0;
    
    if (total > 0) {
      geniusPct = Math.round((polls.genius / total) * 100);
      overratedPct = 100 - geniusPct;
    } else {
      // Default placeholder metrics
      geniusPct = 50;
      overratedPct = 50;
    }
    
    const prevGeniusText = pctGenius.textContent;
    const prevOverratedText = pctOverrated.textContent;
    const geniusChanged = prevGeniusText && prevGeniusText !== `${geniusPct}%`;
    const overratedChanged = prevOverratedText && prevOverratedText !== `${overratedPct}%`;

    barGenius.style.width = `${geniusPct}%`;
    barOverrated.style.width = `${overratedPct}%`;
    pctGenius.textContent = `${geniusPct}%`;
    pctOverrated.textContent = `${overratedPct}%`;

    if (geniusChanged) {
      pctGenius.classList.add('pulse-text');
      setTimeout(() => pctGenius.classList.remove('pulse-text'), 800);
    }
    if (overratedChanged) {
      pctOverrated.classList.add('pulse-text');
      setTimeout(() => pctOverrated.classList.remove('pulse-text'), 800);
    }
  }

  // Chat Follow-Up Submit
  chatForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const query = chatInput.value.trim();
    if (!query || !currentTrend) return;
    
    // Clear input
    chatInput.value = '';
    
    // Add user bubble
    appendBubble(query, 'user');
    
    // Add temporary loading indicator bubble
    const loadingBubble = appendBubble('Thinking...', 'bot loading-bubble');
    
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trend: currentTrend.title,
          query: query,
          history: chatMessages
        })
      });
      
      // Remove loading
      loadingBubble.remove();
      
      if (!res.ok) throw new Error('Chat API error');
      const data = await res.json();
      
      // Add assistant bubble
      appendBubble(data.reply, 'bot');
      
      // Update history reference
      chatMessages.push({ role: 'user', content: query });
      chatMessages.push({ role: 'assistant', content: data.reply });
      
    } catch (err) {
      loadingBubble.remove();
      appendBubble('Sorry, I hit an error responding to your question. Please try again.', 'bot');
      console.error(err);
    }
  });

  function appendBubble(text, roleClass) {
    const div = document.createElement('div');
    div.className = `chat-bubble ${roleClass}`;
    div.innerHTML = text;
    chatHistory.appendChild(div);
    
    // Scroll chat window to bottom
    chatHistory.scrollTop = chatHistory.scrollHeight;
    return div;
  }

  // Initialize Global Live Sentiment Feed
  function initSentimentFeed() {
    const feedContainer = document.getElementById('live-sentiment-feed');
    if (!feedContainer) return;

    const eventSource = new EventSource('/api/sentiment-stream');

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        // Remove empty state if present
        const emptyState = feedContainer.querySelector('.feed-empty-state');
        if (emptyState) {
          emptyState.remove();
        }

        // Create feed item element
        const item = document.createElement('div');
        item.className = 'feed-item';
        
        const timestamp = new Date(data.timestamp);
        const timeStr = timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

        item.innerHTML = `
          <span class="feed-item-flag">${data.location.flag || '📍'}</span>
          <div class="feed-item-content">
            <span class="feed-item-user">${data.location.city}, ${data.location.country}</span>
            voted
            <span class="feed-item-vote ${data.vote}">${data.vote}</span>
            on
            <span class="feed-item-trend">${data.trend}</span>
          </div>
          <span class="feed-item-time">${timeStr}</span>
        `;

        // Wire click listener to load trend details if clicked
        const trendLink = item.querySelector('.feed-item-trend');
        if (trendLink) {
          trendLink.addEventListener('click', (e) => {
            e.stopPropagation();
            const slug = titleToSlug(data.trend);
            // Search in sidebar items
            const itemEl = Array.from(document.querySelectorAll('.trend-item'))
              .find(el => titleToSlug(el.querySelector('.trend-item-title').textContent.trim()) === slug);
            
            if (itemEl && itemEl._clickHandler) {
              itemEl._clickHandler(false);
            } else {
              // Fallback load manual details
              loadTrendDetails({
                title: data.trend,
                traffic: 'Rising',
                news: { headline: '', snippet: '', url: '' }
              });
              const newUrl = window.location.origin + '/t/' + slug;
              window.history.pushState({ path: newUrl }, '', newUrl);
            }
          });
        }

        // Insert at the top
        feedContainer.insertBefore(item, feedContainer.firstChild);

        // Keep maximum 15 items in the feed list
        while (feedContainer.children.length > 15) {
          feedContainer.lastChild.remove();
        }

        // If the incoming simulated vote matches current trend, update percentages
        if (currentTrend && currentTrend.title === data.trend && data.updatedPolls) {
          updatePollPercentages(data.updatedPolls);
        }

      } catch (err) {
        console.error('Error handling SSE live vote event:', err);
      }
    };

    eventSource.onerror = (err) => {
      console.error('SSE Connection error (sentiment stream):', err);
    };
  }

  // Start the feed
  initSentimentFeed();

  // WebMCP Integration: Expose client-side functions as tools to user AI agents (e.g. Claude Code, Siri, etc.)
  const modelContext = document.modelContext || window.modelContext;
  if (modelContext && typeof modelContext.registerTool === 'function') {
    console.log('WebMCP detected. Registering client-side agent tools.');

    // Tool 1: get_trending_topics
    modelContext.registerTool({
      name: "get_trending_topics",
      description: "Lists the active trending search topics currently visible on the page.",
      inputSchema: { type: "object", properties: {} },
      execute() {
        const titles = Array.from(document.querySelectorAll('.trend-item-title')).map(el => el.textContent.trim());
        return { trends: titles };
      },
      annotations: { readOnlyHint: true }
    });

    // Tool 2: get_trend_explanation
    modelContext.registerTool({
      name: "get_trend_explanation",
      description: "Gets the active trend's detailed AI summary, viral trigger tags, and original news links.",
      inputSchema: { type: "object", properties: {} },
      execute() {
        if (!currentTrend) {
          return { error: "No trend is currently active. Select a trend first using select_trend_topic." };
        }
        
        const tags = Array.from(document.querySelectorAll('.viral-tag')).map(el => el.textContent.trim());
        return {
          topic: currentTrend.title,
          traffic: currentTrend.traffic,
          hook: detailHook.textContent.trim(),
          whatIsIt: detailWhat.textContent.trim(),
          takeaway: detailTakeaway.textContent.trim(),
          viralTriggers: tags,
          newsHeadline: newsTitle.textContent.trim(),
          newsSnippet: newsSnippet.textContent.trim()
        };
      },
      annotations: { readOnlyHint: true }
    });

    // Tool 3: select_trend_topic
    modelContext.registerTool({
      name: "select_trend_topic",
      description: "Loads a specific trending search topic by name to analyze its details.",
      inputSchema: {
        type: "object",
        properties: {
          topic: { type: "string", description: "The name of the trending search topic to select (e.g., 'karl anthony towns')." }
        },
        required: ["topic"]
      },
      async execute(input) {
        const items = Array.from(document.querySelectorAll('.trend-item'));
        const target = items.find(item => {
          const title = item.querySelector('.trend-item-title').textContent.trim().toLowerCase();
          return title === input.topic.toLowerCase();
        });
        
        if (target) {
          target.click();
          // Give Fastify/Gemini fetch a moment to load and render the UI
          await new Promise(resolve => setTimeout(resolve, 1500));
          return { success: true, message: `Loaded details and generated explanation for: ${input.topic}` };
        }
        return { success: false, error: `Topic '${input.topic}' was not found in the live trends feed.` };
      }
    });

    // Tool 4: submit_sentiment_vote
    modelContext.registerTool({
      name: "submit_sentiment_vote",
      description: "Votes whether the active trend is genius or overrated, returning updated community percentages.",
      inputSchema: {
        type: "object",
        properties: {
          vote: { type: "string", enum: ["genius", "overrated"], description: "Your opinion vote on the trend." }
        },
        required: ["vote"]
      },
      async execute(input) {
        if (!currentTrend) {
          return { success: false, error: "No trend is active. Use select_trend_topic first." };
        }
        
        await submitVote(input.vote);
        return {
          success: true,
          geniusPercentage: pctGenius.textContent,
          overratedPercentage: pctOverrated.textContent
        };
      }
    });
  }
});
