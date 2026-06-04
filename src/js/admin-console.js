import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { collection, doc, getDoc, getDocs, limit, orderBy, query } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { auth, db, functions } from "./firebase-config";

const state = {
  user: null,
  isAdmin: false,
  users: [],
  deposits: [],
  withdrawals: [],
  tasks: [],
  vipLevels: [],
  plans: [],
  investments: []
};

const els = {
  modePill: document.querySelector("#mode-pill"),
  userPill: document.querySelector("#admin-user-pill"),
  loginForm: document.querySelector("#admin-login-form"),
  logoutButton: document.querySelector("#admin-logout"),
  toast: document.querySelector("#toast")
};

bootstrap();

function bootstrap() {
  els.modePill.textContent = "Firebase production mode";
  bindTabs();
  bindForms();
  bindRefreshButtons();

  onAuthStateChanged(auth, async (user) => {
    state.user = user;
    state.isAdmin = false;
    els.userPill.textContent = user ? user.email || user.uid : "Not signed in";

    if (!user) {
      clearRemoteData();
      renderAll();
      return;
    }

    const token = await user.getIdTokenResult(true);
    state.isAdmin = token.claims.admin === true;
    els.modePill.textContent = state.isAdmin ? "Admin claim verified" : "Signed in without admin claim";
    if (!state.isAdmin) {
      showToast("This account does not have admin claim.", "error");
      clearRemoteData();
      renderAll();
      return;
    }

    await refreshRemoteData("all");
    renderAll();
  });

  renderAll();
}

function bindTabs() {
  document.querySelectorAll("[data-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll("[data-tab]").forEach((tab) => tab.classList.toggle("active", tab === button));
      document.querySelectorAll("[data-page]").forEach((page) => page.classList.toggle("active", page.dataset.page === button.dataset.tab));
    });
  });
}

function bindForms() {
  els.loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    await withButton(event.submitter, async () => {
      await signInWithEmailAndPassword(auth, document.querySelector("#admin-email").value.trim(), document.querySelector("#admin-password").value);
      showToast("Admin signed in.", "success");
    });
  });

  els.logoutButton.addEventListener("click", async () => {
    await withButton(els.logoutButton, async () => {
      await signOut(auth);
      showToast("Logged out.", "success");
    });
  });

  document.querySelector("#task-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const payload = sanitizeTask(formData(event.currentTarget));
    await withButton(event.submitter, async () => {
      await callFunction("adminUpsertTask", payload);
      event.currentTarget.reset();
      await refreshRemoteData("tasks");
      renderAll();
      showToast("Task saved.", "success");
    });
  });

  document.querySelector("#vip-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = formData(event.currentTarget);
    const payload = {
      id: data.id,
      price: Number(data.price || 0),
      dailyTasks: Number(data.dailyTasks || 1),
      reward: Number(data.reward || 0)
    };
    await withButton(event.submitter, async () => {
      await callFunction("adminUpsertVipLevel", payload);
      await refreshRemoteData("vip");
      renderAll();
      showToast("VIP level saved.", "success");
    });
  });

  document.querySelector("#plan-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = formData(event.currentTarget);
    const payload = {
      id: data.id,
      title: data.title,
      periodDays: Number(data.periodDays || 0),
      dailyRate: Number(data.dailyRate || 0),
      minAmount: Number(data.minAmount || 0),
      status: data.status || "active"
    };
    await withButton(event.submitter, async () => {
      await callFunction("adminUpsertInvestmentPlan", payload);
      await refreshRemoteData("investments");
      renderAll();
      showToast("Investment plan saved.", "success");
    });
  });

  document.querySelector("#user-action-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    await withButton(event.submitter, async () => {
      await runUserAction(formData(event.currentTarget));
      await refreshRemoteData("users");
      renderAll();
    });
  });
}

