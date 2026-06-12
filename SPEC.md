# SPEC: Dynamic demographic trend presentation

We will customize the trend explanation and UI styling dynamically based on the user's selected age bracket (Kids/Teens, Adults, Seniors) to increase session duration and user engagement.

## Acceptance Criteria

- **[AC-1] API Extension**: 
  - The `POST /api/explain` endpoint accepts an optional `bracket` field in the request body (allowed values: `"kids_teens"`, `"adults"`, `"seniors"`; default is `"adults"`).
  - Validation: Checked by querying `/api/explain` with different `bracket` values in JSON payload and asserting success.

- **[AC-2] Backend Demographic Generation Guidelines**:
  - The LLM generation prompt for Gemini is customized based on the selected `bracket`:
    - `"kids_teens"`: Simple analogies, gaming/meme/internet reference points, emojis, energetic tone, avoiding corporate fluff.
    - `"seniors"`: Clear definitions, historical/long-term context, no transient slang, high readability, respectful and plain language.
    - `"adults"`: Default catchy, active, concise tone.
  - Validation: Inspected through LLM prompt construction logs or output structure.

- **[AC-3] Database Caching with Bracket Key**:
  - To support independent caching without database schema migrations:
    - Standard `"adults"` bracket uses the default `{trend}` string as cache key.
    - Non-default brackets (`"kids_teens"`, `"seniors"`) append their bracket identifier to the cache key in format `{trend}:{bracket}` when querying/saving in `trend_explanations` and `localized_explanations`.
  - Validation: Direct inspection of SQLite database rows after requesting specialized explanations.

- **[AC-4] Interactive UI demographic selector**:
  - The explainer view contains a visible demographic selector right below the velocity gauge / above the title.
  - The selector contains 3 option pills styled to match the dark glassmorphic layout: "Adult (Default)", "Kids & Teens", and "Seniors".
  - Validation: Playwright assertions checking presence and visibility of selectors in the DOM.

- **[AC-5] Client-side Dynamic Presentation Switching**:
  - Selecting a demographic bracket dynamically updates a `data-demographic` attribute on the `#explainer-view` or `body` element.
  - When `"kids_teens"` is active, energetic visual styles (e.g. customized border glow, vibrant styling highlights) are applied.
  - When `"seniors"` is active, all primary text blocks (hook, what is it, takeaway, news snippets) are scaled up (1.25x font size) and contrast is maximized.
  - Selecting a style triggers a smooth transition and fetches/re-renders the bracket-specific text content.
  - Validation: Playwright E2E verification of CSS variables/styles and viewport changes under different selector states.

- **[AC-6] LocalStorage Persistence**:
  - The user's demographic preference is stored as `selected-demographic` in `localStorage`.
  - Subsequent trend detail loads or page reloads automatically read this value, set the active pill, and request the appropriate explanation bracket.
  - Validation: Refreshing the page or switching trends preserves the active demographic selector and styling.

- **[AC-7] Test Mode / Mock Support**:
  - When running in `process.env.NODE_ENV === 'test'`, the backend returns predefined mock explanations tailored to the requested bracket (e.g., slang for `"kids_teens"` and definitions/context for `"seniors"`) to make assertions deterministic without calling the live Gemini API.
  - Validation: Automated test assertions check for specific wording in mock responses.

## Out of Scope

- User authentication, sign-up forms, or persistent profiles to store age data.
- Demographic segmentation of the global activity feed or live voting statistics.

## Slices

Task type: **additive** (dynamic presentation capabilities). Test strategy: **tests first** (write E2E tests before implementation).

- **[S-1] Test Suite & Backend API updates**
  - **Description**: Add E2E tests verifying `/api/explain` returns different content for each bracket in test mode. Update `server.js` route handlers, prompt compilation, and mock handlers to support and test the `bracket` parameter.
  - **ACs mapped**: `[AC-1]`, `[AC-2]`, `[AC-7]`
  - **Files**: `server.js`, `tests/demographic-presentation.spec.js`

- **[S-2] DB Caching compatibility**
  - **Description**: Extend caching functions in `server.js`/`db.js` to append `:{bracket}` to the trend key for non-default brackets. Verify that caching works correctly across multiple brackets for the same trend.
  - **ACs mapped**: `[AC-3]`
  - **Files**: `server.js`, `db.js`, `tests/demographic-presentation.spec.js`

- **[S-3] Frontend UI Selector & LocalStorage Integration**
  - **Description**: Add the selector pills to `public/index.html` and wire the event listeners in `public/app.js`. Handle state persistence in `localStorage`, showing loading skeletons/indicators during selection changes, and re-fetching explanation blocks.
  - **ACs mapped**: `[AC-4]`, `[AC-6]`
  - **Files**: `public/index.html`, `public/app.js`, `tests/demographic-presentation.spec.js`
  - *Note: Can be built in parallel with S-4 once S-1/S-2 are completed.*

- **[S-4] Styling & Dynamic Layout Adaptation**
  - **Description**: Add CSS rules in `public/styles.css` matching `[data-demographic="seniors"]` and `[data-demographic="kids_teens"]`. Scale body text, titles, lists, and metadata blocks for seniors, and apply energetic glow variables for kids/teens.
  - **ACs mapped**: `[AC-5]`
  - **Files**: `public/styles.css`, `public/app.js`, `tests/demographic-presentation.spec.js`
  - *Note: Can be built in parallel with S-3 once S-1/S-2 are completed.*
