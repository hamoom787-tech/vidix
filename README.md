# VidiX Platform

Premium mobile-first video task earning platform with Firebase Auth/Firestore, a Cloudflare Worker API backend, Admin Panel, Firestore rules, seed helpers, and rules tests.

## Local URLs

- User app: `http://127.0.0.1:5173`
- Admin panel: `http://127.0.0.1:5173/admin.html`
- Firebase Emulator UI, when running: `http://127.0.0.1:4000`
- Firestore emulator: `127.0.0.1:8085`

## Stack

- Frontend: Vite, HTML5, Tailwind CDN mobile shell, Firebase Web SDK.
- Backend: Firebase Auth + Firestore on the free Firebase plan, with Cloudflare Workers handling secure server-side money/task/admin actions.
- Security: client cannot write balances, VIP tier, deposits, withdrawals, ledger, or completed tasks. Money-moving operations go through the Cloudflare Worker API.

## Key Files

```text
index.html                         Home page entry
auth.html                          Login/signup entry
tasks.html / watch.html            Task hall and secure watch pages
deposit.html / withdraw.html       Money request pages
profile.html                       Account, balances, avatars, settings links
admin.html                         Admin Panel UI
src/js/pages/platform-pages.js      Shared controller for user pages
src/css/vidix-pages.css            Shared mobile visual system
src/js/admin-console.js            Admin Panel controller
worker/src/index.js                Cloudflare Worker backend API
wrangler.jsonc                     Cloudflare Worker deployment config
firestore.rules                    Firestore security rules
tests/firestore.rules.test.js      Rules test suite
seed/system-settings.json          VIP/referral/wallet/investment settings
seed/tasks.json                    Default task catalog
public/assets/images/certificates  Certificate/archive image assets
.env                               Local emulator-safe Firebase config
firebase.json                      Hosting and Firestore config
vite.config.js                     Multi-page build: app + admin
```

## Commands

```bash
npm install
npm run dev
npm run worker:dev
npm run build
npm run emulators
npm run admin:bootstrap
npm run seed
npm run test:rules
npm run deploy
npm run worker:deploy
```

## Cloudflare Worker Secrets

Create a Firebase/GCP service account key, then set the Worker secrets:

```bash
npx wrangler secret put GOOGLE_CLIENT_EMAIL
npx wrangler secret put GOOGLE_PRIVATE_KEY
npx wrangler secret put BOOTSTRAP_SECRET
```

Copy `.dev.vars.example` to `.dev.vars` for local Worker development.

## First Admin / Seed

After creating and signing into the first Firebase Auth admin account, call the Worker bootstrap endpoint with the Firebase ID token and `x-bootstrap-secret`. Then seed defaults:

```bash
curl -X POST "$VITE_WORKER_API_URL/admin/bootstrap-root" -H "Authorization: Bearer FIREBASE_ID_TOKEN" -H "x-bootstrap-secret: BOOTSTRAP_SECRET"
curl -X POST "$VITE_WORKER_API_URL/admin/seed-defaults" -H "Authorization: Bearer FIREBASE_ID_TOKEN" -H "x-bootstrap-secret: BOOTSTRAP_SECRET"
```

The npm helpers use the same API. Set `VIDIX_WORKER_API_URL`, `VIDIX_FIREBASE_ID_TOKEN`, and `VIDIX_BOOTSTRAP_SECRET`, then run:

```bash
npm run admin:bootstrap
npm run seed
```

## Firestore Collections

```text
users/{uid}
users/{uid}/downline_level_A/{memberUid}
users/{uid}/downline_level_B/{memberUid}
users/{uid}/downline_level_C/{memberUid}
tasks/{taskId}
user_tasks/{uid_taskId_dayKey}
deposits/{depositId}
withdrawals/{withdrawalId}
investments/{investmentId}
ledger/{ledgerId}
rank_applications/{applicationId}
admin_actions/{actionId}
system_settings/vip_levels
system_settings/referrals
system_settings/investment_plans
system_settings/wallets
public/news
```

## Production Checklist

- Replace `.env` local values with your Firebase Web Config.
- Set `VITE_WORKER_API_URL` to the deployed Worker URL.
- Update `.firebaserc` with the real Firebase project id.
- Create the first admin Auth user, then run Worker bootstrap.
- Seed `system_settings` and `tasks` through `/admin/seed-defaults`.
- Deploy Firestore rules, indexes, Hosting, and Cloudflare Worker.
- Replace local/static assets with licensed posters and final VidiX brand files.
- Replace `public/assets/images/certificates/legacy-mbitir-status-certificate.jpg` with an official VidiX certificate before making public legal claims.
- Review referral/investment wording legally before public launch.