function bindRefreshButtons() {
  document.querySelectorAll("[data-refresh]").forEach((button) => {
    button.addEventListener("click", async () => {
      await withButton(button, async () => {
        await refreshRemoteData(button.dataset.refresh);
        renderAll();
        showToast("Data refreshed.", "success");
      });
    });
  });
}

async function runUserAction(data) {
  if (data.action === "adjustBalance") {
    await callFunction("adminAdjustBalance", {
      uid: data.uid,
      wallet: data.wallet,
      amount: Number(data.amount || 0),
      reason: data.reason || "Admin adjustment"
    });
    showToast("Balance adjusted.", "success");
    return;
  }

  if (data.action === "setVip") {
    await callFunction("adminSetUserVip", {
      uid: data.uid,
      vipLevel: data.vipLevel,
      reason: data.reason || "Admin VIP update"
    });
    showToast("VIP updated.", "success");
    return;
  }

  await callFunction("adminSetUserStatus", {
    uid: data.uid,
    status: data.status,
    reason: data.reason || "Admin status update"
  });
  showToast("User status updated.", "success");
}

async function refreshRemoteData(scope = "all") {
  if (!state.user || !state.isAdmin) return;
  const loaders = {
    users: async () => {
      const snapshot = await getDocs(query(collection(db, "users"), limit(500)));
      state.users = snapshot.docs.map(toRecord);
    },
    deposits: async () => {
      const snapshot = await getDocs(query(collection(db, "deposits"), orderBy("createdAt", "desc"), limit(500)));
      state.deposits = snapshot.docs.map(toRecord);
    },
    withdrawals: async () => {
      const snapshot = await getDocs(query(collection(db, "withdrawals"), orderBy("createdAt", "desc"), limit(500)));
      state.withdrawals = snapshot.docs.map(toRecord);
    },
    tasks: async () => {
      const snapshot = await getDocs(query(collection(db, "tasks"), orderBy("sortOrder", "asc"), limit(500)));
      state.tasks = snapshot.docs.map(toRecord);
    },
    vip: async () => {
      const snapshot = await getDoc(doc(db, "system_settings", "vip_levels"));
      state.vipLevels = snapshot.data()?.levels || [];
    },
    investments: async () => {
      const [plansSnap, investmentsSnap] = await Promise.all([
        getDoc(doc(db, "system_settings", "investment_plans")),
        getDocs(query(collection(db, "investments"), orderBy("createdAt", "desc"), limit(500)))
      ]);
      state.plans = plansSnap.data()?.plans || [];
      state.investments = investmentsSnap.docs.map(toRecord);
    }
  };

  if (scope === "all") {
    for (const loader of Object.values(loaders)) await loader();
    return;
  }

  await loaders[scope]?.();
}

function clearRemoteData() {
  state.users = [];
  state.deposits = [];
  state.withdrawals = [];
  state.tasks = [];
  state.vipLevels = [];
  state.plans = [];
  state.investments = [];
}

function renderAll() {
  renderDashboard();
  renderUsers();
  renderDeposits();
  renderWithdrawals();
  renderTasks();
  renderVip();
  renderInvestments();
}

function renderDashboard() {
  const cards = [
    ["Users", state.users.length],
    ["Pending deposits", state.deposits.filter((item) => item.status === "pending").length],
    ["Pending withdrawals", state.withdrawals.filter((item) => item.status === "pending").length],
    ["Active tasks", state.tasks.filter((item) => item.status === "active").length]
  ];
  document.querySelector("#dashboard-cards").innerHTML = cards.map(([label, value]) => statCard(label, value)).join("");
}

function renderUsers() {
  document.querySelector("#users-list").innerHTML = state.users.length
    ? state.users
        .map(
          (user) => `
            <article class="table-row lg:grid-cols-[1.2fr_.8fr_.8fr_.8fr]">
              <div><strong>${escapeHtml(user.email || user.phoneNumber || user.id)}</strong><p class="text-xs text-mutedSilver">${escapeHtml(user.id)}</p></div>
              <span class="font-money text-vipGold">${escapeHtml(user.vipLevel || "M0")}</span>
              <span class="text-mutedSilver">${escapeHtml(user.status || "active")}</span>
              <strong class="font-money text-emeraldNeon">${money(user.balances?.main || 0)}</strong>
            </article>
          `
        )
        .join("")
    : emptyState("No users loaded.");
}

