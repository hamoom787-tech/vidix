import { onAuthStateChanged, signOut } from "firebase/auth";
import { collection, doc, getDoc, getDocs, limit, onSnapshot, orderBy, query, updateDoc, where } from "firebase/firestore";
import { auth, db } from "./firebase-config";
import { apiRequest } from "./api/backend-client";
import { loginUser, registerNewUser } from "./firebase-auth";
import { submitDepositRequest, submitWithdrawalRequest } from "./wallet-firestore";
import { escapeHtml, formatMoney, showToast, withLoading } from "./ui/async-ui";

const state = {
  authMode: "login",
  language: getInitialLanguage(),
  user: null,
  profile: null,
  profileUnsubscribe: null,
  selectedPaymentMethod: "BINANCE_USDT_BSC",
  walletSettings: null,
  tasks: [],
  completedTaskIdsToday: new Set(),
  dailyTaskLimit: 2,
  activeTask: null,
  activeSession: null,
  countdownTimer: null
};

const AVATAR_OPTIONS = [
  { id: "emerald", label: "Emerald", url: "/assets/images/avatars/avatar-emerald.svg" },
  { id: "sapphire", label: "Sapphire", url: "/assets/images/avatars/avatar-sapphire.svg" },
  { id: "gold", label: "Gold", url: "/assets/images/avatars/avatar-gold.svg" },
  { id: "violet", label: "Violet", url: "/assets/images/avatars/avatar-violet.svg" },
  { id: "carbon", label: "Carbon", url: "/assets/images/avatars/avatar-carbon.svg" },
  { id: "neon", label: "Neon", url: "/assets/images/avatars/avatar-neon.svg" }
];

