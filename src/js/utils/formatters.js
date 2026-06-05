export function formatMoney(value = 0, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 2
  }).format(Number(value || 0));
}

export function formatDate(value) {
  if (!value) return "-";
  const date = typeof value?.toDate === "function" ? value.toDate() : new Date(value);
  return new Intl.DateTimeFormat("ar-EG", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
}

export function todayKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Cairo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  const lookup = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${lookup.year}-${lookup.month}-${lookup.day}`;
}

export function maskUser(uidOrPhone = "") {
  const value = String(uidOrPhone);
  if (value.length <= 6) return `${value.slice(0, 2)}*****`;
  return `${value.slice(0, 5)}*****`;
}

export function calculatePlanReturn(amount, dailyRate, periodDays) {
  const principal = Number(amount || 0);
  const interest = principal * (Number(dailyRate || 0) / 100) * Number(periodDays || 0);
  return {
    principal,
    interest: +interest.toFixed(2),
    maturity: +(principal + interest).toFixed(2)
  };
}
