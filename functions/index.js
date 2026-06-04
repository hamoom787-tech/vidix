import { setGlobalOptions } from "firebase-functions/v2";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore, Timestamp } from "firebase-admin/firestore";
import bcrypt from "bcryptjs";

if (!getApps().length) initializeApp();
setGlobalOptions({ region: "us-central1", maxInstances: 20 });

const db = getFirestore();
const adminAuth = getAuth();

const LEVEL_ORDER = ["M0", "M1", "M2", "M3", "M4", "M5", "M6", "M7", "M8", "M9", "M10"];
const VIP_PRICES = {
  M0: 0,
  M1: 20,
  M2: 125,
  M3: 250,
  M4: 700,
  M5: 2300,
  M6: 5000,
  M7: 9000,
  M8: 15000,
  M9: 25000,
  M10: 50000
};
const REFERRAL_RATES = [
  { level: "A", rate: 0.04 },
  { level: "B", rate: 0.02 },
  { level: "C", rate: 0.01 }
];
const DEFAULT_USDT_EGP_RATE = 50;
const DEFAULT_WITHDRAWAL_SETTINGS = {
  minimum: 10,
  feeRate: 0.02,
  fixedFee: 0,
  allowedWallets: ["main", "commission"]
};

export const completeRegistration = onCall(async (request) => {
  const uid = requireUid(request);
  const referralCode = assertCode(request.data?.referralCode);
  const userRecord = await adminAuth.getUser(uid);
  const requestedPhone = String(request.data?.phone || "").trim().slice(0, 32);
  const requestedDisplayName = String(request.data?.displayName || "").trim().slice(0, 80);

  const inviterSnapshot = await db.collection("users").where("referralCode", "==", referralCode).limit(1).get();
  if (inviterSnapshot.empty) {
    throw new HttpsError("failed-precondition", "Invitation code does not exist.");
  }

  const inviter = inviterSnapshot.docs[0];
  const inviterData = inviter.data();
  const newReferralCode = await createUniqueReferralCode();
  const now = FieldValue.serverTimestamp();

  const referralPath = [inviter.id, ...(inviterData.referralPath || [])].slice(0, 3);
  const userRef = db.collection("users").doc(uid);

  await db.runTransaction(async (tx) => {
    const existing = await tx.get(userRef);
    if (existing.exists) return;

    tx.set(userRef, {
      email: userRecord.email || null,
      phoneNumber: userRecord.phoneNumber || requestedPhone || null,
      displayName: userRecord.displayName || requestedDisplayName || null,
      authProvider: request.data?.authProvider || "email",
      referralCode: newReferralCode,
      referrerUid: inviter.id,
      invitedByCode: referralCode,
      referralPath,
      vipLevel: "M0",
      balances: { main: 0, commission: 0, locked: 0 },
      income: { today: 0, month: 0, total: 0 },
      wallets: {},
      status: "active",
      registeredDayKey: dayKey(),
      createdAt: now,
      updatedAt: now
    });

    referralPath.forEach((ancestorUid, index) => {
      const level = ["A", "B", "C"][index];
      tx.set(db.collection("users").doc(ancestorUid).collection(`downline_level_${level}`).doc(uid), {
        uid,
        email: userRecord.email || null,
        phoneNumber: userRecord.phoneNumber || requestedPhone || null,
        vipLevel: "M0",
        registeredDayKey: dayKey(),
        createdAt: now
      });
    });
  });

  return { ok: true, referralCode: newReferralCode };
});

export const setFundPassword = onCall(async (request) => {
  const uid = requireUid(request);
  const fundPassword = assertFundPassword(request.data?.fundPassword);
  const hash = await bcrypt.hash(fundPassword, 12);

  await db.collection("users").doc(uid).update({
    fundPasswordHash: hash,
    updatedAt: FieldValue.serverTimestamp()
  });

  return { ok: true };
});

export const bindWallet = onCall(async (request) => {
  const uid = requireUid(request);
  const walletAddress = assertWallet(request.data?.walletAddress);
  const network = String(request.data?.network || "TRC20").toUpperCase();
  await verifyFundPassword(uid, request.data?.fundPassword);

  await db.collection("users").doc(uid).update({
    [`wallets.${network.toLowerCase()}`]: {
      address: walletAddress,
      network,
      boundAt: FieldValue.serverTimestamp()
    },
    updatedAt: FieldValue.serverTimestamp()
  });

  return { ok: true };
});

export const createDepositRequest = onCall(async (request) => {
  const uid = requireUid(request);
  const txId = assertTxId(request.data?.txId);
  const paymentMethodId = String(request.data?.paymentMethod || request.data?.network || "").trim();
  const receiptUrl = assertReceiptUrl(request.data?.receiptUrl);
  const walletSettings = await getWalletSettings();
  const paymentMethod = findPaymentMethod(walletSettings, paymentMethodId);
  const depositAmount = normalizeDepositAmount(request.data?.amount, paymentMethod, walletSettings);

  const duplicate = await db.collection("deposits").where("txId", "==", txId).where("paymentMethod", "==", paymentMethod.id).limit(1).get();
  if (!duplicate.empty) {
    throw new HttpsError("already-exists", "This transaction hash was already submitted.");
  }

  const docRef = await db.collection("deposits").add({
    uid,
    amount: depositAmount.usdAmount,
    usdAmount: depositAmount.usdAmount,
    originalAmount: depositAmount.originalAmount,
    originalCurrency: depositAmount.originalCurrency,
    fxRateUsdtEgp: depositAmount.fxRateUsdtEgp,
    txId,
    network: paymentMethod.id,
    paymentMethod: paymentMethod.id,
    paymentLabel: paymentMethod.label || paymentMethod.id,
    paymentWallet: paymentMethod.wallet || null,
    receiptUrl,
    status: "pending",
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  });

  return { ok: true, depositId: docRef.id, status: "pending" };
});

