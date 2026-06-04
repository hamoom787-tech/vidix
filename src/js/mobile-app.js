import { onAuthStateChanged, signOut } from "firebase/auth";
import { collection, doc, getDoc, getDocs, limit, onSnapshot, orderBy, query, where } from "firebase/firestore";
import { auth, db } from "./firebase-config";
import { apiRequest } from "./api/backend-client";
import { loginUser, registerNewUser } from "./firebase-auth";
import { submitDepositRequest, submitWithdrawalRequest } from "./wallet-firestore";
import { escapeHtml, formatMoney, showToast, withLoading } from "./ui/async-ui";

const state = {
  authMode: "login",
  user: null,
  profile: null,
  profileUnsubscribe: null,
  selectedPaymentMethod: "BINANCE_USDT_BSC",
  walletSettings: null,
  tasks: [],
  activeTask: null,
  activeSession: null,
  countdownTimer: null
};

const workerCall = (path) => async (payload) => ({ data: await apiRequest(path, { body: payload }) });
const startTaskWatch = workerCall("/tasks/start");
const completeTask = workerCall("/tasks/complete");
const upgradeVip = workerCall("/vip/upgrade");
const joinInvestment = workerCall("/investments");

bootstrap();

function bootstrap() {
  bindNavigation();
  bindAuth();
  bindDeposit();
  bindWithdrawal();
  bindVip();
  bindInvestment();
  bindClaimButton();
  loadWalletSettings().then(renderPaymentMethods).catch((error) => showToast(error.message, "error"));

  onAuthStateChanged(auth, async (user) => {
    state.user = user;
    state.profile = null;
    state.profileUnsubscribe?.();
    state.profileUnsubscribe = null;

    if (!user) {
      renderProfile(null);
      showScreen("auth");
      state.tasks = [];
      renderTasks();
      return;
    }

    state.profileUnsubscribe = onSnapshot(doc(db, "users", user.uid), (snapshot) => {
      state.profile = snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null;
      renderProfile(state.profile);
      renderVipStatus();
      renderWithdrawalWallet();
      loadTasks().catch((error) => showToast(error.message, "error"));
    });
  });
}

function bindNavigation() {
  document.querySelectorAll("[data-screen-target]").forEach((button) => {
    button.addEventListener("click", () => showScreen(button.dataset.screenTarget));
  });
}

function bindAuth() {
  document.querySelectorAll("[data-auth-mode]").forEach((button) => {
    button.addEventListener("click", () => {
      state.authMode = button.dataset.authMode;
    });
  });

  document.querySelector("#auth-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const payload = {
      email: document.querySelector("#auth-email")?.value.trim(),
      password: document.querySelector("#auth-password")?.value,
      invitationCode: document.querySelector("#auth-referral")?.value.trim(),
      fundPassword: document.querySelector("#auth-fund-password")?.value,
      displayName: document.querySelector("#auth-email")?.value.split("@")[0] || "VidiX Member"
    };

    await withLoading(event.submitter, async () => {
      if (state.authMode === "signup") {
        await registerNewUser(payload);
        showToast("Account created securely.", "success");
      } else {
        await loginUser(payload);
        showToast("Signed in.", "success");
      }
      showScreen("home");
    });
  });
}

function bindDeposit() {
  document.querySelectorAll("[data-amount]").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll("[data-amount]").forEach((item) => item.classList.remove("active"));
      button.classList.add("active");
      setDepositPackage(Number(button.dataset.amount || 0));
    });
  });

  document.querySelector("#deposit-amount")?.addEventListener("input", updateDepositFxNote);

  document.querySelector("#deposit-submit")?.addEventListener("click", async (event) => {
    await withLoading(event.currentTarget, async () => {
      requireSignedIn();
      const result = await submitDepositRequest({
        paymentMethod: state.selectedPaymentMethod,
        amount: Number(document.querySelector("#deposit-amount")?.value || 0),
        txId: document.querySelector("#deposit-txid")?.value.trim(),
        receiptReference: document.querySelector("#receipt-reference")?.value.trim()
      });
      document.querySelector("#deposit-txid").value = "";
      document.querySelector("#receipt-reference").value = "";
      showToast(`Deposit submitted: ${result.depositId}`, "success");
    });
  });
}

