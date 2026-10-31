# Deployment Guide

Monorepo: React (Firebase Hosting) + Express API (**GCP Cloud Run** primary; Render YAML kept as legacy fallback).

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

`VITE_API_URL=https://fab-clean-api-254040893134.us-central1.run.app`

Login uses MSG91 **custom UI** (`exposeMethods: true` + in-page OTP field). A hosting-only redeploy is enough for OTP UI fixes — no Cloud Run change required unless auth API env changed.

### Mac hosting redeploy (OTP / login UI)

Run on a Mac with Firebase credentials (Cloud Agent VMs usually cannot deploy hosting):

```bash
cd /path/to/fab-clean-website
git checkout main && git pull origin main
./scripts/deploy-firebase-hosting.sh
# or:
pnpm install
pnpm --filter @workspace/fab-clean build
firebase deploy --only hosting --project fab-clean-env-1234
# if credentials expired: firebase login --reauth
```

Smoke: https://myfabclean.com/login → phone `8825702072` → OTP step appears → enter `3223` → lands in dashboard. Console may still log `Shadow root has widget: false` (expected with custom UI); the in-page OTP field must appear after send.

CSP in `firebase.json` allows MSG91 OTP widget hosts (`verify.msg91.com`, `verify.phone91.com`, `control.msg91.com`, `api.msg91.com`, `*.hostnsoft.com`) plus the Cloud Run API.

## Backend — GCP Cloud Run (`api.myfabclean.com` / `*.run.app`)

```bash
chmod +x scripts/deploy-cloud-run.sh
./scripts/deploy-cloud-run.sh
```

Or manually:

```bash
gcloud builds submit . --project fab-clean-env-1234 \
  --tag gcr.io/fab-clean-env-1234/fab-clean-api:$(git rev-parse --short HEAD)
gcloud run deploy fab-clean-api \
  --project fab-clean-env-1234 \
  --image gcr.io/fab-clean-env-1234/fab-clean-api:$(git rev-parse --short HEAD) \
  --region us-central1 \
  --platform managed \
  --allow-unauthenticated \
  --port 8080
```

Set secrets on the service (Console or `gcloud run services update … --update-secrets` / `--set-env-vars`). Required keys are listed in `Backend/.env.example`. **Never** put `MSG91_AUTH_KEY` in Frontend env.

## Legacy

`render.yaml` remains for historical Render deploys; prefer Cloud Run for production API.