function renderDeposits() {
  document.querySelector("#deposits-list").innerHTML = state.deposits.length
    ? state.deposits.map(depositRow).join("")
    : emptyState("No deposit requests.");
  bindDepositActions();
}

function depositRow(item) {
  const original = `${Number(item.originalAmount ?? item.amount ?? 0).toFixed(2)} ${escapeHtml(item.originalCurrency || "USD")}`;
  const credit = money(item.usdAmount ?? item.amount ?? 0);
  const receipt = item.receiptUrl ? `<a class="text-emeraldNeon underline" href="${escapeHtml(item.receiptUrl)}" target="_blank" rel="noopener">Receipt</a>` : "No receipt";
  return `
    <article class="table-row lg:grid-cols-[1.2fr_.9fr_.8fr_.8fr_auto]">
      <div><strong>${escapeHtml(item.uid)}</strong><p class="text-xs text-mutedSilver">${escapeHtml(item.txId)}</p>${receipt}</div>
      <span>${escapeHtml(item.paymentLabel || item.paymentMethod || item.network)}</span>
      <div><strong class="font-money text-emeraldNeon">${credit}</strong><p class="text-xs text-mutedSilver">${original}</p></div>
      <span>${escapeHtml(item.status)}</span>
      <div class="flex flex-wrap gap-2">
        <button class="button button-primary" data-approve-deposit="${escapeHtml(item.id)}" type="button" ${item.status !== "pending" ? "disabled" : ""}>Approve</button>
        <button class="button button-ghost" data-reject-deposit="${escapeHtml(item.id)}" type="button" ${item.status !== "pending" ? "disabled" : ""}>Reject</button>
      </div>
    </article>
  `;
}

function renderWithdrawals() {
  document.querySelector("#withdrawals-list").innerHTML = state.withdrawals.length
    ? state.withdrawals.map(withdrawalRow).join("")
    : emptyState("No withdrawal requests.");
  bindWithdrawalActions();
}

function withdrawalRow(item) {
  return `
    <article class="table-row lg:grid-cols-[1.2fr_.8fr_.8fr_.8fr_auto]">
      <div>
        <strong>${escapeHtml(item.uid)}</strong>
        <p class="truncate text-xs text-mutedSilver" dir="ltr">${escapeHtml(item.walletAddress || "")}</p>
      </div>
      <strong class="font-money text-emeraldNeon">${money(item.amount)}</strong>
      <span>Fee ${money(item.fee || 0)} / Net ${money(item.netAmount || 0)}</span>
      <span>${escapeHtml(item.status)}</span>
      <div class="flex flex-wrap gap-2">
        <button class="button button-primary" data-settle-withdrawal="${escapeHtml(item.id)}" data-status="executed" type="button" ${item.status !== "pending" ? "disabled" : ""}>Execute</button>
        <button class="button button-ghost" data-settle-withdrawal="${escapeHtml(item.id)}" data-status="rejected" type="button" ${item.status !== "pending" ? "disabled" : ""}>Reject</button>
      </div>
    </article>
  `;
}

