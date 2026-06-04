# VidiX Folder Structure

```text
vidix/
|-- index.html
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
|       |   |-- banners/
|       |   |-- brand/
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
|   |   |-- app.js
|   |   |-- firebase-auth.js
|   |   |-- firebase-config.js
|   |   |-- mobile-app.js
|   |   |-- platform-controller.js
|   |   |-- task-firestore.js
|   |   |-- wallet-firestore.js
|   |   |-- data/
|   |   |-- ui/
|   |   `-- utils/
|   `-- styles/
|       `-- theme.css
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

- `index.html` is the current mobile-first user app shell.
- `admin.html` is the admin console UI.
- `src/js/api/backend-client.js` attaches the Firebase Auth ID token and calls the Cloudflare Worker API.
- `worker/src/index.js` owns secure registration, task rewards, deposits, withdrawals, VIP upgrades, investments, imports, and admin actions.
- `firebase.json` deploys Firebase Hosting and Firestore rules/indexes only.
- `wrangler.jsonc` deploys the Cloudflare Worker backend.
- `tests/firestore.rules.test.js` runs against the Firestore emulator.
