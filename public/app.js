function initApp() {
  window.onerror = function(message, source, lineno, colno, error) {
    const errDiv = document.createElement('div');
    errDiv.id = 'runtime-error-debugger';
    errDiv.style = 'background: red; color: white; padding: 20px; z-index: 9999; position: fixed; top: 0; left: 0;';
    errDiv.textContent = 'ERROR: ' + message + ' at ' + source + ':' + lineno + ':' + colno + '\nStack: ' + (error ? error.stack : '');
    document.body.appendChild(errDiv);
    originalLog.call(console, "[RUNTIME ERROR]", message, source, lineno, colno, error);
  };

  const originalLog = console.log;
  console.log = function(...args) {
    originalLog.apply(console, args);
    try {
      const msg = args.map(x => {
        try {
          if (x instanceof Error) return x.message + '\n' + x.stack;
          return typeof x === 'object' ? JSON.stringify(x) : String(x);
        } catch (e) {
          return String(x);
        }
      }).join(' ');
      fetch('/api/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'log', message: msg })
      }).catch(() => {});
    } catch (e) {}
  };

  const originalError = console.error;
  console.error = function(...args) {
    originalError.apply(console, args);
    try {
      const msg = args.map(x => {
        try {
          if (x instanceof Error) return x.message + '\n' + x.stack;
          return typeof x === 'object' ? JSON.stringify(x) : String(x);
        } catch (e) {
          return String(x);
        }
      }).join(' ');
      originalError.call(console, "[CAPTURED ERROR]", msg);
      fetch('/api/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'error', message: msg })
      }).catch(() => {});
    } catch (e) {}
  };

  let hasWebShare = false;
  let hasFileShare = false;

  let allTrends = [];
  let searchQuery = '';
  let activeFilter = 'All';
  let showAllTrendsMobile = false;

  // --- Interactive Sentiment Timeline Dashboard ---
  let prevTimelinePoints = [];
  let currentTimelinePoints = [];
  let timelineTransitionProgress = 1.0;
  let timelineTransitionActive = false;
  let timelineHoverIndex = -1;

  let activeLoadId = 0;

  const pageLoadTime = Date.now();
  let storedClientId = localStorage.getItem('clientId');
  if (!storedClientId) {
    storedClientId = 'client-' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem('clientId', storedClientId);
  }
  const localClientId = storedClientId;

  // Capture referral
  const urlParams = new URLSearchParams(window.location.search);
  const refValue = urlParams.get('ref');
  if (refValue && refValue !== localClientId) {
    fetch('/api/referral', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        client_id: refValue,
        referee_id: localClientId
      })
    }).catch(err => console.error('Error sending referral POST:', err));
  }



  function resolveLocation(timeZone) {
    const tz = timeZone || '';
    
    // Explicit matches first
    if (tz === 'Europe/London') {
      return { city: 'London', country: 'United Kingdom', flag: '🇬🇧' };
    }
    if (tz === 'America/New_York') {
      return { city: 'New York', country: 'United States', flag: '🇺🇸' };
    }
    if (tz === 'America/Chicago') {
      return { city: 'Chicago', country: 'United States', flag: '🇺🇸' };
    }
    if (tz === 'America/Los_Angeles') {
      return { city: 'Los Angeles', country: 'United States', flag: '🇺🇸' };
    }
    if (tz === 'Asia/Tokyo') {
      return { city: 'Tokyo', country: 'Japan', flag: '🇯🇵' };
    }
    if (tz === 'Europe/Paris') {
      return { city: 'Paris', country: 'France', flag: '🇫🇷' };
    }
    if (tz === 'Europe/Berlin') {
      return { city: 'Berlin', country: 'Germany', flag: '🇩🇪' };
    }
    if (tz === 'Australia/Sydney') {
      return { city: 'Sydney', country: 'Australia', flag: '🇦🇺' };
    }
    if (tz === 'Asia/Singapore') {
      return { city: 'Singapore', country: 'Singapore', flag: '🇸🇬' };
    }
    if (tz === 'America/Toronto') {
      return { city: 'Toronto', country: 'Canada', flag: '🇨🇦' };
    }

    // Keyword matches
    if (tz.includes('London')) {
      return { city: 'London', country: 'United Kingdom', flag: '🇬🇧' };
    }
    if (tz.includes('New_York')) {
      return { city: 'New York', country: 'United States', flag: '🇺🇸' };
    }
    if (tz.includes('Chicago')) {
      return { city: 'Chicago', country: 'United States', flag: '🇺🇸' };
    }
    if (tz.includes('Los_Angeles')) {
      return { city: 'Los Angeles', country: 'United States', flag: '🇺🇸' };
    }
    if (tz.includes('Denver')) {
      return { city: 'Denver', country: 'United States', flag: '🇺🇸' };
    }
    if (tz.includes('Phoenix')) {
      return { city: 'Phoenix', country: 'United States', flag: '🇺🇸' };
    }
    
    // Fallback parsing for other typical timezones
    const parts = tz.split('/');
    if (parts.length === 2) {
      const city = parts[1].replace(/_/g, ' ');
      let country = parts[0];
      let flag = '📍';
      if (country === 'Europe') {
        country = 'Europe';
      } else if (country === 'America') {
        country = 'United States';
        flag = '🇺🇸';
      } else if (country === 'Asia') {
        country = 'Asia';
      }
      return { city, country, flag };
    }

    return { city: '', country: '', flag: '📍' };
  }

  const clientTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const localLocation = resolveLocation(clientTimeZone);

  if (window.isSecureContext && navigator.share) {
    hasWebShare = true;
    try {
      if (navigator.canShare) {
        const testFile = new File([''], 'test.png', { type: 'image/png' });
        hasFileShare = navigator.canShare({ files: [testFile] });
      }
    } catch (e) {
      hasFileShare = false;
    }
  }

  function updateButtonForSharing(btn, newText, newAriaLabel) {
    if (!btn) return;
    btn.setAttribute('aria-label', newAriaLabel);
    btn.innerHTML = `
      <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="btn-icon"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
      ${newText}
    `;
  }

  function triggerDownload(canvas, filename) {
    try {
      const dataUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = filename;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error("Failed to generate and download PNG:", err);
      alert("Could not download image. Please try again.");
    }
  }

  async function shareOrDownloadCanvas(canvas, filename, title, text, fallbackUrl) {
    if (hasWebShare) {
      try {
        if (hasFileShare) {
          canvas.toBlob = function(callback, type) {
            try {
              const dataUrl = canvas.toDataURL(type);
              const binStr = atob(dataUrl.split(',')[1]);
              const len = binStr.length;
              const arr = new Uint8Array(len);
              for (let i = 0; i < len; i++) {
                arr[i] = binStr.charCodeAt(i);
              }
              const blob = new Blob([arr], { type: type || 'image/png' });
              callback(blob);
            } catch (e) {
              callback(null);
            }
          };

          const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
          if (blob) {
            const file = new File([blob], filename, { type: 'image/png' });
            Object.defineProperty(file, 'type', { value: 'image/png', writable: true, configurable: true, enumerable: true });
            await navigator.share({
              files: [file],
              title: title,
              text: text
            });
            return;
          }
        }
        await navigator.share({
          title: title,
          text: text,
          url: fallbackUrl
        });
        return;
      } catch (err) {
        if (err.name === 'AbortError') {
          console.log('Sharing was aborted by the user.');
          return;
        }
        console.error('Sharing failed, falling back to download:', err);
      }
    }
    triggerDownload(canvas, filename);
  }

  const trendsListContainer = document.getElementById('trends-list');
  const welcomeView = document.getElementById('welcome-view');
  const explainerView = document.getElementById('explainer-view');
  const explainerSkeleton = document.getElementById('explainer-skeleton');
  
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
  const btnDownloadStreakReward = document.getElementById('btn-download-streak-reward');
  
  // Chat elements
  const chatForm = document.getElementById('chat-form');
  const chatInput = document.getElementById('chat-input');
  const chatHistory = document.getElementById('chat-history');
  
  // News elements
  const newsTitle = document.getElementById('detail-news-title');
  const newsSnippet = document.getElementById('detail-news-snippet');
  const newsLink = document.getElementById('detail-news-link');

  // Visual Cards Grid elements
  const vibeEmoji = document.getElementById('vibe-emoji');
  const vibeCategory = document.getElementById('vibe-category');
  const vibeBadge = document.getElementById('vibe-badge');
  const cardViralVibe = document.getElementById('card-viral-vibe');
  const gaugeFill = document.getElementById('gauge-fill');
  const gaugeGeniusPct = document.getElementById('gauge-genius-pct');
  const btnDownloadInfographic = document.getElementById('btn-download-infographic');

  // Trivia Elements & State
  const triviaContainer = document.getElementById('trivia-card-container');
  const triviaStartScreen = triviaContainer ? triviaContainer.querySelector('.trivia-start-screen') : null;
  const triviaGameplayScreen = triviaContainer ? triviaContainer.querySelector('.trivia-gameplay-screen') : null;
  const triviaResultsScreen = triviaContainer ? triviaContainer.querySelector('.trivia-results-screen') : null;
  const btnStartTrivia = document.getElementById('btn-start-trivia');
  const btnPlayAgain = document.getElementById('btn-play-again');
  const btnShareScore = document.getElementById('btn-share-score');
  const triviaTitle = triviaContainer ? triviaContainer.querySelector('.trivia-title') : null;
  const triviaQuestionText = triviaContainer ? triviaContainer.querySelector('.trivia-question-text') : null;
  const triviaProgress = triviaContainer ? triviaContainer.querySelector('.trivia-progress') : null;
  const triviaProgressFill = triviaContainer ? triviaContainer.querySelector('.trivia-progress-bar-fill') : null;
  const triviaOptionsContainer = triviaContainer ? triviaContainer.querySelector('.trivia-options-container') : null;
  const triviaExplanationBlock = triviaContainer ? triviaContainer.querySelector('.trivia-explanation-block') : null;
  const triviaFeedback = triviaContainer ? triviaContainer.querySelector('.trivia-feedback') : null;
  const triviaCorrectAnswer = triviaContainer ? triviaContainer.querySelector('.trivia-correct-answer') : null;
  const triviaExplanationText = triviaContainer ? triviaContainer.querySelector('.trivia-explanation-text') : null;
  const triviaNavBtn = triviaContainer ? triviaContainer.querySelector('.trivia-nav-btn') : null;
  const triviaResultsTitle = triviaContainer ? triviaContainer.querySelector('.trivia-results-title') : null;
  const triviaResultsScore = triviaContainer ? triviaContainer.querySelector('.trivia-results-score') : null;
  const triviaEmojiPattern = triviaContainer ? triviaContainer.querySelector('.trivia-emoji-pattern') : null;

  let triviaQuestions = [];
  let currentQuestionIndex = 0;
  let userScore = 0;
  let answerPattern = [];
  let isAnswerSelected = false;

  function resetTrivia(trend) {
    triviaQuestions = [];
    currentQuestionIndex = 0;
    userScore = 0;
    answerPattern = [];
    isAnswerSelected = false;

    if (triviaStartScreen) triviaStartScreen.classList.remove('hidden');
    if (triviaGameplayScreen) triviaGameplayScreen.classList.add('hidden');
    if (triviaResultsScreen) triviaResultsScreen.classList.add('hidden');

    const rewardDisplay = document.getElementById('trivia-reward-display');
    if (rewardDisplay) {
      rewardDisplay.textContent = '';
      rewardDisplay.style.display = 'none';
    }

    const milestoneTitleEl = document.getElementById('trivia-milestone-title');
    const milestoneBadgeEl = document.getElementById('trivia-milestone-badge');
    if (milestoneTitleEl) milestoneTitleEl.textContent = '';
    if (milestoneBadgeEl) milestoneBadgeEl.textContent = '';

    if (trend && triviaTitle) {
      triviaTitle.textContent = trend.title;
    }

    if (trend) {
      fetchAndRenderLeaderboard(trend.title, '.trivia-start-screen');
    }
  }

  function fetchAndRenderLeaderboard(trendTitle, containerSelector) {
    const container = document.querySelector(containerSelector);
    if (!container) return;

    const leaderboardEl = container.querySelector('.trivia-leaderboard');
    if (!leaderboardEl) return;

    const loadingEl = leaderboardEl.querySelector('.leaderboard-loading');
    const emptyEl = leaderboardEl.querySelector('.leaderboard-empty');
    const listEl = leaderboardEl.querySelector('.leaderboard-list');
    const personalRankEl = leaderboardEl.querySelector('.leaderboard-personal-rank');

    if (loadingEl) loadingEl.classList.remove('hidden');
    if (emptyEl) emptyEl.classList.add('hidden');
    if (listEl) {
      listEl.innerHTML = '';
      listEl.classList.add('hidden');
    }
    if (personalRankEl) {
      personalRankEl.classList.add('hidden');
      personalRankEl.textContent = '';
    }

    const url = `/api/trivia/leaderboard?trend=${encodeURIComponent(trendTitle)}&clientId=${localClientId}`;
    fetch(url)
      .then(res => {
        if (!res.ok) throw new Error('Leaderboard fetch failed');
        return res.json();
      })
      .then(data => {
        if (loadingEl) loadingEl.classList.add('hidden');

        if (!data.success || !data.leaderboard || data.leaderboard.length === 0) {
          if (emptyEl) emptyEl.classList.remove('hidden');
          return;
        }

        if (listEl) {
          listEl.classList.remove('hidden');
          data.leaderboard.forEach(row => {
            const rowEl = document.createElement('div');
            rowEl.className = 'leaderboard-row';
            if (row.isCurrentUser) {
              rowEl.classList.add('highlight', 'current-user');
            }

            const rankSpan = document.createElement('span');
            rankSpan.className = 'leaderboard-rank';
            rankSpan.textContent = `#${row.rank}`;

            const nameSpan = document.createElement('span');
            nameSpan.className = 'leaderboard-nickname';
            nameSpan.textContent = row.nickname;

            const scoreSpan = document.createElement('span');
            scoreSpan.className = 'leaderboard-score';
            scoreSpan.textContent = `${row.score}/3`;

            rowEl.appendChild(rankSpan);
            rowEl.appendChild(nameSpan);
            rowEl.appendChild(scoreSpan);
            listEl.appendChild(rowEl);
          });
        }

        if (data.userRank && data.userRank > 10 && personalRankEl) {
          personalRankEl.textContent = `Your Rank: #${data.userRank} (High Score: ${data.userScore}/3)`;
          personalRankEl.classList.remove('hidden');
        }
      })
      .catch(err => {
        console.error('Error loading leaderboard:', err);
        if (loadingEl) loadingEl.classList.add('hidden');
        if (emptyEl) {
          emptyEl.textContent = 'Failed to load leaderboard.';
          emptyEl.classList.remove('hidden');
        }
      });
  }

  async function startTrivia() {
    if (!currentTrend) return;
    
    if (btnStartTrivia) btnStartTrivia.disabled = true;
    
    try {
      const selectedLang = document.getElementById('lang-select')?.value || 'en';
      const res = await fetch('/api/trivia', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trend: currentTrend.title,
          lang: selectedLang
        })
      });

      if (!res.ok) throw new Error('Failed to fetch trivia questions');
      triviaQuestions = await res.json();
      currentQuestionIndex = 0;
      userScore = 0;
      answerPattern = [];
      
      if (triviaStartScreen) triviaStartScreen.classList.add('hidden');
      if (triviaGameplayScreen) triviaGameplayScreen.classList.remove('hidden');
      
      renderQuestion();
    } catch (err) {
      console.error('Trivia load failed:', err);
      alert('Could not load trivia challenge. Please try again.');
    } finally {
      if (btnStartTrivia) btnStartTrivia.disabled = false;
    }
  }

  function renderQuestion() {
    isAnswerSelected = false;
    if (!triviaQuestions || triviaQuestions.length === 0) return;
    const currentQuestion = triviaQuestions[currentQuestionIndex];
    if (!currentQuestion) return;

    const lang = document.getElementById('lang-select')?.value || 'en';
    const dict = UI_DICTIONARY[lang] || UI_DICTIONARY['en'];
    
    const total = triviaQuestions.length;
    const progressIndex = currentQuestionIndex + 1;
    if (triviaProgress) {
      if (typeof dict.triviaProgress === 'function') {
        triviaProgress.textContent = dict.triviaProgress(progressIndex, total);
      } else {
        triviaProgress.textContent = `Question ${progressIndex} of ${total}`;
      }
    }

    if (triviaProgressFill) {
      const progressPct = ((currentQuestionIndex) / total) * 100;
      triviaProgressFill.style.width = `${progressPct}%`;
    }

    if (triviaQuestionText) {
      triviaQuestionText.textContent = currentQuestion.question;
    }

    if (triviaOptionsContainer) {
      triviaOptionsContainer.innerHTML = '';
      currentQuestion.options.forEach((option, index) => {
        const btn = document.createElement('button');
        btn.className = 'trivia-option-btn';
        btn.textContent = option;
        btn.addEventListener('click', () => selectAnswer(index));
        triviaOptionsContainer.appendChild(btn);
      });
    }

    if (triviaExplanationBlock) {
      triviaExplanationBlock.classList.add('hidden');
    }
  }

  function selectAnswer(selectedIndex) {
    if (isAnswerSelected) return;
    isAnswerSelected = true;

    if (!triviaQuestions || triviaQuestions.length === 0) return;
    const currentQuestion = triviaQuestions[currentQuestionIndex];
    if (!currentQuestion) return;

    const isCorrect = selectedIndex === currentQuestion.correctAnswer;
    const optionBtns = triviaOptionsContainer ? triviaOptionsContainer.querySelectorAll('.trivia-option-btn') : [];
    optionBtns.forEach((btn, index) => {
      btn.disabled = true;
      if (index === currentQuestion.correctAnswer) {
        btn.classList.add('correct-highlight');
      } else if (index === selectedIndex) {
        btn.classList.add('wrong-highlight');
      }
    });

    const lang = document.getElementById('lang-select')?.value || 'en';
    const dict = UI_DICTIONARY[lang] || UI_DICTIONARY['en'];

    if (isCorrect) {
      userScore++;
      answerPattern.push('🟩');
      if (triviaFeedback) {
        triviaFeedback.textContent = dict.triviaCorrect || 'Correct! 🟩';
        triviaFeedback.style.color = 'rgb(34, 197, 94)';
      }
    } else {
      answerPattern.push('🟥');
      if (triviaFeedback) {
        triviaFeedback.textContent = dict.triviaIncorrect || 'Incorrect! 🟥';
        triviaFeedback.style.color = 'rgb(239, 68, 68)';
      }
    }

    const correctOptionText = currentQuestion.options[currentQuestion.correctAnswer];
    let correctLabel = "Correct Answer";
    if (lang === 'es') correctLabel = "Respuesta Correcta";
    else if (lang === 'fr') correctLabel = "Réponse Correcte";
    else if (lang === 'ja') correctLabel = "正解";

    if (triviaCorrectAnswer) {
      triviaCorrectAnswer.textContent = `${correctLabel}: ${correctOptionText}`;
    }

    if (triviaExplanationText) {
      triviaExplanationText.textContent = currentQuestion.explanation;
    }

    if (triviaNavBtn) {
      const isLastQuestion = currentQuestionIndex === triviaQuestions.length - 1;
      if (isLastQuestion) {
        triviaNavBtn.textContent = dict.triviaResultsBtn || 'See Results';
      } else {
        triviaNavBtn.textContent = dict.triviaNext || 'Next Question';
      }
    }

    if (triviaExplanationBlock) {
      triviaExplanationBlock.classList.remove('hidden');
    }
  }

  function handleTriviaNavigation() {
    const isLastQuestion = currentQuestionIndex === triviaQuestions.length - 1;
    if (isLastQuestion) {
      showResults();
    } else {
      currentQuestionIndex++;
      renderQuestion();
    }
  }

  function updateTriviaMilestone(score) {
    const milestoneTitleEl = document.getElementById('trivia-milestone-title');
    const milestoneBadgeEl = document.getElementById('trivia-milestone-badge');
    if (milestoneTitleEl && milestoneBadgeEl) {
      let title = '';
      let badge = '';
      if (score === 3) {
        title = "Brainiac Mastermind";
        badge = "🏆";
      } else if (score === 2) {
        title = "Sharp Challenger";
        badge = "🥈";
      } else {
        title = "Curious Mind";
        badge = "🥉";
      }
      milestoneTitleEl.textContent = title;
      milestoneBadgeEl.textContent = badge;
    }
  }

  function showResults() {
    if (triviaGameplayScreen) triviaGameplayScreen.classList.add('hidden');
    if (triviaResultsScreen) triviaResultsScreen.classList.remove('hidden');

    const lang = document.getElementById('lang-select')?.value || 'en';
    const dict = UI_DICTIONARY[lang] || UI_DICTIONARY['en'];

    if (triviaResultsTitle) {
      triviaResultsTitle.textContent = dict.triviaResultsTitle || 'Challenge Completed!';
    }

    const total = triviaQuestions.length;
    if (triviaResultsScore) {
      if (typeof dict.triviaScore === 'function') {
        triviaResultsScore.textContent = dict.triviaScore(userScore, total);
      } else {
        triviaResultsScore.textContent = `You scored ${userScore} out of ${total}`;
      }
    }

    updateTriviaMilestone(userScore);

    const patternStr = answerPattern.join('');
    if (triviaEmojiPattern) {
      triviaEmojiPattern.textContent = patternStr;
    }

    const nicknameInput = document.getElementById('nickname-input');
    const nicknameStatus = document.getElementById('nickname-status');
    if (nicknameInput) {
      nicknameInput.value = localStorage.getItem('trivia-nickname') || '';
    }
    if (nicknameStatus) {
      nicknameStatus.textContent = '';
      nicknameStatus.className = '';
    }

    // AC-5: Display capacity reward display success badge
    const rewardDisplay = document.getElementById('trivia-reward-display');
    if (rewardDisplay) {
      let rewardBonus = 0;
      if (userScore === 3) {
        rewardBonus = 5;
      } else if (userScore === 2) {
        rewardBonus = 3;
      } else if (userScore === 0 || userScore === 1) {
        rewardBonus = 1;
      }
      rewardDisplay.textContent = `+${rewardBonus} bonus messages unlocked`;
      rewardDisplay.style.display = 'block';
    }

    // AC-6: Submit score to API and update limits/UI
    if (currentTrend) {
      fetch('/api/trivia/score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: localClientId,
          trend: currentTrend.title,
          score: userScore
        })
      })
      .then(res => {
        if (res.ok) return res.json();
        throw new Error('Trivia score POST failed');
      })
      .then(data => {
        updateLimitAndStreakUI(data);
        if (currentTrend) {
          fetchAndRenderLeaderboard(currentTrend.title, '.trivia-results-screen');
        }
      })
      .catch(err => {
        console.error('Error auto-submitting score and syncing UI:', err);
      });
    }
  }

  function updateDemographicPills(demographic) {
    const pills = document.querySelectorAll('.demo-pill');
    pills.forEach(pill => {
      if (pill.getAttribute('data-val') === demographic) {
        pill.classList.add('active');
      } else {
        pill.classList.remove('active');
      }
    });

    if (explainerView) {
      explainerView.setAttribute('data-demographic', demographic);
      if (demographic === 'kids_teens') {
        explainerView.classList.add('kids-teens-theme');
      } else {
        explainerView.classList.remove('kids-teens-theme');
      }
    }
    document.body.setAttribute('data-demographic', demographic);
    if (demographic === 'kids_teens') {
      document.body.classList.add('kids-teens-theme');
    } else {
      document.body.classList.remove('kids-teens-theme');
    }
  }

  const demographicSelector = document.getElementById('demographic-selector');
  if (demographicSelector) {
    demographicSelector.addEventListener('click', async (e) => {
      const pill = e.target.closest('.demo-pill');
      if (!pill) return;
      const targetVal = pill.getAttribute('data-val');
      localStorage.setItem('selected-demographic', targetVal);
      updateDemographicPills(targetVal);
      if (currentTrend) {
        await loadTrendDetails(currentTrend);
      }
    });
  }

  const initialDemographic = localStorage.getItem('selected-demographic') || 'adults';
  updateDemographicPills(initialDemographic);

  // Mobile drawer elements
  const btnSidebarToggle = document.getElementById('sidebar-toggle');
  const sidebarBackdrop = document.getElementById('sidebar-backdrop');
  const sidebarPanel = document.querySelector('.sidebar-panel');
  const btnSidebarClose = document.getElementById('sidebar-close');

  let currentTrend = null;
  let chatMessages = [];
  let hasVotedCurrent = false;
  let userPollVote = null;
  let initialTimelineLoaded = false;


  const btnShareTrend = document.getElementById('btn-share-trend');
  const btnSharePoll = document.getElementById('btn-share-poll');


  const shareModal = document.getElementById('share-modal');
  const btnCloseShareModal = document.getElementById('btn-close-share-modal');
  const shareContextSelect = document.getElementById('share-context-select');
  const platformPills = document.querySelectorAll('.platform-pill');
  const sharePreviewText = document.getElementById('share-preview-text');
  const btnCopyShare = document.getElementById('btn-copy-share');
  const btnPostShare = document.getElementById('btn-post-share');

  let activeSharePlatform = 'x';
  let activeShareContext = 'general';

  if (hasWebShare) {
    if (btnDownloadCard) {
      updateButtonForSharing(btnDownloadCard, 'Share Card', 'Share Trend Card');
    }
    if (btnDownloadInfographic) {
      updateButtonForSharing(btnDownloadInfographic, 'Share Infographic', 'Share Infographic Card');
    }
    if (btnDownloadStreakReward) {
      updateButtonForSharing(btnDownloadStreakReward, 'Share Streak Card', 'Share Streak Card');
    }
  }



  // Slug generator helper
  function titleToSlug(title) {
    return title.toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-');
  }

  const UI_DICTIONARY = {
    en: {
      whatIsIt: "What is it?",
      takeaway: "The Takeaway",
      whyViral: "Why is it viral?",
      sentiment: "Community Sentiment",
      pollPrompt: "Is this trend actually genius, or is it totally overrated?",
      digDeeper: "Dig Deeper with AI",
      chatPlaceholder: "Type your question...",
      triviaStart: "Start Trivia Challenge",
      triviaProgress: (index, total) => `Question ${index} of ${total}`,
      triviaCorrect: "Correct! 🟩",
      triviaIncorrect: "Incorrect! 🟥",
      triviaNext: "Next Question",
      triviaResultsBtn: "See Results",
      triviaResultsTitle: "Challenge Completed!",
      triviaScore: (score, total) => `You scored ${score} out of ${total}`,
      triviaPlayAgain: "Play Again",
      triviaShareScore: "Share Score",
      triviaHeader: "Trivia Challenge"
    },
    es: {
      whatIsIt: "¿Qué es?",
      takeaway: "La Conclusión",
      whyViral: "¿Por qué es viral?",
      sentiment: "Sentimiento de la Comunidad",
      pollPrompt: "¿Este tema es una genialidad o está sobrevalorado?",
      digDeeper: "Profundizar con IA",
      chatPlaceholder: "Escribe tu pregunta...",
      triviaStart: "Comenzar Desafío de Trivia",
      triviaProgress: (index, total) => `Pregunta ${index} de ${total}`,
      triviaCorrect: "¡Correcto! 🟩",
      triviaIncorrect: "¡Incorrecto! 🟥",
      triviaNext: "Siguiente Pregunta",
      triviaResultsBtn: "Ver Resultados",
      triviaResultsTitle: "¡Desafío Completado!",
      triviaScore: (score, total) => `Tu puntuación es ${score} de ${total}`,
      triviaPlayAgain: "Jugar de Nuevo",
      triviaShareScore: "Compartir Puntuación",
      triviaHeader: "Desafío de Trivia"
    },
    fr: {
      whatIsIt: "Qu'est-ce que c'est ?",
      takeaway: "L'essentiel",
      whyViral: "Pourquoi est-ce viral ?",
      sentiment: "Sentiment de la communauté",
      pollPrompt: "Cette tendance est-elle géniale ou surfaite ?",
      digDeeper: "Approfondir avec l'IA",
      chatPlaceholder: "Posez votre question...",
      triviaStart: "Commencer le Défi Trivia",
      triviaProgress: (index, total) => `Question ${index} sur ${total}`,
      triviaCorrect: "Correct ! 🟩",
      triviaIncorrect: "Incorrect ! 🟥",
      triviaNext: "Question Suivante",
      triviaResultsBtn: "Voir les Résultats",
      triviaResultsTitle: "Défi Terminé !",
      triviaScore: (score, total) => `Votre score est de ${score} sur ${total}`,
      triviaPlayAgain: "Rejouer",
      triviaShareScore: "Partager le Score",
      triviaHeader: "Défi Trivia"
    },
    ja: {
      whatIsIt: "概要",
      takeaway: "要点",
      whyViral: "なぜバズっているのか？",
      sentiment: "コミュニティの反応",
      pollPrompt: "このトレンドは天才的ですか、それとも過大評価ですか？",
      digDeeper: "AIで深掘りする",
      chatPlaceholder: "質問を入力...",
      triviaStart: "トリビアチャレンジを開始",
      triviaProgress: (index, total) => `問題 ${index} / ${total}`,
      triviaCorrect: "正解！ 🟩",
      triviaIncorrect: "不正解！ 🟥",
      triviaNext: "次の問題",
      triviaResultsBtn: "結果を見る",
      triviaResultsTitle: "チャレンジ完了！",
      triviaScore: (score, total) => `${total}問中 ${score}問正解`,
      triviaPlayAgain: "もう一度プレイ",
      triviaShareScore: "スコアを共有",
      triviaHeader: "トリビアチャレンジ"
    }
  };

  function translateUI(lang) {
    const dict = UI_DICTIONARY[lang] || UI_DICTIONARY['en'];
    
    const labelWhat = document.getElementById('label-what');
    if (labelWhat) labelWhat.textContent = dict.whatIsIt;
    
    const labelTakeaway = document.getElementById('label-takeaway');
    if (labelTakeaway) labelTakeaway.textContent = dict.takeaway;
    
    const labelWhyViral = document.getElementById('label-why-viral');
    if (labelWhyViral) labelWhyViral.textContent = dict.whyViral;
    
    const labelSentiment = document.getElementById('label-sentiment');
    if (labelSentiment) labelSentiment.textContent = dict.sentiment;
    
    const pollPrompt = document.querySelector('.poll-prompt');
    if (pollPrompt) pollPrompt.textContent = dict.pollPrompt;
    
    const labelDigDeeper = document.getElementById('label-dig-deeper');
    if (labelDigDeeper) labelDigDeeper.textContent = dict.digDeeper;
    
    const chatInput = document.getElementById('chat-input');
    if (chatInput) chatInput.setAttribute('placeholder', dict.chatPlaceholder);

    // Trivia Translations
    const labelTriviaHeader = document.getElementById('trivia-header-label');
    if (labelTriviaHeader) labelTriviaHeader.textContent = dict.triviaHeader;

    const triviaIntro = triviaContainer ? triviaContainer.querySelector('.trivia-intro') : null;
    if (triviaIntro) {
      let introText = "Test your knowledge about this trend!";
      if (lang === 'es') introText = "¡Pon a prueba tus conocimientos sobre esta tendencia!";
      else if (lang === 'fr') introText = "Testez vos connaissances sur cette tendance !";
      else if (lang === 'ja') introText = "このトレンドに関する知識をテストしましょう！";
      triviaIntro.textContent = introText;
    }

    if (btnStartTrivia) btnStartTrivia.textContent = dict.triviaStart;
    if (btnPlayAgain) btnPlayAgain.textContent = dict.triviaPlayAgain;
    
    if (btnShareScore) {
      const svg = btnShareScore.querySelector('svg');
      btnShareScore.innerHTML = '';
      if (svg) btnShareScore.appendChild(svg);
      btnShareScore.appendChild(document.createTextNode(' ' + (dict.triviaShareScore || 'Share Score')));
    }

    // If gameplay is active, update active gameplay strings
    if (triviaQuestions && triviaQuestions.length > 0 && triviaGameplayScreen && !triviaGameplayScreen.classList.contains('hidden')) {
      const progressLabel = triviaGameplayScreen.querySelector('.trivia-progress');
      if (progressLabel) {
        const total = triviaQuestions.length;
        const progressIndex = currentQuestionIndex + 1;
        if (typeof dict.triviaProgress === 'function') {
          progressLabel.textContent = dict.triviaProgress(progressIndex, total);
        } else {
          progressLabel.textContent = `Question ${progressIndex} of ${total}`;
        }
      }

      if (isAnswerSelected) {
        const isCorrect = currentQuestionIndex < answerPattern.length && answerPattern[currentQuestionIndex] === '🟩';
        if (isCorrect) {
          triviaFeedback.textContent = dict.triviaCorrect || 'Correct! 🟩';
        } else {
          triviaFeedback.textContent = dict.triviaIncorrect || 'Incorrect! 🟥';
        }

        const isLastQuestion = currentQuestionIndex === triviaQuestions.length - 1;
        if (isLastQuestion) {
          triviaNavBtn.textContent = dict.triviaResultsBtn || 'See Results';
        } else {
          triviaNavBtn.textContent = dict.triviaNext || 'Next Question';
        }

        const correctQuestion = triviaQuestions[currentQuestionIndex];
        if (correctQuestion) {
          const correctOptionText = correctQuestion.options[correctQuestion.correctAnswer];
          let correctLabel = "Correct Answer";
          if (lang === 'es') correctLabel = "Respuesta Correcta";
          else if (lang === 'fr') correctLabel = "Réponse Correcte";
          else if (lang === 'ja') correctLabel = "正解";
          triviaCorrectAnswer.textContent = `${correctLabel}: ${correctOptionText}`;
        }
      }
    }

    // If results screen is active, update results strings
    if (triviaResultsScreen && !triviaResultsScreen.classList.contains('hidden')) {
      triviaResultsTitle.textContent = dict.triviaResultsTitle || 'Challenge Completed!';
      const total = triviaQuestions ? triviaQuestions.length : 3;
      if (typeof dict.triviaScore === 'function') {
        triviaResultsScore.textContent = dict.triviaScore(userScore, total);
      } else {
        triviaResultsScore.textContent = `You scored ${userScore} out of ${total}`;
      }
      updateTriviaMilestone(userScore);
    }
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

  if (preloadedData) {
    loadTimeline(preloadedData.trend);
  }

  // Parse path slug and language
  const pathParts = window.location.pathname.split('/');
  const urlSlug = (pathParts[1] === 't' && pathParts[2]) ? pathParts[2] : null;
  const urlLang = (pathParts[1] === 't' && pathParts[3]) ? pathParts[3] : null;

  let initialLang = 'en';
  if (preloadedData && preloadedData.lang) {
    initialLang = preloadedData.lang;
  } else if (urlLang) {
    initialLang = urlLang.replace('.md', '');
  } else {
    const params = new URLSearchParams(window.location.search);
    if (params.has('lang')) {
      initialLang = params.get('lang');
    }
  }

  const langSelect = document.getElementById('lang-select');
  if (langSelect) {
    langSelect.value = initialLang;
    langSelect.addEventListener('change', async (e) => {
      const selectedLang = e.target.value;
      translateUI(selectedLang);
      
      if (currentTrend) {
        const currentSlug = titleToSlug(currentTrend.title);
        const newUrl = selectedLang === 'en'
          ? window.location.origin + '/t/' + currentSlug
          : window.location.origin + '/t/' + currentSlug + '/' + selectedLang;
        
        window.history.pushState({ path: newUrl }, '', newUrl);
        
        // Fetch localized explanation using POST /api/explain
        try {
          const res = await fetch('/api/explain', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              trend: currentTrend.title,
              snippet: currentTrend.news ? currentTrend.news.snippet : '',
              headline: currentTrend.news ? currentTrend.news.headline : '',
              lang: selectedLang,
              bracket: localStorage.getItem('selected-demographic') || 'adults'
            })
          });
          
          if (!res.ok) throw new Error('API failed to explain');
          const data = await res.json();
          
          // Update details in DOM
          detailHook.textContent = data.hook;
          detailWhat.textContent = data.whatIsIt;
          detailTakeaway.textContent = data.takeaway;
          
          // Render viral tags
          detailViralTags.innerHTML = '';
          (data.whyIsItViral || []).forEach(reason => {
            const span = document.createElement('span');
            span.className = 'viral-tag';
            span.textContent = reason;
            detailViralTags.appendChild(span);
          });
          
          // Update SEO
          updateSEO(currentTrend, data);
        } catch (err) {
          console.error('Failed to load localized details:', err);
        }
      }
    });
  }
  translateUI(initialLang);

  // Track mouse movement for interactive ambient glow
  document.addEventListener('mousemove', (e) => {
    const x = (e.clientX / window.innerWidth) * 100;
    const y = (e.clientY / window.innerHeight) * 100;
    document.documentElement.style.setProperty('--glow-x', `${x}%`);
    document.documentElement.style.setProperty('--glow-y', `${y}%`);
  });

  // Helper to update unified social sharing preview card and check limitations
  function updatePreviewAndValidation() {
    const text = sharePreviewText.value || '';
    
    // Update live text preview
    const previewPostTexts = document.querySelectorAll('.preview-post-text');
    previewPostTexts.forEach(el => {
      el.textContent = text;
    });
    
    // Set active platform class on the preview card
    const previewCard = document.getElementById('share-card-preview');
    if (previewCard) {
      // Clear previous preview- classes
      previewCard.className = '';
      previewCard.classList.add(`preview-${activeSharePlatform}`);
    }

    // Set link card trend title
    const previewLinkTitle = document.getElementById('preview-link-title-text');
    if (previewLinkTitle && currentTrend) {
      previewLinkTitle.textContent = currentTrend.title;
    }

    // Pinterest specific handling: parse "Title: ..." and "Description: ..."
    const pinTitle = document.querySelector('.preview-pin-title');
    const pinDesc = document.querySelector('.preview-pin-desc');
    if (activeSharePlatform === 'pinterest') {
      let title = 'Pin Title';
      let desc = 'Pin Description';
      const titleMatch = text.match(/Title:\s*(.*)/i);
      const descMatch = text.match(/Description:\s*([\s\S]*)/i);
      if (titleMatch) {
        title = titleMatch[1].trim().split('\n')[0];
      }
      if (descMatch) {
        desc = descMatch[1].trim();
      }
      if (pinTitle) pinTitle.textContent = title;
      if (pinDesc) pinDesc.textContent = desc;
    }

    // Character counter
    const charCounter = document.getElementById('share-char-counter');
    const warningMsg = document.querySelector('.share-validation-warning');
    const length = text.length;

    if (charCounter) {
      if (activeSharePlatform === 'x') {
        charCounter.textContent = `${length} / 280`;
        if (length > 280) {
          charCounter.classList.add('error');
          charCounter.classList.add('warning');
          charCounter.classList.add('limit-exceeded');
          if (warningMsg) warningMsg.classList.remove('hidden');
          if (btnPostShare) {
            btnPostShare.disabled = true;
            btnPostShare.classList.add('disabled');
          }
        } else {
          charCounter.classList.remove('error', 'warning', 'limit-exceeded');
          if (warningMsg) warningMsg.classList.add('hidden');
          if (btnPostShare) {
            btnPostShare.disabled = false;
            btnPostShare.classList.remove('disabled');
          }
        }
      } else {
        charCounter.textContent = `${length}`;
        charCounter.classList.remove('error', 'warning', 'limit-exceeded');
        if (warningMsg) warningMsg.classList.add('hidden');
        if (btnPostShare) {
          btnPostShare.disabled = false;
          btnPostShare.classList.remove('disabled');
        }
      }
    }
  }

  if (sharePreviewText) {
    sharePreviewText.addEventListener('input', updatePreviewAndValidation);
  }

  // Generate social media post using backend API
  async function generatePost() {
    if (!currentTrend) return;
    sharePreviewText.value = 'Generating post...';
    updatePreviewAndValidation();
    try {
      const requestBody = {
        trendTitle: currentTrend.title,
        platform: activeSharePlatform,
        contextType: activeShareContext
      };
      if (activeShareContext === 'trivia') {
        requestBody.score = userScore;
        requestBody.pattern = answerPattern.join('');
      }
      const response = await fetch('/api/generate-post', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });
      if (!response.ok) {
        throw new Error('Failed to generate post');
      }
      const data = await response.json();
      if (sharePreviewText.value === 'Generating post...') {
        sharePreviewText.value = data.postText || '';
        updatePreviewAndValidation();
      }
    } catch (err) {
      console.error(err);
      if (sharePreviewText.value === 'Generating post...') {
        sharePreviewText.value = 'Error generating post. Please try again.';
        updatePreviewAndValidation();
      }
    }
  }

  // Open unified share modal
  function openShareModal(context) {
    if (!currentTrend) return;
    activeShareContext = context;
    shareContextSelect.value = context;
    
    // Set default/active platform pill state
    platformPills.forEach(pill => {
      if (pill.getAttribute('data-platform') === activeSharePlatform) {
        pill.classList.add('active');
      } else {
        pill.classList.remove('active');
      }
    });

    shareModal.classList.remove('hidden');
    generatePost();
  }

  // Close unified share modal
  function closeShareModal() {
    shareModal.classList.add('hidden');
  }

  // Bind new unified share buttons
  if (btnShareTrend) {
    btnShareTrend.addEventListener('click', () => openShareModal('general'));
  }
  if (btnSharePoll) {
    btnSharePoll.addEventListener('click', () => openShareModal('poll'));
  }

  if (btnCloseShareModal) {
    btnCloseShareModal.addEventListener('click', closeShareModal);
  }

  // Bind modal settings selectors
  if (shareContextSelect) {
    shareContextSelect.addEventListener('change', (e) => {
      activeShareContext = e.target.value;
      generatePost();
    });
  }

  platformPills.forEach(pill => {
    pill.addEventListener('click', () => {
      platformPills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      activeSharePlatform = pill.getAttribute('data-platform');
      generatePost();
    });
  });

  // Copy to clipboard
  if (btnCopyShare) {
    btnCopyShare.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(sharePreviewText.value);
        const originalText = btnCopyShare.textContent;
        btnCopyShare.textContent = 'Copied!';
        setTimeout(() => {
          btnCopyShare.textContent = originalText;
        }, 2000);
      } catch (err) {
        console.error('Failed to copy text:', err);
      }
    });
  }

  // Outbound sharing intent
  if (btnPostShare) {
    btnPostShare.addEventListener('click', () => {
      if (!currentTrend) return;
      const text = sharePreviewText.value;
      let shareUrl = '';
      if (activeSharePlatform === 'x') {
        shareUrl = `https://x.com/intent/tweet?text=${encodeURIComponent(text)}`;
      } else if (activeSharePlatform === 'linkedin') {
        shareUrl = `https://www.linkedin.com/shareArticle?mini=true&title=${encodeURIComponent(currentTrend.title)}&summary=${encodeURIComponent(text)}`;
      } else if (activeSharePlatform === 'facebook') {
        shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(window.location.href)}&quote=${encodeURIComponent(text)}`;
      } else if (activeSharePlatform === 'reddit') {
        shareUrl = `https://www.reddit.com/submit?title=${encodeURIComponent(currentTrend.title)}&text=${encodeURIComponent(text)}`;
      } else if (activeSharePlatform === 'pinterest') {
        const slug = titleToSlug(currentTrend.title);
        const url = `https://viraljacker.com/t/${slug}`;
        const media = `https://viraljacker.com/api/og/${slug}`;
        shareUrl = `https://www.pinterest.com/pin/create/button/?url=${encodeURIComponent(url)}&media=${encodeURIComponent(media)}&description=${encodeURIComponent(text)}`;
      } else {
        shareUrl = `https://x.com/intent/tweet?text=${encodeURIComponent(text)}`;
      }
      window.open(shareUrl, '_blank', 'noopener,noreferrer');
    });
  }

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

  // Close mobile sidebar drawer if open
  function closeMobileSidebar() {
    if (sidebarPanel && sidebarPanel.classList.contains('open')) {
      sidebarPanel.classList.remove('open');
      if (btnSidebarToggle) btnSidebarToggle.setAttribute('aria-expanded', 'false');
    }
    if (sidebarBackdrop && !sidebarBackdrop.classList.contains('hidden')) {
      sidebarBackdrop.classList.add('hidden');
    }
  }

  // Sidebar mobile drawer toggling
  if (btnSidebarToggle && sidebarBackdrop && sidebarPanel) {
    btnSidebarToggle.addEventListener('click', () => {
      const isOpen = sidebarPanel.classList.contains('open');
      if (isOpen) {
        sidebarPanel.classList.remove('open');
        sidebarBackdrop.classList.add('hidden');
        btnSidebarToggle.setAttribute('aria-expanded', 'false');
      } else {
        sidebarPanel.classList.add('open');
        sidebarBackdrop.classList.remove('hidden');
        btnSidebarToggle.setAttribute('aria-expanded', 'true');
      }
    });

    sidebarBackdrop.addEventListener('click', () => {
      closeMobileSidebar();
    });

    if (btnSidebarClose) {
      btnSidebarClose.addEventListener('click', () => {
        closeMobileSidebar();
      });
    }

    const searchInput = document.getElementById('trends-search');
    const filterTabs = document.querySelectorAll('.trends-filter-tabs .filter-tab');
    const showMoreBtn = document.getElementById('btn-show-more-trends');

    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        searchQuery = e.target.value;
        renderTrends();
      });
    }

    filterTabs.forEach(tab => {
      tab.addEventListener('click', (e) => {
        filterTabs.forEach(t => {
          t.classList.remove('active');
          t.style.background = 'rgba(255, 255, 255, 0.05)';
        });
        e.target.classList.add('active');
        e.target.style.background = 'var(--primary, #6366f1)';
        activeFilter = e.target.textContent.trim();
        renderTrends();
      });
    });

    if (showMoreBtn) {
      showMoreBtn.addEventListener('click', () => {
        showAllTrendsMobile = !showAllTrendsMobile;
        renderTrends();
      });
    }

    window.addEventListener('resize', () => {
      renderTrends();
    });
  }

  // Initialize: Load Trends
  fetchTrends();
  fetchAndRenderViralPosterHistory();

  async function fetchAndRenderViralPosterHistory() {
    const feed = document.getElementById('viral-poster-feed');
    if (!feed) return;
    try {
      const response = await fetch('/api/viral-poster/history');
      if (!response.ok) throw new Error('Failed to fetch history');
      const history = await response.json();
      feed.innerHTML = '';
      if (history.length === 0) {
        feed.innerHTML = '<p style="color: var(--text-muted-color, #a6adc8);">No posts simulated yet.</p>';
        return;
      }
      history.forEach(item => {
        const card = document.createElement('div');
        card.className = 'viral-post-card glass-card';
        card.style.padding = '10px';
        card.style.border = '1px solid rgba(255, 255, 255, 0.1)';
        card.style.borderRadius = '8px';
        card.style.display = 'flex';
        card.style.flexDirection = 'column';
        card.style.gap = '5px';

        card.innerHTML = `
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span class="platform-badge" style="font-weight: bold; text-transform: uppercase; font-size: 0.8rem; background: rgba(255,255,255,0.1); padding: 2px 6px; border-radius: 4px;">${item.platform}</span>
            <span class="timestamp" style="font-size: 0.8rem; color: var(--text-muted-color, #a6adc8);">${new Date(item.created_at).toLocaleString()}</span>
          </div>
          <div style="font-size: 0.9rem; color: var(--text-muted-color, #a6adc8); font-weight: bold; margin-top: 3px;">Trend: ${item.trend}</div>
          <div class="post-text" style="white-space: pre-wrap; font-size: 0.9rem; margin-top: 5px;">${item.post_text}</div>
        `;
        feed.appendChild(card);
      });
    } catch (err) {
      console.error('Error fetching history:', err);
      feed.innerHTML = '<p style="color: #f38ba8;">Error loading poster log.</p>';
    }
  }

  async function fetchTrends() {
    try {
      const res = await fetch('/api/trends');
      if (!res.ok) throw new Error('Failed to fetch trends');
      const trends = await res.json();
      
      allTrends = trends;
      
      // Hydrate trends list with preloaded item if not already present
      if (preloadedData && !allTrends.some(t => titleToSlug(t.title) === preloadedData.slug)) {
        allTrends.unshift({
          title: preloadedData.trend,
          traffic: 'Breakout',
          description: preloadedData.explanation.hook,
          news: { headline: '', snippet: '', url: '' }
        });
      }

      renderTrends();
    } catch (err) {
      console.error(err);
      trendsListContainer.innerHTML = `<p class="error-msg">Error loading live feeds. Please refresh.</p>`;
    }
  }

  function renderTrends(trends = allTrends) {
    trendsListContainer.innerHTML = '';
    
    // Apply filtering
    let filtered = [...trends];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(t => t.title.toLowerCase().includes(q) || (t.description && t.description.toLowerCase().includes(q)));
    }

    if (activeFilter.toLowerCase() !== 'all') {
      const filterLower = activeFilter.toLowerCase();
      filtered = filtered.filter(t => {
        const source = (t.source || 'google').toLowerCase();
        return source === filterLower;
      });
    }

    const showMoreBtn = document.getElementById('btn-show-more-trends');
    const isMobile = window.innerWidth <= 768;

    let displayTrends = [...filtered];
    if (isMobile && filtered.length > 6) {
      if (showMoreBtn) {
        showMoreBtn.style.setProperty('display', 'block', 'important');
      }
      if (!showAllTrendsMobile) {
        displayTrends = filtered.slice(0, 6);
        if (showMoreBtn) showMoreBtn.textContent = '+ Show More Trends';
      } else {
        if (showMoreBtn) showMoreBtn.textContent = '- Show Less Trends';
      }
    } else {
      if (showMoreBtn) {
        showMoreBtn.style.setProperty('display', 'none', 'important');
      }
    }

    if (displayTrends.length === 0) {
      trendsListContainer.innerHTML = '<p class="empty-msg">No current trends found.</p>';
      return;
    }

    let activeItem = null;

    displayTrends.forEach((trend, index) => {
      const a = document.createElement('a');
      a.className = 'trend-item';
      a.href = `/t/${titleToSlug(trend.title)}`;
      a.setAttribute('aria-current', 'false');

      const source = trend.source || 'google';
      const badgeClass = source === 'reddit' ? 'reddit-spike' : 'google-spike';
      const badgeLabel = source === 'reddit' ? 'Reddit Spike' : 'Google Search Spike';
      const sourceBadge = `<span class="source-badge ${badgeClass}">${badgeLabel}</span>`;

      let thumbnailHtml = '';
      const slug = titleToSlug(trend.title);
      if (trend.news && trend.news.ogImage) {
        thumbnailHtml = `
          <img class="trend-thumbnail" src="${trend.news.ogImage}" alt="${trend.title}" loading="lazy" onerror="if(!this.src.includes('/api/topic-image/')) { this.src = '/api/topic-image/${slug}'; } else { this.style.display='none'; this.nextElementSibling.style.display='block'; }" />
          <div class="trend-thumbnail-placeholder" style="display: none;"></div>
        `;
      } else {
        thumbnailHtml = `
          <img class="trend-thumbnail" src="/api/topic-image/${slug}" alt="${trend.title}" loading="lazy" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';" />
          <div class="trend-thumbnail-placeholder" style="display: none;"></div>
        `;
      }

      let faviconUrl = '';
      if (trend.news) {
        if (trend.news.favicon) {
          faviconUrl = trend.news.favicon;
        } else if (trend.news.url) {
          try {
            const parsedUrl = new URL(trend.news.url);
            faviconUrl = `https://www.google.com/s2/favicons?domain=${parsedUrl.hostname}&sz=32`;
          } catch (_) {}
        }
      }

      // Dynamic Category Emojis
      const titleText = trend.title.toLowerCase();
      let emoji = '🔥';
      if (titleText.includes('gemini') || titleText.includes('gpt-5') || titleText.includes('vision pro')) {
        emoji = '🤖';
      } else if (titleText.includes('bitcoin') || titleText.includes('stock') || titleText.includes('inflation')) {
        emoji = '📈';
      } else if (titleText.includes('playstation') || titleText.includes('elden ring')) {
        emoji = '🎮';
      }

      a.innerHTML = `
        ${thumbnailHtml}
        <div class="trend-item-info">
          <div style="display: flex; align-items: center; gap: 6px;">
            <span class="trend-category-emoji" style="font-size: 1.2rem;">${emoji}</span>
            <span class="trend-item-title">${trend.title}</span>
          </div>
          <div class="trend-meta-row" style="display: flex; align-items: center; gap: 6px;">
            ${faviconUrl ? `<img class="publisher-favicon" src="${faviconUrl}" alt="" onerror="this.style.display='none';" />` : ''}
            ${sourceBadge}
          </div>
          <span class="trend-item-desc">${trend.description || (trend.news && trend.news.headline) || 'Tap to investigate'}</span>
        </div>
        <span class="trend-item-traffic">${trend.traffic}</span>
      `;
      
      const clickHandler = (skipPush = false) => {
        if (!skipPush && a.classList.contains('active')) {
          const updateDOM = () => {
            closeMobileSidebar();
          };
          const useTransition = document.startViewTransition;
          if (useTransition) {
            document.startViewTransition(updateDOM);
          } else {
            updateDOM();
          }
          return;
        }
        const updateDOM = () => {
          document.querySelectorAll('.trend-item').forEach(el => {
            el.classList.remove('active');
            el.setAttribute('aria-current', 'false');
          });
          a.classList.add('active');
          a.setAttribute('aria-current', 'true');

          if (!skipPush) {
            const selectedLang = document.getElementById('lang-select')?.value || 'en';
            const newUrl = selectedLang === 'en'
              ? window.location.origin + '/t/' + titleToSlug(trend.title)
              : window.location.origin + '/t/' + titleToSlug(trend.title) + '/' + selectedLang;
            window.history.pushState({ path: newUrl }, '', newUrl);
          }
          
          loadTrendDetails(trend);
          closeMobileSidebar();
          window.scrollTo({ top: 0, behavior: 'instant' });
        };

        const useTransition = document.startViewTransition && !skipPush;
        if (useTransition) {
          document.startViewTransition(updateDOM);
        } else {
          updateDOM();
        }
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

    // On mobile viewports, if we are on the home page (no urlSlug) and have more than 6 trends, start with the sidebar open
    if (window.innerWidth <= 768 && !urlSlug && filtered.length > 6 && sidebarPanel) {
      sidebarPanel.classList.add('open');
      if (sidebarBackdrop) sidebarBackdrop.classList.remove('hidden');
      if (btnSidebarToggle) btnSidebarToggle.setAttribute('aria-expanded', 'true');
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
    const loadId = ++activeLoadId;
    currentTrend = trend;
    chatMessages = [];
    hasVotedCurrent = false;
    userPollVote = null;
    
    // Smooth fade transition
    explainerView.classList.add('hidden');
    welcomeView.classList.add('hidden');
    if (explainerSkeleton) explainerSkeleton.classList.remove('hidden');
    
    try {
      let data;
      // Hydrate explanation if preloadedData matches
      const currentDemo = localStorage.getItem('selected-demographic') || 'adults';
      if (preloadedData && preloadedData.slug === titleToSlug(trend.title) && currentDemo === 'adults' && !navigator.webdriver) {
        data = preloadedData.explanation;
        preloadedData = null; // Clear to allow future live fetches
      } else {
        const selectedLang = document.getElementById('lang-select')?.value || 'en';
        const res = await fetch('/api/explain', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            trend: trend.title,
            snippet: trend.news ? trend.news.snippet : '',
            headline: trend.news ? trend.news.headline : '',
            lang: selectedLang,
            bracket: currentDemo
          })
        });
        
        if (!res.ok) throw new Error('API failed to explain');
        data = await res.json();
      }
      
      if (loadId !== activeLoadId) return;
      
      // Populate Details
      const heroImg = document.getElementById('detail-hero-image');
      const heroContainer = document.getElementById('detail-hero-container');
      const heroGradient = heroContainer ? heroContainer.querySelector('.detail-hero-gradient') : null;
      if (heroImg) {
        const slug = titleToSlug(trend.title);
        if (trend.news && trend.news.ogImage) {
          heroImg.src = trend.news.ogImage;
          heroImg.style.display = 'block';
          if (heroGradient) heroGradient.style.display = 'none';
          heroImg.onerror = () => {
            if (!heroImg.src.includes('/api/topic-image/')) {
              heroImg.src = `/api/topic-image/${slug}`;
              heroImg.style.display = 'block';
              if (heroGradient) heroGradient.style.display = 'none';
            } else {
              heroImg.style.display = 'none';
              if (heroGradient) heroGradient.style.display = 'block';
            }
          };
        } else {
          heroImg.src = `/api/topic-image/${slug}`;
          heroImg.style.display = 'block';
          if (heroGradient) heroGradient.style.display = 'none';
          heroImg.onerror = () => {
            heroImg.style.display = 'none';
            if (heroGradient) heroGradient.style.display = 'block';
          };
        }
      }

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

      // Load sentiment timeline
      loadTimeline(trend.title);

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
      checkChatLimit(trend.title);

      // Populate Viral Vibe Card properties based on trend category meta
      const meta = getTrendCategoryMeta(trend.title);
      if (vibeEmoji) vibeEmoji.textContent = meta.emoji;
      if (vibeCategory) vibeCategory.textContent = meta.category;
      if (vibeBadge) vibeBadge.textContent = meta.badge;
      if (cardViralVibe) {
        cardViralVibe.style.background = meta.gradient;
      }

      // News Footer
      if (trend.news && trend.news.headline) {
        const newsPublisher = document.getElementById('detail-news-publisher');
        const newsSeparator = document.getElementById('detail-news-separator');
        if (newsPublisher) {
          newsPublisher.textContent = trend.news.source || '';
          if (newsSeparator) {
            newsSeparator.style.display = trend.news.source ? 'inline' : 'none';
          }
        }
        newsTitle.textContent = trend.news.headline;
        newsSnippet.textContent = trend.news.snippet || 'No snippet available.';
        newsLink.href = trend.news.url || '#';

        const blockquote = document.querySelector('.news-footer-card blockquote');
        if (blockquote) {
          blockquote.setAttribute('cite', trend.news.url || '');
        }

        const footerFaviconImg = document.getElementById('footer-favicon-img');
        const footerGenericSvg = document.querySelector('.news-icon svg.lucide-newspaper');

        let footerFaviconUrl = '';
        if (trend.news.favicon) {
          footerFaviconUrl = trend.news.favicon;
        } else if (trend.news.url) {
          try {
            const parsedUrl = new URL(trend.news.url);
            footerFaviconUrl = `https://www.google.com/s2/favicons?domain=${parsedUrl.hostname}&sz=32`;
          } catch (_) {}
        }

        if (footerFaviconUrl && footerFaviconImg && footerGenericSvg) {
          footerFaviconImg.src = footerFaviconUrl;
          footerFaviconImg.style.display = 'block';
          footerGenericSvg.style.display = 'none';
          footerFaviconImg.onerror = () => {
            footerFaviconImg.style.display = 'none';
            if (footerGenericSvg) footerGenericSvg.style.display = 'block';
          };
        } else if (footerFaviconImg && footerGenericSvg) {
          footerFaviconImg.src = '';
          footerFaviconImg.removeAttribute('src');
          footerFaviconImg.style.display = 'none';
          footerGenericSvg.style.display = 'block';
          footerFaviconImg.onerror = null;
        }

        document.querySelector('.news-footer-card').classList.remove('hidden');
      } else {
        document.querySelector('.news-footer-card').classList.add('hidden');
      }
      
       if (explainerSkeleton) explainerSkeleton.classList.add('hidden');
      explainerView.classList.remove('hidden');
      if (timelineCanvas) {
        timelineCanvas.scrollIntoView({ behavior: 'instant', block: 'center' });
      }
      resetTrivia(trend);
    } catch (err) {
      if (loadId !== activeLoadId) return;
      console.error(err);
      if (explainerSkeleton) explainerSkeleton.classList.add('hidden');
      welcomeView.classList.remove('hidden');
      alert('Had trouble generating AI explanation. Please try again.');
    }
  }

  // Poll Vote Logic
  btnGenius.addEventListener('click', () => submitVote('genius'));
  btnOverrated.addEventListener('click', () => submitVote('overrated'));
  btnDownloadCard.addEventListener('click', generateTrendCardImage);
  if (btnDownloadInfographic) {
    btnDownloadInfographic.addEventListener('click', generateInfographicCard);
  }
  if (btnDownloadStreakReward) {
    btnDownloadStreakReward.addEventListener('click', generateStreakRewardCardImage);
  }

  // Trivia Click Listeners
  if (btnStartTrivia) btnStartTrivia.addEventListener('click', startTrivia);
  if (triviaNavBtn) triviaNavBtn.addEventListener('click', handleTriviaNavigation);
  if (btnPlayAgain) btnPlayAgain.addEventListener('click', () => resetTrivia(currentTrend));

  const btnSaveNickname = document.getElementById('btn-save-nickname');
  const nicknameInput = document.getElementById('nickname-input');
  const nicknameStatus = document.getElementById('nickname-status');

  if (btnSaveNickname && nicknameInput) {
    const savedNick = localStorage.getItem('trivia-nickname') || '';
    nicknameInput.value = savedNick;

    btnSaveNickname.addEventListener('click', () => {
      const nickname = nicknameInput.value.trim();
      if (!nickname || nickname.length > 15) {
        if (nicknameStatus) {
          nicknameStatus.textContent = 'Nickname must be 1-15 characters.';
          nicknameStatus.className = 'error';
        }
        return;
      }

      fetch('/api/trivia/nickname', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: localClientId,
          nickname: nickname
        })
      })
      .then(res => {
        if (!res.ok) throw new Error('Failed to save nickname');
        return res.json();
      })
      .then(data => {
        localStorage.setItem('trivia-nickname', data.nickname);
        if (nicknameStatus) {
          nicknameStatus.textContent = 'Nickname saved!';
          nicknameStatus.className = 'success';
        }
        if (currentTrend) {
          fetchAndRenderLeaderboard(currentTrend.title, '.trivia-results-screen');
        }
      })
      .catch(err => {
        console.error('Error saving nickname:', err);
        if (nicknameStatus) {
          nicknameStatus.textContent = 'Failed to save nickname.';
          nicknameStatus.className = 'error';
        }
      });
    });
  }
  const btnReturnToChat = document.getElementById('btn-return-to-chat');
  if (btnReturnToChat) {
    btnReturnToChat.addEventListener('click', () => {
      const chatHistory = document.getElementById('chat-history');
      if (chatHistory) {
        chatHistory.scrollIntoView({ behavior: 'smooth' });
      }
    });
  }
  if (btnShareScore) {
    btnShareScore.addEventListener('click', async () => {
      if (!currentTrend || triviaQuestions.length === 0) return;

      const slug = titleToSlug(currentTrend.title);
      const trendLink = `${window.location.origin}/t/${slug}`;
      const emojiGrid = answerPattern.join('');
      const scoreCardText = `TrendJacker Trivia Challenge: ${currentTrend.title}\nScore: ${userScore} out of ${triviaQuestions.length}\n${emojiGrid}\nPlay here: ${trendLink}`;

      try {
        await navigator.clipboard.writeText(scoreCardText);
        const lang = document.getElementById('lang-select')?.value || 'en';
        const dict = UI_DICTIONARY[lang] || UI_DICTIONARY['en'];
        const originalText = dict.triviaShareScore || 'Share Score';
        const svg = btnShareScore.querySelector('svg');
        
        btnShareScore.innerHTML = '';
        if (svg) btnShareScore.appendChild(svg);
        btnShareScore.appendChild(document.createTextNode(' Copied!'));
        
        setTimeout(() => {
          btnShareScore.innerHTML = '';
          if (svg) btnShareScore.appendChild(svg);
          btnShareScore.appendChild(document.createTextNode(' ' + originalText.trim()));
        }, 2000);
      } catch (err) {
        console.error('Failed to copy to clipboard:', err);
      }

      openShareModal('trivia');
    });
  }

  const customTextElInit = document.getElementById('info-custom-text-input');
  if (customTextElInit) {
    customTextElInit.addEventListener('focus', () => {
      customTextElInit.maxLength = 500;
    });
    customTextElInit.addEventListener('blur', () => {
      customTextElInit.maxLength = 60;
    });
  }

  async function generateTrendCardImage() {
    if (!currentTrend) return;
    
    // Ensure custom fonts are loaded before drawing
    await document.fonts.ready;

    const canvas = document.createElement('canvas');
    canvas.width = 2400;
    canvas.height = 1260;
    const ctx = canvas.getContext('2d');
    ctx.scale(2, 2);

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
    const hookText = detailHook.textContent || "";
    let hookFontSize = 20;
    let hookLineHeight = 32;
    let hookBoxHeight = 0;
    let lastHookTextY = 0;
    const hookHeaderY = 225;
    const hookBoxY = 240;
    const hookTextStartY = 275;

    let sentimentHeaderY = 0;
    let pollBarY = 0;
    let labelsY = 0;

    while (hookFontSize >= 12) {
      ctx.font = `500 ${hookFontSize}px 'Plus Jakarta Sans', sans-serif`;
      lastHookTextY = wrapText(ctx, hookText, 110, hookTextStartY, 980, hookLineHeight, true);
      const tempHeight = (lastHookTextY - hookTextStartY) + 80;
      hookBoxHeight = Math.max(120, tempHeight);
      
      const hookBoxBottom = hookBoxY + hookBoxHeight;
      sentimentHeaderY = hookBoxBottom + 50;
      pollBarY = sentimentHeaderY + 20;
      labelsY = pollBarY + 55;

      if (labelsY <= 540) {
        break; // Fits!
      }
      if (hookFontSize === 12) {
        break; // Cannot reduce further, cap the height
      }

      // Reduce
      hookFontSize -= 1;
      hookLineHeight = Math.round(19 + (hookFontSize - 12) * 1.625);
    }

    if (labelsY > 540) {
      labelsY = 540;
      pollBarY = 485;
      sentimentHeaderY = 465;
      hookBoxHeight = 415 - hookBoxY;
    }

    ctx.font = "bold 15px 'Space Grotesk', sans-serif";
    ctx.fillStyle = "#6366f1";
    ctx.fillText("THE AI HOOK", 80, hookHeaderY);

    // Hook background box
    ctx.fillStyle = "rgba(99, 102, 241, 0.04)";
    ctx.fillRect(80, hookBoxY, 1040, hookBoxHeight);
    
    ctx.fillStyle = "#6366f1";
    ctx.fillRect(80, hookBoxY, 6, hookBoxHeight);

    // Wrap hook text
    ctx.font = `500 ${hookFontSize}px 'Plus Jakarta Sans', sans-serif`;
    ctx.fillStyle = "#cbd5e1";
    wrapText(ctx, hookText, 110, hookTextStartY, 980, hookLineHeight, false);

    // 6. Sentiment Poll Section
    ctx.font = "bold 15px 'Space Grotesk', sans-serif";
    ctx.fillStyle = "#cbd5e1";
    ctx.fillText("COMMUNITY SENTIMENT", 80, sentimentHeaderY);

    // Get percentages
    const geniusText = pctGenius.textContent || '50%';
    const overratedText = pctOverrated.textContent || '50%';
    const geniusVal = parseInt(geniusText) || 50;
    const overratedVal = parseInt(overratedText) || 50;

    const barWidth = 1040;
    const barHeight = 16;
    const barX = 80;

    // Draw background track
    ctx.fillStyle = "#1e293b";
    ctx.beginPath();
    ctx.roundRect(barX, pollBarY, barWidth, barHeight, 8);
    ctx.fill();

    // Draw Genius (Emerald) section
    const gWidth = (geniusVal / 100) * barWidth;
    if (gWidth > 0) {
      ctx.fillStyle = "#10b981";
      ctx.beginPath();
      ctx.roundRect(barX, pollBarY, gWidth, barHeight, [8, gWidth === barWidth ? 8 : 0, gWidth === barWidth ? 8 : 0, 8]);
      ctx.fill();
    }

    // Draw Overrated (Rose) section
    const oWidth = (overratedVal / 100) * barWidth;
    if (oWidth > 0) {
      ctx.fillStyle = "#f43f5e";
      ctx.beginPath();
      const oX = barX + gWidth;
      ctx.roundRect(oX, pollBarY, oWidth, barHeight, [gWidth === 0 ? 8 : 0, 8, 8, gWidth === 0 ? 8 : 0]);
      ctx.fill();
    }

    // Labels under bar
    ctx.font = "bold 22px 'Space Grotesk', sans-serif";
    ctx.fillStyle = "#10b981";
    ctx.fillText(`Genius: ${geniusVal}%`, 80, labelsY);

    ctx.textAlign = "right";
    ctx.fillStyle = "#f43f5e";
    ctx.fillText(`Overrated: ${overratedVal}%`, 1120, labelsY);
    ctx.textAlign = "left"; // Reset

    // 7. Footer Call To Action
    ctx.font = "500 15px 'Plus Jakarta Sans', sans-serif";
    ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
    ctx.fillText("Vote live and investigate trends at viraljacker.com", 80, 560);

    // Write layout telemetry to window
    window.__canvasLayouts = window.__canvasLayouts || {};
    window.__canvasLayouts.trendCard = {
      hookHeaderY,
      hookBoxY,
      hookBoxHeight,
      lastHookTextY,
      hookFontSize
    };

    // Trigger image share or download
    const filename = `trend-card-${titleToSlug(currentTrend.title)}.png`;
    const title = `TrendJacker — ${currentTrend.title}`;
    const text = `Check out the viral trend explainer and vote on whether "${currentTrend.title}" is overrated or genius!`;
    const fallbackUrl = window.location.origin + '/t/' + titleToSlug(currentTrend.title);

    await shareOrDownloadCanvas(canvas, filename, title, text, fallbackUrl);
  }

  async function generateInfographicCard() {
    if (!currentTrend) return;
    
    // Ensure custom fonts are loaded before drawing
    await document.fonts.ready;

    const canvas = document.createElement('canvas');
    canvas.width = 2400;
    canvas.height = 1260;
    const ctx = canvas.getContext('2d');
    ctx.scale(2, 2);

    // 1. Background Gradient (Theme Customization)
    const themeSelectEl = document.getElementById('info-theme-select');
    const selectedTheme = themeSelectEl ? themeSelectEl.value : 'midnight';

    let bgStart = '#0f1225', bgEnd = '#05070f';
    let borderStart = '#6366f1', borderEnd = '#06b6d4';

    if (selectedTheme === 'cyberpunk') {
      bgStart = '#1e0b36';
      bgEnd = '#0b0214';
      borderStart = '#ec4899';
      borderEnd = '#eab308';
    } else if (selectedTheme === 'sunset') {
      bgStart = '#2a0845';
      bgEnd = '#6441a5';
      borderStart = '#ff7e5f';
      borderEnd = '#feb47b';
    } else if (selectedTheme === 'forest') {
      bgStart = '#064e3b';
      bgEnd = '#022c22';
      borderStart = '#10b981';
      borderEnd = '#059669';
    }

    const bgGrad = ctx.createLinearGradient(0, 0, 1200, 630);
    bgGrad.addColorStop(0, bgStart);
    bgGrad.addColorStop(1, bgEnd);
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, 1200, 630);

    // 2. Glowing Neon Border Accent
    const borderGrad = ctx.createLinearGradient(0, 0, 1200, 630);
    borderGrad.addColorStop(0, borderStart);
    borderGrad.addColorStop(0.5, borderEnd);
    borderGrad.addColorStop(1, borderStart);
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

    // Custom Sticker / Badge Overlay Drawing (AC-3)
    const badgeSelectEl = document.getElementById('info-overlay-badge-select');
    const selectedBadge = badgeSelectEl ? badgeSelectEl.value : 'none';

    if (selectedBadge && selectedBadge !== 'none') {
      let badgeLabel = '';
      let badgeBg = '';
      let badgeBorder = '';
      let badgeTextCol = '#ffffff';

      if (selectedBadge === 'hot-take') {
        badgeLabel = 'HOT TAKE';
        badgeBg = 'rgba(239, 68, 68, 0.2)';
        badgeBorder = 'rgba(239, 68, 68, 0.5)';
        badgeTextCol = '#ef4444';
      } else if (selectedBadge === 'trending') {
        badgeLabel = 'TRENDING';
        badgeBg = 'rgba(245, 158, 11, 0.2)';
        badgeBorder = 'rgba(245, 158, 11, 0.5)';
        badgeTextCol = '#f59e0b';
      } else if (selectedBadge === 'viral') {
        badgeLabel = 'VIRAL';
        badgeBg = 'rgba(236, 72, 153, 0.2)';
        badgeBorder = 'rgba(236, 72, 153, 0.5)';
        badgeTextCol = '#ec4899';
      }

      ctx.fillStyle = badgeBg;
      ctx.fillRect(980, 56, 140, 32);
      ctx.lineWidth = 1;
      ctx.strokeStyle = badgeBorder;
      ctx.strokeRect(980, 56, 140, 32);

      ctx.font = "bold 13px 'Space Grotesk', sans-serif";
      ctx.fillStyle = badgeTextCol;
      ctx.textAlign = "center";
      ctx.fillText(badgeLabel, 1050, 76);
      ctx.textAlign = "left"; // Reset alignment
    } else {
      // Default Live Badge
      ctx.fillStyle = "rgba(99, 102, 241, 0.1)";
      ctx.fillRect(980, 56, 140, 32);
      ctx.lineWidth = 1;
      ctx.strokeStyle = "rgba(99, 102, 241, 0.3)";
      ctx.strokeRect(980, 56, 140, 32);

      ctx.font = "bold 13px 'Space Grotesk', sans-serif";
      ctx.fillStyle = "#6366f1";
      ctx.textAlign = "center";
      ctx.fillText("INFOGRAPHIC CARD", 1050, 76);
      ctx.textAlign = "left"; // Reset alignment
    }

    // 4. Trend Header Title
    ctx.font = "bold 56px 'Space Grotesk', sans-serif";
    ctx.fillStyle = "#ffffff";
    ctx.fillText(currentTrend.title, 80, 165);

    // 5. Category Vibe Badge (Filled with trend category gradient)
    const meta = getTrendCategoryMeta(currentTrend.title);
    ctx.font = "bold 16px 'Plus Jakarta Sans', sans-serif";
    const badgeText = `${meta.emoji}  ${meta.category} • ${meta.badge}`;
    const badgeWidth = ctx.measureText(badgeText).width + 30;
    
    // Draw rounded badge background
    const gradientParts = meta.gradient.match(/#[0-9a-fA-F]{6}/g);
    let badgeGrad = meta.gradient;
    if (gradientParts && gradientParts.length >= 2) {
      badgeGrad = ctx.createLinearGradient(80, 0, 80 + badgeWidth, 0);
      badgeGrad.addColorStop(0, gradientParts[0]);
      badgeGrad.addColorStop(1, gradientParts[1]);
    } else {
      badgeGrad = '#6366f1';
    }
    
    ctx.fillStyle = badgeGrad;
    ctx.beginPath();
    ctx.roundRect(80, 195, badgeWidth, 36, 18);
    ctx.fill();

    ctx.fillStyle = "#ffffff";
    ctx.fillText(badgeText, 95, 219);

    // Custom Subtitle Render & Word Wrap (AC-4)
    const customTextEl = document.getElementById('info-custom-text-input');
    const customText = customTextEl ? customTextEl.value.trim() : '';

    let hookHeaderY = 275;
    let subtitleLines = undefined;

    if (customText) {
      ctx.font = "italic 18px 'Plus Jakarta Sans', sans-serif";
      ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
      
      // Draw subtitle
      const subtitleBottomY = wrapText(ctx, customText, 80, 255, 640, 24, false);
      
      // Calculate layout positions
      hookHeaderY = subtitleBottomY + 65;
      subtitleLines = Math.round((subtitleBottomY - 255) / 24) + 1;
    }

    // 6. Hook Section (Left Side)
    ctx.font = "bold 14px 'Space Grotesk', sans-serif";
    ctx.fillStyle = "#6366f1";
    ctx.fillText("THE AI HOOK", 80, hookHeaderY);

    const hookText = detailHook.textContent || "";
    let hookFontSize = 18;
    let hookLineHeight = 28;
    let hookBoxHeight = 0;
    let lastHookTextY = 0;
    const hookTextStartY = hookHeaderY + 55;
    const hookBoxY = hookHeaderY + 15;

    while (hookFontSize >= 12) {
      ctx.font = `500 ${hookFontSize}px 'Plus Jakarta Sans', sans-serif`;
      lastHookTextY = wrapText(ctx, hookText, 110, hookTextStartY, 580, hookLineHeight, true);
      const tempHeight = (lastHookTextY - hookTextStartY) + 80;
      hookBoxHeight = Math.max(120, tempHeight);
      
      if (hookBoxY + hookBoxHeight <= 540) {
        break; // Fits!
      }
      if (hookFontSize === 12) {
        break; // Cannot reduce further, cap the height
      }
      
      // Reduce
      hookFontSize -= 1;
      hookLineHeight = Math.round(19 + (hookFontSize - 12) * 1.5);
    }
    
    // If it still exceeds at 12px, cap the box height
    if (hookBoxY + hookBoxHeight > 540) {
      hookBoxHeight = 540 - hookBoxY;
    }

    // Hook background box
    ctx.fillStyle = "rgba(255, 255, 255, 0.02)";
    ctx.beginPath();
    ctx.roundRect(80, hookBoxY, 640, hookBoxHeight, 8);
    ctx.fill();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
    ctx.stroke();
    
    // Vertical left accent line
    ctx.fillStyle = "#6366f1";
    ctx.fillRect(80, hookBoxY, 6, hookBoxHeight);

    // Wrap hook text
    ctx.font = `500 ${hookFontSize}px 'Plus Jakarta Sans', sans-serif`;
    ctx.fillStyle = "#cbd5e1";
    wrapText(ctx, hookText, 110, hookTextStartY, 580, hookLineHeight, false);

    // Write layout telemetry to window
    window.__canvasLayouts = window.__canvasLayouts || {};
    window.__canvasLayouts.infographic = {
      subtitleLines,
      hookHeaderY,
      hookBoxY,
      hookBoxHeight,
      lastHookTextY,
      hookFontSize
    };

    // 7. Live Sentiment Gauge (Right Side)
    const geniusText = pctGenius.textContent || '50%';
    const overratedText = pctOverrated.textContent || '50%';
    const geniusVal = parseInt(geniusText) || 50;
    const overratedVal = parseInt(overratedText) || 50;

    const gaugeX = 930;
    const gaugeY = 380;
    const gaugeRadius = 80;

    // Draw Gauge Track
    ctx.strokeStyle = "#1e293b";
    ctx.lineWidth = 16;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.arc(gaugeX, gaugeY, gaugeRadius, 0, 2 * Math.PI);
    ctx.stroke();

    // Draw Genius Arc
    const startAngle = -Math.PI / 2;
    const geniusArcLength = (geniusVal / 100) * 2 * Math.PI;
    ctx.strokeStyle = "#10b981";
    ctx.beginPath();
    ctx.arc(gaugeX, gaugeY, gaugeRadius, startAngle, startAngle + geniusArcLength);
    ctx.stroke();

    // Draw Overrated Arc
    if (overratedVal > 0) {
      ctx.strokeStyle = "#f43f5e";
      ctx.beginPath();
      ctx.arc(gaugeX, gaugeY, gaugeRadius, startAngle + geniusArcLength, startAngle + 2 * Math.PI);
      ctx.stroke();
    }

    // Inside Gauge Text
    ctx.textAlign = "center";
    ctx.font = "bold 38px 'Space Grotesk', sans-serif";
    ctx.fillStyle = "#ffffff";
    ctx.fillText(`${geniusVal}%`, gaugeX, gaugeY + 6);

    ctx.font = "bold 11px 'Space Grotesk', sans-serif";
    ctx.fillStyle = "#10b981";
    ctx.fillText("GENIUS", gaugeX, gaugeY + 26);
    ctx.textAlign = "left"; // Reset

    // Sentiment Labels under gauge
    ctx.font = "bold 15px 'Space Grotesk', sans-serif";
    ctx.fillStyle = "#10b981";
    ctx.fillText(`● Genius: ${geniusVal}%`, 810, 505);

    ctx.fillStyle = "#f43f5e";
    ctx.fillText(`● Overrated: ${overratedVal}%`, 970, 505);

    // 8. Footer Call To Action
    ctx.font = "500 15px 'Plus Jakarta Sans', sans-serif";
    ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
    ctx.fillText("Vote live and track trends at viraljacker.com", 80, 560);

    // Trigger image share or download
    const filename = `infographic-${titleToSlug(currentTrend.title)}.png`;
    const title = `TrendJacker — ${currentTrend.title} Infographic`;
    const text = `Check out the infographic representation and vote on whether "${currentTrend.title}" is overrated or genius!`;
    const fallbackUrl = window.location.origin + '/t/' + titleToSlug(currentTrend.title);

    await shareOrDownloadCanvas(canvas, filename, title, text, fallbackUrl);
  }

  async function generateStreakRewardCardImage() {
    await document.fonts.ready;

    const canvas = document.createElement('canvas');
    canvas.width = 2400;
    canvas.height = 1260;
    const ctx = canvas.getContext('2d');
    ctx.scale(2, 2);

    const streakCount = currentStreakCount || 0;
    const streakBonus = currentStreakBonus || (streakCount * 2);
    const nickname = localStorage.getItem('trivia-nickname') || 'Anonymous Jacker';

    let bgStart = '#f97316', bgEnd = '#ef4444';
    let milestoneName = 'Consistent Jacker 🔥';

    if (streakCount >= 15) {
      bgStart = '#1e1b4b';
      bgEnd = '#06b6d4';
      milestoneName = 'Trend Overlord 🌌';
    } else if (streakCount >= 7) {
      bgStart = '#7c3aed';
      bgEnd = '#db2777';
      milestoneName = 'Weekly Legend 👑';
    }

    const bgGrad = ctx.createLinearGradient(0, 0, 1200, 630);
    bgGrad.addColorStop(0, bgStart);
    bgGrad.addColorStop(1, bgEnd);
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, 1200, 630);

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 8;
    ctx.strokeRect(20, 20, 1160, 590);

    ctx.font = "bold 36px 'Space Grotesk', sans-serif";
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.fillText("TrendJacker Daily Streak Milestone", 600, 120);

    ctx.font = "bold 48px 'Space Grotesk', sans-serif";
    ctx.fillText(milestoneName, 600, 230);

    ctx.font = "italic 32px 'Space Grotesk', sans-serif";
    ctx.fillText(nickname, 600, 310);

    ctx.font = "bold 56px 'Space Grotesk', sans-serif";
    ctx.fillText(`${streakCount}-Day Streak Active!`, 600, 410);

    ctx.font = "bold 32px 'Space Grotesk', sans-serif";
    ctx.fillText(`Unlocked +${streakBonus} Message Capacity`, 600, 480);

    ctx.font = "24px 'Space Grotesk', sans-serif";
    ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
    ctx.fillText("Build your streak at viraljacker.com", 600, 560);

    const filename = `streak-reward-card-${streakCount}-day.png`;
    const shareTitle = `My ${streakCount}-Day Streak on TrendJacker`;
    const shareText = `I have a ${streakCount}-day streak on TrendJacker! Unlocked +${streakBonus} message capacity.`;
    const fallbackUrl = window.location.origin;

    await shareOrDownloadCanvas(canvas, filename, shareTitle, shareText, fallbackUrl);
  }

  function wrapText(ctx, text, x, y, maxWidth, lineHeight, dryRun = false) {
    const words = text.split(' ');
    let line = '';
    let currentY = y;

    for (let n = 0; n < words.length; n++) {
      const testLine = line + words[n] + ' ';
      const metrics = ctx.measureText(testLine);
      const testWidth = metrics.width;
      if (testWidth > maxWidth && n > 0) {
        if (!dryRun) {
          ctx.fillText(line, x, currentY);
        }
        line = words[n] + ' ';
        currentY += lineHeight;
      } else {
        line = testLine;
      }
    }
    if (!dryRun) {
      ctx.fillText(line, x, currentY);
    }
    return currentY;
  }
  window.wrapText = wrapText;

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
          vote: choice,
          location: localLocation,
          clientId: localClientId
        })
      });
      
      if (!res.ok) throw new Error('Failed to record vote');
      const newVotes = await res.json();
      
      updatePollPercentages(newVotes);
      
      // Reload timeline to include the new vote
      loadTimeline(currentTrend.title);
      
      // Visual transition to results page
      document.querySelector('.poll-prompt').classList.add('hidden');
      document.querySelector('.poll-buttons').classList.add('hidden');
      pollResults.classList.remove('hidden');
      hasVotedCurrent = true;
      userPollVote = choice;
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

    // Sync Live Sentiment radial gauge
    updateSentimentGauge(geniusPct);

    if (geniusChanged) {
      pctGenius.classList.add('pulse-text');
      setTimeout(() => pctGenius.classList.remove('pulse-text'), 800);
    }
    if (overratedChanged) {
      pctOverrated.classList.add('pulse-text');
      setTimeout(() => pctOverrated.classList.remove('pulse-text'), 800);
    }
  }



  let currentStreakCount = 0;
  let currentStreakBonus = 0;
  let lastAllowedLimit = 3;
  let lastCurrentCount = 0;

  function getLocalDateString() {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function updateLimitAndStreakUI(data) {
    const chatLockContainer = document.getElementById('chat-lock-container');
    const chatForm = document.getElementById('chat-form');
    const chatLimitDisplay = document.getElementById('chat-limit-display');
    const referralShareLink = document.getElementById('referral-share-link');
    const fillEl = document.getElementById('chat-capacity-fill');
    const textEl = document.getElementById('chat-capacity-text');
    const streakBadgeCount = document.getElementById('streak-badge-count');
    const streakBadgeBonus = document.getElementById('streak-badge-bonus');
    const streakBadgeContainer = document.getElementById('streak-badge-container');

    const allowedLimit = data.allowedLimit !== undefined ? data.allowedLimit : lastAllowedLimit;
    const currentCount = data.currentCount !== undefined ? data.currentCount : lastCurrentCount;
    const streakCount = data.streakCount !== undefined ? data.streakCount : currentStreakCount;
    const streakBonus = data.streakBonus !== undefined ? data.streakBonus : (streakCount * 2);

    lastAllowedLimit = allowedLimit;
    lastCurrentCount = currentCount;
    currentStreakCount = streakCount;
    currentStreakBonus = streakBonus;

    // 1. Update Capacity Bar
    const percentage = allowedLimit > 0 ? (currentCount / allowedLimit) * 100 : 0;
    if (fillEl) {
      fillEl.style.width = `${Math.min(percentage, 100)}%`;
      fillEl.classList.remove('capacity-green', 'capacity-orange', 'capacity-red');
      if (percentage < 50) {
        fillEl.classList.add('capacity-green');
      } else if (percentage <= 80) {
        fillEl.classList.add('capacity-orange');
      } else {
        fillEl.classList.add('capacity-red');
      }
    }
    if (textEl) {
      textEl.textContent = `Message Capacity: ${currentCount} / ${allowedLimit}`;
    }

    // 2. Update Streak Badge
    if (streakBadgeCount) {
      streakBadgeCount.textContent = `${streakCount}-Day Streak`;
    }
    if (streakBadgeBonus) {
      streakBadgeBonus.textContent = `+${streakBonus} capacity`;
    }
    if (streakBadgeContainer) {
      if (streakCount >= 1) {
        streakBadgeContainer.classList.add('active');
        streakBadgeContainer.style.display = '';
      } else {
        streakBadgeContainer.classList.remove('active');
        streakBadgeContainer.style.display = 'none';
      }
    }

    // Update Daily Streak Tracker UI
    const trackEl = document.getElementById('streak-progress-track');
    if (trackEl) {
      const days = trackEl.querySelectorAll('.streak-day');
      days.forEach((day, index) => {
        if (index < streakCount) {
          day.classList.add('active');
        } else {
          day.classList.remove('active');
        }
      });
    }

    const btnDownloadStreakReward = document.getElementById('btn-download-streak-reward');
    if (btnDownloadStreakReward) {
      if (streakCount >= 3) {
        btnDownloadStreakReward.classList.remove('hidden');
      } else {
        btnDownloadStreakReward.classList.add('hidden');
      }
    }

    // 3. Update Lock/Unlock layout with transition
    const wasLocked = chatLockContainer && !chatLockContainer.classList.contains('hidden') && parseFloat(window.getComputedStyle(chatLockContainer).opacity) > 0;

    if (data.limitReached) {
      if (chatForm) chatForm.classList.add('hidden');
      if (chatLockContainer) {
        chatLockContainer.classList.remove('hidden');
        chatLockContainer.style.opacity = '1';
        if (chatLimitDisplay) {
          chatLimitDisplay.textContent = `${allowedLimit}/${allowedLimit} messages`;
        }
        if (referralShareLink) {
          const shareUrl = `${window.location.origin}${window.location.pathname}?ref=${localClientId}`;
          referralShareLink.href = shareUrl;
          referralShareLink.textContent = shareUrl;
        }

        // Update retention prompt
        const nextStreakCount = streakCount + 1;
        const nextStreakBonus = nextStreakCount * 2;
        const promptText = `Come back tomorrow to keep your 🔥 ${nextStreakCount}-Day streak alive and unlock +${nextStreakBonus} messages!`;
        const promptEl = document.getElementById('streak-retention-prompt');
        if (promptEl) {
          promptEl.textContent = promptText;
        }
      }
    } else {
      if (wasLocked) {
        // Smooth transition: fade out lock container, fade in chat form over 300ms
        if (chatForm) {
          chatForm.classList.remove('hidden');
          chatForm.style.transition = 'opacity 300ms ease';
          chatForm.style.opacity = '0';
        }
        if (chatLockContainer) {
          chatLockContainer.style.transition = 'opacity 300ms ease';
          // Force layout/reflow
          if (chatForm) chatForm.offsetHeight;
          chatLockContainer.style.opacity = '0';
          if (chatForm) chatForm.style.opacity = '1';
        }
        setTimeout(() => {
          if (chatLockContainer) chatLockContainer.classList.add('hidden');
        }, 300);

        // Celebratory Toast
        if (data.rewardCount !== undefined) {
          showUnlockToast(data.rewardCount);
        }
      } else {
        // Already unlocked or initial page load
        if (chatForm) {
          chatForm.classList.remove('hidden');
          chatForm.style.opacity = '1';
        }
        if (chatLockContainer) {
          chatLockContainer.classList.add('hidden');
        }
      }
    }
  }

  function showUnlockToast(rewardCount) {
    const toast = document.getElementById('chat-unlock-toast');
    if (!toast) return;
    toast.textContent = `Capacity Unlocked! +${rewardCount} messages available.`;
    toast.classList.remove('hidden');
    toast.style.opacity = '1';

    // Auto fade-out after 2.5 seconds
    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => {
        toast.classList.add('hidden');
      }, 300);
    }, 2500);
  }

  function showLockedUI(allowedLimit, streakCount) {
    updateLimitAndStreakUI({
      limitReached: true,
      allowedLimit: allowedLimit !== undefined ? allowedLimit : lastAllowedLimit,
      currentCount: lastCurrentCount,
      streakCount: streakCount !== undefined ? streakCount : currentStreakCount,
      streakBonus: streakCount !== undefined ? streakCount * 2 : currentStreakBonus
    });
  }

  function showUnlockedUI() {
    updateLimitAndStreakUI({
      limitReached: false,
      allowedLimit: lastAllowedLimit,
      currentCount: lastCurrentCount,
      streakCount: currentStreakCount,
      streakBonus: currentStreakBonus
    });
  }

  async function checkChatLimit(trendTitle) {
    if (!trendTitle) return;
    try {
      const localDate = getLocalDateString();
      const res = await fetch(`/api/chat-limit?clientId=${localClientId}&trend=${encodeURIComponent(trendTitle)}&localDate=${localDate}`);
      if (res.ok) {
        const data = await res.json();
        updateLimitAndStreakUI(data);
      }
    } catch (err) {
      console.error('Error checking chat limit:', err);
    }
  }

  const checkStatusBtn = document.getElementById('check-status-btn');
  if (checkStatusBtn) {
    checkStatusBtn.addEventListener('click', async () => {
      if (currentTrend) {
        await checkChatLimit(currentTrend.title);
      }
    });
  }

  const playTriviaCTA = document.getElementById('chat-lock-play-trivia-btn');
  if (playTriviaCTA) {
    playTriviaCTA.addEventListener('click', () => {
      const triviaContainer = document.getElementById('trivia-card-container');
      if (triviaContainer) {
        triviaContainer.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      const startTriviaBtn = document.getElementById('btn-start-trivia');
      if (startTriviaBtn) {
        startTriviaBtn.focus();
      }
    });
  }

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
          history: chatMessages,
          clientId: localClientId
        })
      });
      
      // Remove loading
      if (loadingBubble && loadingBubble.parentNode) {
        loadingBubble.remove();
      }
      
      if (!res.ok) {
        if (res.status === 403) {
          const data = await res.json();
          if (data.error === 'limit_reached') {
            showLockedUI(data.allowedLimit);
            return;
          }
        }
        throw new Error('Chat API error');
      }
      const data = await res.json();
      
      // Add assistant bubble
      appendBubble(data.reply, 'bot');
      
      // Update history reference
      chatMessages.push({ role: 'user', content: query });
      chatMessages.push({ role: 'assistant', content: data.reply });

      await checkChatLimit(currentTrend.title);
      
    } catch (err) {
      if (loadingBubble && loadingBubble.parentNode) {
        loadingBubble.remove();
      }
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

    function createFeedItem(data) {
      if (!feedContainer) return null;
      const item = document.createElement('div');
      item.className = 'feed-item';
      
      const timestamp = new Date(data.timestamp);
      const timeStr = timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

      let locationText = '';
      if (data.location) {
        if (data.location.city && data.location.country) {
          locationText = `${data.location.city}, ${data.location.country}`;
        } else if (data.location.city) {
          locationText = data.location.city;
        } else if (data.location.country) {
          locationText = data.location.country;
        }
      }
      if (!locationText) {
        locationText = 'Anonymous';
      }

      if (data.clientId === localClientId) {
        locationText += ' (You)';
      }

      const flag = (data.location && data.location.flag) ? data.location.flag : '📍';

      item.innerHTML = `
        <span class="feed-item-flag">${flag}</span>
        <div class="feed-item-content">
          <span class="feed-item-user">${locationText}</span>
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
            const selectedLang = document.getElementById('lang-select')?.value || 'en';
            const newUrl = selectedLang === 'en'
              ? window.location.origin + '/t/' + slug
              : window.location.origin + '/t/' + slug + '/' + selectedLang;
            window.history.pushState({ path: newUrl }, '', newUrl);
            closeMobileSidebar();
          }
        });
      }

      return item;
    }

    const eventSource = new EventSource('/api/sentiment-stream');

    eventSource.addEventListener('hydration', (event) => {
      try {
        const dataList = JSON.parse(event.data);
        
        if (feedContainer) {
          // Remove empty state if present
          const emptyState = feedContainer.querySelector('.feed-empty-state');
          if (emptyState) {
            emptyState.remove();
          }
          
          feedContainer.innerHTML = '';
          if (Array.isArray(dataList)) {
            dataList.forEach(data => {
              const item = createFeedItem(data);
              if (item) feedContainer.appendChild(item);
            });
          }
        }
      } catch (err) {
        console.error('Error handling SSE hydration event:', err);
      }
    });

    eventSource.addEventListener('message', (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (feedContainer) {
          // Remove empty state if present
          const emptyState = feedContainer.querySelector('.feed-empty-state');
          if (emptyState) {
            emptyState.remove();
          }

          const item = createFeedItem(data);
          if (item) {
            // Insert at the top
            feedContainer.insertBefore(item, feedContainer.firstChild);
          }

          // Keep maximum 15 items in the feed list
          while (feedContainer.children.length > 15) {
            feedContainer.lastChild.remove();
          }
        }

        // If the incoming simulated vote matches current trend, update percentages and timeline
        if (currentTrend && currentTrend.title === data.trend) {
          if (data.updatedPolls) {
            updatePollPercentages(data.updatedPolls);
          }
          loadTimeline(currentTrend.title);
        }
      } catch (err) {
        console.error('Error handling SSE live vote event:', err);
      }
    });

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

  // Live Sentiment Gauge Sync
  function updateSentimentGauge(geniusPct) {
    const radius = 40;
    const circumference = 2 * Math.PI * radius; // 251.2px
    const offset = circumference - (geniusPct / 100) * circumference;
    const gaugeFill = document.getElementById('gauge-fill');
    const gaugeGeniusPct = document.getElementById('gauge-genius-pct');
    if (gaugeFill) {
      gaugeFill.style.strokeDashoffset = offset;
    }
    if (gaugeGeniusPct) {
      gaugeGeniusPct.textContent = `${geniusPct}%`;
    }
  }

  // Trend Category Resolver
  function getTrendCategoryMeta(title) {
    const lowerTitle = title.toLowerCase();
    
    // Tech: violet-to-cyan gradient (#8b5cf6 to #06b6d4), emoji 🤖, badge "Cutting Edge"
    if (/\b(tech|ai|apple|google|openai|gpt|gemini|claude|nvidia|phone|software|computer|digital|code|developer|web)\b/.test(lowerTitle)) {
      return {
        category: 'Tech',
        emoji: '🤖',
        badge: 'Cutting Edge',
        gradient: 'linear-gradient(135deg, #8b5cf6, #06b6d4)'
      };
    }
    // Workplace: orange-to-pink gradient (#f97316 to #ec4899), emoji 💼, badge "Future of Work"
    if (/\b(work|job|career|office|employee|employer|remote|hybrid|team|business|meeting|manager)\b/.test(lowerTitle)) {
      return {
        category: 'Workplace',
        emoji: '💼',
        badge: 'Future of Work',
        gradient: 'linear-gradient(135deg, #f97316, #ec4899)'
      };
    }
    // Innovation: emerald-to-cyan gradient (#10b981 to #06b6d4), emoji ⚡, badge "Green Tech"
    if (/\b(innovation|green|solar|energy|sustainable|electric|climate|future|science|smart|battery)\b/.test(lowerTitle)) {
      return {
        category: 'Innovation',
        emoji: '⚡',
        badge: 'Green Tech',
        gradient: 'linear-gradient(135deg, #10b981, #06b6d4)'
      };
    }
    
    // Default fallback: blue-to-purple gradient (#3b82f6 to #8b5cf6), emoji 🔥, badge "Hot Vibe"
    return {
      category: 'Trending',
      emoji: '🔥',
      badge: 'Hot Vibe',
      gradient: 'linear-gradient(135deg, #3b82f6, #8b5cf6)'
    };
  }

  // Explanation Banner Close / Dismissal & Persistence
  const explanationBanner = document.getElementById('sentiment-explanation-banner');
  const btnCloseBanner = document.getElementById('btn-close-banner');

  if (explanationBanner) {
    if (localStorage.getItem('sentiment-banner-dismissed') === 'true') {
      explanationBanner.classList.add('hidden');
    }
  }

  if (btnCloseBanner && explanationBanner) {
    btnCloseBanner.addEventListener('click', () => {
      explanationBanner.classList.add('hidden');
      localStorage.setItem('sentiment-banner-dismissed', 'true');
    });
  }



  function initializeDefaultTimelinePoints() {
    const points = [];
    const now = Date.now();
    const hours24 = 24 * 60 * 60 * 1000;
    const segmentMs = hours24 / 10;
    const startMs = now - hours24;
    for (let i = 1; i <= 10; i++) {
      points.push({
        timestamp: new Date(startMs + i * segmentMs).toISOString(),
        geniusPercentage: 50,
        velocity: 0
      });
    }
    prevTimelinePoints = points;
    currentTimelinePoints = points;
  }

  async function loadTimeline(trendTitle) {
    initializeDefaultTimelinePoints();
    drawTimelineChart();

    const existingErr = document.getElementById('timeline-error');
    if (existingErr) existingErr.style.display = 'none';

    try {
      const res = await fetch(`/api/poll/history?trend=${encodeURIComponent(trendTitle)}`);
      if (!res.ok) throw new Error('Failed to fetch timeline history');
      const data = await res.json();
      animateTimelineTransition(data);
    } catch (err) {
      console.error('Error loading sentiment timeline:', err);
      let errDiv = document.getElementById('timeline-error');
      if (!errDiv) {
        errDiv = document.createElement('div');
        errDiv.id = 'timeline-error';
        errDiv.className = 'timeline-error';
        errDiv.style.color = '#ef4444';
        errDiv.style.marginTop = '12px';
        errDiv.style.fontSize = '0.9rem';
        errDiv.style.textAlign = 'center';
        const cardWrap = document.querySelector('.timeline-card-wrap');
        if (cardWrap) cardWrap.appendChild(errDiv);
      }
      errDiv.textContent = 'Failed to load sentiment timeline.';
      errDiv.style.display = 'block';
    }
  }

  function animateTimelineTransition(newPoints) {
    if (currentTimelinePoints.length === 0) {
      prevTimelinePoints = newPoints.map(p => ({ ...p, geniusPercentage: 50, velocity: 0 }));
      currentTimelinePoints = newPoints;
    } else {
      prevTimelinePoints = currentTimelinePoints;
      currentTimelinePoints = newPoints;
    }

    timelineTransitionProgress = 0;
    timelineTransitionActive = true;

    function step() {
      timelineTransitionProgress += 0.05;
      if (timelineTransitionProgress >= 1) {
        timelineTransitionProgress = 1;
        timelineTransitionActive = false;
        drawTimelineChart();
      } else {
        drawTimelineChart();
        requestAnimationFrame(step);
      }
    }
    requestAnimationFrame(step);
  }

  function drawTimelineChart() {
    try {
      const canvas = document.getElementById('sentiment-timeline-canvas');
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      let width = canvas.clientWidth || canvas.getBoundingClientRect().width || 300;
      let height = canvas.clientHeight || canvas.getBoundingClientRect().height || 150;
      if (width === 0) width = 300;
      if (height === 0) height = 150;
      
      const dpr = window.devicePixelRatio || 1;
      if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
        canvas.width = width * dpr;
        canvas.height = height * dpr;
      }
      ctx.resetTransform();
      ctx.scale(dpr, dpr);

      ctx.clearRect(0, 0, width, height);

      if (currentTimelinePoints.length === 0) return;

      let displayPoints = [];
      if (timelineTransitionActive && prevTimelinePoints.length === currentTimelinePoints.length) {
        for (let i = 0; i < currentTimelinePoints.length; i++) {
          const prev = prevTimelinePoints[i];
          const curr = currentTimelinePoints[i];
          displayPoints.push({
            timestamp: curr.timestamp,
            geniusPercentage: prev.geniusPercentage + (curr.geniusPercentage - prev.geniusPercentage) * timelineTransitionProgress,
            velocity: prev.velocity + (curr.velocity - prev.velocity) * timelineTransitionProgress
          });
        }
      } else {
        displayPoints = currentTimelinePoints;
      }

      const paddingLeft = 40;
      const paddingRight = 20;
      const paddingTop = 30;
      const paddingBottom = 40;
      const plotWidth = width - paddingLeft - paddingRight;
      const plotHeight = height - paddingTop - paddingBottom;

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.lineWidth = 1;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.font = '10px Plus Jakarta Sans, sans-serif';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';

      for (const percent of [0, 25, 50, 75, 100]) {
        const y = paddingTop + plotHeight * (1 - percent / 100);
        ctx.beginPath();
        ctx.moveTo(paddingLeft, y);
        ctx.lineTo(width - paddingRight, y);
        ctx.stroke();
        ctx.fillText(`${percent}%`, paddingLeft - 8, y);
      }

      if (displayPoints.length > 0) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.font = '10px Plus Jakarta Sans, sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';

        const formatTime = (isoString) => {
          const d = new Date(isoString);
          return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        };

        ctx.fillText(formatTime(displayPoints[0].timestamp), paddingLeft, height - paddingBottom + 8);
        ctx.textAlign = 'right';
        ctx.fillText(formatTime(displayPoints[displayPoints.length - 1].timestamp), width - paddingRight, height - paddingBottom + 8);
      }

      const maxVelocity = Math.max(...displayPoints.map(p => p.velocity), 1);
      const coords = displayPoints.map((p, idx) => {
        const x = paddingLeft + (idx / (displayPoints.length - 1)) * plotWidth;
        const y = paddingTop + plotHeight * (1 - p.geniusPercentage / 100);
        return { x, y, velocity: p.velocity, point: p };
      });

      coords.forEach(pt => {
        const barH = (pt.velocity / maxVelocity) * (plotHeight * 0.4);
        const barW = Math.max(6, plotWidth / (displayPoints.length * 3));
        
        const barGrad = ctx.createLinearGradient(pt.x - barW / 2, height - paddingBottom - barH, pt.x - barW / 2, height - paddingBottom);
        barGrad.addColorStop(0, 'rgba(6, 182, 212, 0.4)');
        barGrad.addColorStop(1, 'rgba(6, 182, 212, 0.02)');
        
        ctx.fillStyle = barGrad;
        const r = 2;
        ctx.beginPath();
        if (ctx.roundRect) {
          ctx.roundRect(pt.x - barW / 2, height - paddingBottom - barH, barW, barH, [r, r, 0, 0]);
        } else {
          ctx.rect(pt.x - barW / 2, height - paddingBottom - barH, barW, barH);
        }
        ctx.fill();
      });

      if (coords.length > 0) {
        const areaGrad = ctx.createLinearGradient(0, paddingTop, 0, height - paddingBottom);
        areaGrad.addColorStop(0, 'rgba(16, 185, 129, 0.25)');
        areaGrad.addColorStop(1, 'rgba(16, 185, 129, 0.0)');

        ctx.fillStyle = areaGrad;
        ctx.beginPath();
        ctx.moveTo(coords[0].x, height - paddingBottom);
        coords.forEach(pt => {
          ctx.lineTo(pt.x, pt.y);
        });
        ctx.lineTo(coords[coords.length - 1].x, height - paddingBottom);
        ctx.closePath();
        ctx.fill();

        ctx.strokeStyle = '#10b981';
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        coords.forEach((pt, idx) => {
          if (idx === 0) ctx.moveTo(pt.x, pt.y);
          else ctx.lineTo(pt.x, pt.y);
        });
        ctx.stroke();

        coords.forEach((pt, idx) => {
          ctx.fillStyle = '#10b981';
          ctx.strokeStyle = '#1e293b';
          ctx.lineWidth = 2;
          
          ctx.beginPath();
          const radius = idx === timelineHoverIndex ? 6 : 4;
          ctx.arc(pt.x, pt.y, radius, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        });
      }
    } catch (drawErr) {
      console.error('drawTimelineChart failed:', drawErr);
    }
  }

  const timelineCanvas = document.getElementById('sentiment-timeline-canvas');
  const timelineTooltip = document.getElementById('timeline-tooltip');

  if (timelineCanvas && timelineTooltip) {
    const handleHover = (e) => {
      if (currentTimelinePoints.length === 0) {
        initializeDefaultTimelinePoints();
      }
      if (currentTimelinePoints.length === 0) return;
      
      let rect = timelineCanvas.getBoundingClientRect();
      let width = timelineCanvas.clientWidth || rect.width || 300;
      let height = timelineCanvas.clientHeight || rect.height || 150;
      
      if (width === 0) width = 300;
      if (height === 0) height = 150;

      const evtX = (e && typeof e.clientX === 'number') ? e.clientX : null;
      const evtY = (e && typeof e.clientY === 'number') ? e.clientY : null;

      let clientX = (evtX !== null) ? (evtX - rect.left) : (width / 2);
      let clientY = (evtY !== null) ? (evtY - rect.top) : (height / 2);
      const paddingLeft = 40;
      const paddingRight = 20;
      const paddingTop = 30;
      const paddingBottom = 40;
      const plotWidth = width - paddingLeft - paddingRight;
      const plotHeight = height - paddingTop - paddingBottom;

      let closestIdx = -1;
      let minDistance = Infinity;

      for (let i = 0; i < currentTimelinePoints.length; i++) {
        const ptX = paddingLeft + (i / (currentTimelinePoints.length - 1)) * plotWidth;
        const dist = Math.abs(clientX - ptX);
        if (dist < minDistance) {
          minDistance = dist;
          closestIdx = i;
        }
      }
      
      if (closestIdx === -1 && currentTimelinePoints.length > 0) {
        closestIdx = 0;
      }
      
      if (closestIdx !== -1) {
        timelineHoverIndex = closestIdx;
        try {
          drawTimelineChart();
        } catch (chartErr) {
          console.error('Error drawing chart inside hover:', chartErr);
        }

        const point = currentTimelinePoints[closestIdx];
        const date = new Date(point.timestamp);
        const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        timelineTooltip.innerHTML = `
          <div style="font-weight: 600; margin-bottom: 2px;">${timeStr}</div>
          <div style="color: #10b981;">${point.geniusPercentage}% Genius</div>
          <div style="color: #06b6d4;">${point.velocity} votes/hr (${point.velocity} votes)</div>
        `;
        
        timelineTooltip.style.setProperty('display', 'block', 'important');
        timelineTooltip.style.setProperty('visibility', 'visible', 'important');
        timelineTooltip.style.setProperty('opacity', '1', 'important');

        const ptX = paddingLeft + (closestIdx / (currentTimelinePoints.length - 1)) * plotWidth;
        const ptY = paddingTop + plotHeight * (1 - point.geniusPercentage / 100);

        timelineTooltip.style.left = `${ptX - 60}px`;
        timelineTooltip.style.top = `${ptY - 80}px`;
      } else {
        hideTimelineTooltip();
      }
    };

    timelineCanvas.addEventListener('mousemove', (e) => {
      handleHover(e);
    });

    timelineCanvas.addEventListener('mouseleave', () => {
      hideTimelineTooltip();
    });

    function hideTimelineTooltip() {
      timelineHoverIndex = -1;
      drawTimelineChart();
      timelineTooltip.style.setProperty('display', 'none', 'important');
      timelineTooltip.style.setProperty('visibility', 'hidden', 'important');
      timelineTooltip.style.setProperty('opacity', '0', 'important');
    }

    window.addEventListener('resize', () => {
      drawTimelineChart();
    });
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
