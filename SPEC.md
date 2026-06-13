# Specification: Enable Firestore Cache in Production

## Acceptance Criteria

- **[AC-1] Set NODE_ENV=production in Cloud Run Deploy Workflow**
  - **Check**: Inspect `.github/workflows/deploy.yml`. The `gcloud run deploy` command in the `deploy` job must include `NODE_ENV=production` in the `--set-env-vars` list.
  - **Expected command format**:
    ```yaml
    gcloud run deploy trend-jacker \
      --source . \
      --project profithelm-477200 \
      --region us-central1 \
      --allow-unauthenticated \
      --set-env-vars="GEMINI_API_KEY=${{ secrets.GEMINI_API_KEY }},NODE_ENV=production"
    ```

- **[AC-2] Update Example Deployment Command in README.md**
  - **Check**: Inspect `README.md` under the `## 💡 Notes for the Next Agent/Developer` section. The example `gcloud run deploy` command must include `NODE_ENV=production` in the `--set-env-vars` argument.
  - **Expected command format**:
    ```bash
    gcloud run deploy trend-jacker \
      --source . \
      --project profithelm-477200 \
      --region us-central1 \
      --allow-unauthenticated \
      --set-env-vars="GEMINI_API_KEY=YOUR_KEY,NODE_ENV=production"
    ```

## Out of Scope
- Modifying Firestore initialization code (`db.js`) or local SQLite configuration.
- Provisioning new Firestore databases or changing GCP IAM policies.
- Running manual or live production deployments.

## Slices

- **[S-1] Configure Production Environment in CI/CD Workflow**
  - **ACs**: `[AC-1]`
  - **Files**: `.github/workflows/deploy.yml`
  - **Dependency**: None (Independent)
  
- **[S-2] Update Deployment Documentation in README.md**
  - **ACs**: `[AC-2]`
  - **Files**: `README.md`
  - **Dependency**: None (Independent)
