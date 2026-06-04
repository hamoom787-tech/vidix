import { apiRequest } from "./api/backend-client";

export async function listPendingDeposits() {
  const data = await apiRequest("/admin/deposits", { method: "GET" });
  return (data.deposits || []).filter((item) => item.status === "pending");
}

export async function listPendingWithdrawals() {
  const data = await apiRequest("/admin/withdrawals", { method: "GET" });
  return (data.withdrawals || []).filter((item) => item.status === "pending");
}

export async function approveDepositRequest(depositId, approvedAmount) {
  return apiRequest(`/admin/deposits/${encodeURIComponent(depositId)}/approve`, { body: { approvedAmount } });
}

export async function rejectDepositRequest(depositId, reason = "Rejected by admin") {
  return apiRequest(`/admin/deposits/${encodeURIComponent(depositId)}/reject`, { body: { reason } });
}

export async function settleWithdrawalRequest(withdrawalId, status, payoutTxId = "") {
  return apiRequest(`/admin/withdrawals/${encodeURIComponent(withdrawalId)}/settle`, { body: { status, payoutTxId } });
}

export async function getAdminDashboardStats() {
  return apiRequest("/admin/dashboard", { method: "GET" });
}
