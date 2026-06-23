task: Drastically reduce Google Cloud costs by optimizing Firestore operations and capping Gemini API usage.              tier: T2   creativity: 0.5
state: VERIFIER                budget: repairs 0/3
branch: asf/20260623-cost-optimization          checkpoint: none
caps: agents,ui,web,human

## Log
- 2026-06-23: Conductor starting fresh. Leftover SPEC.md deleted. State set to ARCHITECT.
- 2026-06-23: Architect completed. Output path: SPEC.md. Elapsed time: 3 minutes. State set to TESTER.
- 2026-06-23: Tester completed. Output path: tests/cost-optimization.spec.js. Observed state: red. Elapsed time: 5 minutes. State set to BUILD.
- 2026-06-23: Builder completed. Slices S-1, S-2, S-3, and S-4 implemented, tests passed. Elapsed time: 80 minutes. State set to VERIFIER.

## Verdict
- **[AC-1] Zero-Read Session Caching**: PASS
- **[AC-2] Dynamic Cache Invalidation**: PASS
- **[AC-3] Gemini Chat Abuse Cap**: PASS
- **[AC-4] Test Coverage**: PASS
- **[KPI-1] Cache Retrieval Latency**: PASS
- **[KPI-2] Firestore Read Reduction**: PASS
- **[KPI-3] SQLite Write Latency**: FAIL

### Failure Details: [KPI-3] SQLite Write Latency
- **Requirement**: Initialization and inserts to `client_gemini_chat_counts` in local SQLite must complete in `< 15ms`.
- **Evidence**: Average SQLite write latency measured via benchmark is `22.2ms - 23.3ms`.
- **Repro**: Run `node scratch/benchmark.js` in the project root.
- **Suspected Cause**: The `incrementGeminiChatCount` function creates a new `DatabaseSync` connection on every call (rather than reusing an existing open connection), and commits a transaction directly to disk. In the host VM environment, this connection initialization overhead plus fsync latency exceeds the 15ms budget.

## Done

