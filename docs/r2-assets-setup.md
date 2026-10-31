# Cloudflare R2 — Fab Clean assets

- Account: Ace-Digital `f87da0d0e6f25f32932b46f2607477ad`
- Bucket: `fab-clean-assets`
- Public: `https://pub-c99d2656ac73471b81644c90647ebd30.r2.dev`

## Cloud Run secrets/env

```
CLOUDFLARE_ACCOUNT_ID=f87da0d0e6f25f32932b46f2607477ad
CLOUDFLARE_API_TOKEN=<R2 write token>
R2_BUCKET=fab-clean-assets
R2_PUBLIC_BASE_URL=https://pub-c99d2656ac73471b81644c90647ebd30.r2.dev
```

```bash
psql "$DATABASE_URL" -f sql/2026-10-31-user-avatar-url.sql
./scripts/deploy-cloud-run.sh
./scripts/deploy-firebase-hosting.sh
```
