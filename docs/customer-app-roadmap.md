# Fab Clean customer app — founder roadmap

Canonical planning copy also lives in the project store. This repo copy travels with PRs.

## Phase 1 (this change set)

- Logged-in schedule pickup skips name/phone; nearest store + structured address (pincode autofill).
- Profile address add uses the same structured fields.
- Sitemap/SEO + lightweight analytics (optional `VITE_GA_MEASUREMENT_ID`).

## Domain / Cloudflare

| Host | Role |
|------|------|
| `myfabclean.com` | Marketing + current portal |
| `app.myfabclean.com` | Future customer app alias → same Firebase Hosting |
| `api.myfabclean.com` | Cloud Run website API |

Cloudflare DNS for `app`: add Firebase custom domain first, then CNAME `app` → the target Firebase shows. Prefer Free plan; Cloud Run **min instances = 0**.

Full detail: see project docs `customer-app-roadmap.md` in the Fab Clean Cursor store, or ask for the Mac DNS checklist after merge.

## Next phases (not in this PR)

2. Mobile app shell + offers  
3. Razorpay pay / invoice / wallet  
4. Referral + promos  
5. Capacitor native wrap  

## Redeploy

```bash
git checkout main && git pull
./scripts/deploy-firebase-hosting.sh
```
