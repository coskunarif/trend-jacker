task: Reduce LLM operational API cost and query response latency.              tier: T2   creativity: 0.5
state: BUILDER                budget: repairs 0/3
branch: asf/20260613-cost-latency          checkpoint: none
caps: agents,ui,web,human

## Log
- 2026-06-13: Conductor recalled Scout with runner-up task (infographics/prediction winner was ALREADY DONE). Starting Scout phase.
- 2026-06-13: Scout completed. Selected task: Reduce LLM operational API cost and query response latency. Conductor starting Architect phase.
- 2026-06-13: Architect completed SPEC.md. Conductor starting Tester phase.
- 2026-06-13: Tester completed test suite. Observed state: red. Conductor starting Builder phase.

## Task
**Objective**: Reduce LLM operational API cost and query response latency.
**Metric it moves**: Average API token count per chat interaction and client-side query response time.
**Why now**: Unbounded chat history causes quadratically scaling token costs, while duplicate user queries hit the network unnecessarily, degrading responsiveness.
**Runner-up**: Subtraction of redundant LLM demographic query invocations when selection is unchanged.

## Verdict

## Done
