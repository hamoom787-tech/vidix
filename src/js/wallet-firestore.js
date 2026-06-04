import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { httpsCallable } from "firebase/functions";
import { auth, functions, storage } from "./firebase-config";
import { assertCryptoWallet, assertFundPassword, assertPositiveAmount, assertTxId } from "./utils/validators";

const createDepositRequest = httpsCallable(functions, "createDepositRequest");
const requestWithdrawal = httpsCallable(functions, "requestWithdrawal");

export async function uploadReceiptImage(file) {
  if (!auth.currentUser) throw new Error("Authentication is required.");
  if (!file) throw new Error("Receipt image is required.");

  const cleanName = file.name.replace(/[^\w.-]/g, "_");
  const receiptRef = ref(storage, `receipts/${auth.currentUser.uid}/${Date.now()}-${cleanName}`);

  await uploadBytes(receiptRef, file, {
    contentType: file.type || "application/octet-stream",
    customMetadata: { uid: auth.currentUser.uid }
  });

  return getDownloadURL(receiptRef);
}

export async function submitDepositRequest({ method, paymentMethod, amount, txId, receiptFile }) {
  const safeAmount = assertPositiveAmount(amount, 1);
  const safeTxId = assertTxId(txId);
  const receiptUrl = await uploadReceiptImage(receiptFile);

  const response = await createDepositRequest({
    network: paymentMethod || method,
    paymentMethod: paymentMethod || method,
    amount: safeAmount,
    txId: safeTxId,
    receiptUrl
  });

  return response.data;
}

export async function submitWithdrawalRequest({ sourceWallet = "commission", walletAddress, amount, fundPassword }) {
  const safeAmount = assertPositiveAmount(amount, 10);
  const safeWallet = assertCryptoWallet(walletAddress);
  const safeFundPassword = assertFundPassword(fundPassword);

  // The balance check, fund password verification, deduction, ledger entry,
  // and pending withdrawal document are handled by Cloud Functions.
  const response = await requestWithdrawal({
    sourceWallet,
    walletAddress: safeWallet,
    amount: safeAmount,
    fundPassword: safeFundPassword
  });

  return response.data;
}
