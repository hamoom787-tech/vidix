# VidiX Platform

Premium mobile-first video task earning platform with a Firebase-only Admin Panel, callable backend, Firestore rules, seed scripts, and rules tests.

## Local URLs

- User app: `http://127.0.0.1:5173`
- Admin panel: `http://127.0.0.1:5173/admin.html`
- Firebase Emulator UI, when running: `http://127.0.0.1:4000`

## Stack

- Frontend: Vite, HTML5, Tailwind CDN mobile shell, Firebase Web SDK.
- Backend: Firebase Auth, Firestore, Storage, Cloud Functions v2.
- Security: client cannot write balances, VIP tier, deposits, withdrawals, ledger, or completed tasks. Money-moving operations go through callable Cloud Functions.

## Key Files

```text
index.html                         User mobile UI
admin.html                         Admin Panel UI
src/js/mobile-app.js               User app Firebase controller
src/js/admin-console.js            Admin Panel Firebase controller
functions/index.js                 Callable backend and admin actions
firestore.rules                    Firestore security rules
storage.rules                      Storage security rules
tests/firestore.rules.test.js      Rules test suite
tools/seed-firestore.js            Firestore seed/import script
tools/set-admin-claim.js           Admin custom-claim script
seed/system-settings.json          VIP/referral/wallet/investment settings
seed/tasks.json                    Default task catalog
.env                               Local emulator-safe Firebase config
firebase.json                      Hosting, Functions, Firestore, Storage config
vite.config.js                     Multi-page build: app + admin
```

## Commands

```bash
npm install
cd functions && npm install && cd ..
npm run dev
npm run build
npm run emulators
npm run seed
npm run test:rules
npm run deploy
```

## Admin Claim

For the Auth emulator or a real Firebase project:

```bash
npm run admin:claim -- --uid USER_UID
npm run admin:claim -- --email admin@example.com
npm run admin:claim -- --uid USER_UID --remove
```

For a real Firebase project, make sure Admin SDK credentials are available through `GOOGLE_APPLICATION_CREDENTIALS` or your normal Firebase/Google ADC setup.

## Seed Firestore

Default seed:

```bash
npm run seed
```

Specific seed file:

```bash
npm run seed -- --file seed/tasks.json
```

The seed script writes document paths from JSON keys such as `tasks/task-id` and `system_settings/vip_levels`.

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
- Update `.firebaserc` with the real Firebase project id.
- Create the first admin Auth user and set `admin: true`.
- Seed `system_settings` and `tasks`.
- Deploy Firestore rules, Storage rules, indexes, Functions, and Hosting.
- Replace local/static assets with licensed posters and final VidiX brand files.
- Review referral/investment wording legally before public launch.
