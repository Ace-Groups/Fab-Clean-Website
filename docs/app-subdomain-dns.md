# app.myfabclean.com — customer portal (Fab Clean Cloudflare)

Same Firebase Hosting site as marketing; hostname switches to the **AppShell**.

| Host | Role |
|------|------|
| `myfabclean.com` | Marketing |
| `app.myfabclean.com` | Customer portal |
| `api.myfabclean.com` | Cloud Run API |

**DNS authority today:** Cloudflare (`bradley.ns` / `chloe.ns`) — zone lives in the **Fab Clean** Cloudflare account (not Ace-Digital). Apex already points at Firebase (`hosting-site=fab-clean-website`).

## Mac — Fab Clean Cloudflare (do this)

### A. Firebase first
1. [Firebase Console](https://console.firebase.google.com/project/fab-clean-env-1234/hosting) → site **fab-clean-website**
2. **Add custom domain** → `app.myfabclean.com`
3. Copy the records Firebase shows (usually a **CNAME** to `fab-clean-website.web.app` or similar)

### B. Fab Clean Cloudflare DNS
1. Log into **Fab Clean** Cloudflare (the account that owns `myfabclean.com`)
2. **DNS → Records → Add record**

| Type | Name | Target | Proxy |
|------|------|--------|-------|
| CNAME | `app` | `fab-clean-website.web.app` | **DNS only** until SSL verifies, then Proxied + SSL **Full (strict)** |

(`www` already uses that same target. Live check: `app` has **no** record yet.)

3. Wait for Firebase domain status → Connected

### C. Deploy code
```bash
git pull origin main
./scripts/deploy-firebase-hosting.sh
./scripts/deploy-cloud-run.sh   # CORS includes app.myfabclean.com
```

## Agent / MCP note
Cursor Cloudflare MCP is authorized as **Ace-Digital** (`admin@acedigital.cc`) only — no `myfabclean.com` zone there. DNS edits for `app` require the **Fab Clean** Cloudflare login (or a Fab Clean API token with Zone DNS Edit).

## Smoke
1. https://app.myfabclean.com → `/login` or `/dashboard`
2. https://myfabclean.com Sign in → app subdomain