function bindWithdrawal() {
  document.querySelector("#withdraw-amount")?.addEventListener("input", renderWithdrawalFee);
  document.querySelector("#withdraw-source")?.addEventListener("change", renderWithdrawalFee);

  document.querySelector("#withdraw-submit")?.addEventListener("click", async (event) => {
    await withLoading(event.currentTarget, async () => {
      requireSignedIn();
      const walletAddress = document.querySelector("#withdraw-wallet")?.value.trim();
      const result = await submitWithdrawalRequest({
        sourceWallet: document.querySelector("#withdraw-source")?.value || "commission",
        walletAddress,
        amount: Number(document.querySelector("#withdraw-amount")?.value || 0),
        fundPassword: document.querySelector("#withdraw-fund-password")?.value
      });
      document.querySelector("#withdraw-amount").value = "";
      document.querySelector("#withdraw-fund-password").value = "";
      showToast(`Withdrawal pending. Net: ${formatMoney(result.netAmount)} Fee: ${formatMoney(result.fee)}`, "success");
    });
  });
}

function bindVip() {
  document.querySelectorAll("[data-vip-level]").forEach((button) => {
    button.addEventListener("click", async () => {
      await withLoading(button, async () => {
        requireSignedIn();
        const result = await upgradeVip({ levelId: button.dataset.vipLevel });
        showToast(`VIP upgraded to ${result.data.vipLevel}.`, "success");
      }, "Joining");
    });
  });
}

function bindInvestment() {
  document.querySelectorAll("[data-invest-plan]").forEach((button) => {
    button.addEventListener("click", async () => {
      const amount = window.prompt("Investment amount in USD");
      if (!amount) return;
      await withLoading(button, async () => {
        requireSignedIn();
        await joinInvestment({ planId: button.dataset.investPlan, amount: Number(amount) });
        showToast("Investment created.", "success");
      }, "Investing");
    });
  });
}

function bindClaimButton() {
  document.querySelector("#claim-button")?.addEventListener(
    "click",
    async (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (event.currentTarget.disabled) return;

      await withLoading(event.currentTarget, async () => {
        requireSignedIn();
        if (!state.activeTask || !state.activeSession) throw new Error("Start the task watch session first.");
        await completeTask({
          taskId: state.activeTask.id,
          watchSessionId: state.activeSession.sessionId
        });
        state.activeTask = null;
        state.activeSession = null;
        showToast("Reward claimed securely.", "success");
        await loadTasks();
        showScreen("tasks");
      }, "Claiming");
    },
    true
  );
}

async function loadWalletSettings() {
  const fallback = {
    fx: { usdtEgpRate: Number(import.meta.env.VITE_DEFAULT_USDT_EGP_RATE || 50) },
    depositNetworks: [
      {
        id: "BINANCE_USDT_BSC",
        label: "Binance USDT - BNB Smart Chain (BEP20)",
        wallet: import.meta.env.VITE_ADMIN_PAYMENT_BINANCE_USDT_BSC || "0xf4eca9ac6d3df1aed0d819e16ad9214448ae4cd0",
        minimumDeposit: 20,
        status: "active"
      }
    ],
    withdrawal: { minimum: 10, feeRate: 0.02, fixedFee: 0, allowedWallets: ["main", "commission"] }
  };

  try {
    state.walletSettings = await apiRequest("/settings/wallets", { method: "GET", authRequired: false });
  } catch (apiError) {
    const snapshot = auth.currentUser ? await getDoc(doc(db, "system_settings", "wallets")).catch(() => null) : null;
    state.walletSettings = snapshot?.data?.() || fallback;
  }
}

async function loadTasks() {
  const snapshot = await getDocs(query(collection(db, "tasks"), where("status", "==", "active"), orderBy("sortOrder", "asc"), limit(100)));
  state.tasks = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
  renderTasks();
}

function renderTasks() {
  const taskList = document.querySelector("#task-list");
  if (!taskList) return;
  const vipLevel = state.profile?.vipLevel || "M0";
  const tasks = state.tasks.filter((task) => vipAllowed(vipLevel, task.vipRequired || "M0"));
  taskList.innerHTML = tasks.length
    ? tasks
        .map(
          (task) => `
            <article class="task-card" data-task-id="${escapeHtml(task.id)}">
              <img src="${escapeHtml(task.posterUrl)}" alt="${escapeHtml(task.title)}" />
              <div class="p-4">
                <div class="flex items-center justify-between gap-3">
                  <h3 class="text-lg font-black">${escapeHtml(task.title)}</h3>
                  <strong class="font-money text-emeraldNeon">${formatMoney(task.reward)}</strong>
                </div>
                <p class="mt-1 text-sm text-mutedSilver">${Number(task.durationSeconds || 12)} seconds watch task - ${escapeHtml(task.vipRequired || "M0")}</p>
                <button class="mt-4 h-12 w-full rounded-2xl bg-emeraldNeon font-black text-obsidian" type="button" data-start-secure-task="${escapeHtml(task.id)}">Start Watch</button>
              </div>
            </article>
          `
        )
        .join("")
    : `<article class="rounded-2xl border border-slateLine bg-frost p-4 text-sm font-bold text-mutedSilver">No tasks available for your current VIP level.</article>`;

  taskList.querySelectorAll("[data-start-secure-task]").forEach((button) => {
    button.addEventListener("click", async () => {
      await withLoading(button, async () => {
        requireSignedIn();
        const task = state.tasks.find((item) => item.id === button.dataset.startSecureTask);
        if (!task) throw new Error("Task not found.");
        const session = await startTaskWatch({ taskId: task.id });
        state.activeTask = task;
        state.activeSession = session.data;
        startCountdown(task, Number(session.data.durationSeconds || task.durationSeconds || 12));
        showScreen("watch");
      }, "Starting");
    });
  });
}

