task: Set NODE_ENV=production in deployment configurations (README.md and deploy.yml) to enable Firestore cache in production.              tier: T1   creativity: 0.5
state: complete                budget: repairs 0/2
branch: asf/20260613-enable-production-firestore          checkpoint: none
caps: agents,ui,web,human

## Log
- 2026-06-13: Conductor starting fresh run with T1. Starting Architect phase.
- 2026-06-13: Architect completed SPEC.md. Conductor starting Builder phase.
- 2026-06-13: Builder completed all slices. Conductor starting Verifier phase.
- 2026-06-13: Verifier completed validation checks successfully. Conductor starting Shipper phase.
## Verdict
- **[AC-1] Set NODE_ENV=production in Cloud Run Deploy Workflow**: PASS
  - Evidence: Verified that `.github/workflows/deploy.yml` sets `NODE_ENV=production` in `--set-env-vars`.
- **[AC-2] Update Example Deployment Command in README.md**: PASS
  - Evidence: Verified that `README.md` contains the updated `gcloud run deploy` example command with `NODE_ENV=production` in `--set-env-vars`.
- **Test Suite**: PASS
  - Evidence: All 120 Playwright tests passed successfully.
- **Dogfood / Visual Checks**: SKIPPED
  - Reason: The changes are limited to CI/CD and documentation files, which cannot affect the local runtime behavior or web user interface.
## Done
### Delivered Work
- Enabled Firestore client cache in production by configuring `NODE_ENV=production`.

### Verification Table
| Acceptance Criterion | Verification Evidence |
| :--- | :--- |
| **[AC-1]** Set `NODE_ENV=production` in Cloud Run Deploy Workflow | `.github/workflows/deploy.yml` was successfully configured to include `NODE_ENV=production` in the `--set-env-vars` option of `gcloud run deploy`. |
| **[AC-2]** Update Example Deployment Command in README.md | `README.md` was updated to document `NODE_ENV=production` inside the `--set-env-vars` list of the example `gcloud run deploy` command. |

### Integration Details
- **PR Link**: https://github.com/coskunarif/trend-jacker/pull/26
- **Integration Method**: Squash and merge via `gh pr merge --squash`