const TRANSLATIONS = {
  ar: {
    aboutUs: "عن الشركة",
    accountCreated: "تم إنشاء الحساب بأمان.",
    accountPassword: "كلمة مرور الحساب",
    adminPanel: "لوحة الإدارة",
    appDownload: "تحميل التطبيق",
    avatarSaved: "تم حفظ صورة الحساب.",
    back: "رجوع",
    bindWallet: "ربط محفظة كريبتو",
    bindWalletFirst: "اربط محفظة من حسابك أولاً",
    certificates: "الشهادات",
    chooseAvatar: "اختار صورة الحساب",
    claimLocked: "استلام المكافأة",
    claimUnlocked: "استلام {reward}",
    commission: "العمولة",
    completedToday: "اكتملت اليوم",
    copy: "نسخ",
    createAccount: "إنشاء الحساب",
    currentStatus: "المستوى الحالي",
    deposit: "شحن",
    depositFxEgp: "{amount} جنيه = {usdt} USDT بسعر {rate} جنيه/USDT",
    depositFxUsdt: "{amount} USDT سيتم مراجعته وإضافته كرصيد بالدولار.",
    depositSubmitted: "تم إرسال طلب الشحن: {id}",
    email: "البريد الإلكتروني",
    emailPlaceholder: "member@example.com",
    fundLogs: "سجلات الصندوق المالي",
    fundPassword: "كلمة مرور العمليات المالية",
    fundPasswordPlaceholder: "6 أرقام أو أكثر",
    guide: "الدليل",
    home: "الرئيسية",
    invitationCode: "كود الدعوة",
    invite: "دعوة",
    invoiceDetails: "تفاصيل الفاتورة",
    joinNow: "انضم الآن",
    languageChanged: "تم تغيير اللغة.",
    livePayoutTracker: "متابعة الأرباح المباشرة",
    login: "دخول",
    loginSubtitle: "حساب، كود دعوة، وكلمة عمليات مالية منفصلة.",
    loginTitle: "تسجيل الدخول",
    mainBalance: "الرصيد الأساسي",
    myAccount: "حسابي",
    noTasks: "لا توجد مهام متاحة لمستواك الحالي.",
    notSignedIn: "لم يتم تسجيل الدخول",
    passwordPlaceholder: "••••••••",
    paymentCopied: "تم نسخ بيانات الدفع.",
    platformAds: "إعلانات المنصة",
    profileStyle: "شكل الحساب",
    referralPlaceholder: "VX-ROOT",
    remainingWatchTime: "وقت المشاهدة المتبقي",
    resetFundPassword: "تغيير كلمة مرور الصندوق",
    rewardClaimed: "تم استلام المكافأة بأمان.",
    secureAccess: "دخول آمن",
    secureContinue: "متابعة آمنة",
    signedIn: "تم تسجيل الدخول.",
    signInFirst: "سجل الدخول أولاً.",
    signup: "إنشاء حساب",
    startWatch: "ابدأ المشاهدة",
    tagline: "منصة ربح فيديو آمنة",
    tapToSave: "اضغط للحفظ",
    taskCompletedAll: "تم إنهاء كل مهام اليوم. ارجع غدًا لمهمتين جديدتين.",
    taskDailyNote: "مهام اليوم: مهمتان فقط، كل مهمة بقيمة $1.00.",
    taskHall: "قاعة المهام",
    taskMissing: "المهمة غير موجودة.",
    taskProgress: "مهام اليوم: {done}/{limit}",
    tasks: "المهام",
    today: "اليوم",
    totalRevenue: "إجمالي الأرباح",
    unlocked: "مفتوح",
    vipLevels: "مستويات العضوية",
    walletBalance: "رصيد المحفظة",
    watchSeconds: "{seconds} ثانية مشاهدة - {vip}",
    watchTask: "مهمة مشاهدة",
    withdraw: "سحب",
    withdrawalFee: "الرسوم: {fee} - الصافي: {net} - الحد الأدنى: {minimum}",
    withdrawalPending: "طلب السحب قيد المراجعة. الصافي: {net} الرسوم: {fee}"
  },
  en: {
    aboutUs: "About Us",
    accountCreated: "Account created securely.",
    accountPassword: "Account password",
    adminPanel: "Admin Panel",
    appDownload: "App Download",
    avatarSaved: "Profile avatar saved.",
    back: "Back",
    bindWallet: "Bind Crypto Wallet",
    bindWalletFirst: "Bind a wallet in profile first",
    certificates: "Certificates",
    chooseAvatar: "Choose your avatar",
    claimLocked: "Claim Reward",
    claimUnlocked: "Claim {reward}",
    commission: "Commission",
    completedToday: "Completed today",
    copy: "Copy",
    createAccount: "Create Account",
    currentStatus: "Current Status",
    deposit: "Deposit",
    depositFxEgp: "{amount} EGP = {usdt} USDT at {rate} EGP/USDT",
    depositFxUsdt: "{amount} USDT will be reviewed and credited as USD balance.",
    depositSubmitted: "Deposit submitted: {id}",
    email: "Email",
    emailPlaceholder: "member@example.com",
    fundLogs: "Financial Fund Logs",
    fundPassword: "Fund password",
    fundPasswordPlaceholder: "6 digits or more",
    guide: "Guide",
    home: "Home",
    invitationCode: "Invitation code",
    invite: "Invite",
    invoiceDetails: "Invoice Details",
    joinNow: "Join Now",
    languageChanged: "Language changed.",
    livePayoutTracker: "Live Payout Tracker",
    login: "Login",
    loginSubtitle: "Account access, invitation code, and separate fund password.",
    loginTitle: "Sign in",
    mainBalance: "Main Balance",
    myAccount: "My Account",
    noTasks: "No tasks available for your current VIP level.",
    notSignedIn: "Not signed in",
    passwordPlaceholder: "••••••••",
    paymentCopied: "Payment detail copied.",
    platformAds: "Platform Ads",
    profileStyle: "Profile Style",
    referralPlaceholder: "VX-ROOT",
    remainingWatchTime: "Remaining Watch Time",
    resetFundPassword: "Reset Fund Password",
    rewardClaimed: "Reward claimed securely.",
    secureAccess: "Secure Access",
    secureContinue: "Secure Continue",
    signedIn: "Signed in.",
    signInFirst: "Sign in first.",
    signup: "Sign Up",
    startWatch: "Start Watch",
    tagline: "Secure video earning",
    tapToSave: "Tap to save",
    taskCompletedAll: "All daily tasks are completed. Come back tomorrow for two fresh videos.",
    taskDailyNote: "Daily tasks: only two videos, each pays $1.00.",
    taskHall: "Task Hall",
    taskMissing: "Task not found.",
    taskProgress: "Today: {done}/{limit}",
    tasks: "Tasks",
    today: "Today",
    totalRevenue: "Total Revenue",
    unlocked: "Unlocked",
    vipLevels: "VIP Levels",
    walletBalance: "Wallet Balance",
    watchSeconds: "{seconds} seconds watch task - {vip}",
    watchTask: "Watch Task",
    withdraw: "Withdraw",
    withdrawalFee: "Fee: {fee} - Net payout: {net} - Minimum: {minimum}",
    withdrawalPending: "Withdrawal pending. Net: {net} Fee: {fee}"
  }
};

normalizeTranslations();

