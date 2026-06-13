# Trend Jacker

> [!IMPORTANT]
> **Project Philosophy**: Before developing or extending features, please read our [PHILOSOPHY.md](file:///home/ubuntuadmin/projects/trend-jacker/PHILOSOPHY.md) to understand the core principles, design vision, and growth objectives for this application.

> [!TIP]
> **🤖 Autonomous Agent Onboarding**: This project runs on fully autonomous agent execution cycles.
> To start your development cycle:
> 1. Run the bootstrap command in the terminal: `npm run agent:next`
> 2. Read the task metadata and instructions output from the command.
> 3. Develop the solution autonomously following our [PHILOSOPHY.md](file:///home/ubuntuadmin/projects/trend-jacker/PHILOSOPHY.md) core design principles.
> 4. Verify your implementation, update the playbook status, and select the next task.
> 
> **⚡ Chat Shortcuts**:
> You can trigger this loop directly in the chat by typing:
> - `/next` or `next task`: Instructs the agent to immediately execute `npm run agent:next` and implement the active task autonomously.

A real-time AI viral trend analyzer and sentiment voting platform designed for social media consumers. It fetches trending topics from Google Trends RSS, generates engaging explanations and viral hooks using Google Gemini AI, and hosts interactive "Overrated vs. Genius" community polls with follow-up Q&A chat.

## 🚀 Live Project Status

The project is fully deployed and live:
- **Production URL (HTTPS)**: [https://viraljacker.com](https://viraljacker.com)
- **Alternative URL (HTTPS)**: [https://www.viraljacker.com](https://www.viraljacker.com)
- **Direct Cloud Run URL**: [https://trend-jacker-250134012801.us-central1.run.app](https://trend-jacker-250134012801.us-central1.run.app)

---

## 🛠️ Infrastructure & Deployment

### 1. Google Cloud Platform (GCP)
- **Hosting**: Google Cloud Run (Region: `us-central1`, Project: `profithelm-477200`).
- **AI Backend**: Generative Language API (`generativelanguage.googleapis.com`) is enabled. A dedicated API key is created and injected into Cloud Run as `GEMINI_API_KEY`.
- **Domain Verification**: `viraljacker.com` is registered and verified in Google Search Console under the project's service account (`gainhelm-searchconsole-cli@profithelm-477200.iam.gserviceaccount.com`).
- **Domain Mappings**: Cloud Run custom domain mappings are configured for both `viraljacker.com` and `www.viraljacker.com` with Let's Encrypt / Google Trust Services SSL certificates.

### 2. Cloudflare DNS
- **Registrar & Nameservers**: Cloudflare, Inc.
- **Routing Records**:
  - `A` records at root (`@`) pointing to Google Cloud Run IPs (`216.239.32.21`, etc.) set to **DNS-only** (no Cloudflare proxy) to ensure seamless Google SSL verification.
  - `AAAA` records at root (`@`) pointing to Google Cloud Run IPv6 addresses.
  - `CNAME` record for `www` pointing to `ghs.googlehosted.com.`.
  - `TXT` record at root (`@`) for `google-site-verification` verification.

---

## 💻 Tech Stack

- **Core**: Node.js (ES Modules, Fastify framework).
- **Frontend**: Vanilla HTML5, CSS3, and JavaScript served statically from the `/public` directory.
- **AI SDK**: `@google/generative-ai` version `^0.21.0`.
- **Model**: `gemini-3.5-flash` for high-speed, cost-efficient viral analysis and conversational chat.

---

## 🚀 Local Development

### Prerequisites
1. Node.js (v18+ recommended)
2. A valid Gemini API Key from Google AI Studio.

### Getting Started
1. Install dependencies:
   ```bash
   npm install
   ```
2. Create a `.env` file in the root directory:
   ```env
   GEMINI_API_KEY=your_gemini_api_key_here
   ```
3. Run the development server:
   ```bash
   npm run dev
   ```
   The app will run locally at [http://localhost:3000](http://localhost:3000).

---

## 🔌 API Endpoints Reference

### 1. `GET /api/trends`
Fetches and parses the Google Trends US RSS feed. Returns a list of the top 15 trending topics.
- **Response**: Array of trend objects including approx. traffic volume, news headlines, snippets, and source URL.

### 2. `POST /api/explain`
Calls Gemini AI to analyze why a topic is viral, providing a catchy hook, explanation, key viral reasons, and a summary.
- **Request Body**:
  ```json
  {
    "trend": "topic name",
    "headline": "news headline (optional)",
    "snippet": "news snippet (optional)"
  }
  ```
- **Response**: JSON with `hook`, `whatIsIt`, `whyIsItViral` (array), `takeaway`, and current `polls` counts.

### 3. `POST /api/chat`
Follow-up conversational QA about a specific trend with chat history.
- **Request Body**:
  ```json
  {
    "trend": "topic name",
    "query": "user message",
    "history": [
      { "role": "user", "content": "..." },
      { "role": "assistant", "content": "..." }
    ]
  }
  ```
- **Response**: `{ "reply": "Gemini response" }`

### 4. `POST /api/poll`
Records user votes on a trend ("overrated" vs. "genius").
- **Request Body**:
  ```json
  {
    "trend": "topic name",
    "vote": "overrated" // or "genius"
  }
  ```
- **Response**: `{ "overrated": X, "genius": Y }`

---

## 💡 Notes for the Next Agent/Developer

- **JSON Parsing Safeguard**: When calling the Gemini API to explain trends, the model output is occasionally wrapped in markdown code blocks (e.g. ` ```json ... ``` `) even when `responseMimeType: 'application/json'` is specified. A regex cleaner was added to `server.js` before calling `JSON.parse()` to prevent crashes.
- **In-Memory Poll State**: The "Overrated vs Genius" voting system uses an in-memory `Map` (`pollStorage`) to record votes. Since Cloud Run is serverless, the poll state is ephemeral and will reset when the container scales down to zero. In future phases, you may want to persist votes to a database (e.g., PostgreSQL on Railway or Cloud SQL).
- **Deployment Command**:
  ```bash
  gcloud run deploy trend-jacker \
    --source . \
    --project profithelm-477200 \
    --region us-central1 \
    --allow-unauthenticated \
    --set-env-vars="GEMINI_API_KEY=YOUR_KEY,NODE_ENV=production"
  ```
