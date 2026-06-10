# TrendJacker Core Philosophy

**There are no rigid boundaries. There is no fixed product specification.**

Any agent or developer taking over this project has **complete creative license and absolute freedom** to build the most engaging, viral, and loved web application possible. Use the ideas below as a launchpad, not a constraint. Trust your imagination to design features, interfaces, and loops that people immediately fall in love with.

---

## 🎨 1. Instantly Catchy & High-Retention UX
* **The Goal**: Hook standard social media consumers within 3 seconds of page load.
* **The Principle**: Keep user interfaces alive, visual, and lightweight. Use curated dark-mode palettes, smooth micro-animations, and instant feedback loops.
* **The Sentiment Loop**: Turn content reading into a game. Interactive sentiment checks (e.g., "Genius vs. Overrated"), community polls, and snappy conversational follow-ups keep users engaged.
* **Imagine**: How can we introduce viral sharing hooks, dynamic memes, or micro-reward mechanisms to keep retention high?

## 🔍 2. Aggressive Search Visibility (SEO & GEO)
* **The Goal**: Land on the first page of Google Search results and become a top citation in AI Search Engine answers (ChatGPT, Gemini, Perplexity).
* **The Principle**: 
  * **Traditional SEO**: Implement pristine semantic HTML5 structure, schema markup (JSON-LD), lightning-fast PageSpeed/Core Web Vitals, and unique metadata.
  * **Generative Engine Optimization (GEO)**: Format trend responses with clear entity relationships, credible context, and direct summaries that AI scrapers can easily cite.
* **Imagine**: How can we automatically generate dynamic Schema tags, sitemaps, and citation-friendly layouts for every trending page?

## 📡 3. Cross-Platform Trend Ingestion
* **The Goal**: Identify viral trends early, before they saturate the mainstream.
* **The Principle**: Scan multiple platforms to cross-reference interest spikes. Move beyond Google Trends to capture raw, early-stage velocity across:
  * Social Media (TikTok, X/Twitter, Reddit)
  * Media Platforms (YouTube, Twitch, News RSS feeds)
* **Imagine**: What simple, cost-efficient APIs or scrapers can we integrate to compile a unified "Viral Velocity Index" across platforms?

## 🤖 4. Agentic Freedom & Room to Imagine
* **The Goal**: Let developer agents build, experiment, and optimize independently.
* **The Principle**:
  * **Self-Inspiration Loop**: The developer agent must not limit itself to user requests. In the absence of prescriptive prompts, the agent should actively audit the application, identify gaps in features, performance, SEO/GEO, or visual aesthetics, and brainstorm creative solutions.
  * **Weighted Playbook Management**: The agent maintains a persistent [AGENT_PLAYBOOK.md](file:///home/ubuntuadmin/projects/trend-jacker/AGENT_PLAYBOOK.md) in the project root to record, score, and execute ideas. Incoming agents should bootstrap by running the trigger command `npm run agent:next` (or reacting to the `/next` or `next task` chat shortcuts) to parse the playbook, display current task details, and obtain immediate instructions.
  * **Full Execution Autonomy**: The agent is empowered to autonomously complete the entire development lifecycle (brainstorming, implementation, styling, verification, and deployment) for playbook tasks, presenting the completed wow-factor features.
  * **Modular Stack**: Keep the codebase modular and stateless (Fastify backend + clean static frontend) so agents can execute playbook tasks with zero architectural friction.

---

## ⚙️ 5. Generic Technical & Design Principles

* **Zero-Bloat & Lightweight Execution**: Prioritize vanilla HTML, CSS, and JS. Avoid heavy libraries or frameworks unless absolutely necessary. Every millisecond of load time matters for consumer retention.
* **AI-First & Resilient Design**: AI outputs can be unpredictable. Always implement sanitization and robust parsing (e.g. JSON cleaners, error catching) on LLM outputs. If the AI or external trends APIs fail, the app must degrade gracefully (e.g., fallback to cached data) rather than crash.
* **Frictionless Access (Zero Barriers)**: Do not force users through complex onboarding, signup forms, or configuration. Let them see, vote, and interact with the trends immediately on land.
* **Statelessness & Serverless Scalability**: Keep the core application stateless so it can run on scale-to-zero serverless platforms (like Cloud Run). If data persistence is introduced, keep it decoupled from the compute instance.
* **Agentic Accessibility**: Maintain and register clean programmatic hooks (e.g., WebMCP tool registration on the window context) so other AI tools, browser agents, and search engines can easily read, navigate, and interact with the app.

---

## 🌐 Universal Software & Product Principles (For All Apps)

These high-level principles apply universally across all codebases and applications we build, regardless of the target platform, framework, or specific product features.

### 1. Premium Visual Aesthetics & Motion
* **Visual Excellence**: Avoid default colors and browser styling. Every application must use a curated, harmonious color system (sleek dark modes, balanced HSL tones) and modern typography (e.g., Google Fonts).
* **Dynamic Feedback**: Use subtle hover effects, active states, and micro-animations. An interface should feel alive, encouraging interaction through motion and depth (e.g., backdrop-filter glassmorphism).

### 2. Dependency Minimalism & Native Web Standards
* **Native First**: Rely on native web APIs (such as `<dialog>`, `<popover>`, custom CSS variables, and native selectors like `:has()`) before pulling in large, third-party libraries.
* **Zero Bloat**: Maintain the smallest possible bundle size. Every dependency imported must justify its size in terms of utility and performance.

### 3. Resilience & Defensive Integration
* **Graceful Degradation**: Treat all external dependencies (APIs, databases, third-party services) as unreliable. Always implement error wrappers, timeout limits, and clean fallback UI states.
* **Safe LLM Integrations**: When parsing responses from AI models, assume the output might deviate from the requested format. Implement defensive regex cleaners, fallback schemas, and try-catch blocks.

### 4. Agent-Friendly Architecture (WebMCP)
* **Programmatic Readiness**: Design UIs to be machine-readable as well as human-friendly. Use structured, semantic markup.
* **Expose Agent Tools**: When running in client environments, register key functionalities as executable tools (e.g., on the `window` context). This allows external browsing agents or automation scripts to navigate, fetch data, and trigger actions.

### 5. Dual Engine Optimization (SEO & GEO)
* **Traditional SEO**: Maintain semantic HTML5 hierarchies (single `<h1>`, logical tags), Schema.org JSON-LD structural markup, and optimized Core Web Vitals to rank high in traditional search queries.
* **Generative Engine Optimization (GEO)**: Format text summaries clearly and organize key details into citation-friendly formats so that AI search engines (like Perplexity, ChatGPT, and Gemini) can crawl, read, and cite the app accurately.

### 6. Infrastructure Economy & High-Performance Engineering
* **Cost-Performance Optimization**: Always design and select the most cost-efficient infrastructure options (such as scale-to-zero compute, serverless SQLite, free-tier databases, or edge caching) to keep operational overhead as close to zero as possible.
* **Exceptional Performance Balance**: While prioritizing low-cost infrastructure, never sacrifice application speed. The app must remain highly optimized, ensuring instant page loading, rapid hydration, low API latency, and lightweight resource utilization.
* **Decoupled State**: Keep persistent application data completely decoupled from compute instances to leverage economic, stateless serverless scaling.


