import {
  createUserWithEmailAndPassword,
  deleteUser,
  onAuthStateChanged,
  RecaptchaVerifier,
  signInWithEmailAndPassword,
  signInWithPhoneNumber,
  signOut
} from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  where
} from "firebase/firestore";
import { auth, db, firebaseApp } from "./firebase-config";
import { apiRequest } from "./api/backend-client";
import { assertCryptoWallet, assertFundPassword, assertPositiveAmount, assertReferralCode, assertTxId } from "./utils/validators";
import { todayKey } from "./utils/formatters";

export { auth, db, firebaseApp };

const workerCall = (path) => async (payload = {}) => ({ data: await apiRequest(path, { body: payload }) });

export const api = {
  completeRegistration: workerCall("/auth/complete-registration"),
  setFundPassword: workerCall("/auth/set-fund-password"),
  bindWallet: workerCall("/wallet/bind"),
  createDepositRequest: workerCall("/deposits"),
  requestWithdrawal: workerCall("/withdrawals"),
  startTaskWatch: workerCall("/tasks/start"),
  completeTask: workerCall("/tasks/complete"),
  upgradeVip: workerCall("/vip/upgrade"),
  joinInvestment: workerCall("/investments"),
  applyForRank: workerCall("/ranks/apply")
};

export function watchAuth(callback) {
  return onAuthStateChanged(auth, callback);
}

export async function signUpWithEmail({ email, password, referralCode, fundPassword }) {
  const invitationCode = assertReferralCode(referralCode);
  const secureFundPassword = assertFundPassword(fundPassword);
  const credential = await createUserWithEmailAndPassword(auth, email, password);

  try {
    await api.completeRegistration({
      referralCode: invitationCode,
      fundPassword: secureFundPassword,
      authProvider: "email"
    });
    return credential.user;
  } catch (error) {
    await deleteUser(credential.user).catch(() => {});
    throw error;
  }
}

export async function loginWithEmail({ email, password }) {
  const credential = await signInWithEmailAndPassword(auth, email, password);
  return credential.user;
}

export function createPhoneVerifier(containerId = "recaptcha-container") {
  if (window.recaptchaVerifier) return window.recaptchaVerifier;
  auth.useDeviceLanguage();
  window.recaptchaVerifier = new RecaptchaVerifier(auth, containerId, {
    size: "normal",
    "expired-callback": () => {
      window.recaptchaVerifier = null;
    }
  });
  return window.recaptchaVerifier;
}

export async function startPhoneVerification(phoneNumber) {
  const cleanPhone = String(phoneNumber || "").trim();
  if (!/^\+[1-9]\d{7,14}$/.test(cleanPhone)) {
    throw new Error("Phone number must be in international E.164 format.");
  }
  const verifier = createPhoneVerifier();
  return signInWithPhoneNumber(auth, cleanPhone, verifier);
}

export async function confirmPhoneCode({ confirmationResult, otpCode, mode, referralCode, fundPassword }) {
  if (!confirmationResult) throw new Error("Send the phone verification code first.");
  const credential = await confirmationResult.confirm(String(otpCode || "").trim());

  if (mode === "signup") {
    const invitationCode = assertReferralCode(referralCode);
    const secureFundPassword = assertFundPassword(fundPassword);
    await api.completeRegistration({
      referralCode: invitationCode,
      fundPassword: secureFundPassword,
      authProvider: "phone"
    });
  }

  return credential.user;
}

export async function logout() {
  await signOut(auth);
}

export function watchUserProfile(uid, callback) {
  return onSnapshot(doc(db, "users", uid), (snapshot) => {
    callback(snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null);
  });
}

export async function getCurrentUserProfile() {
  const user = auth.currentUser;
  if (!user) return null;
  const snapshot = await getDoc(doc(db, "users", user.uid));
  return snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null;
}

export async function listAvailableTasks({ vipLevel = "M0" } = {}) {
  const tasksRef = collection(db, "tasks");
  const snapshot = await getDocs(
    query(tasksRef, where("status", "==", "active"), orderBy("sortOrder", "asc"), limit(50))
  );

  const order = ["M0", "M1", "M2", "M3", "M4", "M5", "M6", "M7", "M8", "M9", "M10"];
  const userLevelIndex = order.indexOf(vipLevel);

  return snapshot.docs
    .map((taskDoc) => ({ id: taskDoc.id, ...taskDoc.data() }))
    .filter((task) => order.indexOf(task.vipRequired || "M0") <= userLevelIndex);
}

export function createWatchTimer({ seconds = 12, onTick, onReady }) {
  let remaining = Math.max(1, Number(seconds || 12));
  let intervalId = null;

  onTick?.(remaining);
  intervalId = window.setInterval(() => {
    remaining -= 1;
    onTick?.(remaining);

    if (remaining <= 0) {
      window.clearInterval(intervalId);
      onReady?.();
    }
  }, 1000);

  return () => window.clearInterval(intervalId);
}