export const approveDeposit = onCall(async (request) => {
  requireAdmin(request);
  const depositId = String(request.data?.depositId || "").trim();
  const approvedAmount = request.data?.approvedAmount == null ? null : assertAmount(request.data.approvedAmount, 0.01);
  if (!depositId) throw new HttpsError("invalid-argument", "Deposit ID is required.");

  const depositRef = db.collection("deposits").doc(depositId);
  const ledgerRef = db.collection("ledger").doc();

  await db.runTransaction(async (tx) => {
    const depositSnap = await tx.get(depositRef);
    if (!depositSnap.exists) throw new HttpsError("not-found", "Deposit not found.");
    const deposit = depositSnap.data();
    if (deposit.status !== "pending") {
      throw new HttpsError("failed-precondition", "Only pending deposits can be approved.");
    }

    const amount = approvedAmount ?? Number(deposit.usdAmount ?? deposit.amount ?? 0);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new HttpsError("failed-precondition", "Deposit amount is invalid.");
    }
    const userRef = db.collection("users").doc(deposit.uid);
    const userSnap = await tx.get(userRef);
    if (!userSnap.exists) throw new HttpsError("not-found", "User profile not found.");

    tx.update(userRef, {
      "balances.main": FieldValue.increment(amount),
      updatedAt: FieldValue.serverTimestamp()
    });
    tx.update(depositRef, {
      approvedAmount: amount,
      approvedUsdAmount: amount,
      status: "approved",
      reviewedBy: request.auth.uid,
      reviewedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    });
    tx.set(ledgerRef, {
      uid: deposit.uid,
      type: "deposit_approved",
      amount,
      wallet: "main",
      refId: depositRef.id,
      createdAt: FieldValue.serverTimestamp()
    });

    writeReferralCommissions(tx, userSnap.data(), deposit.uid, amount, "deposit_approved");
  });

  return { ok: true, depositId, status: "approved" };
});

export const rejectDeposit = onCall(async (request) => {
  requireAdmin(request);
  const depositId = String(request.data?.depositId || "").trim();
  const reason = String(request.data?.reason || "Rejected by admin").slice(0, 300);
  if (!depositId) throw new HttpsError("invalid-argument", "Deposit ID is required.");

  await db.collection("deposits").doc(depositId).update({
    status: "rejected",
    reason,
    reviewedBy: request.auth.uid,
    reviewedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  });

  return { ok: true, depositId, status: "rejected" };
});

export const requestWithdrawal = onCall(async (request) => {
  const uid = requireUid(request);
  const walletSettings = await getWalletSettings();
  const withdrawalSettings = normalizeWithdrawalSettings(walletSettings.withdrawal);
  const sourceWallet = assertWithdrawWalletSource(request.data?.sourceWallet, withdrawalSettings.allowedWallets);
  const walletAddress = assertWallet(request.data?.walletAddress);
  const amount = assertAmount(request.data?.amount, withdrawalSettings.minimum);
  await verifyFundPassword(uid, request.data?.fundPassword);

  const fee = calculateWithdrawalFee(amount, withdrawalSettings);
  const netAmount = +(amount - fee).toFixed(2);
  if (netAmount <= 0) {
    throw new HttpsError("failed-precondition", "Withdrawal amount must be greater than the fee.");
  }
  const userRef = db.collection("users").doc(uid);
  const withdrawalRef = db.collection("withdrawals").doc();
  const ledgerRef = db.collection("ledger").doc();

  await db.runTransaction(async (tx) => {
    const userSnap = await tx.get(userRef);
    if (!userSnap.exists) throw new HttpsError("not-found", "User profile not found.");

    const data = userSnap.data();
    if (!walletMatchesBoundAddress(data.wallets, walletAddress)) {
      throw new HttpsError("failed-precondition", "Bind this wallet in your profile before requesting withdrawal.");
    }
    const walletBalance = Number(data.balances?.[sourceWallet] || 0);
    if (walletBalance < amount) {
      throw new HttpsError("failed-precondition", "Insufficient balance.");
    }

    tx.update(userRef, {
      [`balances.${sourceWallet}`]: FieldValue.increment(-amount),
      updatedAt: FieldValue.serverTimestamp()
    });

    tx.set(withdrawalRef, {
      uid,
      sourceWallet,
      amount,
      fee,
      feeRate: withdrawalSettings.feeRate,
      fixedFee: withdrawalSettings.fixedFee,
      netAmount,
      walletAddress,
      status: "pending",
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    });

    tx.set(ledgerRef, {
      uid,
      type: "withdrawal_hold",
      amount: -amount,
      sourceWallet,
      refId: withdrawalRef.id,
      createdAt: FieldValue.serverTimestamp()
    });
  });

  return { ok: true, withdrawalId: withdrawalRef.id, netAmount, fee };
});

