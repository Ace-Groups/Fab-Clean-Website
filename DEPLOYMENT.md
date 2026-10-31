# Deployment Guide

Monorepo: React (Firebase Hosting) + Express API (**GCP Cloud Run** primary; Render YAML kept as legacy fallback).

## Cloud Run service name

Deploy **only** to **`fab-clean-website-api`**. Service **`fab-clean-api`** is reserved for the ERP (`fabzclean-t1` / `erp.myfabclean.com`). See project store doc `docs/cloud-run-service-split.md`.

## Prerequisites

- Node.js 22+, pnpm 10+
- Firebase CLI (`npm i -g firebase-tools`) authenticated to `fab-clean-env-1234`
- `gcloud` authenticated to project **`fab-clean-env-1234`** (project number `254040893134`; use the **ID** for `gcloud`, not the number)
- Docker optional (Cloud Build can build the image)

## Setup

```bash
pnpm install
pnpm --filter @workspace/fab-clean build   # Frontend → Frontend/dist-build
pnpm --filter @workspace/api-server build  # Backend → Backend/dist/index.cjs
```

## Frontend — Firebase Hosting (`myfabclean.com`)

Production API URL is set in `Frontend/.env.production`:

`VITE_API_URL=https://fab-clean-website-api-254040893134.us-central1.run.app`

After the first deploy of `fab-clean-website-api`, confirm the live URL (the hostname may differ slightly):

```bash
gcloud run services describe fab-clean-website-api \
  --project fab-clean-env-1234 --region us-central1 --format='value(status.url)'
```

Update `Frontend/.env.production` if needed, then rebuild hosting.

```bash
./scripts/deploy-firebase-hosting.sh
# or:
pnpm --filter @workspace/fab-clean build
firebase deploy --only hosting --project fab-clean-env-1234
```

CSP in `firebase.json` allows MSG91 OTP widget hosts (`verify.msg91.com`, `verify.phone91.com`, `control.msg91.com`, `api.msg91.com`) plus the Cloud Run website API.

## Backend — GCP Cloud Run (`api.myfabclean.com` / `*.run.app`)

Default service: **`fab-clean-website-api`** (override with `CLOUD_RUN_SERVICE` only for non-production experiments).

```bash
chmod +x scripts/deploy-cloud-run.sh
./scripts/deploy-cloud-run.sh
```

Or manually:

```bash
SHORT_SHA=$(git rev-parse --short HEAD)
gcloud builds submit . --project fab-clean-env-1234 \
  --config cloudbuild.yaml \
  --substitutions=_IMAGE=gcr.io/fab-clean-env-1234/fab-clean-website-api:${SHORT_SHA}
gcloud run deploy fab-clean-website-api \
  --project fab-clean-env-1234 \
  --image gcr.io/fab-clean-env-1234/fab-clean-website-api:${SHORT_SHA} \
  --region us-central1 \
  --platform managed \
  --allow-unauthenticated \
  --port 8080
```

Set secrets on the service (Console or `gcloud run services update … --update-secrets` / `--set-env-vars`). Required keys are listed in `Backend/.env.example`. **Never** put `MSG91_AUTH_KEY` in Frontend env.

## Legacy

`render.yaml` remains for historical Render deploys; prefer Cloud Run for production API.
