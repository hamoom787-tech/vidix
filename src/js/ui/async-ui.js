export function showToast(message, type = "success", timeout = 3400) {
  const toast = document.querySelector("#toast");
  if (!toast) return;
  toast.textContent = message;
  toast.classList.remove("hidden");
  toast.classList.toggle("border-red-500/50", type === "error");
  toast.classList.toggle("text-red-100", type === "error");
  toast.classList.toggle("border-emeraldNeon/40", type !== "error");
  clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => toast.classList.add("hidden"), timeout);
}

export async function withLoading(button, action, label = "Processing") {
  if (!button || button.dataset.loading === "true") return null;
  const original = button.innerHTML;
  button.dataset.loading = "true";
  button.disabled = true;
  button.innerHTML = `<span class="inline-flex items-center justify-center gap-2"><span class="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"></span>${label}</span>`;
  try {
    return await action();
  } catch (error) {
    showToast(error.message || "Operation failed.", "error");
    return null;
  } finally {
    button.dataset.loading = "false";
    button.disabled = false;
    button.innerHTML = original;
  }
}

export function formatMoney(value = 0, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 2
  }).format(Number(value || 0));
}

export function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