export const settleWithdrawal = onCall(async (request) => {
  requireAdmin(request);
  const withdrawalId = String(request.data?.withdrawalId || "").trim();
  const status = String(request.data?.status || "").trim();
  const payoutTxId = String(request.data?.payoutTxId || "").trim();
  if (!withdrawalId || !["executed", "rejected"].includes(status)) {
    throw new HttpsError("invalid-argument", "Withdrawal ID and valid status are required.");
  }
  if (status === "executed" && payoutTxId.length < 6) {
    throw new HttpsError("invalid-argument", "Execution reference / payout TxID is required.");
  }

  const withdrawalRef = db.collection("withdrawals").doc(withdrawalId);
  const ledgerRef = db.collection("ledger").doc();

  await db.runTransaction(async (tx) => {
    const withdrawalSnap = await tx.get(withdrawalRef);
    if (!withdrawalSnap.exists) throw new HttpsError("not-found", "Withdrawal not found.");
    const withdrawal = withdrawalSnap.data();
    if (withdrawal.status !== "pending") {
      throw new HttpsError("failed-precondition", "Only pending withdrawals can be settled.");
    }

    tx.update(withdrawalRef, {
      status,
      payoutTxId: status === "executed" ? payoutTxId || null : null,
      reviewedBy: request.auth.uid,
      reviewedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    });

    if (status === "rejected") {
      const userRef = db.collection("users").doc(withdrawal.uid);
      tx.update(userRef, {
        [`balances.${withdrawal.sourceWallet}`]: FieldValue.increment(Number(withdrawal.amount || 0)),
        updatedAt: FieldValue.serverTimestamp()
      });
      tx.set(ledgerRef, {
        uid: withdrawal.uid,
        type: "withdrawal_refund",
        amount: Number(withdrawal.amount || 0),
        wallet: withdrawal.sourceWallet,
        refId: withdrawalRef.id,
        createdAt: FieldValue.serverTimestamp()
      });
    } else {
      tx.set(ledgerRef, {
        uid: withdrawal.uid,
        type: "withdrawal_executed",
        amount: 0,
        grossAmount: Number(withdrawal.amount || 0),
        fee: Number(withdrawal.fee || 0),
        netAmount: Number(withdrawal.netAmount || 0),
        wallet: withdrawal.sourceWallet,
        payoutTxId,
        refId: withdrawalRef.id,
        createdAt: FieldValue.serverTimestamp()
      });
    }
  });

  return { ok: true, withdrawalId, status };
});

export const startTaskWatch = onCall(async (request) => {
  const uid = requireUid(request);
  const taskId = String(request.data?.taskId || "").trim();
  const currentDayKey = dayKey();
  if (!taskId) throw new HttpsError("invalid-argument", "Task ID is required.");

  const taskRef = db.collection("tasks").doc(taskId);
  const userRef = db.collection("users").doc(uid);
  const userTaskRef = db.collection("user_tasks").doc(`${uid}_${taskId}_${currentDayKey}`);
  const sessionRef = db.collection("task_sessions").doc();

  return db.runTransaction(async (tx) => {
    const [taskSnap, userSnap, userTaskSnap] = await Promise.all([tx.get(taskRef), tx.get(userRef), tx.get(userTaskRef)]);
    if (!taskSnap.exists) throw new HttpsError("not-found", "Task not found.");
    if (!userSnap.exists) throw new HttpsError("not-found", "User profile not found.");
    if (userTaskSnap.exists) throw new HttpsError("already-exists", "Task already completed today.");

    const task = taskSnap.data();
    const user = userSnap.data();
    if (task.status !== "active") throw new HttpsError("failed-precondition", "Task is not active.");
    if (!levelAllowed(user.vipLevel || "M0", task.vipRequired || "M0")) {
      throw new HttpsError("permission-denied", "VIP level is not eligible for this task.");
    }

    const dailyLimit = await getDailyLimit(tx, user.vipLevel || "M0");
    const completedToday = await tx.get(
      db.collection("user_tasks").where("uid", "==", uid).where("dayKey", "==", currentDayKey).where("status", "==", "completed")
    );
    if (completedToday.size >= dailyLimit) {
      throw new HttpsError("resource-exhausted", "Daily task limit reached.");
    }

    const durationSeconds = assertInteger(Number(task.durationSeconds || 12), 5, 900);
    const nowMs = Date.now();
    const earliestClaimAt = Timestamp.fromMillis(nowMs + durationSeconds * 1000);
    tx.set(sessionRef, {
      uid,
      taskId,
      dayKey: currentDayKey,
      durationSeconds,
      status: "watching",
      startedAt: FieldValue.serverTimestamp(),
      earliestClaimAt,
      expiresAt: Timestamp.fromMillis(nowMs + (durationSeconds + 900) * 1000)
    });

    return { ok: true, sessionId: sessionRef.id, taskId, durationSeconds, earliestClaimAtMs: earliestClaimAt.toMillis() };
  });
});

