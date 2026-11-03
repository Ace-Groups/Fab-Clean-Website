# app.myfabclean.com — customer portal (Fab Clean Cloudflare)

Same Firebase Hosting site as marketing; hostname switches to the **AppShell**.

| Host | Role |
|------|------|
| `myfabclean.com` | Marketing |
| `app.myfabclean.com` | Customer portal |
| `api.myfabclean.com` | Cloud Run API |

**DNS authority:** Fab Clean Cloudflare (`bradley` / `chloe`).

## Current status

| Step | State |
|------|--------|
| CNAME `app` → `fab-clean-website.web.app` | Done (same target as `www`) |
| Firebase custom domain `app.myfabclean.com` | **Required next** |
| Without Firebase domain | Chrome shows `NET::ERR_CERT_COMMON_NAME_INVALID` (cert is for `firebaseapp.com`) |

## Mac — finish SSL

1. [Firebase Hosting → fab-clean-website](https://console.firebase.google.com/project/fab-clean-env-1234/hosting/sites/fab-clean-website)
2. **Add custom domain** → `app.myfabclean.com`
3. CNAME already exists in Fab Clean CF → Continue / Verify
4. Wait until status **Connected**
5. Keep Cloudflare **DNS only** until Connected; then Proxied + SSL **Full (strict)** OK

```bash
git pull origin main
./scripts/deploy-firebase-hosting.sh
./scripts/deploy-cloud-run.sh
```

## Smoke

1. `https://app.myfabclean.com` → `/login` or `/dashboard` (valid cert for `app.`)
2. `https://myfabclean.com` Sign in → app subdomain