const workerCall = (path) => async (payload) => ({ data: await apiRequest(path, { body: payload }) });
const startTaskWatch = workerCall("/tasks/start");
const completeTask = workerCall("/tasks/complete");
const upgradeVip = workerCall("/vip/upgrade");
const joinInvestment = workerCall("/investments");

bootstrap();

function bootstrap() {
  bindLanguageSwitcher();
  bindNavigation();
  bindAuth();
  bindAvatarPicker();
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
      state.completedTaskIdsToday = new Set();
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

function bindLanguageSwitcher() {
  document.querySelectorAll("[data-language]").forEach((button) => {
    button.addEventListener("click", () => setLanguage(button.dataset.language, true));
  });
  setLanguage(state.language);
}

function bindAvatarPicker() {
  renderAvatarPicker();
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
      renderAuthMode();
    });
  });
  renderAuthMode();

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
        showToast(t("accountCreated"), "success");
      } else {
        await loginUser(payload);
        showToast(t("signedIn"), "success");
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
      showToast(t("depositSubmitted", { id: result.depositId }), "success");
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
      showToast(t("withdrawalPending", { net: formatMoney(result.netAmount), fee: formatMoney(result.fee) }), "success");
    });
  });
}

function bindVip() {
  document.querySelectorAll("[data-vip-level]").forEach((button) => {
    button.addEventListener("click", async () => {
      await withLoading(button, async () => {
        requireSignedIn();
        const result = await upgradeVip({ levelId: button.dataset.vipLevel });
        showToast(`VIP ${result.data.vipLevel}`, "success");
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
        state.completedTaskIdsToday.add(state.activeTask.id);
        state.activeTask = null;
        state.activeSession = null;
        showToast(t("rewardClaimed"), "success");
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
  const [taskSnapshot, completedSnapshot] = await Promise.all([
    getDocs(query(collection(db, "tasks"), where("status", "==", "active"), orderBy("sortOrder", "asc"), limit(100))),
    state.user
      ? getDocs(
          query(
            collection(db, "user_tasks"),
            where("uid", "==", state.user.uid),
            where("dayKey", "==", dayKey()),
            where("status", "==", "completed"),
            limit(20)
          )
        )
      : Promise.resolve({ docs: [] })
  ]);
  state.tasks = taskSnapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
  state.completedTaskIdsToday = new Set(completedSnapshot.docs.map((item) => item.data().taskId).filter(Boolean));
  renderTasks();
}

function renderTasks() {
  const taskList = document.querySelector("#task-list");
  if (!taskList) return;
  const vipLevel = state.profile?.vipLevel || "M0";
  const tasks = state.tasks.filter((task) => vipAllowed(vipLevel, task.vipRequired || "M0")).slice(0, state.dailyTaskLimit);
  const completedCount = Math.min(tasks.filter((task) => state.completedTaskIdsToday.has(task.id)).length, state.dailyTaskLimit);
  renderTaskProgress(completedCount, state.dailyTaskLimit);
  taskList.innerHTML = tasks.length
    ? tasks
        .map(
          (task) => {
            const isCompleted = state.completedTaskIdsToday.has(task.id);
            return `
            <article class="task-card ${isCompleted ? "opacity-70" : ""}" data-task-id="${escapeHtml(task.id)}">
              <img src="${escapeHtml(task.posterUrl)}" alt="${escapeHtml(task.title)}" />
              <div class="p-4">
                <div class="flex items-center justify-between gap-3">
                  <h3 class="text-lg font-black">${escapeHtml(task.title)}</h3>
                  <strong class="font-money text-emeraldNeon">${formatMoney(task.reward)}</strong>
                </div>
                <p class="mt-1 text-sm text-mutedSilver">${escapeHtml(t("watchSeconds", { seconds: Number(task.durationSeconds || 12), vip: task.vipRequired || "M0" }))}</p>
                ${
                  isCompleted
                    ? `<button class="mt-4 h-12 w-full rounded-2xl border border-emeraldNeon/35 bg-emeraldNeon/10 font-black text-emeraldNeon" type="button" disabled>${escapeHtml(t("completedToday"))}</button>`
                    : `<button class="mt-4 h-12 w-full rounded-2xl bg-emeraldNeon font-black text-obsidian" type="button" data-start-secure-task="${escapeHtml(task.id)}">${escapeHtml(t("startWatch"))}</button>`
                }
              </div>
            </article>
          `;
          }
        )
        .join("")
    : `<article class="rounded-2xl border border-slateLine bg-frost p-4 text-sm font-bold text-mutedSilver">${escapeHtml(t("noTasks"))}</article>`;

  if (tasks.length > 0 && completedCount >= state.dailyTaskLimit) {
    taskList.insertAdjacentHTML(
      "afterbegin",
      `<article class="rounded-2xl border border-emeraldNeon/25 bg-emeraldNeon/10 p-4 text-sm font-black text-emeraldNeon">${escapeHtml(t("taskCompletedAll"))}</article>`
    );
  }

  taskList.querySelectorAll("[data-start-secure-task]").forEach((button) => {
    button.addEventListener("click", async () => {
      await withLoading(button, async () => {
        requireSignedIn();
        const task = state.tasks.find((item) => item.id === button.dataset.startSecureTask);
        if (!task) throw new Error(t("taskMissing"));
        const session = await startTaskWatch({ taskId: task.id });
        state.activeTask = task;
        state.activeSession = session.data;
        startCountdown(task, Number(session.data.durationSeconds || task.durationSeconds || 12));
        showScreen("watch");
      }, t("startWatch"));
    });
  });
}

function renderTaskProgress(done, limitCount) {
  const progress = `${done}/${limitCount}`;
  setText("[data-task-progress]", progress);
  setText("[data-home-task-progress]", progress);
  setText("#task-daily-note", t("taskDailyNote"));
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
            <button class="rounded-xl bg-emeraldNeon px-3 py-3 text-xs font-black text-obsidian" type="button" data-copy-value="${escapeHtml(method.wallet || method.paymentLink || "")}">${escapeHtml(t("copy"))}</button>
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
      showToast(t("paymentCopied"), "success");
    });
  });

  updateDepositFxNote();
}

function renderProfile(profile) {
  const main = profile?.balances?.main || 0;
  const commission = profile?.balances?.commission || 0;
  const income = profile?.income || {};
  setText("[data-profile-uid]", profile?.id ? `UID: ${profile.id}` : t("notSignedIn"));
  setText("[data-main-balance]", formatMoney(main));
  setText("[data-commission-balance]", formatMoney(commission));
  setText("[data-today-income]", formatMoney(income.today || 0));
  setText("[data-total-income]", formatMoney(income.total || 0));
  setText("[data-home-balance]", formatMoney(main + commission));
  setText("[data-home-income]", formatMoney(income.today || 0));
  setText("[data-home-vip]", profile?.vipLevel || "M0");
  renderProfileAvatar(profile);
  renderAvatarPicker(profile);
}

function renderProfileAvatar(profile) {
  const avatar = selectedAvatar(profile);
  const image = document.querySelector("#profile-avatar");
  if (image) {
    image.src = avatar.url;
    image.alt = `${avatar.label} VidiX avatar`;
  }
}

function renderAvatarPicker(profile = state.profile) {
  const root = document.querySelector("#avatar-picker");
  if (!root) return;
  const selectedId = selectedAvatar(profile).id;
  root.innerHTML = AVATAR_OPTIONS.map(
    (avatar) => `
      <button
        class="avatar-option ${avatar.id === selectedId ? "active" : ""}"
        type="button"
        data-avatar-id="${escapeHtml(avatar.id)}"
        aria-label="${escapeHtml(avatar.label)}"
      >
        <img src="${escapeHtml(avatar.url)}" alt="${escapeHtml(avatar.label)}" />
      </button>
    `
  ).join("");

  root.querySelectorAll("[data-avatar-id]").forEach((button) => {
    button.addEventListener("click", async () => {
      await withLoading(button, async () => {
        requireSignedIn();
        const avatar = AVATAR_OPTIONS.find((item) => item.id === button.dataset.avatarId) || AVATAR_OPTIONS[0];
        await updateDoc(doc(db, "users", state.user.uid), {
          avatarId: avatar.id,
          avatarUrl: avatar.url,
          updatedAt: new Date()
        });
        showToast(t("avatarSaved"), "success");
      });
    });
  });
}

function renderVipStatus() {
  const current = state.profile?.vipLevel || "M0";
  document.querySelectorAll("[data-vip-level]").forEach((button) => {
    const target = button.dataset.vipLevel;
    const isCurrent = target === current;
    const isLower = vipOrder(target) <= vipOrder(current);
    button.disabled = isLower;
    button.textContent = isCurrent ? t("currentStatus") : isLower ? t("unlocked") : t("joinNow");
  });
}

function renderWithdrawalWallet() {
  const wallet = firstBoundWallet(state.profile?.wallets);
  const display = wallet?.address || t("bindWalletFirst");
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
  setText("#withdraw-fee-note", t("withdrawalFee", { fee: formatMoney(fee), net: formatMoney(net), minimum: formatMoney(settings.minimum || 10) }));
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
    setText("#deposit-fx-note", t("depositFxEgp", { amount: amount.toFixed(2), usdt: (amount / rate).toFixed(2), rate: rate.toFixed(2) }));
  } else {
    setText("#deposit-fx-note", t("depositFxUsdt", { amount: amount.toFixed(2) }));
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
    claim.textContent = t("claimLocked");
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
        claim.textContent = t("claimUnlocked", { reward: formatMoney(task.reward) });
      }
    }
  }, 250);
}

