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
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { httpsCallable } from "firebase/functions";
import { auth, db, firebaseApp, functions, storage } from "./firebase-config";
import { assertCryptoWallet, assertFundPassword, assertPositiveAmount, assertReferralCode, assertTxId } from "./utils/validators";
import { todayKey } from "./utils/formatters";

export { auth, db, firebaseApp, functions, storage };

const callable = (name) => httpsCallable(functions, name);

export const api = {
  completeRegistration: callable("completeRegistration"),
  setFundPassword: callable("setFundPassword"),
  bindWallet: callable("bindWallet"),
  createDepositRequest: callable("createDepositRequest"),
  requestWithdrawal: callable("requestWithdrawal"),
  startTaskWatch: callable("startTaskWatch"),
  completeTask: callable("completeTask"),
  upgradeVip: callable("upgradeVip"),
  joinInvestment: callable("joinInvestment"),
  applyForRank: callable("applyForRank")
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
      authProvider: "email"
    });

    await api.setFundPassword({ fundPassword: secureFundPassword });
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
      authProvider: "phone"
    });
    await api.setFundPassword({ fundPassword: secureFundPassword });
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
  if (!auth.currentUser) throw new Error("You must be signed in to upload a receipt.");
  if (!file) throw new Error("Receipt screenshot is required.");

  const cleanName = file.name.replace(/[^\w.-]/g, "_");
  const storageRef = ref(storage, `receipts/${auth.currentUser.uid}/${Date.now()}-${cleanName}`);
  await uploadBytes(storageRef, file, {
    contentType: file.type || "application/octet-stream",
    customMetadata: { uid: auth.currentUser.uid }
  });
  return getDownloadURL(storageRef);
}

export async function submitDeposit({ network, paymentMethod, amount, txId, receiptFile }) {
  const value = assertPositiveAmount(amount, 20);
  const cleanTxId = assertTxId(txId);
  const receiptUrl = await uploadDepositReceipt(receiptFile);
  const response = await api.createDepositRequest({
    network: paymentMethod || network,
    paymentMethod: paymentMethod || network,
    amount: value,
    txId: cleanTxId,
    receiptUrl
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
