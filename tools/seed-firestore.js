import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

const args = parseArgs(process.argv.slice(2));
const projectId =
  args.project ||
  process.env.GCLOUD_PROJECT ||
  process.env.FIREBASE_PROJECT_ID ||
  process.env.VITE_FIREBASE_PROJECT_ID ||
  "vidix-local";
const files = args.file ? [args.file] : ["seed/system-settings.json", "seed/tasks.json"];

initializeApp({ projectId });
const db = getFirestore();

for (const file of files) {
  const fullPath = resolve(file);
  const json = JSON.parse(readFileSync(fullPath, "utf8"));
  const entries = Object.entries(json);

  for (const [path, data] of entries) {
    if (path.includes("REPLACE_WITH_FIREBASE_AUTH_UID")) {
      console.log(`Skipped placeholder path: ${path}`);
      continue;
    }

    validateDocPath(path);
    await db.doc(path).set(reviveSentinels(data), { merge: true });
    console.log(`Seeded ${path}`);
  }
}

console.log(`Done. Project: ${projectId}`);

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

function validateDocPath(path) {
  const segments = path.split("/").filter(Boolean);
  if (segments.length < 2 || segments.length % 2 !== 0) {
    throw new Error(`Invalid Firestore document path: ${path}`);
  }
}

function reviveSentinels(value) {
  if (value === "__SERVER_TIMESTAMP__") return FieldValue.serverTimestamp();
  if (Array.isArray(value)) return value.map(reviveSentinels);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, reviveSentinels(entry)]));
  }
  return value;
}