function renderPaymentMethods() {
  const root = document.querySelector("#payment-methods");
  if (!root || !state.walletSettings) return;
  const methods = (state.walletSettings.depositNetworks || []).filter((method) => method.status === "active");
  root.innerHTML = methods
    .map(
      (method) => `
        <article class="rounded-2xl border ${method.id === state.selectedPaymentMethod ? "border-emeraldNeon" : "border-slateLine"} bg-frost p-4" data-payment-method="${escapeHtml(method.id)}">
          <div class="flex items-center justify-between gap-3">
            <div>
              <strong class="text-base font-black">${escapeHtml(method.label || method.id)}</strong>
              <p class="mt-1 text-xs text-mutedSilver">${escapeHtml(method.currency === "EGP" ? "EGP payment converted to USDT balance after admin approval." : "USDT payment credited as USD balance after admin approval.")}</p>
            </div>
            <span class="shrink-0 rounded-full border border-emeraldNeon/35 bg-emeraldNeon/10 px-3 py-1 text-xs font-black text-emeraldNeon">${escapeHtml(method.currency || "USDT")}</span>
          </div>
          <div class="mt-3 flex items-center gap-2" dir="ltr">
            <code class="min-w-0 flex-1 truncate rounded-xl bg-black/30 px-3 py-3 text-xs text-white">${escapeHtml(method.wallet || method.paymentLink || "")}</code>
            <button class="rounded-xl bg-emeraldNeon px-3 py-3 text-xs font-black text-obsidian" type="button" data-copy-value="${escapeHtml(method.wallet || method.paymentLink || "")}">Copy</button>
          </div>
          ${method.paymentLink ? `<a class="mt-3 flex h-11 items-center justify-center rounded-xl border border-vipGold/40 bg-vipGold/10 text-sm font-black text-vipGold" href="${escapeHtml(method.paymentLink)}" target="_blank" rel="noopener">Open Payment Link</a>` : ""}
        </article>
      `
    )
    .join("");

  root.querySelectorAll("[data-payment-method]").forEach((card) => {
    card.addEventListener("click", (event) => {
      if (event.target.closest("[data-copy-value],a")) return;
      state.selectedPaymentMethod = card.dataset.paymentMethod;
      renderPaymentMethods();
      setDepositPackage(Number(document.querySelector(".amount-button.active")?.dataset.amount || 20));
    });
  });

  root.querySelectorAll("[data-copy-value]").forEach((button) => {
    button.addEventListener("click", async () => {
      await navigator.clipboard.writeText(button.dataset.copyValue);
      showToast("Payment detail copied.", "success");
    });
  });

  updateDepositFxNote();
}

function renderProfile(profile) {
  const main = profile?.balances?.main || 0;
  const commission = profile?.balances?.commission || 0;
  const income = profile?.income || {};
  setText("[data-profile-uid]", profile?.id ? `UID: ${profile.id}` : "Not signed in");
  setText("[data-main-balance]", formatMoney(main));
  setText("[data-commission-balance]", formatMoney(commission));
  setText("[data-today-income]", formatMoney(income.today || 0));
  setText("[data-total-income]", formatMoney(income.total || 0));
  setText("[data-home-balance]", formatMoney(main + commission));
  setText("[data-home-income]", formatMoney(income.today || 0));
  setText("[data-home-vip]", profile?.vipLevel || "M0");
}

function renderVipStatus() {
  const current = state.profile?.vipLevel || "M0";
  document.querySelectorAll("[data-vip-level]").forEach((button) => {
    const target = button.dataset.vipLevel;
    const isCurrent = target === current;
    const isLower = vipOrder(target) <= vipOrder(current);
    button.disabled = isLower;
    button.textContent = isCurrent ? "Current Status" : isLower ? "Unlocked" : "Join Now";
  });
}

