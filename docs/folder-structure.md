# VidiX Folder Structure

```text
vidix/
├── index.html
├── admin.html
├── vite.config.js
├── package.json
├── package-lock.json
├── firebase.json
├── firestore.rules
├── firestore.indexes.json
├── storage.rules
├── .env
├── .env.example
├── .firebaserc
├── .firebaserc.example
├── docs/
│   └── folder-structure.md
├── public/
│   └── assets/
│       └── images/
│           ├── banners/
│           ├── brand/
│           └── tasks/
├── seed/
│   ├── bootstrap-root-user.example.json
│   ├── system-settings.json
│   └── tasks.json
├── src/
│   ├── js/
│   │   ├── admin-console.js
│   │   ├── app.js
│   │   ├── platform-controller.js
│   │   ├── data/
│   │   ├── ui/
│   │   └── utils/
│   └── styles/
│       └── theme.css
├── tests/
│   └── firestore.rules.test.js
├── tools/
│   ├── seed-firestore.js
│   └── set-admin-claim.js
└── functions/
    ├── package.json
    ├── package-lock.json
    └── index.js
```

## Notes

- `index.html` is the current mobile-first user app shell.
- `admin.html` is the Firebase-only admin console.
- `src/js/admin-console.js` manages users, deposits, withdrawals, tasks, VIP levels, and investments through Firebase Auth/Functions.
- `functions/index.js` contains both user callable functions and admin callable actions.
- `tests/firestore.rules.test.js` runs against the Firestore emulator.
