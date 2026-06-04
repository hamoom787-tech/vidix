import { collection, getDocs, limit, orderBy, query, where } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "./firebase-config";

export async function listPendingDeposits() {
  const snapshot = await getDocs(
    query(collection(db, "deposits"), where("status", "==", "pending"), orderBy("createdAt", "desc"), limit(200))
  );
  return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
}

export async function listPendingWithdrawals() {
  const snapshot = await getDocs(
    query(collection(db, "withdrawals"), where("status", "==", "pending"), orderBy("createdAt", "desc"), limit(200))
  );
  return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
}

export async function approveDepositRequest(depositId, approvedAmount) {
  return (await httpsCallable(functions, "approveDeposit")({ depositId, approvedAmount })).data;
}

export async function rejectDepositRequest(depositId, reason = "Rejected by admin") {
  return (await httpsCallable(functions, "rejectDeposit")({ depositId, reason })).data;
}

export async function settleWithdrawalRequest(withdrawalId, status, payoutTxId = "") {
  return (await httpsCallable(functions, "settleWithdrawal")({ withdrawalId, status, payoutTxId })).data;
}

export async function getAdminDashboardStats() {
  return (await httpsCallable(functions, "adminDashboardStats")()).data;
}
