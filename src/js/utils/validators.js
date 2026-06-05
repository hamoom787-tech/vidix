export function assertPositiveAmount(amount, minimum = 0) {
  const value = Number(amount);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error("Amount must be greater than zero.");
  }
  if (value < minimum) {
    throw new Error(`Minimum amount is ${minimum}.`);
  }
  return value;
}

export function assertTxId(txId) {
  const clean = String(txId || "").trim();
  if (clean.length < 6 || clean.length > 140) {
    throw new Error("Payment reference must be between 6 and 140 characters.");
  }
  return clean;
}

export function assertCryptoWallet(wallet) {
  const clean = String(wallet || "").trim();
  const looksLikeTron = /^T[A-Za-z0-9]{25,40}$/.test(clean);
  const looksLikeEth = /^0x[a-fA-F0-9]{40}$/.test(clean);
  if (!looksLikeTron && !looksLikeEth) {
    throw new Error("Enter a valid TRC20 or EVM wallet address.");
  }
  return clean;
}

export function assertReferralCode(code) {
  const clean = String(code || "").trim().toUpperCase();
  if (!/^[A-Z0-9-]{6,18}$/.test(clean)) {
    throw new Error("Invitation code is required and must be valid.");
  }
  return clean;
}

export function assertFundPassword(password) {
  const clean = String(password || "");
  if (clean.length < 6) {
    throw new Error("Fund password must be at least 6 characters.");
  }
  return clean;
}
