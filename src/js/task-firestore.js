import { collection, getDocs, limit, query, where } from "firebase/firestore";
import { auth, db } from "./firebase-config";
import { apiRequest } from "./api/backend-client";
import { todayKey } from "./utils/formatters";

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
  return apiRequest("/tasks/start", { body: { taskId } });
}

export async function claimRewardAfterCountdown(taskId, watchSessionId) {
  if (!auth.currentUser) throw new Error("Authentication is required.");
  if (!watchSessionId) throw new Error("Watch session is required.");

  return apiRequest("/tasks/complete", {
    body: {
    taskId,
    watchSessionId,
    dayKey: todayKey(),
    watchedAt: Date.now()
    }
  });
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