export async function startTaskWatchSession(taskId) {
  if (!auth.currentUser) throw new Error("You must be signed in to start a task.");
  const response = await api.startTaskWatch({ taskId });
  return response.data;
}

export async function claimTaskReward(taskId, watchSessionId) {
  if (!auth.currentUser) throw new Error("You must be signed in to claim a task.");
  if (!watchSessionId) throw new Error("Watch session is required.");
  const response = await api.completeTask({ taskId, watchSessionId, watchedAt: Date.now(), dayKey: todayKey() });
  return response.data;
}

export async function getTaskStatus(status = "all") {
  const uid = auth.currentUser?.uid;
  if (!uid) return [];

  const base = [where("uid", "==", uid), orderBy("createdAt", "desc"), limit(100)];
  const filters = status === "all" ? base : [where("uid", "==", uid), where("status", "==", status), orderBy("createdAt", "desc"), limit(100)];
  const snapshot = await getDocs(query(collection(db, "user_tasks"), ...filters));
  return snapshot.docs.map((taskDoc) => ({ id: taskDoc.id, ...taskDoc.data() }));
}

export async function uploadDepositReceipt(file) {
  if (!file) throw new Error("Payment proof reference is required.");
  throw new Error("Firebase Storage is disabled on the free plan. Paste a receipt URL or payment reference instead.");
}

export async function submitDeposit({ network, paymentMethod, amount, txId, receiptReference }) {
  const value = assertPositiveAmount(amount, 20);
  const cleanTxId = assertTxId(txId);
  const proofReference = String(receiptReference || cleanTxId || "").trim();
  if (proofReference.length < 6) throw new Error("Payment proof reference is required.");
  const response = await api.createDepositRequest({
    network: paymentMethod || network,
    paymentMethod: paymentMethod || network,
    amount: value,
    txId: cleanTxId,
    receiptUrl: proofReference,
    receiptReference: proofReference
  });
  return response.data;
}

export async function submitWithdrawal({ sourceWallet, walletAddress, amount, fundPassword }) {
  const value = assertPositiveAmount(amount, 10);
  const wallet = assertCryptoWallet(walletAddress);
  const password = assertFundPassword(fundPassword);

  const response = await api.requestWithdrawal({
    sourceWallet,
    walletAddress: wallet,
    amount: value,
    fundPassword: password
  });
  return response.data;
}

export async function bindCryptoWallet({ walletAddress, network, fundPassword }) {
  const wallet = assertCryptoWallet(walletAddress);
  const password = assertFundPassword(fundPassword);
  const response = await api.bindWallet({ walletAddress: wallet, network, fundPassword: password });
  return response.data;
}

export async function upgradeMembership(levelId) {
  const response = await api.upgradeVip({ levelId });
  return response.data;
}

export async function joinInvestmentPlan({ planId, amount }) {
  const value = assertPositiveAmount(amount, 50);
  const response = await api.joinInvestment({ planId, amount: value });
  return response.data;
}

export async function applyForCorporateRank(rankId) {
  const response = await api.applyForRank({ rankId });
  return response.data;
}

export async function getTeamReport({ from, to } = {}) {
  const uid = auth.currentUser?.uid;
  if (!uid) return null;

  const levels = ["A", "B", "C"];
  const report = {
    total: 0,
    newToday: 0,
    activeVipByLevel: {},
    commissionTotal: 0,
    levels: {}
  };

  await Promise.all(
    levels.map(async (level) => {
      const snapshot = await getDocs(query(collection(db, "users", uid, "downline_level_" + level), limit(500)));
      const members = snapshot.docs.map((memberDoc) => ({ id: memberDoc.id, ...memberDoc.data() }));
      report.levels[level] = members;
      report.total += members.length;

      members.forEach((member) => {
        if (member.registeredDayKey === todayKey()) report.newToday += 1;
        if (member.vipLevel && member.vipLevel !== "M0") {
          report.activeVipByLevel[member.vipLevel] = (report.activeVipByLevel[member.vipLevel] || 0) + 1;
        }
      });
    })
  );

  const commissionQuery = [where("uid", "==", uid), where("type", "==", "referral_commission")];
  if (from) commissionQuery.push(where("createdAt", ">=", from));
  if (to) commissionQuery.push(where("createdAt", "<=", to));
  const ledgerSnapshot = await getDocs(query(collection(db, "ledger"), ...commissionQuery, limit(500)));

  report.commissionTotal = ledgerSnapshot.docs.reduce((sum, item) => sum + Number(item.data().amount || 0), 0);
  return report;
}

export function watchLedger(uid, callback) {
  return onSnapshot(
    query(collection(db, "ledger"), where("uid", "==", uid), orderBy("createdAt", "desc"), limit(50)),
    (snapshot) => callback(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })))
  );
}
