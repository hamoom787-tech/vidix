import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "vitest";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment
} from "@firebase/rules-unit-testing";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc
} from "firebase/firestore";

let testEnv;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: "vidix-rules-test",
    firestore: {
      rules: readFileSync("firestore.rules", "utf8"),
      host: "127.0.0.1",
      port: 8080
    }
  });
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), "users/user-a"), {
      email: "a@vidix.local",
      balances: { main: 100, commission: 5, locked: 0 },
      income: { today: 0, month: 0, total: 0 },
      vipLevel: "M1",
      status: "active",
      wallets: {},
      createdAt: new Date()
    });
    await setDoc(doc(context.firestore(), "users/user-b"), {
      email: "b@vidix.local",
      balances: { main: 20, commission: 1, locked: 0 },
      income: { today: 0, month: 0, total: 0 },
      vipLevel: "M0",
      status: "active",
      wallets: {},
      createdAt: new Date()
    });
    await setDoc(doc(context.firestore(), "deposits/dep-a"), {
      uid: "user-a",
      amount: 20,
      status: "pending"
    });
    await setDoc(doc(context.firestore(), "ledger/ledger-a"), {
      uid: "user-a",
      type: "task_reward",
      amount: 1
    });
    await setDoc(doc(context.firestore(), "task_sessions/session-a"), {
      uid: "user-a",
      taskId: "task-a",
      status: "watching"
    });
    await setDoc(doc(context.firestore(), "subscriptions/sub-a"), {
      uid: "user-a",
      levelId: "M1",
      amount: 20
    });
    await setDoc(doc(context.firestore(), "tasks/task-a"), {
      title: "Task A",
      status: "active",
      reward: 1,
      sortOrder: 1
    });
    await setDoc(doc(context.firestore(), "admin_actions/action-a"), {
      adminUid: "admin",
      action: "adminAdjustBalance"
    });
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

describe("VidiX Firestore security rules", () => {
  test("owners can read their own profile but not another user's profile", async () => {
    const userDb = testEnv.authenticatedContext("user-a").firestore();
    await assertSucceeds(getDoc(doc(userDb, "users/user-a")));
    await assertFails(getDoc(doc(userDb, "users/user-b")));
  });

  test("users cannot edit financial profile fields from the client", async () => {
    const userDb = testEnv.authenticatedContext("user-a").firestore();
    await assertFails(updateDoc(doc(userDb, "users/user-a"), { "balances.main": 999999 }));
    await assertFails(updateDoc(doc(userDb, "users/user-a"), { vipLevel: "M10" }));
    await assertSucceeds(updateDoc(doc(userDb, "users/user-a"), { displayName: "VidiX Member" }));
  });

  test("normal users cannot create money movement documents", async () => {
    const userDb = testEnv.authenticatedContext("user-a").firestore();
    await assertFails(setDoc(doc(userDb, "ledger/hack"), { uid: "user-a", amount: 10000 }));
    await assertFails(setDoc(doc(userDb, "deposits/hack"), { uid: "user-a", amount: 10000 }));
    await assertFails(setDoc(doc(userDb, "withdrawals/hack"), { uid: "user-a", amount: 10000 }));
    await assertFails(setDoc(doc(userDb, "task_sessions/hack"), { uid: "user-a", taskId: "task-a" }));
    await assertFails(setDoc(doc(userDb, "subscriptions/hack"), { uid: "user-a", amount: 20 }));
  });

  test("owners can read their own financial documents only", async () => {
    const userDb = testEnv.authenticatedContext("user-a").firestore();
    await assertSucceeds(getDoc(doc(userDb, "deposits/dep-a")));
    await assertSucceeds(getDoc(doc(userDb, "ledger/ledger-a")));
    await assertSucceeds(getDoc(doc(userDb, "task_sessions/session-a")));
    await assertSucceeds(getDoc(doc(userDb, "subscriptions/sub-a")));
  });

  test("admins can list users, write tasks and system settings, and read admin action logs", async () => {
    const adminDb = testEnv.authenticatedContext("admin", { admin: true }).firestore();
    await assertSucceeds(getDocs(collection(adminDb, "users")));
    await assertSucceeds(updateDoc(doc(adminDb, "users/user-a"), { "balances.main": 500 }));
    await assertSucceeds(updateDoc(doc(adminDb, "deposits/dep-a"), { status: "approved" }));
    await assertSucceeds(setDoc(doc(adminDb, "tasks/task-admin"), { title: "Admin Task", status: "active" }));
    await assertSucceeds(setDoc(doc(adminDb, "system_settings/vip_levels"), { levels: [] }));
    await assertSucceeds(getDoc(doc(adminDb, "admin_actions/action-a")));
  });

  test("non-admins cannot manage tasks or settings", async () => {
    const userDb = testEnv.authenticatedContext("user-a").firestore();
    await assertFails(setDoc(doc(userDb, "tasks/task-user"), { title: "Hack", status: "active" }));
    await assertFails(setDoc(doc(userDb, "system_settings/vip_levels"), { levels: [] }));
    await assertFails(getDoc(doc(userDb, "admin_actions/action-a")));
  });
});