function renderWithdrawalWallet() {
  const wallet = firstBoundWallet(state.profile?.wallets);
  const display = wallet?.address || "Bind a wallet in profile first";
  const walletText = document.querySelector("#withdraw-wallet-display");
  const walletInput = document.querySelector("#withdraw-wallet");
  if (walletText) walletText.textContent = display;
  if (walletInput) walletInput.value = wallet?.address || "";
  renderWithdrawalFee();
}

function renderWithdrawalFee() {
  const settings = state.walletSettings?.withdrawal || { feeRate: 0.02, fixedFee: 0, minimum: 10 };
  const amount = Number(document.querySelector("#withdraw-amount")?.value || 0);
  const fee = Math.max(0, amount * Number(settings.feeRate || 0) + Number(settings.fixedFee || 0));
  const net = Math.max(0, amount - fee);
  setText("#withdraw-fee-note", `Fee: ${formatMoney(fee)} - Net payout: ${formatMoney(net)} - Minimum: ${formatMoney(settings.minimum || 10)}`);
}

function setDepositPackage(usdAmount) {
  const method = selectedMethod();
  const amountInput = document.querySelector("#deposit-amount");
  if (!amountInput || !method) return;
  if ((method.currency || "USDT").toUpperCase() === "EGP") {
    amountInput.value = Math.ceil(usdAmount * Number(state.walletSettings?.fx?.usdtEgpRate || 50));
  } else {
    amountInput.value = usdAmount;
  }
  updateDepositFxNote();
}

function updateDepositFxNote() {
  const method = selectedMethod();
  const amount = Number(document.querySelector("#deposit-amount")?.value || 0);
  if (!method) return;
  if ((method.currency || "USDT").toUpperCase() === "EGP") {
    const rate = Number(state.walletSettings?.fx?.usdtEgpRate || 50);
    setText("#deposit-fx-note", `${amount.toFixed(2)} EGP = ${(amount / rate).toFixed(2)} USDT balance at ${rate.toFixed(2)} EGP/USDT`);
  } else {
    setText("#deposit-fx-note", `${amount.toFixed(2)} USDT will be reviewed and credited as USD balance.`);
  }
}

function startCountdown(task, totalSeconds) {
  window.clearInterval(state.countdownTimer);
  state.countdownTimer = null;
  const claim = document.querySelector("#claim-button");
  const value = document.querySelector("#countdown-value");
  const bar = document.querySelector("#countdown-bar");
  const title = document.querySelector("#watch-title");
  const cover = document.querySelector("#watch-cover");
  const startedAt = performance.now();

  if (title) title.textContent = task.title;
  if (cover) cover.style.backgroundImage = `linear-gradient(180deg, rgba(0,0,0,.1), rgba(0,0,0,.72)), url('${task.posterUrl}')`;
  if (claim) {
    claim.disabled = true;
    claim.classList.remove("unlocked", "animate-pulseGlow");
    claim.textContent = "Claim Reward / استلام المكافأة";
  }

  state.countdownTimer = window.setInterval(() => {
    const elapsed = Math.floor((performance.now() - startedAt) / 1000);
    const remaining = Math.max(0, totalSeconds - elapsed);
    if (value) value.textContent = remaining;
    if (bar) bar.style.width = `${(remaining / totalSeconds) * 100}%`;
    if (remaining <= 0) {
      window.clearInterval(state.countdownTimer);
      if (claim) {
        claim.disabled = false;
        claim.classList.add("unlocked", "animate-pulseGlow");
        claim.textContent = `Unlocked - Claim ${formatMoney(task.reward)}`;
      }
    }
  }, 250);
}

function showScreen(name) {
  document.querySelectorAll(".screen").forEach((screen) => screen.classList.toggle("active", screen.id === `screen-${name}`));
  document.querySelectorAll(".nav-button").forEach((button) => button.classList.toggle("active", button.dataset.screenTarget === name));
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function selectedMethod() {
  return (state.walletSettings?.depositNetworks || []).find((method) => method.id === state.selectedPaymentMethod);
}

function firstBoundWallet(wallets = {}) {
  return Object.values(wallets || {}).find((wallet) => wallet?.address);
}

function vipAllowed(userLevel, requiredLevel) {
  return vipOrder(userLevel) >= vipOrder(requiredLevel);
}

function vipOrder(level) {
  return ["M0", "M1", "M2", "M3", "M4", "M5", "M6", "M7", "M8", "M9", "M10"].indexOf(String(level || "M0").toUpperCase());
}

function setText(selector, value) {
  document.querySelectorAll(selector).forEach((node) => {
    node.textContent = value;
  });
}

function requireSignedIn() {
  if (!state.user) throw new Error("Sign in first.");
}

window.vidixLogout = async () => {
  await signOut(auth);
  showToast("Signed out.", "success");
};
