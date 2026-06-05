# VidiX Folder Structure

```text
vidix/
|-- index.html
|-- auth.html
|-- tasks.html
|-- watch.html
|-- vip.html
|-- deposit.html
|-- withdraw.html
|-- profile.html
|-- wallet.html
|-- fund-password.html
|-- invoice.html
|-- fund.html
|-- team.html
|-- rank.html
|-- guide.html
|-- about.html
|-- certificates.html
|-- admin.html
|-- vite.config.js
|-- package.json
|-- package-lock.json
|-- firebase.json
|-- firestore.rules
|-- firestore.indexes.json
|-- wrangler.jsonc
|-- .env.example
|-- .dev.vars.example
|-- docs/
|   `-- folder-structure.md
|-- public/
|   `-- assets/
|       |-- images/
|       |   |-- avatars/
|       |   |-- banners/
|       |   |-- brand/
|       |   |-- certificates/
|       |   `-- tasks/
|       `-- videos/
|-- seed/
|   |-- bootstrap-root-user.example.json
|   |-- system-settings.json
|   `-- tasks.json
|-- src/
|   |-- js/
|   |   |-- api/
|   |   |   `-- backend-client.js
|   |   |-- admin-console.js
|   |   |-- firebase-auth.js
|   |   |-- firebase-config.js
|   |   |-- pages/
|   |   |   `-- platform-pages.js
|   |   |-- wallet-firestore.js
|   |   |-- ui/
|   |   |   `-- async-ui.js
|   |   `-- utils/
|   `-- css/
|       `-- vidix-pages.css
|-- tests/
|   `-- firestore.rules.test.js
|-- tools/
|   |-- seed-firestore.js
|   `-- set-admin-claim.js
`-- worker/
    `-- src/
        `-- index.js
```

## Notes

- Each user route is a standalone HTML entry, with shared rendering in `src/js/pages/platform-pages.js`.
- `admin.html` is the admin console UI.
- `src/js/api/backend-client.js` attaches the Firebase Auth ID token and calls the Cloudflare Worker API.
- `worker/src/index.js` owns secure registration, task rewards, deposits, withdrawals, VIP upgrades, investments, imports, and admin actions.
- `firebase.json` deploys Firebase Hosting and Firestore rules/indexes only.
- `wrangler.jsonc` deploys the Cloudflare Worker backend.
- `tests/firestore.rules.test.js` runs against the Firestore emulator.