export const completeTask = onCall(async (request) => {
  const uid = requireUid(request);
  const taskId = String(request.data?.taskId || "").trim();
  const watchSessionId = String(request.data?.watchSessionId || request.data?.sessionId || "").trim();
  const requestedDayKey = dayKey();
  if (!taskId || !watchSessionId) throw new HttpsError("invalid-argument", "Task ID and watch session are required.");

  const taskRef = db.collection("tasks").doc(taskId);
  const userRef = db.collection("users").doc(uid);
  const userTaskRef = db.collection("user_tasks").doc(`${uid}_${taskId}_${requestedDayKey}`);
  const sessionRef = db.collection("task_sessions").doc(watchSessionId);
  const ledgerRef = db.collection("ledger").doc();

  await db.runTransaction(async (tx) => {
    const [taskSnap, userSnap, userTaskSnap, sessionSnap] = await Promise.all([tx.get(taskRef), tx.get(userRef), tx.get(userTaskRef), tx.get(sessionRef)]);
    if (!taskSnap.exists) throw new HttpsError("not-found", "Task not found.");
    if (!userSnap.exists) throw new HttpsError("not-found", "User profile not found.");
    if (!sessionSnap.exists) throw new HttpsError("failed-precondition", "Start the watch session before claiming.");
    if (userTaskSnap.exists) throw new HttpsError("already-exists", "Task already completed today.");

    const task = taskSnap.data();
    const user = userSnap.data();
    const session = sessionSnap.data();
    if (session.uid !== uid || session.taskId !== taskId || session.dayKey !== requestedDayKey || session.status !== "watching") {
      throw new HttpsError("permission-denied", "Invalid watch session.");
    }
    if (Date.now() < session.earliestClaimAt.toMillis()) {
      throw new HttpsError("failed-precondition", "Watch time has not completed yet.");
    }
    if (session.expiresAt && Date.now() > session.expiresAt.toMillis()) {
      throw new HttpsError("deadline-exceeded", "Watch session expired. Restart the task.");
    }
    if (task.status !== "active") throw new HttpsError("failed-precondition", "Task is not active.");
    if (!levelAllowed(user.vipLevel || "M0", task.vipRequired || "M0")) {
      throw new HttpsError("permission-denied", "VIP level is not eligible for this task.");
    }

    const dailyLimit = await getDailyLimit(tx, user.vipLevel || "M0");
    const completedToday = await tx.get(
      db.collection("user_tasks").where("uid", "==", uid).where("dayKey", "==", requestedDayKey).where("status", "==", "completed")
    );
    if (completedToday.size >= dailyLimit) {
      throw new HttpsError("resource-exhausted", "Daily task limit reached.");
    }

    const reward = Number(task.reward || 0);
    tx.set(userTaskRef, {
      uid,
      taskId,
      reward,
      status: "completed",
      dayKey: requestedDayKey,
      watchSessionId,
      createdAt: FieldValue.serverTimestamp()
    });
    tx.update(sessionRef, {
      status: "claimed",
      claimedAt: FieldValue.serverTimestamp()
    });

    tx.update(userRef, {
      "balances.commission": FieldValue.increment(reward),
      "income.today": FieldValue.increment(reward),
      "income.month": FieldValue.increment(reward),
      "income.total": FieldValue.increment(reward),
      updatedAt: FieldValue.serverTimestamp()
    });

    tx.set(ledgerRef, {
      uid,
      type: "task_reward",
      amount: reward,
      wallet: "commission",
      refId: userTaskRef.id,
      createdAt: FieldValue.serverTimestamp()
    });

    writeReferralCommissions(tx, user, uid, reward, "task_reward");
  });

  return { ok: true, status: "completed" };
});

export const upgradeVip = onCall(async (request) => {
  const uid = requireUid(request);
  const levelId = String(request.data?.levelId || "").toUpperCase();
  assertVipLevel(levelId);

  const userRef = db.collection("users").doc(uid);
  const subscriptionRef = db.collection("subscriptions").doc();
  const ledgerRef = db.collection("ledger").doc();

  await db.runTransaction(async (tx) => {
    const userSnap = await tx.get(userRef);
    if (!userSnap.exists) throw new HttpsError("not-found", "User profile not found.");
    const user = userSnap.data();
    const level = await getVipLevel(tx, levelId);
    const price = Number(level.price ?? VIP_PRICES[levelId] ?? 0);
    if (LEVEL_ORDER.indexOf(levelId) <= LEVEL_ORDER.indexOf(user.vipLevel || "M0")) {
      throw new HttpsError("failed-precondition", "Target level must be higher than current level.");
    }
    if (Number(user.balances?.main || 0) < price) {
      throw new HttpsError("failed-precondition", "Insufficient main wallet balance.");
    }

    tx.update(userRef, {
      vipLevel: levelId,
      vipStartedAt: FieldValue.serverTimestamp(),
      "balances.main": FieldValue.increment(-price),
      updatedAt: FieldValue.serverTimestamp()
    });
    tx.set(subscriptionRef, {
      uid,
      levelId,
      amount: price,
      sourceWallet: "main",
      status: "active",
      createdAt: FieldValue.serverTimestamp()
    });

    tx.set(ledgerRef, {
      uid,
      type: "vip_upgrade",
      amount: -price,
      levelId,
      wallet: "main",
      refId: subscriptionRef.id,
      createdAt: FieldValue.serverTimestamp()
    });

    updateReferralTreeVip(tx, user.referralPath || [], uid, levelId);
    writeReferralCommissions(tx, user, uid, price, "vip_upgrade");
  });

  return { ok: true, vipLevel: levelId };
});

export const joinInvestment = onCall(async (request) => {
  const uid = requireUid(request);
  const planId = String(request.data?.planId || "").trim();
  const amount = assertAmount(request.data?.amount, 50);
  const planSnap = await db.collection("system_settings").doc("investment_plans").get();
  const plan = (planSnap.data()?.plans || []).find((item) => item.id === planId);
  if (!plan) throw new HttpsError("not-found", "Investment plan not found.");
  if (amount < Number(plan.minAmount || 0)) throw new HttpsError("failed-precondition", "Amount is below plan minimum.");

  const userRef = db.collection("users").doc(uid);
  const investmentRef = db.collection("investments").doc();
  const ledgerRef = db.collection("ledger").doc();

  await db.runTransaction(async (tx) => {
    const userSnap = await tx.get(userRef);
    if (!userSnap.exists) throw new HttpsError("not-found", "User profile not found.");
    if (Number(userSnap.data().balances?.main || 0) < amount) {
      throw new HttpsError("failed-precondition", "Insufficient main wallet balance.");
    }

    const maturityAt = Timestamp.fromMillis(Date.now() + Number(plan.periodDays) * 24 * 60 * 60 * 1000);
    tx.update(userRef, {
      "balances.main": FieldValue.increment(-amount),
      "balances.locked": FieldValue.increment(amount),
      updatedAt: FieldValue.serverTimestamp()
    });
    tx.set(investmentRef, {
      uid,
      planId,
      amount,
      dailyRate: Number(plan.dailyRate),
      periodDays: Number(plan.periodDays),
      maturityAt,
      status: "active",
      createdAt: FieldValue.serverTimestamp()
    });
    tx.set(ledgerRef, {
      uid,
      type: "investment_lock",
      amount: -amount,
      wallet: "main",
      refId: investmentRef.id,
      createdAt: FieldValue.serverTimestamp()
    });
  });

  return { ok: true, investmentId: investmentRef.id };
});

