#!/usr/bin/env bash
# Deploy Fab Clean API to Google Cloud Run (us-central1).
# Requires: gcloud auth + Cloud Build / Run permissions. Does not print secrets.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PROJECT_ID="${GCP_PROJECT_ID:-254040893134}"
REGION="${GCP_REGION:-us-central1}"
SERVICE="${CLOUD_RUN_SERVICE:-fab-clean-api}"
SHORT_SHA="$(git -C "$ROOT" rev-parse --short HEAD)"
IMAGE="${CLOUD_RUN_IMAGE:-gcr.io/${PROJECT_ID}/${SERVICE}:${SHORT_SHA}}"

echo "Project:  $PROJECT_ID"
echo "Region:   $REGION"
echo "Service:  $SERVICE"
echo "Image:    $IMAGE"

gcloud config set project "$PROJECT_ID"

gcloud builds submit "$ROOT" \
  --config="$ROOT/cloudbuild.yaml" \
  --substitutions="_IMAGE=${IMAGE}"

gcloud run deploy "$SERVICE" \
  --image "$IMAGE" \
  --region "$REGION" \
  --platform managed \
  --allow-unauthenticated \
  --port 8080 \
  --cpu 1 \
  --memory 512Mi \
  --min-instances 0 \
  --max-instances 10

echo "Service URL:"
gcloud run services describe "$SERVICE" --region "$REGION" --format='value(status.url)'
echo
echo "Ensure MSG91 / DB / JWT env vars or secrets are already set on the service."
echo "Example (do this yourself; do not paste secrets into chat):"
echo "  gcloud run services update $SERVICE --region $REGION --update-env-vars MSG91_WIDGET_ID=…"
