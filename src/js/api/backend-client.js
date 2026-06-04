import { auth } from "../firebase-config";

const API_BASE_URL = String(import.meta.env.VITE_WORKER_API_URL || "").replace(/\/+$/, "");

export function hasBackendApi() {
  return API_BASE_URL.length > 0;
}

export async function apiRequest(path, { method = "POST", body, authRequired = true, headers = {} } = {}) {
  if (!API_BASE_URL) {
    throw new Error("Cloudflare Worker API URL is not configured. Set VITE_WORKER_API_URL.");
  }

  const requestHeaders = {
    Accept: "application/json",
    ...headers
  };

  if (body !== undefined) requestHeaders["Content-Type"] = "application/json";

  if (authRequired) {
    const user = auth.currentUser;
    if (!user) throw new Error("Sign in first.");
    requestHeaders.Authorization = `Bearer ${await user.getIdToken()}`;
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: requestHeaders,
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload?.error?.message || payload?.message || `Request failed with status ${response.status}.`);
  }

  return payload.data ?? payload;
}
