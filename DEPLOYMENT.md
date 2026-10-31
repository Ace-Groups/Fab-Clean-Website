# Deployment Guide

Monorepo: React (Firebase Hosting) + Express API (**GCP Cloud Run** primary; Render YAML kept as legacy fallback).

## Prerequisites

- Node.js 22+, pnpm 10+
- Firebase CLI (`npm i -g firebase-tools`) authenticated to `fab-clean-env-1234`
- `gcloud` authenticated to project `254040893134` (Cloud Run / Artifact Registry / Cloud Build)
- Docker optional (Cloud Build can build the image)

## Setup

```bash
pnpm install
pnpm --filter @workspace/fab-clean build   # Frontend → Frontend/dist-build
pnpm --filter @workspace/api-server build  # Backend → Backend/dist/index.cjs
```

## Frontend — Firebase Hosting (`myfabclean.com`)

Production API URL is set in `Frontend/.env.production`:

`VITE_API_URL=https://fab-clean-api-254040893134.us-central1.run.app`

```bash
./scripts/deploy-firebase-hosting.sh
# or:
pnpm --filter @workspace/fab-clean build
firebase deploy --only hosting --project fab-clean-env-1234
```

CSP in `firebase.json` allows MSG91 OTP widget hosts (`verify.msg91.com`, `verify.phone91.com`, `control.msg91.com`, `api.msg91.com`) plus the Cloud Run API.

## Backend — GCP Cloud Run (`api.myfabclean.com` / `*.run.app`)

```bash
chmod +x scripts/deploy-cloud-run.sh
./scripts/deploy-cloud-run.sh
```

Or manually:

```bash
gcloud builds submit . --tag gcr.io/254040893134/fab-clean-api:$(git rev-parse --short HEAD)
gcloud run deploy fab-clean-api \
  --image gcr.io/254040893134/fab-clean-api:$(git rev-parse --short HEAD) \
  --region us-central1 \
  --platform managed \
  --allow-unauthenticated \
  --port 8080
```

Set secrets on the service (Console or `gcloud run services update … --update-secrets` / `--set-env-vars`). Required keys are listed in `Backend/.env.example`. **Never** put `MSG91_AUTH_KEY` in Frontend env.

## Legacy

`render.yaml` remains for historical Render deploys; prefer Cloud Run for production API.
