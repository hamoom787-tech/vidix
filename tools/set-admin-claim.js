const args = parseArgs(process.argv.slice(2));
const workerUrl = String(args.api || process.env.VIDIX_WORKER_API_URL || process.env.VITE_WORKER_API_URL || "").replace(/\/+$/, "");
const idToken = args.token || process.env.VIDIX_FIREBASE_ID_TOKEN || process.env.FIREBASE_ID_TOKEN;
const bootstrapSecret = args.bootstrapSecret || process.env.VIDIX_BOOTSTRAP_SECRET || process.env.BOOTSTRAP_SECRET;

if (!workerUrl || !idToken || !bootstrapSecret) {
  console.error("This project now uses Worker admin roles instead of Firebase custom claims.");
  console.error("Usage: node tools/set-admin-claim.js --api https://vidix-api.example.workers.dev --token FIREBASE_ID_TOKEN --bootstrapSecret SECRET");
  console.error("Or set VIDIX_WORKER_API_URL, VIDIX_FIREBASE_ID_TOKEN, and VIDIX_BOOTSTRAP_SECRET.");
  process.exit(1);
}

const response = await fetch(`${workerUrl}/admin/bootstrap-root`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${idToken}`,
    "x-bootstrap-secret": bootstrapSecret
  }
});
const payload = await response.json().catch(() => ({}));
if (!response.ok) {
  console.error(payload?.error?.message || `Admin bootstrap failed with ${response.status}.`);
  process.exit(1);
}

console.log(`Bootstrapped Worker admin role for uid ${payload.data?.uid}. Referral code: ${payload.data?.referralCode}.`);

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
