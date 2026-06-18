task: Implement a content discovery directory to index historical trend explanations and increase search crawler coverage. | Increase search crawler coverage | Historical trend content exists in the database but lacks internal links or persistent sitemap representation | runner-up: Normalize route path casing to prevent duplicate search engine indexing due to case variations.              tier: T2   creativity: 0.5
state: VERIFY                 budget: repairs 0/3
branch: asf/20260617-trend-directory          checkpoint: none
caps: agents,ui,web,human

## Log
- 2026-06-17: Conductor starting fresh. Starting Scout phase to analyze harborseo.ai and identify SEO/GEO candidate tasks.
- 2026-06-17: Spawned server process on port 3025 (Task ID: ee93f319-75e4-4897-b1ff-36b8151efb6f/task-35).
- 2026-06-17: Scout completed. Selected "Implement a content discovery directory to index historical trend explanations and increase search crawler coverage." as winner. Conductor starting Architect phase.
- 2026-06-17: Architect completed SPEC.md. Conductor starting Tester phase.
- 2026-06-17: Tester completed. Observed state: red. Conductor starting Builder phase.
- 2026-06-18: Consolidated dependent slices [S-2], [S-3], [S-4], and [S-5] into a single commit to ensure atomic integration of directory routes and consolidated sitemaps.
- 2026-06-18: Builder completed. Integrated S-1 and S-6, and consolidated S-2 to S-5. All tests passed. Conductor starting Verifier phase.

## Task
- **Objective**: Implement a content discovery directory to index historical trend explanations and increase search crawler coverage.
- **Metric**: Increase search crawler coverage (indexing volume of historical trends).
- **Why Now**: Historical trend content exists in the database but lacks internal links or persistent sitemap representation, rendering it inaccessible to search crawlers and AI search engine discovery mechanisms.
- **Runner-up**: Normalize route path casing to prevent duplicate search engine indexing due to case variations.

## Verdict

All checks passed successfully.
- **[AC-1] Database helper**: PASS. Verified SQLite querying and sorted array structure returned from `getAllCachedExplanations()`.
- **[AC-2] Directory Page Routes and Lowercase Path Normalization**: PASS. Enforces lowercase casing normalization with 301 redirects (e.g. `/Directory` redirects to `/directory`, `/directory/ES` redirects to `/directory/es`), and redirects unsupported languages to `/directory`.
- **[AC-3] Directory SEO, Alternate Links, and JSON-LD**: PASS. Localized head tags (title, description), hreflang alternatives (x-default, en, es, fr, ja), alternate `Link` headers, and `CollectionPage` structured schema are correctly generated and verified.
- **[AC-4] Comprehensive sitemap.xml Integration**: PASS. Correctly integrates unique trends and sitemap directory urls in all language sub-paths with all alternate language codes.
- **[AC-5] llms.txt and llms-full.txt Sitemap Consolidation**: PASS. Correctly returns text formatting list (with source citations) and compiles full content.
- **[AC-6] Global Footer Links and Client Translation Hydration**: PASS. Footer selector correctly targets `#directory-link` and hydrates text and href for localized directories on the frontend.

## Done