function renderTasks() {
  document.querySelector("#tasks-list").innerHTML = state.tasks.length
    ? state.tasks
        .map(
          (task) => `
            <article class="table-row lg:grid-cols-[92px_1fr_.6fr_.6fr_auto]">
              <img class="h-16 w-24 rounded-xl object-cover" src="${escapeHtml(task.posterUrl)}" alt="${escapeHtml(task.title)}" />
              <div><strong>${escapeHtml(task.title)}</strong><p class="text-xs text-mutedSilver">${escapeHtml(task.category)} - ${escapeHtml(task.status)}</p></div>
              <span class="font-money text-vipGold">${escapeHtml(task.vipRequired)}</span>
              <strong class="font-money text-emeraldNeon">${money(task.reward)}</strong>
              <button class="button button-ghost" data-archive-task="${escapeHtml(task.id)}" type="button">Archive</button>
            </article>
          `
        )
        .join("")
    : emptyState("No tasks configured.");

  document.querySelectorAll("[data-archive-task]").forEach((button) => {
    button.addEventListener("click", async () => {
      await withButton(button, async () => {
        await callFunction("adminArchiveTask", { taskId: button.dataset.archiveTask });
        await refreshRemoteData("tasks");
        renderAll();
        showToast("Task archived.", "success");
      });
    });
  });
}

function renderVip() {
  document.querySelector("#vip-list").innerHTML = state.vipLevels.length
    ? state.vipLevels
        .map(
          (level) => `
            <article class="table-row lg:grid-cols-[.5fr_1fr_1fr_1fr]">
              <strong class="font-money text-vipGold">${escapeHtml(level.id)}</strong>
              <span>Price ${money(level.price)}</span>
              <span>${Number(level.dailyTasks || 0)} tasks/day</span>
              <strong class="font-money text-emeraldNeon">${money(level.reward)}</strong>
            </article>
          `
        )
        .join("")
    : emptyState("No VIP levels configured.");
}

function renderInvestments() {
  document.querySelector("#plans-list").innerHTML = state.plans.length
    ? state.plans
        .map(
          (plan) => `
            <article class="table-row lg:grid-cols-[1fr_.7fr_.7fr_.7fr]">
              <div><strong>${escapeHtml(plan.title)}</strong><p class="text-xs text-mutedSilver">${escapeHtml(plan.id)} - ${escapeHtml(plan.status || "active")}</p></div>
              <span>${Number(plan.periodDays || 0)} days</span>
              <strong class="font-money text-vipGold">${Number(plan.dailyRate || 0)}%</strong>
              <span>${money(plan.minAmount)}</span>
            </article>
          `
        )
        .join("")
    : emptyState("No investment plans configured.");

  document.querySelector("#investments-list").innerHTML = state.investments.length
    ? state.investments
        .map(
          (investment) => `
            <article class="table-row lg:grid-cols-[1fr_.7fr_.7fr_.7fr_auto]">
              <div><strong>${escapeHtml(investment.uid)}</strong><p class="text-xs text-mutedSilver">${escapeHtml(investment.planId)}</p></div>
              <strong class="font-money text-emeraldNeon">${money(investment.amount)}</strong>
              <span>${escapeHtml(investment.status)}</span>
              <span>${Number(investment.dailyRate || 0)}%</span>
              <button class="button button-primary" data-mature-investment="${escapeHtml(investment.id)}" type="button" ${investment.status !== "active" ? "disabled" : ""}>Mature</button>
            </article>
          `
        )
        .join("")
    : "";

  document.querySelectorAll("[data-mature-investment]").forEach((button) => {
    button.addEventListener("click", async () => {
      await withButton(button, async () => {
        await callFunction("adminSetInvestmentStatus", { investmentId: button.dataset.matureInvestment, status: "matured" });
        await refreshRemoteData("investments");
        renderAll();
        showToast("Investment matured.", "success");
      });
    });
  });
}

