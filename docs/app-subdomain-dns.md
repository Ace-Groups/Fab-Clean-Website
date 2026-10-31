# app.myfabclean.com — customer portal

Same Firebase Hosting site as marketing; hostname switches to the **AppShell** (bottom nav: Home · Book · Orders · Profile).

| Host | Role |
|------|------|
| `myfabclean.com` | Marketing |
| `app.myfabclean.com` | Customer web app / portal |
| `api.myfabclean.com` | Cloud Run API |

## 1. Firebase (Mac)

```bash
firebase hosting:sites:list --project fab-clean-env-1234
# Add custom domain on site fab-clean-website:
# Firebase Console → Hosting → Add custom domain → app.myfabclean.com
# Copy the A/AAAA or CNAME records Firebase shows.
```

## 2. Cloudflare DNS (zone for myfabclean.com)

If DNS is in Cloudflare (Fab Clean / Ace-Digital account):

| Type | Name | Target | Proxy |
|------|------|--------|-------|
| CNAME | `app` | `fab-clean-website.web.app` **or** the exact target Firebase shows | DNS only until SSL verifies, then Proxied OK with Full (strict) |

Also ensure API CORS includes `https://app.myfabclean.com` (shipped in code defaults).

## 3. Deploy

```bash
git pull
./scripts/deploy-firebase-hosting.sh
./scripts/deploy-cloud-run.sh   # picks up CORS default
```

## Smoke

1. https://app.myfabclean.com → redirects to `/login` or `/dashboard`
2. https://myfabclean.com → Sign in → opens app subdomain login
3. Bottom tabs work on phone-width viewport