export const applyForRank = onCall(async (request) => {
  const uid = requireUid(request);
  const rankId = String(request.data?.rankId || "").trim();
  if (!rankId) throw new HttpsError("invalid-argument", "Rank ID is required.");

  const applicationRef = await db.collection("rank_applications").add({
    uid,
    rankId,
    status: "pending_review",
    contractAccepted: true,
    acceptedAt: FieldValue.serverTimestamp(),
    createdAt: FieldValue.serverTimestamp()
  });

  return { ok: true, applicationId: applicationRef.id };
});

export const adminDashboardStats = onCall(async (request) => {
  requireAdmin(request);
  const [users, deposits, withdrawals, tasks, investments] = await Promise.all([
    db.collection("users").limit(500).get(),
    db.collection("deposits").where("status", "==", "pending").limit(500).get(),
    db.collection("withdrawals").where("status", "==", "pending").limit(500).get(),
    db.collection("tasks").where("status", "==", "active").limit(500).get(),
    db.collection("investments").where("status", "==", "active").limit(500).get()
  ]);

  return {
    ok: true,
    stats: {
      users: users.size,
      pendingDeposits: deposits.size,
      pendingWithdrawals: withdrawals.size,
      activeTasks: tasks.size,
      activeInvestments: investments.size
    }
  };
});

export const adminAdjustBalance = onCall(async (request) => {
  const adminUid = requireAdmin(request);
  const uid = String(request.data?.uid || "").trim();
  const wallet = assertBalanceWallet(request.data?.wallet);
  const amount = assertSignedAmount(request.data?.amount);
  const reason = String(request.data?.reason || "Admin balance adjustment").slice(0, 300);
  if (!uid) throw new HttpsError("invalid-argument", "User UID is required.");

  const userRef = db.collection("users").doc(uid);
  const ledgerRef = db.collection("ledger").doc();
  const actionRef = db.collection("admin_actions").doc();

  await db.runTransaction(async (tx) => {
    const userSnap = await tx.get(userRef);
    if (!userSnap.exists) throw new HttpsError("not-found", "User profile not found.");

    const currentBalance = Number(userSnap.data().balances?.[wallet] || 0);
    if (currentBalance + amount < 0) {
      throw new HttpsError("failed-precondition", "Adjustment would create a negative balance.");
    }

    tx.update(userRef, {
      [`balances.${wallet}`]: FieldValue.increment(amount),
      updatedAt: FieldValue.serverTimestamp()
    });
    tx.set(ledgerRef, {
      uid,
      type: "admin_balance_adjustment",
      amount,
      wallet,
      reason,
      adminUid,
      createdAt: FieldValue.serverTimestamp()
    });
    tx.set(actionRef, {
      adminUid,
      action: "adminAdjustBalance",
      targetUid: uid,
      payload: { wallet, amount, reason },
      createdAt: FieldValue.serverTimestamp()
    });
  });

  return { ok: true };
});

export const adminSetUserVip = onCall(async (request) => {
  const adminUid = requireAdmin(request);
  const uid = String(request.data?.uid || "").trim();
  const vipLevel = assertVipLevel(request.data?.vipLevel);
  const reason = String(request.data?.reason || "Admin VIP update").slice(0, 300);
  if (!uid) throw new HttpsError("invalid-argument", "User UID is required.");

  await db.collection("users").doc(uid).update({
    vipLevel,
    updatedAt: FieldValue.serverTimestamp()
  });
  await writeAdminAction(adminUid, "adminSetUserVip", uid, { vipLevel, reason });
  return { ok: true, vipLevel };
});

export const adminSetUserStatus = onCall(async (request) => {
  const adminUid = requireAdmin(request);
  const uid = String(request.data?.uid || "").trim();
  const status = assertUserStatus(request.data?.status);
  const reason = String(request.data?.reason || "Admin status update").slice(0, 300);
  if (!uid) throw new HttpsError("invalid-argument", "User UID is required.");

  await db.collection("users").doc(uid).update({
    status,
    statusReason: reason,
    updatedAt: FieldValue.serverTimestamp()
  });
  await writeAdminAction(adminUid, "adminSetUserStatus", uid, { status, reason });
  return { ok: true, status };
});

export const adminUpsertTask = onCall(async (request) => {
  const adminUid = requireAdmin(request);
  const task = sanitizeTaskPayload(request.data || {});
  const taskRef = db.collection("tasks").doc(task.id);

  await taskRef.set(
    {
      ...task,
      updatedAt: FieldValue.serverTimestamp(),
      createdAt: FieldValue.serverTimestamp()
    },
    { merge: true }
  );
  await writeAdminAction(adminUid, "adminUpsertTask", task.id, task);
  return { ok: true, taskId: task.id };
});