function bindDepositActions() {
  document.querySelectorAll("[data-approve-deposit]").forEach((button) => {
    button.addEventListener("click", async () => {
      const item = state.deposits.find((deposit) => deposit.id === button.dataset.approveDeposit);
      const fallback = Number(item?.usdAmount ?? item?.amount ?? 0).toFixed(2);
      const approvedAmount = window.prompt("Approved USD/USDT credit amount", fallback);
      if (approvedAmount == null) return;
      await withButton(button, async () => {
        await callFunction("approveDeposit", { depositId: button.dataset.approveDeposit, approvedAmount: Number(approvedAmount) });
        await refreshRemoteData("deposits");
        await refreshRemoteData("users");
        renderAll();
        showToast("Deposit approved and balance credited.", "success");
      });
    });
  });

  document.querySelectorAll("[data-reject-deposit]").forEach((button) => {
    button.addEventListener("click", async () => {
      const reason = window.prompt("Rejection reason", "Receipt or payment reference could not be verified.");
      if (reason == null) return;
      await withButton(button, async () => {
        await callFunction("rejectDeposit", { depositId: button.dataset.rejectDeposit, reason });
        await refreshRemoteData("deposits");
        renderAll();
        showToast("Deposit rejected.", "success");
      });
    });
  });
}

function bindWithdrawalActions() {
  document.querySelectorAll("[data-settle-withdrawal]").forEach((button) => {
    button.addEventListener("click", async () => {
      const status = button.dataset.status;
      const payoutTxId = status === "executed" ? window.prompt("Payout TxID / execution reference") : "";
      if (status === "executed" && !payoutTxId) return;
      await withButton(button, async () => {
        await callFunction("settleWithdrawal", { withdrawalId: button.dataset.settleWithdrawal, status, payoutTxId });
        await refreshRemoteData("withdrawals");
        await refreshRemoteData("users");
        renderAll();
        showToast(`Withdrawal ${status}.`, "success");
      });
    });
  });
}

async function callFunction(name, payload = {}) {
  if (!state.user) throw new Error("Admin must be signed in.");
  if (!state.isAdmin) throw new Error("Admin claim is required.");
  return (await httpsCallable(functions, name)(payload)).data;
}

async function withButton(button, action) {
  if (!button || button.dataset.loading === "true") return;
  const original = button.innerHTML;
  button.dataset.loading = "true";
  button.disabled = true;
  button.innerHTML = `<span class="inline-flex items-center gap-2"><span class="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"></span>Processing</span>`;
  try {
    await action();
  } catch (error) {
    showToast(error.message || "Operation failed.", "error");
  } finally {
    button.dataset.loading = "false";
    button.disabled = false;
    button.innerHTML = original;
  }
}

function sanitizeTask(data) {
  return {
    id: data.id || slugify(data.title),
    title: data.title,
    category: data.category || "Movie Trailer",
    posterUrl: data.posterUrl || "/assets/images/tasks/watch-earn-phone.png",
    videoUrl: data.videoUrl || "",
    reward: Number(data.reward || 0),
    durationSeconds: Number(data.durationSeconds || 12),
    vipRequired: data.vipRequired || "M0",
    status: data.status || "active",
    sortOrder: Date.now()
  };
}

function toRecord(snapshot) {
  return { id: snapshot.id, ...snapshot.data() };
}

function formData(form) {
  return Object.fromEntries(new FormData(form).entries());
}

function statCard(label, value) {
  return `
    <article class="panel rounded-3xl p-5">
      <p class="text-sm font-bold text-mutedSilver">${escapeHtml(label)}</p>
      <strong class="font-money mt-2 block text-4xl font-black text-emeraldNeon">${escapeHtml(value)}</strong>
    </article>
  `;
}

function emptyState(message) {
  return `<article class="rounded-2xl border border-slateLine bg-white/5 p-4 text-sm font-bold text-mutedSilver">${escapeHtml(message)}</article>`;
}

function money(value) {
  return `$${Number(value || 0).toFixed(2)}`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function slugify(value) {
  return String(value || "task")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 64);
}

function showToast(message, type = "success") {
  els.toast.textContent = message;
  els.toast.classList.toggle("border-red-500/40", type === "error");
  els.toast.classList.toggle("text-red-100", type === "error");
  els.toast.classList.toggle("border-emeraldNeon/40", type !== "error");
  els.toast.classList.toggle("text-white", type !== "error");
  els.toast.classList.remove("hidden");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => els.toast.classList.add("hidden"), 3600);
}
