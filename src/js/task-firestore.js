import { collection, getDocs, limit, query, where } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { auth, db, functions } from "./firebase-config";
import { todayKey } from "./utils/formatters";

const completeTask = httpsCallable(functions, "completeTask");
const startTaskWatch = httpsCallable(functions, "startTaskWatch");

export async function getCompletedTasksToday(uid = auth.currentUser?.uid, day = todayKey()) {
  if (!uid) throw new Error("Authentication is required.");
  const snapshot = await getDocs(
    query(
      collection(db, "user_tasks"),
      where("uid", "==", uid),
      where("dayKey", "==", day),
      where("status", "==", "completed"),
      limit(200)
    )
  );
  return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
}

export async function startTaskWatchSession(taskId) {
  if (!auth.currentUser) throw new Error("Authentication is required.");
  const response = await startTaskWatch({ taskId });
  return response.data;
}

export async function claimRewardAfterCountdown(taskId, watchSessionId) {
  if (!auth.currentUser) throw new Error("Authentication is required.");
  if (!watchSessionId) throw new Error("Watch session is required.");

  // Daily limit, VIP eligibility, duplicate task checks, balance update, task log,
  // and referral commission distribution are all performed atomically in Cloud Functions.
  const response = await completeTask({
    taskId,
    watchSessionId,
    dayKey: todayKey(),
    watchedAt: Date.now()
  });
  return response.data;
}

export function bindClaimRewardButton(button, taskId, watchSessionId, { onSuccess, onError } = {}) {
  button.addEventListener("click", async () => {
    if (button.disabled) return;
    button.disabled = true;

    try {
      const result = await claimRewardAfterCountdown(taskId, watchSessionId);
      onSuccess?.(result);
    } catch (error) {
      button.disabled = false;
      onError?.(error);
    }
  });
}
