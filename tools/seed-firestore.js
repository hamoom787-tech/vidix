import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const args = parseArgs(process.argv.slice(2));
const workerUrl = String(args.api || process.env.VIDIX_WORKER_API_URL || process.env.VITE_WORKER_API_URL || "").replace(/\/+$/, "");
const idToken = args.token || process.env.VIDIX_FIREBASE_ID_TOKEN || process.env.FIREBASE_ID_TOKEN;
const bootstrapSecret = args.bootstrapSecret || process.env.VIDIX_BOOTSTRAP_SECRET || process.env.BOOTSTRAP_SECRET;
const files = args.file ? [args.file] : ["seed/system-settings.json", "seed/tasks.json"];

if (!workerUrl || !idToken) {
  console.error("Usage: node tools/seed-firestore.js --api https://vidix-api.example.workers.dev --token FIREBASE_ID_TOKEN [--bootstrapSecret SECRET]");
  console.error("Or set VIDIX_WORKER_API_URL, VIDIX_FIREBASE_ID_TOKEN, and optionally VIDIX_BOOTSTRAP_SECRET.");
  process.exit(1);
}

const documents = {};
for (const file of files) {
  const fullPath = resolve(file);
  Object.assign(documents, JSON.parse(readFileSync(fullPath, "utf8")));
}

const response = await fetch(`${workerUrl}/admin/import-documents`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${idToken}`,
    "Content-Type": "application/json",
    ...(bootstrapSecret ? { "x-bootstrap-secret": bootstrapSecret } : {})
  },
  body: JSON.stringify({ documents })
});
const payload = await response.json().catch(() => ({}));
if (!response.ok) {
  console.error(payload?.error?.message || `Import failed with ${response.status}.`);
  process.exit(1);
}

console.log(`Imported ${payload.data?.count ?? Object.keys(documents).length} documents through ${workerUrl}.`);

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