function showScreen(name) {
  document.querySelectorAll(".screen").forEach((screen) => screen.classList.toggle("active", screen.id === `screen-${name}`));
  document.querySelectorAll(".nav-button").forEach((button) => button.classList.toggle("active", button.dataset.screenTarget === name));
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function setLanguage(language, notify = false) {
  state.language = ["ar", "en"].includes(language) ? language : "ar";
  try {
    window.localStorage.setItem("vidix-language", state.language);
  } catch {
    // Local storage can be blocked in private browsers; the UI can still switch for the session.
  }

  document.documentElement.lang = state.language;
  document.documentElement.dir = state.language === "ar" ? "rtl" : "ltr";
  document.body?.setAttribute("dir", document.documentElement.dir);

  document.querySelectorAll("[data-language]").forEach((button) => {
    const isActive = button.dataset.language === state.language;
    button.classList.toggle("bg-emeraldNeon", isActive);
    button.classList.toggle("text-obsidian", isActive);
    button.classList.toggle("text-mutedSilver", !isActive);
  });

  document.querySelectorAll("[data-i18n]").forEach((node) => {
    node.textContent = t(node.dataset.i18n);
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach((node) => {
    node.setAttribute("placeholder", t(node.dataset.i18nPlaceholder));
  });

  renderAuthMode();
  renderTasks();
  renderProfile(state.profile);
  renderVipStatus();
  renderWithdrawalWallet();
  renderPaymentMethods();

  if (notify) showToast(t("languageChanged"), "success");
}

function renderAuthMode() {
  const isSignup = state.authMode === "signup";
  document.querySelectorAll("[data-auth-mode]").forEach((button) => {
    const isActive = button.dataset.authMode === state.authMode;
    button.classList.toggle("bg-emeraldNeon", isActive);
    button.classList.toggle("text-obsidian", isActive);
    button.classList.toggle("text-mutedSilver", !isActive);
  });
  document.querySelectorAll(".signup-field").forEach((field) => field.classList.toggle("hidden", !isSignup));
  const submit = document.querySelector("#auth-submit");
  if (submit) submit.textContent = isSignup ? t("createAccount") : t("secureContinue");
}

function t(key, params = {}) {
  const dictionary = TRANSLATIONS[state.language] || TRANSLATIONS.ar;
  const fallback = TRANSLATIONS.en[key] || key;
  let value = dictionary[key] || fallback;
  Object.entries(params).forEach(([name, replacement]) => {
    value = value.replaceAll(`{${name}}`, String(replacement));
  });
  return value;
}

function normalizeTranslations() {
  Object.values(TRANSLATIONS).forEach((dictionary) => {
    Object.entries(dictionary).forEach(([key, value]) => {
      if (typeof value === "string") dictionary[key] = decodeMojibake(value);
    });
  });
}

function decodeMojibake(value) {
  if (!/[ÃÂØÙâ]/.test(value)) return value;
  try {
    const bytes = Uint8Array.from([...value].map((character) => character.charCodeAt(0)));
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return value;
  }
}

function getInitialLanguage() {
  try {
    const saved = window.localStorage.getItem("vidix-language");
    return ["ar", "en"].includes(saved) ? saved : "ar";
  } catch {
    return "ar";
  }
}

function selectedMethod() {
  return (state.walletSettings?.depositNetworks || []).find((method) => method.id === state.selectedPaymentMethod);
}

function selectedAvatar(profile = state.profile) {
  return AVATAR_OPTIONS.find((avatar) => avatar.id === profile?.avatarId) || AVATAR_OPTIONS[0];
}

function firstBoundWallet(wallets = {}) {
  return Object.values(wallets || {}).find((wallet) => wallet?.address);
}

function dayKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Cairo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  const lookup = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${lookup.year}-${lookup.month}-${lookup.day}`;
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
  if (!state.user) throw new Error(t("signInFirst"));
}

window.vidixLogout = async () => {
  await signOut(auth);
  showToast("Signed out.", "success");
};