export const adminArchiveTask = onCall(async (request) => {
  const adminUid = requireAdmin(request);
  const taskId = String(request.data?.taskId || "").trim();
  if (!taskId) throw new HttpsError("invalid-argument", "Task ID is required.");

  await db.collection("tasks").doc(taskId).update({
    status: "archived",
    updatedAt: FieldValue.serverTimestamp()
  });
  await writeAdminAction(adminUid, "adminArchiveTask", taskId, {});
  return { ok: true, taskId, status: "archived" };
});

export const adminUpsertVipLevel = onCall(async (request) => {
  const adminUid = requireAdmin(request);
  const level = {
    id: assertVipLevel(request.data?.id),
    price: assertAmount(request.data?.price ?? 0, 0),
    dailyTasks: assertInteger(request.data?.dailyTasks, 1, 200),
    reward: assertAmount(request.data?.reward ?? 0, 0)
  };
  const settingsRef = db.collection("system_settings").doc("vip_levels");

  await db.runTransaction(async (tx) => {
    const settingsSnap = await tx.get(settingsRef);
    const levels = settingsSnap.data()?.levels || [];
    const index = levels.findIndex((item) => item.id === level.id);
    if (index >= 0) levels[index] = { ...levels[index], ...level };
    else levels.push(level);
    levels.sort((a, b) => LEVEL_ORDER.indexOf(a.id) - LEVEL_ORDER.indexOf(b.id));
    tx.set(settingsRef, { levels, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  });

  await writeAdminAction(adminUid, "adminUpsertVipLevel", level.id, level);
  return { ok: true, level };
});

export const adminUpsertInvestmentPlan = onCall(async (request) => {
  const adminUid = requireAdmin(request);
  const plan = sanitizeInvestmentPlan(request.data || {});
  const settingsRef = db.collection("system_settings").doc("investment_plans");

  await db.runTransaction(async (tx) => {
    const settingsSnap = await tx.get(settingsRef);
    const plans = settingsSnap.data()?.plans || [];
    const index = plans.findIndex((item) => item.id === plan.id);
    if (index >= 0) plans[index] = { ...plans[index], ...plan };
    else plans.push(plan);
    tx.set(settingsRef, { plans, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  });

  await writeAdminAction(adminUid, "adminUpsertInvestmentPlan", plan.id, plan);
  return { ok: true, plan };
});

export const adminSetInvestmentStatus = onCall(async (request) => {
  const adminUid = requireAdmin(request);
  const investmentId = String(request.data?.investmentId || "").trim();
  const status = String(request.data?.status || "").trim();
  if (!investmentId || !["active", "matured", "cancelled"].includes(status)) {
    throw new HttpsError("invalid-argument", "Investment ID and valid status are required.");
  }

  const investmentRef = db.collection("investments").doc(investmentId);
  const actionRef = db.collection("admin_actions").doc();

  await db.runTransaction(async (tx) => {
    const investmentSnap = await tx.get(investmentRef);
    if (!investmentSnap.exists) throw new HttpsError("not-found", "Investment not found.");
    const investment = investmentSnap.data();

    tx.update(investmentRef, {
      status,
      reviewedBy: adminUid,
      reviewedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    });

    if (["matured", "cancelled"].includes(status) && investment.status === "active") {
      const principal = Number(investment.amount || 0);
      const interest =
        status === "matured"
          ? +(principal * (Number(investment.dailyRate || 0) / 100) * Number(investment.periodDays || 0)).toFixed(2)
          : 0;
      const payout = +(principal + interest).toFixed(2);
      const userRef = db.collection("users").doc(investment.uid);
      const ledgerRef = db.collection("ledger").doc();
      tx.update(userRef, {
        "balances.locked": FieldValue.increment(-principal),
        "balances.main": FieldValue.increment(payout),
        "income.total": FieldValue.increment(interest),
        updatedAt: FieldValue.serverTimestamp()
      });
      tx.set(ledgerRef, {
        uid: investment.uid,
        type: status === "matured" ? "investment_maturity" : "investment_cancel_refund",
        amount: payout,
        principal,
        interest,
        wallet: "main",
        refId: investmentId,
        adminUid,
        createdAt: FieldValue.serverTimestamp()
      });
    }

    tx.set(actionRef, {
      adminUid,
      action: "adminSetInvestmentStatus",
      targetUid: investment.uid,
      refId: investmentId,
      payload: { status },
      createdAt: FieldValue.serverTimestamp()
    });
  });

  return { ok: true, investmentId, status };
});

function requireUid(request) {
  if (!request.auth?.uid) {
    throw new HttpsError("unauthenticated", "Authentication required.");
  }
  return request.auth.uid;
}

function requireAdmin(request) {
  const uid = requireUid(request);
  if (request.auth.token.admin !== true) {
    throw new HttpsError("permission-denied", "Admin claim required.");
  }
  return uid;
}

function assertAmount(amount, minimum) {
  const value = Number(amount);
  if (!Number.isFinite(value) || value < minimum) {
    throw new HttpsError("invalid-argument", `Amount must be at least ${minimum}.`);
  }
  return +value.toFixed(2);
}

function assertReceiptUrl(url) {
  const value = String(url || "").trim();
  const isHttps = value.startsWith("https://");
  const isEmulatorUrl = process.env.FUNCTIONS_EMULATOR === "true" && /^https?:\/\/(127\.0\.0\.1|localhost):\d+\//.test(value);
  if (!isHttps && !isEmulatorUrl) {
    throw new HttpsError("invalid-argument", "A valid uploaded receipt URL is required.");
  }
  return value;
}

function assertCode(code) {
  const value = String(code || "").trim().toUpperCase();
  if (!/^[A-Z0-9-]{6,18}$/.test(value)) {
    throw new HttpsError("invalid-argument", "Invalid invitation code.");
  }
  return value;
}

function assertTxId(txId) {
  const value = String(txId || "").trim();
  if (value.length < 12 || value.length > 140) {
    throw new HttpsError("invalid-argument", "Invalid transaction hash.");
  }
  return value;
}

function assertWallet(wallet) {
  const value = String(wallet || "").trim();
  const looksLikeTron = /^T[A-Za-z0-9]{25,40}$/.test(value);
  const looksLikeEth = /^0x[a-fA-F0-9]{40}$/.test(value);
  if (!looksLikeTron && !looksLikeEth) {
    throw new HttpsError("invalid-argument", "Invalid wallet address.");
  }
  return value;
}

function assertWithdrawWalletSource(source, allowedWallets = ["main", "commission"]) {
  const value = String(source || "main").trim();
  if (!allowedWallets.includes(value)) {
    throw new HttpsError("invalid-argument", "Invalid wallet source.");
  }
  return value;
}

function assertBalanceWallet(source) {
  const value = String(source || "main").trim();
  if (!["main", "commission", "locked"].includes(value)) {
    throw new HttpsError("invalid-argument", "Invalid balance wallet.");
  }
  return value;
}

function assertSignedAmount(amount) {
  const value = Number(amount);
  if (!Number.isFinite(value) || value === 0) {
    throw new HttpsError("invalid-argument", "Amount delta must be a non-zero number.");
  }
  return +value.toFixed(2);
}

function assertInteger(value, minimum, maximum) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < minimum || number > maximum) {
    throw new HttpsError("invalid-argument", `Value must be an integer between ${minimum} and ${maximum}.`);
  }
  return number;
}

function assertVipLevel(level) {
  const value = String(level || "").toUpperCase();
  if (!LEVEL_ORDER.includes(value)) {
    throw new HttpsError("invalid-argument", "Invalid VIP level.");
  }
  return value;
}

function assertUserStatus(status) {
  const value = String(status || "").trim();
  if (!["active", "suspended", "review"].includes(value)) {
    throw new HttpsError("invalid-argument", "Invalid user status.");
  }
  return value;
}

function assertFundPassword(password) {
  const value = String(password || "");
  if (value.length < 6) {
    throw new HttpsError("invalid-argument", "Fund password is too short.");
  }
  return value;
}

async function verifyFundPassword(uid, candidate) {
  const userSnap = await db.collection("users").doc(uid).get();
  const hash = userSnap.data()?.fundPasswordHash;
  if (!hash) throw new HttpsError("failed-precondition", "Fund password is not set.");
  const ok = await bcrypt.compare(String(candidate || ""), hash);
  if (!ok) throw new HttpsError("permission-denied", "Invalid fund password.");
}

async function createUniqueReferralCode() {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const code = `VX-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    const existing = await db.collection("users").where("referralCode", "==", code).limit(1).get();
    if (existing.empty) return code;
  }
  throw new HttpsError("internal", "Could not create referral code.");
}

async function getWalletSettings() {
  const snapshot = await db.collection("system_settings").doc("wallets").get();
  const data = snapshot.data() || {};
  return {
    ...data,
    fx: {
      usdtEgpRate: Number(data.fx?.usdtEgpRate || data.usdtEgpRate || DEFAULT_USDT_EGP_RATE)
    },
    withdrawal: normalizeWithdrawalSettings(data.withdrawal)
  };
}

function normalizeWithdrawalSettings(settings = {}) {
  const feeRate = Number(settings.feeRate ?? DEFAULT_WITHDRAWAL_SETTINGS.feeRate);
  const fixedFee = Number(settings.fixedFee ?? DEFAULT_WITHDRAWAL_SETTINGS.fixedFee);
  const minimum = Number(settings.minimum ?? DEFAULT_WITHDRAWAL_SETTINGS.minimum);
  const allowedWallets = Array.isArray(settings.allowedWallets) && settings.allowedWallets.length ? settings.allowedWallets : DEFAULT_WITHDRAWAL_SETTINGS.allowedWallets;
  return {
    minimum: Number.isFinite(minimum) && minimum > 0 ? minimum : DEFAULT_WITHDRAWAL_SETTINGS.minimum,
    feeRate: Number.isFinite(feeRate) && feeRate >= 0 ? feeRate : DEFAULT_WITHDRAWAL_SETTINGS.feeRate,
    fixedFee: Number.isFinite(fixedFee) && fixedFee >= 0 ? fixedFee : DEFAULT_WITHDRAWAL_SETTINGS.fixedFee,
    allowedWallets: allowedWallets.filter((wallet) => ["main", "commission"].includes(wallet)).length
      ? allowedWallets.filter((wallet) => ["main", "commission"].includes(wallet))
      : DEFAULT_WITHDRAWAL_SETTINGS.allowedWallets
  };
}

function findPaymentMethod(settings, requestedId) {
  const normalizedId = String(requestedId || "").trim().toUpperCase();
  const methods = settings.depositNetworks || [];
  const method = methods.find((item) => String(item.id || "").toUpperCase() === normalizedId);
  if (!method || method.status !== "active") {
    throw new HttpsError("invalid-argument", "Payment method is not available.");
  }
  return method;
}

function normalizeDepositAmount(rawAmount, paymentMethod, settings) {
  const originalCurrency = String(paymentMethod.currency || "USDT").toUpperCase();
  const originalMinimum = Number(paymentMethod.minimumDeposit || (originalCurrency === "EGP" ? 100 : 20));
  const originalAmount = assertAmount(rawAmount, originalMinimum);
  const fxRateUsdtEgp = Number(settings.fx?.usdtEgpRate || DEFAULT_USDT_EGP_RATE);

  if (originalCurrency === "EGP") {
    if (!Number.isFinite(fxRateUsdtEgp) || fxRateUsdtEgp <= 0) {
      throw new HttpsError("failed-precondition", "USDT/EGP exchange rate is not configured.");
    }
    return {
      originalAmount,
      originalCurrency,
      fxRateUsdtEgp,
      usdAmount: +(originalAmount / fxRateUsdtEgp).toFixed(2)
    };
  }

  return {
    originalAmount,
    originalCurrency,
    fxRateUsdtEgp: null,
    usdAmount: originalAmount
  };
}

function calculateWithdrawalFee(amount, settings) {
  return +(amount * Number(settings.feeRate || 0) + Number(settings.fixedFee || 0)).toFixed(2);
}

function walletMatchesBoundAddress(wallets = {}, walletAddress) {
  const normalized = String(walletAddress || "").trim().toLowerCase();
  return Object.values(wallets || {}).some((wallet) => String(wallet?.address || "").trim().toLowerCase() === normalized);
}

async function getVipLevel(tx, levelId) {
  const settingsSnap = await tx.get(db.collection("system_settings").doc("vip_levels"));
  const level = (settingsSnap.data()?.levels || []).find((item) => item.id === levelId);
  if (!level && VIP_PRICES[levelId] == null) {
    throw new HttpsError("invalid-argument", "Unknown VIP level.");
  }
  return level || { id: levelId, price: VIP_PRICES[levelId] };
}

function updateReferralTreeVip(tx, referralPath, uid, vipLevel) {
  referralPath.slice(0, 3).forEach((ancestorUid, index) => {
    const level = ["A", "B", "C"][index];
    if (!ancestorUid || !level) return;
    tx.set(
      db.collection("users").doc(ancestorUid).collection(`downline_level_${level}`).doc(uid),
      {
        vipLevel,
        updatedAt: FieldValue.serverTimestamp()
      },
      { merge: true }
    );
  });
}

function levelAllowed(userLevel, requiredLevel) {
  return LEVEL_ORDER.indexOf(userLevel) >= LEVEL_ORDER.indexOf(requiredLevel);
}

async function getDailyLimit(tx, vipLevel) {
  const settingsRef = db.collection("system_settings").doc("vip_levels");
  const settingsSnap = await tx.get(settingsRef);
  const level = (settingsSnap.data()?.levels || []).find((item) => item.id === vipLevel);
  return Number(level?.dailyTasks || 1);
}

function writeReferralCommissions(tx, user, sourceUid, baseAmount, sourceType) {
  const path = user.referralPath || [];
  REFERRAL_RATES.forEach(({ level, rate }, index) => {
    const ancestorUid = path[index];
    if (!ancestorUid) return;

    const amount = +(baseAmount * rate).toFixed(2);
    const ancestorRef = db.collection("users").doc(ancestorUid);
    const ledgerRef = db.collection("ledger").doc();
    tx.update(ancestorRef, {
      "balances.commission": FieldValue.increment(amount),
      "income.today": FieldValue.increment(amount),
      "income.month": FieldValue.increment(amount),
      "income.total": FieldValue.increment(amount),
      updatedAt: FieldValue.serverTimestamp()
    });
    tx.set(ledgerRef, {
      uid: ancestorUid,
      type: "referral_commission",
      amount,
      rate,
      level,
      sourceUid,
      sourceType,
      wallet: "commission",
      createdAt: FieldValue.serverTimestamp()
    });
  });
}

function dayKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function sanitizeTaskPayload(payload) {
  const id = String(payload.id || payload.taskId || slugify(payload.title || "task")).trim();
  const title = String(payload.title || "").trim();
  if (!id || !title) throw new HttpsError("invalid-argument", "Task ID and title are required.");

  const status = String(payload.status || "active").trim();
  if (!["active", "draft", "archived"].includes(status)) {
    throw new HttpsError("invalid-argument", "Invalid task status.");
  }

  return {
    id,
    title: title.slice(0, 120),
    category: String(payload.category || "Movie Trailer").slice(0, 80),
    posterUrl: String(payload.posterUrl || "").slice(0, 600),
    videoUrl: String(payload.videoUrl || "").slice(0, 600),
    reward: assertAmount(payload.reward ?? 0, 0),
    durationSeconds: assertInteger(Number(payload.durationSeconds || 12), 5, 900),
    vipRequired: assertVipLevel(payload.vipRequired || "M0"),
    status,
    sortOrder: Number.isFinite(Number(payload.sortOrder)) ? Number(payload.sortOrder) : Date.now()
  };
}

function sanitizeInvestmentPlan(payload) {
  const id = String(payload.id || "").trim();
  const title = String(payload.title || "").trim();
  const status = String(payload.status || "active").trim();
  if (!id || !title) throw new HttpsError("invalid-argument", "Plan ID and title are required.");
  if (!["active", "draft", "archived"].includes(status)) {
    throw new HttpsError("invalid-argument", "Invalid investment plan status.");
  }

  return {
    id,
    title: title.slice(0, 140),
    periodDays: assertInteger(Number(payload.periodDays || 1), 1, 3650),
    dailyRate: assertAmount(payload.dailyRate ?? 0, 0),
    minAmount: assertAmount(payload.minAmount ?? 0, 0),
    status
  };
}

async function writeAdminAction(adminUid, action, targetUid, payload = {}) {
  await db.collection("admin_actions").add({
    adminUid,
    action,
    targetUid,
    payload,
    createdAt: FieldValue.serverTimestamp()
  });
}

function slugify(value) {
  return String(value || "task")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 64);
}
