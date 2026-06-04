import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

const args = parseArgs(process.argv.slice(2));
const projectId =
  args.project ||
  process.env.GCLOUD_PROJECT ||
  process.env.FIREBASE_PROJECT_ID ||
  process.env.VITE_FIREBASE_PROJECT_ID ||
  "vidix-local";

if (!args.uid && !args.email) {
  console.error("Usage: npm run admin:claim -- --uid USER_UID");
  console.error("   or: npm run admin:claim -- --email admin@example.com");
  process.exit(1);
}

initializeApp({ projectId });

const auth = getAuth();
const user = args.uid ? await auth.getUser(args.uid) : await auth.getUserByEmail(args.email);
const existingClaims = user.customClaims || {};
const admin = args.remove ? false : true;

await auth.setCustomUserClaims(user.uid, {
  ...existingClaims,
  admin
});

console.log(`Updated admin claim for ${user.uid} (${user.email || "no email"}): admin=${admin}`);
console.log("The user must sign out and sign in again to receive the updated token.");

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const next = argv[index + 1];
    parsed[key] = next && !next.startsWith("--") ? next : true;
    if (next && !next.startsWith("--")) index += 1;
  }
  return parsed;
}
