# Implementation Plan — TJ-29: Debate Arena Subtraction & Catchy Visual Cards Integration

This document outlines the design specification, UI mockup, and step-by-step test-driven implementation plan to retire the text-heavy "AI Sentiment Debate Arena" and replace it with a set of three catchy, responsive, visual infographic cards (Viral Vibe, Live Sentiment, and Snapshot Share).

---

## 🎨 UI Mockup Design

Here is the premium UI layout designed for the new visual cards grid:

![Visual Cards UI Mockup](file:///home/ubuntuadmin/.gemini/antigravity-cli/brain/83ccc315-6fa5-4eb3-92da-47673224d260/visual_cards_mockup_1781135295451.png)

---

## 🎯 Target Specifications

### 1. Subtraction: Retire AI Sentiment Debate Arena
- **Database**: Remove SQLite `debate_votes` table creation, `getDebateData`, and `incrementDebateVote` helpers from `db.js`.
- **Backend Routing**: Delete POST `/api/debate` and POST `/api/debate/vote` route handlers from `server.js`.
- **Frontend HTML**: Remove the `<div class="glass-card debate-card full-width">` container from `public/index.html`.
- **Frontend Styles**: Clean up all `.debate-*` and `.download-debate-*` CSS declarations from `public/styles.css`.
- **Frontend Logic**: Remove debate-related selectors, listeners, timers (`activeDebateTimer1`, `activeDebateTimer2`), helper functions (`fetchAndRenderDebate`, `renderDebateTurn`, `updateDebatePercentages`, `submitDebateVote`), and the `generateDebateMemeCard` canvas sharing generator from `public/app.js`.

### 2. Additive: Catchy Visual Cards Suite
We will introduce a new responsive container `<div class="visual-cards-grid">` styled with a modern grid layout (3-column on desktop, 1-column on mobile). Inside it, we will render three high-fidelity cards:

#### Card 1: "Viral Vibe" Card
- **Description**: Displays the category of the trend, a large themed emoji, and a styled status badge.
- **Gradients & Emojis**: Mapped dynamically based on the trend title:
  - **Tech**: Violet-to-cyan gradient (`#8b5cf6` to `#06b6d4`), emoji `🤖`, badge "Cutting Edge".
  - **Workplace**: Orange-to-pink gradient (`#f97316` to `#ec4899`), emoji `💼`, badge "Future of Work".
  - **Innovation**: Emerald-to-cyan gradient (`#10b981` to `#06b6d4`), emoji `⚡`, badge "Green Tech".
  - **Trending (Fallback)**: Blue-to-purple gradient (`#3b82f6` to `#8b5cf6`), emoji `🔥`, badge "Hot Vibe".

#### Card 2: "Live Sentiment Chart" Card
- **Description**: An interactive circular SVG radial progress gauge displaying the live vote split between "Genius" (emerald glow) and "Overrated" (rose glow).
- **Behavior**: Hydrates dynamically from the active trend's poll percentages and updates instantly in real-time when the user casts a vote or when sentiment updates via the SSE stream.

#### Card 3: "Snapshot Share" Card
- **Description**: Features a visual placeholder preview of the shareable infographic card and an interactive "Download Infographic" button.
- **Meme/Infographic Sharing**: A new canvas-based generator `generateInfographicCard` in `public/app.js` will draw a beautiful 1200x630 share card containing the trend title, category vibe emoji/badge, radial sentiment split, the AI-generated hook, and a professional footer attribution (`viraljacker.com`).

---

## 🛠️ Detailed Step-by-Step Execution Plan

### Step 1: Automated Test Suite Cleanup (Militant TDD / Subtraction)
*Goal: Identify and delete deprecated tests referencing retired debate elements, and prepare new test blocks verifying the new visual cards.*

1. **Modify `tests/e2e.spec.js`**:
   - Delete the test `should load debate arena, render turns, and submit verdict` (lines 250-317).
   - In the sharing test `should show unified sharing modal...` (lines 480-537):
     - Remove the interception rules for `/api/debate` and `/api/debate/vote`.
     - Remove assertions checking for `shareDebateBtn` and `downloadDebateCardBtn`.
     - Add assertions to verify that clicking the new "Download Infographic" button in the Snapshot Share card triggers a valid canvas image download suggested as `infographic-*.png`.
2. **Modify `tests/responsive.spec.js`**:
   - Delete the test `should render debate bubbles side-by-side with uncompressed avatars` (lines 125-195).
   - Delete the test `should have overflow-y auto/scroll on debate messages...` (lines 259-270).
   - Add a test verifying that the `.visual-cards-grid` behaves responsively (flex/grid 3-column layout on desktop, stacking to 1-column on mobile/narrow viewports).
3. **Modify `tests/viral-generator.spec.js`**:
   - Delete assertions clicking `#btn-share-debate` and checking for context select `debate` (lines 81-89).
   - In test case `6. Verify Redundant Button Removal` (lines 194-205), remove references to `#btn-share-debate-x` if deprecated.
4. **Run tests**:
   - Run `npx playwright test` and confirm the deprecated tests are gone and only valid assertions remain.

### Step 2: Remove Backend Route Handlers (`server.js` & `db.js`)
*Goal: Remove all database helpers, table creations, and routes associated with the debate arena.*

1. **In `db.js`**:
   - Remove SQLite execution block for `CREATE TABLE IF NOT EXISTS debate_votes`.
   - Delete helper functions: `getDebateData`, `incrementDebateVote`, and `getLocalSqliteDebateData`.
2. **In `server.js`**:
   - Remove imports of `getDebateData` and `incrementDebateVote` from `./db.js` (line 10).
   - Delete helper function `generateDebate` (lines 432-486).
   - Delete route definitions `POST /api/debate` and `POST /api/debate/vote` (lines 489-513).

### Step 3: Implement Visual Cards Grid HTML (`index.html`)
*Goal: Place the new card structure into the center panel.*

1. **Modify `public/index.html`**:
   - Locate and delete `<div class="glass-card debate-card full-width">` (lines 291-347).
   - Insert the new visual cards section:
     ```html
     <div class="visual-cards-grid">
       <!-- Card 1: Viral Vibe -->
       <div class="glass-card visual-card vibe-card" id="card-viral-vibe">
         <h3 class="card-heading">
           <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="card-icon"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
           Viral Vibe
         </h3>
         <div class="vibe-content">
           <span id="vibe-emoji" class="vibe-emoji">🔥</span>
           <div class="vibe-meta">
             <span id="vibe-category" class="vibe-category">Trending</span>
             <span id="vibe-badge" class="vibe-badge">Hot Vibe</span>
           </div>
         </div>
       </div>

       <!-- Card 2: Live Sentiment Chart -->
       <div class="glass-card visual-card sentiment-chart-card" id="card-live-sentiment">
         <h3 class="card-heading">
           <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="card-icon"><path d="M21.21 15.89A10 10 0 1 1 8 2.83M22 12A10 10 0 0 0 12 2v10z"/></svg>
           Live Sentiment
         </h3>
         <div class="radial-gauge-container">
           <svg viewBox="0 0 100 100" class="radial-gauge">
             <circle class="gauge-bg" cx="50" cy="50" r="40" fill="none" stroke-width="8"></circle>
             <circle class="gauge-fill-genius" id="gauge-fill" cx="50" cy="50" r="40" fill="none" stroke-width="8" stroke-dasharray="251.2" stroke-dashoffset="125.6"></circle>
           </svg>
           <div class="gauge-text">
             <span class="gauge-pct" id="gauge-genius-pct">50%</span>
             <span class="gauge-label">Genius</span>
           </div>
         </div>
       </div>

       <!-- Card 3: Snapshot Share -->
       <div class="glass-card visual-card share-card" id="card-snapshot-share">
         <h3 class="card-heading">
           <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="card-icon"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>
           Snapshot Share
         </h3>
         <div class="share-card-content">
           <div class="card-preview-placeholder">
             <div class="mini-card-graphic">
               <span class="mini-title">Trend Summary</span>
               <div class="mini-bar"></div>
             </div>
           </div>
           <button id="btn-download-infographic" class="download-infographic-btn" aria-label="Download infographic share card image">
             <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="btn-icon"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
             Download Infographic
           </button>
         </div>
       </div>
     </div>
     ```

### Step 4: Implement Visual Cards CSS Styles (`styles.css`)
*Goal: Style the grid layout dynamically and add glassmorphism effects.*

1. **Delete old debate styles**: Remove CSS lines matching `.debate-*` and `.download-debate-*`.
2. **Add Visual Grid and Card styles**:
   ```css
   /* Visual Cards Grid Layout */
   .visual-cards-grid {
     display: grid;
     grid-template-columns: repeat(3, 1fr);
     gap: var(--space-4);
     margin-top: var(--space-4);
     width: 100%;
   }

   @media (max-width: 900px) {
     .visual-cards-grid {
       grid-template-columns: 1fr;
     }
   }

   /* Visual Card Styling */
   .visual-card {
     display: flex;
     flex-direction: column;
     min-height: 200px;
     justify-content: space-between;
     padding: var(--space-4);
     transition: transform 0.3s var(--ease-out), box-shadow 0.3s var(--ease-out);
   }

   .visual-card:hover {
     transform: translateY(-4px);
     box-shadow: 0 12px 24px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.1);
   }

   /* Vibe Card Customization */
   .vibe-content {
     display: flex;
     align-items: center;
     gap: var(--space-4);
     margin-top: var(--space-4);
     flex-grow: 1;
   }

   .vibe-emoji {
     font-size: 3.5rem;
     filter: drop-shadow(0 0 8px rgba(255, 255, 255, 0.15));
     animation: float 3s ease-in-out infinite;
   }

   @keyframes float {
     0%, 100% { transform: translateY(0); }
     50% { transform: translateY(-8px); }
   }

   .vibe-meta {
     display: flex;
     flex-direction: column;
     gap: var(--space-1);
   }

   .vibe-category {
     font-size: 1.25rem;
     font-weight: 700;
     color: #ffffff;
     text-transform: uppercase;
     letter-spacing: 0.05em;
   }

   .vibe-badge {
     padding: var(--space-1) var(--space-2);
     font-size: 0.75rem;
     font-weight: 600;
     border-radius: 99px;
     background: rgba(255, 255, 255, 0.1);
     border: 1px solid rgba(255, 255, 255, 0.2);
     color: #ffffff;
     width: fit-content;
     text-shadow: 0 0 4px rgba(0,0,0,0.5);
   }

   /* Sentiment Radial Gauge */
   .radial-gauge-container {
     position: relative;
     width: 120px;
     height: 120px;
     margin: var(--space-4) auto 0 auto;
     display: flex;
     align-items: center;
     justify-content: center;
   }

   .radial-gauge {
     transform: rotate(-90deg);
     width: 100%;
     height: 100%;
   }

   .gauge-bg {
     stroke: var(--bg-card);
   }

   .gauge-fill-genius {
     stroke: #10b981;
     stroke-linecap: round;
     filter: drop-shadow(0 0 6px rgba(16, 185, 129, 0.6));
     transition: stroke-dashoffset 0.8s cubic-bezier(0.4, 0, 0.2, 1);
   }

   .gauge-text {
     position: absolute;
     display: flex;
     flex-direction: column;
     align-items: center;
     justify-content: center;
     text-align: center;
   }

   .gauge-pct {
     font-size: 1.5rem;
     font-weight: 700;
     color: #ffffff;
     line-height: 1;
   }

   .gauge-label {
     font-size: 0.65rem;
     color: var(--text-muted);
     text-transform: uppercase;
     letter-spacing: 0.05em;
     margin-top: 2px;
   }

   /* Share Card Customization */
   .share-card-content {
     display: flex;
     flex-direction: column;
     gap: var(--space-3);
     margin-top: var(--space-3);
     flex-grow: 1;
   }

   .card-preview-placeholder {
     height: 70px;
     background: rgba(0, 0, 0, 0.3);
     border-radius: var(--space-2);
     border: 1px dashed var(--border);
     display: flex;
     align-items: center;
     justify-content: center;
     overflow: hidden;
   }

   .mini-card-graphic {
     display: flex;
     flex-direction: column;
     gap: var(--space-1);
     width: 70%;
     align-items: center;
   }

   .mini-title {
     font-size: 0.65rem;
     color: var(--text-muted);
     letter-spacing: 0.05em;
   }

   .mini-bar {
     height: 4px;
     width: 100%;
     background: linear-gradient(90deg, #10b981 60%, #f43f5e 40%);
     border-radius: 99px;
   }

   .download-infographic-btn {
     display: flex;
     align-items: center;
     justify-content: center;
     gap: var(--space-2);
     width: 100%;
     padding: var(--space-2) var(--space-4);
     background: linear-gradient(135deg, var(--primary), var(--primary-hover));
     border: none;
     border-radius: var(--space-2);
     color: #ffffff;
     font-weight: 600;
     font-size: 0.85rem;
     cursor: pointer;
     transition: opacity 0.2s ease, transform 0.1s ease;
   }

   .download-infographic-btn:hover {
     opacity: 0.9;
     transform: scale(1.02);
   }

   .download-infographic-btn:active {
     transform: scale(0.98);
   }
   ```

### Step 5: Implement Dynamic Client-Side Logic (`app.js`)
*Goal: Bind poll numbers to the circular gauge, assign category properties to the Vibe card, and code the infographic generator.*

1. **Add category mapping helper**:
   - Write `getTrendCategoryMeta(title)` inside `public/app.js`.
2. **Update trend selection routing**:
   - In `showTrendDetails(trend)`:
     - Clear/remove call to `fetchAndRenderDebate`.
     - Resolve trend category properties using `getTrendCategoryMeta(trend.title)`.
     - Apply resolved category name, emoji, and status badge to the DOM elements:
       - `#vibe-emoji` -> textContent = emoji
       - `#vibe-category` -> textContent = category
       - `#vibe-badge` -> textContent = badge
       - Apply resolved gradient string to `#card-viral-vibe` element background style.
     - Select `#btn-download-infographic` and bind click listener to call `generateInfographicCard()`.
3. **Synchronize Sentiment Gauge with Vote Poll**:
   - Write a helper `updateSentimentGauge(geniusPct)` that updates SVG `#gauge-fill` stroke dashoffset:
     - `const radius = 40; const circumference = 2 * Math.PI * radius;` (251.2px)
     - `const offset = circumference - (geniusPct / 100) * circumference;`
     - Update `#gauge-fill` style `strokeDashoffset` to this offset.
     - Update `#gauge-genius-pct` textContent to `${geniusPct}%`.
   - Update `updatePollPercentages(votes)` and client-side vote triggers to call `updateSentimentGauge` in addition to updating the regular progress bars.
4. **Implement Infographic Canvas Generator**:
   - Code `generateInfographicCard()` to construct a beautiful PNG image containing:
     - Gradient background.
     - Title of the trend.
     - The "Viral Vibe" category emoji and text badge.
     - An elegant radial gauge representation depicting the voting split (Genius vs Overrated).
     - The AI hook text wrapping.
     - Professional attribution/branding text.
     - Use `shareOrDownloadCanvas` helper to trigger download.

---

## 🚦 Verification and AutoCover

1. Run the server locally and verify that the page renders the new visual cards grid seamlessly, with fluid scaling and responsive placement across mobile/desktop.
2. Confirm that casting a "Genius" or "Overrated" vote instantly updates the circular radial sentiment chart with a smooth transition.
3. Validate that clicking the "Download Infographic" button builds and downloads a high-resolution infographic.
4. Run `npx playwright test` to ensure all tests pass successfully without reference to the retired debate module.
