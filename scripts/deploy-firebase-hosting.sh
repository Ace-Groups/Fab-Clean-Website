#!/usr/bin/env bash
# Build frontend and deploy Firebase Hosting (myfabclean.com / fab-clean-website target).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

pnpm install
pnpm --filter @workspace/fab-clean build

if ! command -v firebase >/dev/null 2>&1; then
  echo "firebase CLI missing — using npx firebase-tools" >&2
  npx --yes firebase-tools@13 deploy --only hosting --project fab-clean-env-1234
else
  firebase deploy --only hosting --project fab-clean-env-1234
fi
