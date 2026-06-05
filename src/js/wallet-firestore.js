import { apiRequest } from "./api/backend-client";
import { assertCryptoWallet, assertFundPassword, assertPositiveAmount, assertTxId } from "./utils/validators";

export async function submitDepositRequest({ method, paymentMethod, amount, txId, receiptUrl, receiptReference }) {
  const safeAmount = assertPositiveAmount(amount, 1);
  const safeTxId = assertTxId(txId);
  const proofReference = String(receiptReference || receiptUrl || safeTxId || "").trim();
  if (proofReference.length < 6) throw new Error("Payment proof reference is required.");

  return apiRequest("/deposits", {
    body: {
      network: paymentMethod || method,
      paymentMethod: paymentMethod || method,
      amount: safeAmount,
      txId: safeTxId,
      receiptUrl: proofReference,
      receiptReference: proofReference
    }
  });
}

export async function submitWithdrawalRequest({ sourceWallet = "commission", walletAddress, amount, fundPassword }) {
  const safeAmount = assertPositiveAmount(amount, 10);
  const safeWallet = assertCryptoWallet(walletAddress);
  const safeFundPassword = assertFundPassword(fundPassword);

  return apiRequest("/withdrawals", {
    body: {
      sourceWallet,
      walletAddress: safeWallet,
      amount: safeAmount,
      fundPassword: safeFundPassword
    }
  });
}
