const LEVEL_ORDER = ["M0", "M1", "M2", "M3", "M4", "M5", "M6", "M7", "M8", "M9", "M10"];
const REFERRAL_RATES = [
  { level: "A", rate: 0.04 },
  { level: "B", rate: 0.02 },
  { level: "C", rate: 0.01 }
];

const DEFAULT_WITHDRAWAL_SETTINGS = {
  minimum: 10,
  feeRate: 0.02,
  fixedFee: 0,
  allowedWallets: ["main", "commission"]
};

const DEFAULT_SYSTEM_SETTINGS = {
  "system_settings/vip_levels": {
    levels: [
      { id: "M0", price: 0, dailyTasks: 2, reward: 1 },
      { id: "M1", price: 20, dailyTasks: 2, reward: 1 },
      { id: "M2", price: 125, dailyTasks: 2, reward: 1 },
      { id: "M3", price: 250, dailyTasks: 2, reward: 1 },
      { id: "M4", price: 700, dailyTasks: 2, reward: 1 },
      { id: "M5", price: 2300, dailyTasks: 2, reward: 1 },
      { id: "M6", price: 5000, dailyTasks: 2, reward: 1 },
      { id: "M7", price: 9000, dailyTasks: 2, reward: 1 },
      { id: "M8", price: 15000, dailyTasks: 2, reward: 1 },
      { id: "M9", price: 25000, dailyTasks: 2, reward: 1 },
      { id: "M10", price: 50000, dailyTasks: 2, reward: 1 }
    ]
  },
  "system_settings/referrals": {
    levels: REFERRAL_RATES
  },
  "system_settings/investment_plans": {
    plans: [
      { id: "doomsday-180", title: "Avengers: Doomsday Plan", periodDays: 180, dailyRate: 2, minAmount: 100, status: "active" },
      { id: "sapphire-90", title: "Sapphire Growth Plan", periodDays: 90, dailyRate: 1.2, minAmount: 50, status: "active" },
      { id: "emerald-365", title: "Emerald Reserve", periodDays: 365, dailyRate: 2.5, minAmount: 500, status: "active" }
    ]
  },
  "system_settings/wallets": {
    fx: { usdtEgpRate: 50 },
    depositNetworks: [
      {
        id: "BINANCE_USDT_BSC",
        label: "Binance USDT - BNB Smart Chain (BEP20)",
        wallet: "0xf4eca9ac6d3df1aed0d819e16ad9214448ae4cd0",
        minimumDeposit: 20,
        currency: "USDT",
        status: "active"
      },
      {
        id: "VODAFONE_CASH",
        label: "Vodafone Cash",
        wallet: "01501691767",
        minimumDeposit: 100,
        currency: "EGP",
        status: "active"
      },
      {
        id: "INSTAPAY_PHONE",
        label: "InstaPay Phone",
        wallet: "01115838581",
        minimumDeposit: 100,
        currency: "EGP",
        status: "active"
      },
      {
        id: "INSTAPAY_HANDLE",
        label: "InstaPay Handle",
        wallet: "mohamm3edr3da@instapay",
        paymentLink: "https://ipn.eg/S/mohamm3edr3da/instapay/78yteB",
        minimumDeposit: 100,
        currency: "EGP",
        status: "active"
      }
    ],
    withdrawal: DEFAULT_WITHDRAWAL_SETTINGS
  },
  "public/news": {
    items: [
      "VidiX admin review is required for all deposits.",
      "Never share your fund password with support or team members.",
      "VIP task limits are refreshed daily."
    ]
  }
};

const DEFAULT_TASKS = {
  "tasks/task-taylor-swift": {
    title: "Taylor Swift Premiere",
    category: "Music Documentary",
    vipRequired: "M0",
    reward: 1,
    durationSeconds: 12,
    status: "active",
    sortOrder: 10,
    posterUrl: "/assets/images/tasks/watch-earn-phone.png",
    videoUrl: "https://www.youtube.com/embed/ysz5S6PUM-U"
  },
  "tasks/task-wimpy-kid": {
    title: "Diary of a Wimpy Kid",
    category: "Family Trailer",
    vipRequired: "M0",
    reward: 1,
    durationSeconds: 12,
    status: "active",
    sortOrder: 20,
    posterUrl: "/assets/images/tasks/movie-task-vault.png",
    videoUrl: "https://www.youtube.com/embed/jNQXAC9IVRw"
  },
  "tasks/task-murder-easttown": {
    title: "Murder in Easttown",
    category: "Drama Preview",
    vipRequired: "M2",
    reward: 1,
    durationSeconds: 12,
    status: "archived",
    sortOrder: 30,
    posterUrl: "/assets/images/banners/vidix-cinema-vip.png",
    videoUrl: "https://www.youtube.com/embed/tgbNymZ7vqY"
  },
  "tasks/task-gupta-journey": {
    title: "Gupta's Journey",
    category: "Cinema Trailer",
    vipRequired: "M0",
    reward: 1,
    durationSeconds: 12,
    status: "archived",
    sortOrder: 40,
    posterUrl: "/assets/images/brand/vidix-hex-logo-scene.png",
    videoUrl: "https://www.youtube.com/embed/ysz5S6PUM-U"
  }
};

let googleTokenCache = null;
let secureTokenJwksCache = null;

export default {
  async fetch(request, env, ctx) {
    try {
      return await handleRequest(request, env, ctx);
    } catch (error) {
      const apiError = normalizeError(error);
      console.error(JSON.stringify({ level: "error", code: apiError.code, message: apiError.message, status: apiError.status }));
      return jsonResponse(
        { ok: false, error: { code: apiError.code, message: apiError.message } },
        apiError.status,
        request,
        env
      );
    }
  }
};

async function handleRequest(request, env, ctx) {
  const url = new URL(request.url);
  const method = request.method.toUpperCase();
  const parts = url.pathname.split("/").filter(Boolean);

  if (method === "OPTIONS") return corsPreflight(request, env);
  if (method === "GET" && url.pathname === "/health") {
    return jsonResponse({ ok: true, data: { service: "vidix-api", status: "healthy" } }, 200, request, env);
  }

  if (method === "GET" && url.pathname === "/settings/wallets") {
    const settings = await getWalletSettings(env);
    return jsonResponse({ ok: true, data: settings }, 200, request, env);
  }

  const authUser = await requireFirebaseUser(request, env);

  if (method === "POST" && url.pathname === "/auth/complete-registration") {
    return jsonResponse({ ok: true, data: await completeRegistration(env, authUser, await readJson(request)) }, 200, request, env);
  }

  if (method === "POST" && url.pathname === "/auth/set-fund-password") {
    return jsonResponse({ ok: true, data: await setFundPassword(env, authUser, await readJson(request)) }, 200, request, env);
  }

  if (method === "POST" && url.pathname === "/wallet/bind") {
    return jsonResponse({ ok: true, data: await bindWallet(env, authUser, await readJson(request)) }, 200, request, env);
  }

  if (method === "POST" && url.pathname === "/deposits") {
    return jsonResponse({ ok: true, data: await createDepositRequest(env, authUser, await readJson(request)) }, 200, request, env);
  }

  if (method === "POST" && url.pathname === "/withdrawals") {
    return jsonResponse({ ok: true, data: await requestWithdrawal(env, authUser, await readJson(request)) }, 200, request, env);
  }

  if (method === "POST" && url.pathname === "/tasks/start") {
    return jsonResponse({ ok: true, data: await startTaskWatch(env, authUser, await readJson(request)) }, 200, request, env);
  }

  if (method === "POST" && url.pathname === "/tasks/complete") {
    return jsonResponse({ ok: true, data: await completeTask(env, authUser, await readJson(request)) }, 200, request, env);
  }

  if (method === "POST" && url.pathname === "/vip/upgrade") {
    return jsonResponse({ ok: true, data: await upgradeVip(env, authUser, await readJson(request)) }, 200, request, env);
  }

  if (method === "POST" && url.pathname === "/investments") {
    return jsonResponse({ ok: true, data: await joinInvestment(env, authUser, await readJson(request)) }, 200, request, env);
  }

  if (method === "POST" && url.pathname === "/ranks/apply") {
    return jsonResponse({ ok: true, data: await applyForRank(env, authUser, await readJson(request)) }, 200, request, env);
  }

  if (parts[0] === "admin") {
    return await handleAdminRoute({ request, env, ctx, authUser, method, parts });
  }

  throw new ApiError(404, "Route not found.", "not_found");
}

async function handleAdminRoute({ request, env, authUser, method, parts }) {
  if (method === "POST" && parts[1] === "bootstrap-root") {
    await requireBootstrapSecret(request, env);
    return jsonResponse({ ok: true, data: await bootstrapRootAdmin(env, authUser) }, 200, request, env);
  }

  if (method === "POST" && parts[1] === "seed-defaults") {
    const hasBootstrapSecret = await hasValidBootstrapSecret(request, env);
    if (!hasBootstrapSecret) await requireAdmin(env, authUser);
    return jsonResponse({ ok: true, data: await seedDefaults(env, authUser.uid) }, 200, request, env);
  }

  if (method === "POST" && parts[1] === "import-documents") {
    const hasBootstrapSecret = await hasValidBootstrapSecret(request, env);
    if (!hasBootstrapSecret) await requireAdmin(env, authUser);
    return jsonResponse({ ok: true, data: await importDocuments(env, authUser.uid, await readJson(request)) }, 200, request, env);
  }

  const adminProfile = await requireAdmin(env, authUser);

  if (method === "GET" && parts[1] === "me") {
    return jsonResponse({ ok: true, data: { isAdmin: true, profile: adminProfile } }, 200, request, env);
  }

  if (method === "GET" && parts[1] === "dashboard") {
    return jsonResponse({ ok: true, data: await getAdminDashboard(env) }, 200, request, env);
  }

  if (method === "GET" && parts[1] === "users") {
    const users = await queryDocs(env, "users", { limit: 500 });
    return jsonResponse({ ok: true, data: { users } }, 200, request, env);
  }

  if (method === "GET" && parts[1] === "deposits") {
    const deposits = await queryDocs(env, "deposits", { orderBy: [{ field: "createdAt", direction: "DESCENDING" }], limit: 500 });
    return jsonResponse({ ok: true, data: { deposits } }, 200, request, env);
  }

  if (method === "GET" && parts[1] === "withdrawals") {
    const withdrawals = await queryDocs(env, "withdrawals", { orderBy: [{ field: "createdAt", direction: "DESCENDING" }], limit: 500 });
    return jsonResponse({ ok: true, data: { withdrawals } }, 200, request, env);
  }

  if (method === "GET" && parts[1] === "tasks") {
    const tasks = await queryDocs(env, "tasks", { orderBy: [{ field: "sortOrder", direction: "ASCENDING" }], limit: 500 });
    return jsonResponse({ ok: true, data: { tasks } }, 200, request, env);
  }

  if (method === "GET" && parts[1] === "vip-levels") {
    const settings = await getDoc(env, "system_settings/vip_levels");
    return jsonResponse({ ok: true, data: { levels: settings?.levels || [] } }, 200, request, env);
  }

  if (method === "GET" && parts[1] === "investments") {
    const [plansDoc, investments] = await Promise.all([
      getDoc(env, "system_settings/investment_plans"),
      queryDocs(env, "investments", { orderBy: [{ field: "createdAt", direction: "DESCENDING" }], limit: 500 })
    ]);
    return jsonResponse({ ok: true, data: { plans: plansDoc?.plans || [], investments } }, 200, request, env);
  }

  if (method === "POST" && parts[1] === "deposits" && parts[3] === "approve") {
    return jsonResponse({ ok: true, data: await approveDeposit(env, authUser.uid, parts[2], await readJson(request)) }, 200, request, env);
  }

  if (method === "POST" && parts[1] === "deposits" && parts[3] === "reject") {
    return jsonResponse({ ok: true, data: await rejectDeposit(env, authUser.uid, parts[2], await readJson(request)) }, 200, request, env);
  }

  if (method === "POST" && parts[1] === "withdrawals" && parts[3] === "settle") {
    return jsonResponse({ ok: true, data: await settleWithdrawal(env, authUser.uid, parts[2], await readJson(request)) }, 200, request, env);
  }

  if (method === "POST" && parts[1] === "tasks" && parts.length === 2) {
    return jsonResponse({ ok: true, data: await adminUpsertTask(env, authUser.uid, await readJson(request)) }, 200, request, env);
  }

  if (method === "POST" && parts[1] === "tasks" && parts[3] === "archive") {
    return jsonResponse({ ok: true, data: await adminArchiveTask(env, authUser.uid, parts[2]) }, 200, request, env);
  }

  if (method === "POST" && parts[1] === "vip-levels") {
    return jsonResponse({ ok: true, data: await adminUpsertVipLevel(env, authUser.uid, await readJson(request)) }, 200, request, env);
  }

  if (method === "POST" && parts[1] === "investment-plans") {
    return jsonResponse({ ok: true, data: await adminUpsertInvestmentPlan(env, authUser.uid, await readJson(request)) }, 200, request, env);
  }

  if (method === "POST" && parts[1] === "investments" && parts[3] === "status") {
    return jsonResponse({ ok: true, data: await adminSetInvestmentStatus(env, authUser.uid, parts[2], await readJson(request)) }, 200, request, env);
  }

  if (method === "POST" && parts[1] === "users" && parts[2] === "action") {
    return jsonResponse({ ok: true, data: await adminUserAction(env, authUser.uid, await readJson(request)) }, 200, request, env);
  }

  throw new ApiError(404, "Admin route not found.", "not_found");
}

async function completeRegistration(env, authUser, payload) {
  const referralCode = assertReferralCode(payload.referralCode);
  const fundPassword = assertFundPassword(payload.fundPassword);
  const displayName = String(payload.displayName || authUser.name || "").trim().slice(0, 80) || "VidiX Member";
  const requestedPhone = String(payload.phone || authUser.phone_number || "").trim().slice(0, 32) || null;

  return runTransaction(env, async (tx) => {
    const existing = await tx.get(`users/${authUser.uid}`);
    if (existing) return { ok: true, uid: authUser.uid, referralCode: existing.referralCode };

    const inviters = await tx.query("users", { filters: [{ field: "referralCode", op: "EQUAL", value: referralCode }], limit: 1 });
    if (!inviters.length) throw new ApiError(412, "Invitation code does not exist.", "invalid_referral");

    const inviter = inviters[0];
    const newReferralCode = await createUniqueReferralCode(env, tx);
    const referralPath = [inviter.id, ...(inviter.referralPath || [])].slice(0, 3);
    const now = new Date();
    const userDoc = {
      email: authUser.email || null,
      phoneNumber: authUser.phone_number || requestedPhone,
      displayName,
      authProvider: payload.authProvider || "email",
      referralCode: newReferralCode,
      referrerUid: inviter.id,
      invitedByCode: referralCode,
      referralPath,
      vipLevel: "M0",
      balances: { main: 0, commission: 0, locked: 0 },
      income: { today: 0, month: 0, total: 0 },
      wallets: {},
      role: "user",
      status: "active",
      registeredDayKey: dayKey(),
      fundPasswordHash: await hashFundPassword(fundPassword),
      createdAt: now,
      updatedAt: now
    };

    tx.set(`users/${authUser.uid}`, userDoc, { exists: false });
    referralPath.forEach((ancestorUid, index) => {
      const level = ["A", "B", "C"][index];
      tx.set(`users/${ancestorUid}/downline_level_${level}/${authUser.uid}`, {
        uid: authUser.uid,
        email: authUser.email || null,
        phoneNumber: authUser.phone_number || requestedPhone,
        vipLevel: "M0",
        registeredDayKey: dayKey(),
        createdAt: now,
        updatedAt: now
      });
    });

    return { ok: true, uid: authUser.uid, referralCode: newReferralCode };
  });
}

async function setFundPassword(env, authUser, payload) {
  const fundPassword = assertFundPassword(payload.fundPassword);
  return runTransaction(env, async (tx) => {
    const profile = await requireActiveUserProfileTx(tx, authUser.uid);
    tx.set(`users/${authUser.uid}`, stripMeta({ ...profile, fundPasswordHash: await hashFundPassword(fundPassword), updatedAt: new Date() }), { exists: true });
    return { ok: true };
  });
}

async function bindWallet(env, authUser, payload) {
  const walletAddress = assertWallet(payload.walletAddress);
  const network = String(payload.network || "TRC20").trim().toUpperCase().slice(0, 24);
  const fundPassword = assertFundPassword(payload.fundPassword);

  return runTransaction(env, async (tx) => {
    const profile = await requireActiveUserProfileTx(tx, authUser.uid);
    await requireValidFundPassword(profile, fundPassword);
    const wallets = { ...(profile.wallets || {}) };
    wallets[network.toLowerCase()] = { address: walletAddress, network, boundAt: new Date() };
    tx.set(`users/${authUser.uid}`, stripMeta({ ...profile, wallets, updatedAt: new Date() }), { exists: true });
    return { ok: true, network };
  });
}

async function createDepositRequest(env, authUser, payload) {
  const txId = assertTxId(payload.txId);
  const settings = await getWalletSettings(env);
  const paymentMethod = findPaymentMethod(settings, payload.paymentMethod || payload.network);
  const receiptReference = assertReceiptReference(payload.receiptUrl || payload.receiptReference || payload.proofReference || txId);
  const depositAmount = normalizeDepositAmount(payload.amount, paymentMethod, settings);

  return runTransaction(env, async (tx) => {
    await requireActiveUserProfileTx(tx, authUser.uid);
    const duplicate = await tx.query("deposits", {
      filters: [
        { field: "txId", op: "EQUAL", value: txId },
        { field: "paymentMethod", op: "EQUAL", value: paymentMethod.id }
      ],
      limit: 1
    });
    if (duplicate.length) throw new ApiError(409, "This payment reference was already submitted.", "duplicate_deposit");

    const depositId = crypto.randomUUID();
    const now = new Date();
    tx.set(`deposits/${depositId}`, {
      uid: authUser.uid,
      amount: depositAmount.usdAmount,
      usdAmount: depositAmount.usdAmount,
      originalAmount: depositAmount.originalAmount,
      originalCurrency: depositAmount.originalCurrency,
      fxRateUsdtEgp: depositAmount.fxRateUsdtEgp,
      txId,
      network: paymentMethod.id,
      paymentMethod: paymentMethod.id,
      paymentLabel: paymentMethod.label || paymentMethod.id,
      paymentWallet: paymentMethod.wallet || paymentMethod.paymentLink || null,
      receiptUrl: receiptReference,
      receiptReference,
      status: "pending",
      createdAt: now,
      updatedAt: now
    });

    return { ok: true, depositId, status: "pending", usdAmount: depositAmount.usdAmount };
  });
}

async function requestWithdrawal(env, authUser, payload) {
  const settings = await getWalletSettings(env);
  const withdrawalSettings = normalizeWithdrawalSettings(settings.withdrawal);
  const sourceWallet = assertWithdrawWalletSource(payload.sourceWallet, withdrawalSettings.allowedWallets);
  const walletAddress = assertWallet(payload.walletAddress);
  const amount = assertAmount(payload.amount, withdrawalSettings.minimum);
  const fundPassword = assertFundPassword(payload.fundPassword);
  const fee = calculateWithdrawalFee(amount, withdrawalSettings);
  const netAmount = roundMoney(amount - fee);
  if (netAmount <= 0) throw new ApiError(412, "Withdrawal amount must be greater than the fee.", "invalid_withdrawal_amount");

  return runTransaction(env, async (tx) => {
    const profile = await requireActiveUserProfileTx(tx, authUser.uid);
    await requireValidFundPassword(profile, fundPassword);
    if (!walletMatchesBoundAddress(profile.wallets, walletAddress)) {
      throw new ApiError(412, "Bind this wallet in your profile before requesting withdrawal.", "wallet_not_bound");
    }

    const currentBalance = Number(profile.balances?.[sourceWallet] || 0);
    if (currentBalance < amount) throw new ApiError(412, "Insufficient balance.", "insufficient_balance");

    const now = new Date();
    const withdrawalId = crypto.randomUUID();
    const updatedProfile = adjustBalance(profile, sourceWallet, -amount);
    tx.set(`users/${authUser.uid}`, stripMeta({ ...updatedProfile, updatedAt: now }), { exists: true });
    tx.set(`withdrawals/${withdrawalId}`, {
      uid: authUser.uid,
      sourceWallet,
      amount,
      fee,
      feeRate: withdrawalSettings.feeRate,
      fixedFee: withdrawalSettings.fixedFee,
      netAmount,
      walletAddress,
      status: "pending",
      createdAt: now,
      updatedAt: now
    });
    tx.set(`ledger/${crypto.randomUUID()}`, {
      uid: authUser.uid,
      type: "withdrawal_hold",
      amount: -amount,
      sourceWallet,
      refId: withdrawalId,
      createdAt: now
    });

    return { ok: true, withdrawalId, netAmount, fee };
  });
}

async function startTaskWatch(env, authUser, payload) {
  const taskId = String(payload.taskId || "").trim();
  if (!taskId) throw new ApiError(400, "Task ID is required.", "invalid_task");
  const currentDayKey = dayKey();

  return runTransaction(env, async (tx) => {
    const task = await tx.get(`tasks/${taskId}`);
    const profile = await requireActiveUserProfileTx(tx, authUser.uid);
    const existingUserTask = await tx.get(`user_tasks/${authUser.uid}_${taskId}_${currentDayKey}`);
    if (!task) throw new ApiError(404, "Task not found.", "task_not_found");
    if (existingUserTask) throw new ApiError(409, "Task already completed today.", "task_duplicate");
    if (task.status !== "active") throw new ApiError(412, "Task is not active.", "task_inactive");
    if (!levelAllowed(profile.vipLevel || "M0", task.vipRequired || "M0")) {
      throw new ApiError(403, "VIP level is not eligible for this task.", "vip_not_allowed");
    }

    const dailyLimit = await getDailyLimitTx(tx, profile.vipLevel || "M0");
    const completedToday = await tx.query("user_tasks", {
      filters: [
        { field: "uid", op: "EQUAL", value: authUser.uid },
        { field: "dayKey", op: "EQUAL", value: currentDayKey },
        { field: "status", op: "EQUAL", value: "completed" }
      ],
      limit: 250
    });
    if (completedToday.length >= dailyLimit) throw new ApiError(429, "Daily task limit reached.", "daily_limit_reached");

    const durationSeconds = assertInteger(task.durationSeconds || 12, 5, 900);
    const nowMs = Date.now();
    const sessionId = crypto.randomUUID();
    tx.set(`task_sessions/${sessionId}`, {
      uid: authUser.uid,
      taskId,
      dayKey: currentDayKey,
      durationSeconds,
      status: "watching",
      startedAt: new Date(nowMs),
      earliestClaimAt: new Date(nowMs + durationSeconds * 1000),
      earliestClaimAtMs: nowMs + durationSeconds * 1000,
      expiresAt: new Date(nowMs + (durationSeconds + 900) * 1000),
      expiresAtMs: nowMs + (durationSeconds + 900) * 1000
    });

    return { ok: true, sessionId, taskId, durationSeconds, earliestClaimAtMs: nowMs + durationSeconds * 1000 };
  });
}

async function completeTask(env, authUser, payload) {
  const taskId = String(payload.taskId || "").trim();
  const watchSessionId = String(payload.watchSessionId || payload.sessionId || "").trim();
  if (!taskId || !watchSessionId) throw new ApiError(400, "Task ID and watch session are required.", "invalid_task_claim");
  const currentDayKey = dayKey();

  return runTransaction(env, async (tx) => {
    const task = await tx.get(`tasks/${taskId}`);
    const profile = await requireActiveUserProfileTx(tx, authUser.uid);
    const existingUserTask = await tx.get(`user_tasks/${authUser.uid}_${taskId}_${currentDayKey}`);
    const session = await tx.get(`task_sessions/${watchSessionId}`);
    const ancestorProfiles = await readAncestorProfiles(tx, profile.referralPath || []);

    if (!task) throw new ApiError(404, "Task not found.", "task_not_found");
    if (!session) throw new ApiError(412, "Start the watch session before claiming.", "session_missing");
    if (existingUserTask) throw new ApiError(409, "Task already completed today.", "task_duplicate");
    if (session.uid !== authUser.uid || session.taskId !== taskId || session.dayKey !== currentDayKey || session.status !== "watching") {
      throw new ApiError(403, "Invalid watch session.", "invalid_session");
    }
    if (Date.now() < Number(session.earliestClaimAtMs || 0)) {
      throw new ApiError(412, "Watch time has not completed yet.", "watch_time_incomplete");
    }
    if (session.expiresAtMs && Date.now() > Number(session.expiresAtMs)) {
      throw new ApiError(408, "Watch session expired. Restart the task.", "session_expired");
    }
    if (task.status !== "active") throw new ApiError(412, "Task is not active.", "task_inactive");
    if (!levelAllowed(profile.vipLevel || "M0", task.vipRequired || "M0")) {
      throw new ApiError(403, "VIP level is not eligible for this task.", "vip_not_allowed");
    }

    const dailyLimit = await getDailyLimitTx(tx, profile.vipLevel || "M0");
    const completedToday = await tx.query("user_tasks", {
      filters: [
        { field: "uid", op: "EQUAL", value: authUser.uid },
        { field: "dayKey", op: "EQUAL", value: currentDayKey },
        { field: "status", op: "EQUAL", value: "completed" }
      ],
      limit: 250
    });
    if (completedToday.length >= dailyLimit) throw new ApiError(429, "Daily task limit reached.", "daily_limit_reached");

    const reward = roundMoney(Number(task.reward || 0));
    const now = new Date();
    const updatedProfile = addIncome(adjustBalance(profile, "commission", reward), reward);
    tx.set(`users/${authUser.uid}`, stripMeta({ ...updatedProfile, updatedAt: now }), { exists: true });
    tx.set(`user_tasks/${authUser.uid}_${taskId}_${currentDayKey}`, {
      uid: authUser.uid,
      taskId,
      reward,
      status: "completed",
      dayKey: currentDayKey,
      watchSessionId,
      createdAt: now
    }, { exists: false });
    tx.set(`task_sessions/${watchSessionId}`, stripMeta({ ...session, status: "claimed", claimedAt: now, updatedAt: now }), { exists: true });
    tx.set(`ledger/${crypto.randomUUID()}`, {
      uid: authUser.uid,
      type: "task_reward",
      amount: reward,
      wallet: "commission",
      refId: `${authUser.uid}_${taskId}_${currentDayKey}`,
      createdAt: now
    });
    writeReferralCommissionsTx(tx, ancestorProfiles, authUser.uid, reward, "task_reward", now);

    return { ok: true, status: "completed", reward };
  });
}

async function upgradeVip(env, authUser, payload) {
  const levelId = assertVipLevel(payload.levelId);

  return runTransaction(env, async (tx) => {
    const profile = await requireActiveUserProfileTx(tx, authUser.uid);
    const level = await getVipLevelTx(tx, levelId);
    const ancestorProfiles = await readAncestorProfiles(tx, profile.referralPath || []);
    if (LEVEL_ORDER.indexOf(levelId) <= LEVEL_ORDER.indexOf(profile.vipLevel || "M0")) {
      throw new ApiError(412, "Target level must be higher than current level.", "invalid_vip_upgrade");
    }

    const price = roundMoney(Number(level.price || 0));
    if (Number(profile.balances?.main || 0) < price) throw new ApiError(412, "Insufficient main wallet balance.", "insufficient_balance");

    const now = new Date();
    const subscriptionId = crypto.randomUUID();
    const updatedProfile = adjustBalance({ ...profile, vipLevel: levelId, vipStartedAt: now }, "main", -price);
    tx.set(`users/${authUser.uid}`, stripMeta({ ...updatedProfile, updatedAt: now }), { exists: true });
    tx.set(`subscriptions/${subscriptionId}`, {
      uid: authUser.uid,
      levelId,
      amount: price,
      sourceWallet: "main",
      status: "active",
      createdAt: now
    });
    tx.set(`ledger/${crypto.randomUUID()}`, {
      uid: authUser.uid,
      type: "vip_upgrade",
      amount: -price,
      levelId,
      wallet: "main",
      refId: subscriptionId,
      createdAt: now
    });
    updateReferralTreeVipTx(tx, profile.referralPath || [], authUser.uid, levelId, now);
    writeReferralCommissionsTx(tx, ancestorProfiles, authUser.uid, price, "vip_upgrade", now);

    return { ok: true, vipLevel: levelId };
  });
}

async function joinInvestment(env, authUser, payload) {
  const planId = String(payload.planId || "").trim();
  const amount = assertAmount(payload.amount, 50);
  if (!planId) throw new ApiError(400, "Plan ID is required.", "invalid_plan");

  return runTransaction(env, async (tx) => {
    const settings = await tx.get("system_settings/investment_plans");
    const plan = (settings?.plans || []).find((item) => item.id === planId && item.status === "active");
    if (!plan) throw new ApiError(404, "Investment plan not found.", "plan_not_found");
    if (amount < Number(plan.minAmount || 0)) throw new ApiError(412, "Amount is below plan minimum.", "below_plan_minimum");

    const profile = await requireActiveUserProfileTx(tx, authUser.uid);
    if (Number(profile.balances?.main || 0) < amount) throw new ApiError(412, "Insufficient main wallet balance.", "insufficient_balance");

    const now = new Date();
    const investmentId = crypto.randomUUID();
    const maturityAt = new Date(Date.now() + Number(plan.periodDays) * 24 * 60 * 60 * 1000);
    let updatedProfile = adjustBalance(profile, "main", -amount);
    updatedProfile = adjustBalance(updatedProfile, "locked", amount);

    tx.set(`users/${authUser.uid}`, stripMeta({ ...updatedProfile, updatedAt: now }), { exists: true });
    tx.set(`investments/${investmentId}`, {
      uid: authUser.uid,
      planId,
      amount,
      dailyRate: Number(plan.dailyRate),
      periodDays: Number(plan.periodDays),
      maturityAt,
      status: "active",
      createdAt: now
    });
    tx.set(`ledger/${crypto.randomUUID()}`, {
      uid: authUser.uid,
      type: "investment_lock",
      amount: -amount,
      wallet: "main",
      refId: investmentId,
      createdAt: now
    });

    return { ok: true, investmentId };
  });
}

async function applyForRank(env, authUser, payload) {
  const rankId = String(payload.rankId || "").trim().slice(0, 80);
  if (!rankId) throw new ApiError(400, "Rank ID is required.", "invalid_rank");
  const profile = await getDoc(env, `users/${authUser.uid}`);
  if (!profile || profile.status !== "active") throw new ApiError(403, "Active profile is required.", "profile_required");

  const applicationId = crypto.randomUUID();
  await commitWrites(env, [
    setWrite(env, `rank_applications/${applicationId}`, {
      uid: authUser.uid,
      rankId,
      status: "pending_review",
      contractAccepted: true,
      acceptedAt: new Date(),
      createdAt: new Date()
    })
  ]);
  return { ok: true, applicationId };
}

async function bootstrapRootAdmin(env, authUser) {
  const now = new Date();
  return runTransaction(env, async (tx) => {
    const existing = await tx.get(`users/${authUser.uid}`);
    const doc = existing || {
      email: authUser.email || null,
      phoneNumber: authUser.phone_number || null,
      displayName: authUser.name || authUser.email || "VidiX Admin",
      authProvider: "email",
      referralCode: "VX-ROOT",
      referralPath: [],
      vipLevel: "M10",
      balances: { main: 0, commission: 0, locked: 0 },
      income: { today: 0, month: 0, total: 0 },
      wallets: {},
      registeredDayKey: dayKey(),
      createdAt: now
    };

    tx.set(`users/${authUser.uid}`, stripMeta({
      ...doc,
      email: doc.email || authUser.email || null,
      displayName: doc.displayName || authUser.name || "VidiX Admin",
      role: "admin",
      status: "active",
      referralCode: doc.referralCode || "VX-ROOT",
      vipLevel: doc.vipLevel || "M10",
      updatedAt: now
    }), { exists: Boolean(existing) });

    return { ok: true, uid: authUser.uid, role: "admin", referralCode: doc.referralCode || "VX-ROOT" };
  });
}

async function seedDefaults(env, adminUid) {
  const now = new Date();
  const writes = [];
  Object.entries(DEFAULT_SYSTEM_SETTINGS).forEach(([path, data]) => {
    writes.push(setWrite(env, path, { ...data, updatedAt: now }));
  });
  Object.entries(DEFAULT_TASKS).forEach(([path, data]) => {
    writes.push(setWrite(env, path, { ...data, createdAt: now, updatedAt: now }));
  });
  writes.push(setWrite(env, `admin_actions/${crypto.randomUUID()}`, {
    adminUid,
    action: "seedDefaults",
    targetUid: "system",
    payload: { settings: Object.keys(DEFAULT_SYSTEM_SETTINGS).length, tasks: Object.keys(DEFAULT_TASKS).length },
    createdAt: now
  }));
  await commitWrites(env, writes);
  return { ok: true, settings: Object.keys(DEFAULT_SYSTEM_SETTINGS).length, tasks: Object.keys(DEFAULT_TASKS).length };
}

async function importDocuments(env, adminUid, payload) {
  const documents = payload.documents && typeof payload.documents === "object" ? payload.documents : payload;
  const entries = Object.entries(documents || {});
  if (!entries.length) throw new ApiError(400, "No documents were provided for import.", "empty_import");
  if (entries.length > 400) throw new ApiError(400, "Import is limited to 400 documents per request.", "import_too_large");

  const now = new Date();
  const writes = entries.map(([path, data]) => {
    validateImportPath(path);
    return setWrite(env, path, { ...reviveImportValue(data), updatedAt: now });
  });
  writes.push(setWrite(env, `admin_actions/${crypto.randomUUID()}`, {
    adminUid,
    action: "importDocuments",
    targetUid: "system",
    payload: { count: entries.length },
    createdAt: now
  }));
  await commitWrites(env, writes);
  return { ok: true, count: entries.length };
}

async function approveDeposit(env, adminUid, depositId, payload) {
  const id = decodeURIComponent(String(depositId || "").trim());
  const approvedAmount = payload.approvedAmount == null ? null : assertAmount(payload.approvedAmount, 0.01);
  if (!id) throw new ApiError(400, "Deposit ID is required.", "invalid_deposit");

  return runTransaction(env, async (tx) => {
    const deposit = await tx.get(`deposits/${id}`);
    if (!deposit) throw new ApiError(404, "Deposit not found.", "deposit_not_found");
    if (deposit.status !== "pending") throw new ApiError(412, "Only pending deposits can be approved.", "deposit_not_pending");
    const profile = await tx.get(`users/${deposit.uid}`);
    if (!profile) throw new ApiError(404, "User profile not found.", "profile_not_found");

    const amount = roundMoney(approvedAmount ?? Number(deposit.usdAmount ?? deposit.amount ?? 0));
    if (amount <= 0) throw new ApiError(412, "Deposit amount is invalid.", "invalid_deposit_amount");
    const now = new Date();
    const updatedProfile = adjustBalance(profile, "main", amount);
    tx.set(`users/${deposit.uid}`, stripMeta({ ...updatedProfile, updatedAt: now }), { exists: true });
    tx.set(`deposits/${id}`, stripMeta({
      ...deposit,
      approvedAmount: amount,
      approvedUsdAmount: amount,
      status: "approved",
      reviewedBy: adminUid,
      reviewedAt: now,
      updatedAt: now
    }), { exists: true });
    tx.set(`ledger/${crypto.randomUUID()}`, {
      uid: deposit.uid,
      type: "deposit_approved",
      amount,
      wallet: "main",
      refId: id,
      createdAt: now
    });

    return { ok: true, depositId: id, status: "approved", amount };
  });
}

async function rejectDeposit(env, adminUid, depositId, payload) {
  const id = decodeURIComponent(String(depositId || "").trim());
  const reason = String(payload.reason || "Receipt or payment reference could not be verified.").trim().slice(0, 300);
  if (!id) throw new ApiError(400, "Deposit ID is required.", "invalid_deposit");

  return runTransaction(env, async (tx) => {
    const deposit = await tx.get(`deposits/${id}`);
    if (!deposit) throw new ApiError(404, "Deposit not found.", "deposit_not_found");
    if (deposit.status !== "pending") throw new ApiError(412, "Only pending deposits can be rejected.", "deposit_not_pending");
    const now = new Date();
    tx.set(`deposits/${id}`, stripMeta({ ...deposit, status: "rejected", reason, reviewedBy: adminUid, reviewedAt: now, updatedAt: now }), { exists: true });
    return { ok: true, depositId: id, status: "rejected" };
  });
}

async function settleWithdrawal(env, adminUid, withdrawalId, payload) {
  const id = decodeURIComponent(String(withdrawalId || "").trim());
  const status = String(payload.status || "").trim();
  const payoutTxId = String(payload.payoutTxId || "").trim().slice(0, 160);
  if (!id || !["executed", "rejected"].includes(status)) throw new ApiError(400, "Withdrawal ID and valid status are required.", "invalid_withdrawal");
  if (status === "executed" && payoutTxId.length < 6) throw new ApiError(400, "Execution reference / payout TxID is required.", "invalid_payout_ref");

  return runTransaction(env, async (tx) => {
    const withdrawal = await tx.get(`withdrawals/${id}`);
    if (!withdrawal) throw new ApiError(404, "Withdrawal not found.", "withdrawal_not_found");
    if (withdrawal.status !== "pending") throw new ApiError(412, "Only pending withdrawals can be settled.", "withdrawal_not_pending");

    const now = new Date();
    tx.set(`withdrawals/${id}`, stripMeta({ ...withdrawal, status, payoutTxId: status === "executed" ? payoutTxId : null, reviewedBy: adminUid, reviewedAt: now, updatedAt: now }), { exists: true });
    if (status === "rejected") {
      const profile = await tx.get(`users/${withdrawal.uid}`);
      if (!profile) throw new ApiError(404, "User profile not found.", "profile_not_found");
      const updatedProfile = adjustBalance(profile, withdrawal.sourceWallet, Number(withdrawal.amount || 0));
      tx.set(`users/${withdrawal.uid}`, stripMeta({ ...updatedProfile, updatedAt: now }), { exists: true });
      tx.set(`ledger/${crypto.randomUUID()}`, {
        uid: withdrawal.uid,
        type: "withdrawal_refund",
        amount: Number(withdrawal.amount || 0),
        wallet: withdrawal.sourceWallet,
        refId: id,
        createdAt: now
      });
    } else {
      tx.set(`ledger/${crypto.randomUUID()}`, {
        uid: withdrawal.uid,
        type: "withdrawal_executed",
        amount: 0,
        grossAmount: Number(withdrawal.amount || 0),
        fee: Number(withdrawal.fee || 0),
        netAmount: Number(withdrawal.netAmount || 0),
        wallet: withdrawal.sourceWallet,
        payoutTxId,
        refId: id,
        createdAt: now
      });
    }

    return { ok: true, withdrawalId: id, status };
  });
}

async function adminUpsertTask(env, adminUid, payload) {
  const task = sanitizeTaskPayload(payload);
  const now = new Date();
  await commitWrites(env, [
    setWrite(env, `tasks/${task.id}`, { ...task, updatedAt: now, createdAt: payload.createdAt ? new Date(payload.createdAt) : now }),
    setWrite(env, `admin_actions/${crypto.randomUUID()}`, { adminUid, action: "adminUpsertTask", targetUid: task.id, payload: task, createdAt: now })
  ]);
  return { ok: true, taskId: task.id };
}

async function adminArchiveTask(env, adminUid, taskId) {
  const id = decodeURIComponent(String(taskId || "").trim());
  if (!id) throw new ApiError(400, "Task ID is required.", "invalid_task");
  return runTransaction(env, async (tx) => {
    const task = await tx.get(`tasks/${id}`);
    if (!task) throw new ApiError(404, "Task not found.", "task_not_found");
    const now = new Date();
    tx.set(`tasks/${id}`, stripMeta({ ...task, status: "archived", updatedAt: now }), { exists: true });
    tx.set(`admin_actions/${crypto.randomUUID()}`, { adminUid, action: "adminArchiveTask", targetUid: id, payload: {}, createdAt: now });
    return { ok: true, taskId: id, status: "archived" };
  });
}

async function adminUpsertVipLevel(env, adminUid, payload) {
  const level = {
    id: assertVipLevel(payload.id),
    price: assertAmount(payload.price ?? 0, 0),
    dailyTasks: assertInteger(payload.dailyTasks, 1, 200),
    reward: assertAmount(payload.reward ?? 0, 0)
  };
  return runTransaction(env, async (tx) => {
    const settings = await tx.get("system_settings/vip_levels") || { levels: [] };
    const levels = [...(settings.levels || [])];
    const index = levels.findIndex((item) => item.id === level.id);
    if (index >= 0) levels[index] = { ...levels[index], ...level };
    else levels.push(level);
    levels.sort((a, b) => LEVEL_ORDER.indexOf(a.id) - LEVEL_ORDER.indexOf(b.id));
    const now = new Date();
    tx.set("system_settings/vip_levels", { ...stripMeta(settings), levels, updatedAt: now });
    tx.set(`admin_actions/${crypto.randomUUID()}`, { adminUid, action: "adminUpsertVipLevel", targetUid: level.id, payload: level, createdAt: now });
    return { ok: true, level };
  });
}

async function adminUpsertInvestmentPlan(env, adminUid, payload) {
  const plan = sanitizeInvestmentPlan(payload);
  return runTransaction(env, async (tx) => {
    const settings = await tx.get("system_settings/investment_plans") || { plans: [] };
    const plans = [...(settings.plans || [])];
    const index = plans.findIndex((item) => item.id === plan.id);
    if (index >= 0) plans[index] = { ...plans[index], ...plan };
    else plans.push(plan);
    const now = new Date();
    tx.set("system_settings/investment_plans", { ...stripMeta(settings), plans, updatedAt: now });
    tx.set(`admin_actions/${crypto.randomUUID()}`, { adminUid, action: "adminUpsertInvestmentPlan", targetUid: plan.id, payload: plan, createdAt: now });
    return { ok: true, plan };
  });
}

async function adminSetInvestmentStatus(env, adminUid, investmentId, payload) {
  const id = decodeURIComponent(String(investmentId || "").trim());
  const status = String(payload.status || "").trim();
  if (!id || !["active", "matured", "cancelled"].includes(status)) throw new ApiError(400, "Investment ID and valid status are required.", "invalid_investment");

  return runTransaction(env, async (tx) => {
    const investment = await tx.get(`investments/${id}`);
    if (!investment) throw new ApiError(404, "Investment not found.", "investment_not_found");
    const profile = ["matured", "cancelled"].includes(status) && investment.status === "active" ? await tx.get(`users/${investment.uid}`) : null;
    const now = new Date();
    tx.set(`investments/${id}`, stripMeta({ ...investment, status, reviewedBy: adminUid, reviewedAt: now, updatedAt: now }), { exists: true });

    if (profile) {
      const principal = roundMoney(Number(investment.amount || 0));
      const interest = status === "matured" ? roundMoney(principal * (Number(investment.dailyRate || 0) / 100) * Number(investment.periodDays || 0)) : 0;
      const payout = roundMoney(principal + interest);
      let updatedProfile = adjustBalance(profile, "locked", -principal);
      updatedProfile = adjustBalance(updatedProfile, "main", payout);
      updatedProfile = addIncome(updatedProfile, interest, { today: false, month: false });
      tx.set(`users/${investment.uid}`, stripMeta({ ...updatedProfile, updatedAt: now }), { exists: true });
      tx.set(`ledger/${crypto.randomUUID()}`, {
        uid: investment.uid,
        type: status === "matured" ? "investment_maturity" : "investment_cancel_refund",
        amount: payout,
        principal,
        interest,
        wallet: "main",
        refId: id,
        adminUid,
        createdAt: now
      });
    }

    tx.set(`admin_actions/${crypto.randomUUID()}`, { adminUid, action: "adminSetInvestmentStatus", targetUid: investment.uid, refId: id, payload: { status }, createdAt: now });
    return { ok: true, investmentId: id, status };
  });
}

async function adminUserAction(env, adminUid, payload) {
  const action = String(payload.action || "").trim();
  const uid = String(payload.uid || "").trim();
  if (!uid) throw new ApiError(400, "User UID is required.", "invalid_user");

  if (action === "adjustBalance") {
    const wallet = assertBalanceWallet(payload.wallet);
    const amount = assertSignedAmount(payload.amount);
    const reason = String(payload.reason || "Admin balance adjustment").slice(0, 300);
    return runTransaction(env, async (tx) => {
      const profile = await tx.get(`users/${uid}`);
      if (!profile) throw new ApiError(404, "User profile not found.", "profile_not_found");
      if (Number(profile.balances?.[wallet] || 0) + amount < 0) {
        throw new ApiError(412, "Adjustment would create a negative balance.", "negative_balance");
      }
      const now = new Date();
      const updatedProfile = adjustBalance(profile, wallet, amount);
      tx.set(`users/${uid}`, stripMeta({ ...updatedProfile, updatedAt: now }), { exists: true });
      tx.set(`ledger/${crypto.randomUUID()}`, { uid, type: "admin_balance_adjustment", amount, wallet, reason, adminUid, createdAt: now });
      tx.set(`admin_actions/${crypto.randomUUID()}`, { adminUid, action: "adminAdjustBalance", targetUid: uid, payload: { wallet, amount, reason }, createdAt: now });
      return { ok: true };
    });
  }

  if (action === "setVip") {
    const vipLevel = assertVipLevel(payload.vipLevel);
    const reason = String(payload.reason || "Admin VIP update").slice(0, 300);
    return runTransaction(env, async (tx) => {
      const profile = await tx.get(`users/${uid}`);
      if (!profile) throw new ApiError(404, "User profile not found.", "profile_not_found");
      const now = new Date();
      tx.set(`users/${uid}`, stripMeta({ ...profile, vipLevel, updatedAt: now }), { exists: true });
      updateReferralTreeVipTx(tx, profile.referralPath || [], uid, vipLevel, now);
      tx.set(`admin_actions/${crypto.randomUUID()}`, { adminUid, action: "adminSetUserVip", targetUid: uid, payload: { vipLevel, reason }, createdAt: now });
      return { ok: true, vipLevel };
    });
  }

  const status = assertUserStatus(payload.status);
  const reason = String(payload.reason || "Admin status update").slice(0, 300);
  return runTransaction(env, async (tx) => {
    const profile = await tx.get(`users/${uid}`);
    if (!profile) throw new ApiError(404, "User profile not found.", "profile_not_found");
    const now = new Date();
    tx.set(`users/${uid}`, stripMeta({ ...profile, status, statusReason: reason, updatedAt: now }), { exists: true });
    tx.set(`admin_actions/${crypto.randomUUID()}`, { adminUid, action: "adminSetUserStatus", targetUid: uid, payload: { status, reason }, createdAt: now });
    return { ok: true, status };
  });
}

async function getAdminDashboard(env) {
  const [users, pendingDeposits, pendingWithdrawals, activeTasks, activeInvestments] = await Promise.all([
    queryDocs(env, "users", { limit: 500 }),
    queryDocs(env, "deposits", { filters: [{ field: "status", op: "EQUAL", value: "pending" }], limit: 500 }),
    queryDocs(env, "withdrawals", { filters: [{ field: "status", op: "EQUAL", value: "pending" }], limit: 500 }),
    queryDocs(env, "tasks", { filters: [{ field: "status", op: "EQUAL", value: "active" }], limit: 500 }),
    queryDocs(env, "investments", { filters: [{ field: "status", op: "EQUAL", value: "active" }], limit: 500 })
  ]);
  return {
    stats: {
      users: users.length,
      pendingDeposits: pendingDeposits.length,
      pendingWithdrawals: pendingWithdrawals.length,
      activeTasks: activeTasks.length,
      activeInvestments: activeInvestments.length
    }
  };
}

async function requireFirebaseUser(request, env) {
  const header = request.headers.get("Authorization") || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) throw new ApiError(401, "Authentication required.", "unauthenticated");
  return verifyFirebaseIdToken(env, match[1]);
}

async function verifyFirebaseIdToken(env, token) {
  const projectId = requireEnv(env, "FIREBASE_PROJECT_ID");
  const [encodedHeader, encodedPayload, encodedSignature] = String(token).split(".");
  if (!encodedHeader || !encodedPayload || !encodedSignature) throw new ApiError(401, "Invalid token.", "invalid_token");

  const header = JSON.parse(decodeBase64UrlToString(encodedHeader));
  const payload = JSON.parse(decodeBase64UrlToString(encodedPayload));
  if (header.alg !== "RS256" || !header.kid) throw new ApiError(401, "Invalid token algorithm.", "invalid_token");

  const jwks = await getSecureTokenJwks();
  const jwk = jwks.keys.find((key) => key.kid === header.kid);
  if (!jwk) throw new ApiError(401, "Token key is not trusted.", "invalid_token");

  const key = await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
  const ok = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    key,
    decodeBase64UrlToBytes(encodedSignature),
    new TextEncoder().encode(`${encodedHeader}.${encodedPayload}`)
  );
  if (!ok) throw new ApiError(401, "Invalid token signature.", "invalid_token");

  const now = Math.floor(Date.now() / 1000);
  if (payload.aud !== projectId || payload.iss !== `https://securetoken.google.com/${projectId}`) {
    throw new ApiError(401, "Token project mismatch.", "invalid_token");
  }
  if (!payload.sub || String(payload.sub).length > 128) throw new ApiError(401, "Invalid token subject.", "invalid_token");
  if (Number(payload.exp || 0) <= now || Number(payload.iat || 0) > now + 300) throw new ApiError(401, "Token expired.", "token_expired");

  return {
    uid: payload.sub,
    email: payload.email || null,
    phone_number: payload.phone_number || null,
    name: payload.name || null,
    claims: payload
  };
}

async function getSecureTokenJwks() {
  if (secureTokenJwksCache && secureTokenJwksCache.expiresAt > Date.now()) return secureTokenJwksCache.value;
  const response = await fetch("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com");
  if (!response.ok) throw new ApiError(503, "Could not load Firebase token keys.", "jwks_unavailable");
  const cacheControl = response.headers.get("cache-control") || "";
  const maxAgeMatch = cacheControl.match(/max-age=(\d+)/);
  const maxAgeMs = maxAgeMatch ? Number(maxAgeMatch[1]) * 1000 : 60 * 60 * 1000;
  const value = await response.json();
  secureTokenJwksCache = { value, expiresAt: Date.now() + Math.max(60_000, maxAgeMs - 60_000) };
  return value;
}

async function requireAdmin(env, authUser) {
  const profile = await getDoc(env, `users/${authUser.uid}`);
  if (!profile || profile.role !== "admin" || profile.status !== "active") {
    throw new ApiError(403, "Admin access required.", "admin_required");
  }
  return profile;
}

async function requireActiveUserProfileTx(tx, uid) {
  const profile = await tx.get(`users/${uid}`);
  if (!profile) throw new ApiError(404, "User profile not found.", "profile_not_found");
  if (profile.status && profile.status !== "active") throw new ApiError(403, "Account is not active.", "account_inactive");
  return profile;
}

async function requireBootstrapSecret(request, env) {
  if (!(await hasValidBootstrapSecret(request, env))) throw new ApiError(403, "Bootstrap secret is required.", "bootstrap_forbidden");
}

async function hasValidBootstrapSecret(request, env) {
  const expected = env.BOOTSTRAP_SECRET;
  const provided = request.headers.get("x-bootstrap-secret") || "";
  return Boolean(expected) && constantTimeEqual(String(provided), String(expected));
}

async function getAccessToken(env) {
  if (googleTokenCache && googleTokenCache.expiresAt > Date.now() + 60_000) return googleTokenCache.token;

  const clientEmail = requireEnv(env, "GOOGLE_CLIENT_EMAIL");
  const privateKey = normalizePrivateKey(requireEnv(env, "GOOGLE_PRIVATE_KEY"));
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: clientEmail,
    scope: "https://www.googleapis.com/auth/datastore",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600
  };

  const signingInput = `${encodeBase64Url(JSON.stringify(header))}.${encodeBase64Url(JSON.stringify(payload))}`;
  const key = await importPrivateKey(privateKey);
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(signingInput));
  const assertion = `${signingInput}.${bytesToBase64Url(new Uint8Array(signature))}`;

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion
    })
  });
  const payloadResponse = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new ApiError(503, payloadResponse.error_description || "Could not create Google access token.", "google_auth_failed");
  }

  googleTokenCache = {
    token: payloadResponse.access_token,
    expiresAt: Date.now() + Number(payloadResponse.expires_in || 3600) * 1000
  };
  return googleTokenCache.token;
}

async function importPrivateKey(pem) {
  const b64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/\s+/g, "");
  const raw = decodeBase64ToBytes(b64);
  return crypto.subtle.importKey("pkcs8", raw, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
}

async function getDoc(env, path, transaction = null) {
  const token = await getAccessToken(env);
  const url = new URL(documentUrl(env, path));
  if (transaction) url.searchParams.set("transaction", transaction);
  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (response.status === 404) return null;
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw firestoreError(response, payload);
  return docToRecord(payload);
}

async function queryDocs(env, collectionId, options = {}) {
  const token = await getAccessToken(env);
  const structuredQuery = {
    from: [{ collectionId }]
  };
  if (options.filters?.length) structuredQuery.where = makeWhere(options.filters);
  if (options.orderBy?.length) {
    structuredQuery.orderBy = options.orderBy.map((item) => ({
      field: { fieldPath: item.field },
      direction: item.direction || "ASCENDING"
    }));
  }
  if (options.limit) structuredQuery.limit = Number(options.limit);

  const body = { structuredQuery };
  if (options.transaction) body.transaction = options.transaction;
  const response = await fetch(`${documentsBaseUrl(env)}:runQuery`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const payload = await response.json().catch(() => []);
  if (!response.ok) throw firestoreError(response, payload);
  return payload.filter((row) => row.document).map((row) => docToRecord(row.document));
}

async function runTransaction(env, callback, attempts = 3) {
  let lastError = null;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const transaction = await beginTransaction(env);
    const writes = [];
    const tx = {
      get: (path) => getDoc(env, path, transaction),
      query: (collectionId, options) => queryDocs(env, collectionId, { ...options, transaction }),
      set: (path, data, precondition = {}) => writes.push(setWrite(env, path, data, precondition))
    };

    try {
      const result = await callback(tx);
      await commitWrites(env, writes, transaction);
      return result;
    } catch (error) {
      lastError = error;
      await rollbackTransaction(env, transaction).catch(() => {});
      if (!isRetryableTransactionError(error) || attempt === attempts - 1) throw error;
    }
  }
  throw lastError || new ApiError(500, "Transaction failed.", "transaction_failed");
}

async function beginTransaction(env) {
  const token = await getAccessToken(env);
  const response = await fetch(`${documentsBaseUrl(env)}:beginTransaction`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ options: { readWrite: {} } })
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw firestoreError(response, payload);
  return payload.transaction;
}

async function commitWrites(env, writes, transaction = null) {
  if (!writes.length && !transaction) return;
  const token = await getAccessToken(env);
  const body = { writes };
  if (transaction) body.transaction = transaction;
  const response = await fetch(`${documentsBaseUrl(env)}:commit`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw firestoreError(response, payload);
}

async function rollbackTransaction(env, transaction) {
  if (!transaction) return;
  const token = await getAccessToken(env);
  await fetch(`${documentsBaseUrl(env)}:rollback`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ transaction })
  });
}

function setWrite(env, path, data, precondition = {}) {
  const write = {
    update: {
      name: docResourceName(env, path),
      fields: toFields(stripUndefined(data))
    }
  };
  if (precondition.exists !== undefined) write.currentDocument = { exists: Boolean(precondition.exists) };
  return write;
}

function firestoreError(response, payload) {
  const message = payload?.error?.message || payload?.[0]?.error?.message || `Firestore request failed with ${response.status}.`;
  return new ApiError(response.status, message, "firestore_error");
}

function isRetryableTransactionError(error) {
  return error instanceof ApiError && [409, 429, 500, 503].includes(error.status);
}

function documentsBaseUrl(env) {
  const projectId = requireEnv(env, "FIREBASE_PROJECT_ID");
  const databaseId = env.FIRESTORE_DATABASE_ID || "(default)";
  return `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/${encodeURIComponent(databaseId)}/documents`;
}

function documentUrl(env, path) {
  return `${documentsBaseUrl(env)}/${path.split("/").map(encodeURIComponent).join("/")}`;
}

function docResourceName(env, path) {
  const projectId = requireEnv(env, "FIREBASE_PROJECT_ID");
  const databaseId = env.FIRESTORE_DATABASE_ID || "(default)";
  return `projects/${projectId}/databases/${databaseId}/documents/${path}`;
}

function toFields(data) {
  return Object.fromEntries(Object.entries(data || {}).filter(([, value]) => value !== undefined).map(([key, value]) => [key, toValue(value)]));
}

function toValue(value) {
  if (value === null) return { nullValue: null };
  if (value instanceof Date) return { timestampValue: value.toISOString() };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(toValue) } };
  if (typeof value === "boolean") return { booleanValue: value };
  if (typeof value === "number") return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  if (typeof value === "object") return { mapValue: { fields: toFields(value) } };
  return { stringValue: String(value) };
}

function fromValue(value) {
  if ("nullValue" in value) return null;
  if ("stringValue" in value) return value.stringValue;
  if ("integerValue" in value) return Number(value.integerValue);
  if ("doubleValue" in value) return Number(value.doubleValue);
  if ("booleanValue" in value) return value.booleanValue;
  if ("timestampValue" in value) return value.timestampValue;
  if ("arrayValue" in value) return (value.arrayValue.values || []).map(fromValue);
  if ("mapValue" in value) return Object.fromEntries(Object.entries(value.mapValue.fields || {}).map(([key, nestedValue]) => [key, fromValue(nestedValue)]));
  return undefined;
}

function docToRecord(document) {
  const id = document.name.split("/").pop();
  return { id, ...Object.fromEntries(Object.entries(document.fields || {}).map(([key, value]) => [key, fromValue(value)])) };
}

function makeWhere(filters) {
  const mapped = filters.map((filter) => ({
    fieldFilter: {
      field: { fieldPath: filter.field },
      op: filter.op || "EQUAL",
      value: toValue(filter.value)
    }
  }));
  if (mapped.length === 1) return mapped[0];
  return { compositeFilter: { op: "AND", filters: mapped } };
}

async function getWalletSettings(env) {
  const data = await getDoc(env, "system_settings/wallets");
  const fallback = DEFAULT_SYSTEM_SETTINGS["system_settings/wallets"];
  return {
    ...fallback,
    ...(data || {}),
    fx: {
      usdtEgpRate: Number(data?.fx?.usdtEgpRate || data?.usdtEgpRate || fallback.fx.usdtEgpRate)
    },
    withdrawal: normalizeWithdrawalSettings(data?.withdrawal || fallback.withdrawal)
  };
}

async function getDailyLimitTx(tx, vipLevel) {
  const settings = await tx.get("system_settings/vip_levels");
  const level = (settings?.levels || DEFAULT_SYSTEM_SETTINGS["system_settings/vip_levels"].levels).find((item) => item.id === vipLevel);
  return Number(level?.dailyTasks || 1);
}

async function getVipLevelTx(tx, levelId) {
  const settings = await tx.get("system_settings/vip_levels");
  const level = (settings?.levels || DEFAULT_SYSTEM_SETTINGS["system_settings/vip_levels"].levels).find((item) => item.id === levelId);
  if (!level) throw new ApiError(400, "Unknown VIP level.", "invalid_vip");
  return level;
}

async function readAncestorProfiles(tx, referralPath = []) {
  const ancestors = [];
  for (const ancestorUid of referralPath.slice(0, 3)) {
    if (!ancestorUid) continue;
    const profile = await tx.get(`users/${ancestorUid}`);
    if (profile) ancestors.push(profile);
  }
  return ancestors;
}

function writeReferralCommissionsTx(tx, ancestorProfiles, sourceUid, baseAmount, sourceType, now) {
  ancestorProfiles.slice(0, 3).forEach((ancestor, index) => {
    const rateConfig = REFERRAL_RATES[index];
    if (!rateConfig || ancestor.status === "suspended") return;
    const amount = roundMoney(baseAmount * rateConfig.rate);
    if (amount <= 0) return;
    const updatedAncestor = addIncome(adjustBalance(ancestor, "commission", amount), amount);
    tx.set(`users/${ancestor.id}`, stripMeta({ ...updatedAncestor, updatedAt: now }), { exists: true });
    tx.set(`ledger/${crypto.randomUUID()}`, {
      uid: ancestor.id,
      type: "referral_commission",
      amount,
      rate: rateConfig.rate,
      level: rateConfig.level,
      sourceUid,
      sourceType,
      wallet: "commission",
      createdAt: now
    });
  });
}

function updateReferralTreeVipTx(tx, referralPath, uid, vipLevel, now) {
  referralPath.slice(0, 3).forEach((ancestorUid, index) => {
    const level = ["A", "B", "C"][index];
    if (!ancestorUid || !level) return;
    tx.set(`users/${ancestorUid}/downline_level_${level}/${uid}`, {
      uid,
      vipLevel,
      updatedAt: now
    });
  });
}

async function createUniqueReferralCode(env, tx) {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const code = `VX-${randomCode(6)}`;
    const existing = await tx.query("users", { filters: [{ field: "referralCode", op: "EQUAL", value: code }], limit: 1 });
    if (!existing.length) return code;
  }
  throw new ApiError(500, "Could not create referral code.", "referral_generation_failed");
}

async function hashFundPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations: 210000, hash: "SHA-256" }, key, 256);
  return `pbkdf2$210000$${bytesToBase64Url(salt)}$${bytesToBase64Url(new Uint8Array(bits))}`;
}

async function requireValidFundPassword(profile, candidate) {
  const hash = String(profile.fundPasswordHash || "");
  const [algo, iterationsRaw, saltRaw, expectedRaw] = hash.split("$");
  if (algo !== "pbkdf2" || !iterationsRaw || !saltRaw || !expectedRaw) {
    throw new ApiError(412, "Fund password is not set. Reset it from your account settings.", "fund_password_missing");
  }

  const salt = decodeBase64UrlToBytes(saltRaw);
  const expected = decodeBase64UrlToBytes(expectedRaw);
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(String(candidate || "")), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations: Number(iterationsRaw), hash: "SHA-256" }, key, expected.length * 8);
  if (!constantTimeBytesEqual(new Uint8Array(bits), expected)) throw new ApiError(403, "Invalid fund password.", "invalid_fund_password");
}

function normalizeWithdrawalSettings(settings = {}) {
  const feeRate = Number(settings.feeRate ?? DEFAULT_WITHDRAWAL_SETTINGS.feeRate);
  const fixedFee = Number(settings.fixedFee ?? DEFAULT_WITHDRAWAL_SETTINGS.fixedFee);
  const minimum = Number(settings.minimum ?? DEFAULT_WITHDRAWAL_SETTINGS.minimum);
  const allowedWallets = Array.isArray(settings.allowedWallets) && settings.allowedWallets.length ? settings.allowedWallets : DEFAULT_WITHDRAWAL_SETTINGS.allowedWallets;
  const cleanAllowed = allowedWallets.filter((wallet) => ["main", "commission"].includes(wallet));
  return {
    minimum: Number.isFinite(minimum) && minimum > 0 ? minimum : DEFAULT_WITHDRAWAL_SETTINGS.minimum,
    feeRate: Number.isFinite(feeRate) && feeRate >= 0 ? feeRate : DEFAULT_WITHDRAWAL_SETTINGS.feeRate,
    fixedFee: Number.isFinite(fixedFee) && fixedFee >= 0 ? fixedFee : DEFAULT_WITHDRAWAL_SETTINGS.fixedFee,
    allowedWallets: cleanAllowed.length ? cleanAllowed : DEFAULT_WITHDRAWAL_SETTINGS.allowedWallets
  };
}

function normalizeDepositAmount(rawAmount, paymentMethod, settings) {
  const originalCurrency = String(paymentMethod.currency || "USDT").toUpperCase();
  const originalMinimum = Number(paymentMethod.minimumDeposit || (originalCurrency === "EGP" ? 100 : 20));
  const originalAmount = assertAmount(rawAmount, originalMinimum);
  const fxRateUsdtEgp = Number(settings.fx?.usdtEgpRate || 50);

  if (originalCurrency === "EGP") {
    if (!Number.isFinite(fxRateUsdtEgp) || fxRateUsdtEgp <= 0) {
      throw new ApiError(412, "USDT/EGP exchange rate is not configured.", "fx_not_configured");
    }
    return {
      originalAmount,
      originalCurrency,
      fxRateUsdtEgp,
      usdAmount: roundMoney(originalAmount / fxRateUsdtEgp)
    };
  }

  return { originalAmount, originalCurrency, fxRateUsdtEgp: null, usdAmount: originalAmount };
}

function findPaymentMethod(settings, requestedId) {
  const normalizedId = String(requestedId || "").trim().toUpperCase();
  const method = (settings.depositNetworks || []).find((item) => String(item.id || "").toUpperCase() === normalizedId);
  if (!method || method.status !== "active") throw new ApiError(400, "Payment method is not available.", "payment_method_unavailable");
  return method;
}

function adjustBalance(profile, wallet, delta) {
  const balances = { main: 0, commission: 0, locked: 0, ...(profile.balances || {}) };
  balances[wallet] = roundMoney(Number(balances[wallet] || 0) + Number(delta || 0));
  return { ...profile, balances };
}

function addIncome(profile, amount, options = { today: true, month: true }) {
  const income = { today: 0, month: 0, total: 0, ...(profile.income || {}) };
  if (options.today !== false) income.today = roundMoney(Number(income.today || 0) + amount);
  if (options.month !== false) income.month = roundMoney(Number(income.month || 0) + amount);
  income.total = roundMoney(Number(income.total || 0) + amount);
  return { ...profile, income };
}

function walletMatchesBoundAddress(wallets = {}, walletAddress) {
  const normalized = String(walletAddress || "").trim().toLowerCase();
  return Object.values(wallets || {}).some((wallet) => String(wallet?.address || "").trim().toLowerCase() === normalized);
}

function calculateWithdrawalFee(amount, settings) {
  return roundMoney(amount * Number(settings.feeRate || 0) + Number(settings.fixedFee || 0));
}

function levelAllowed(userLevel, requiredLevel) {
  return LEVEL_ORDER.indexOf(userLevel) >= LEVEL_ORDER.indexOf(requiredLevel);
}

function assertAmount(amount, minimum) {
  const value = Number(amount);
  if (!Number.isFinite(value) || value < minimum) throw new ApiError(400, `Amount must be at least ${minimum}.`, "invalid_amount");
  return roundMoney(value);
}

function assertSignedAmount(amount) {
  const value = Number(amount);
  if (!Number.isFinite(value) || value === 0) throw new ApiError(400, "Amount delta must be a non-zero number.", "invalid_amount");
  return roundMoney(value);
}

function assertInteger(value, minimum, maximum) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < minimum || number > maximum) {
    throw new ApiError(400, `Value must be an integer between ${minimum} and ${maximum}.`, "invalid_integer");
  }
  return number;
}

function assertReferralCode(code) {
  const value = String(code || "").trim().toUpperCase();
  if (!/^[A-Z0-9-]{6,18}$/.test(value)) throw new ApiError(400, "Invalid invitation code.", "invalid_referral");
  return value;
}

function assertFundPassword(password) {
  const value = String(password || "");
  if (value.length < 6 || value.length > 80) throw new ApiError(400, "Fund password must be between 6 and 80 characters.", "invalid_fund_password");
  return value;
}

function assertTxId(txId) {
  const value = String(txId || "").trim();
  if (value.length < 6 || value.length > 140) throw new ApiError(400, "Payment reference must be between 6 and 140 characters.", "invalid_txid");
  return value;
}

function assertReceiptReference(value) {
  const reference = String(value || "").trim();
  if (reference.length < 6 || reference.length > 600) throw new ApiError(400, "Payment proof reference is required.", "invalid_receipt");
  return reference;
}

function assertWallet(wallet) {
  const value = String(wallet || "").trim();
  const looksLikeTron = /^T[A-Za-z0-9]{25,40}$/.test(value);
  const looksLikeEth = /^0x[a-fA-F0-9]{40}$/.test(value);
  if (!looksLikeTron && !looksLikeEth) throw new ApiError(400, "Enter a valid TRC20 or EVM wallet address.", "invalid_wallet");
  return value;
}

function assertWithdrawWalletSource(source, allowedWallets = ["main", "commission"]) {
  const value = String(source || "main").trim();
  if (!allowedWallets.includes(value)) throw new ApiError(400, "Invalid wallet source.", "invalid_wallet_source");
  return value;
}

function assertBalanceWallet(source) {
  const value = String(source || "main").trim();
  if (!["main", "commission", "locked"].includes(value)) throw new ApiError(400, "Invalid balance wallet.", "invalid_wallet_source");
  return value;
}

function assertVipLevel(level) {
  const value = String(level || "").toUpperCase();
  if (!LEVEL_ORDER.includes(value)) throw new ApiError(400, "Invalid VIP level.", "invalid_vip");
  return value;
}

function assertUserStatus(status) {
  const value = String(status || "").trim();
  if (!["active", "suspended", "review"].includes(value)) throw new ApiError(400, "Invalid user status.", "invalid_status");
  return value;
}

function sanitizeTaskPayload(payload) {
  const id = String(payload.id || payload.taskId || slugify(payload.title || "task")).trim().slice(0, 80);
  const title = String(payload.title || "").trim();
  const status = String(payload.status || "active").trim();
  if (!id || !title) throw new ApiError(400, "Task ID and title are required.", "invalid_task");
  if (!["active", "draft", "archived"].includes(status)) throw new ApiError(400, "Invalid task status.", "invalid_task_status");
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
  const id = String(payload.id || "").trim().slice(0, 80);
  const title = String(payload.title || "").trim();
  const status = String(payload.status || "active").trim();
  if (!id || !title) throw new ApiError(400, "Plan ID and title are required.", "invalid_plan");
  if (!["active", "draft", "archived"].includes(status)) throw new ApiError(400, "Invalid investment plan status.", "invalid_plan_status");
  return {
    id,
    title: title.slice(0, 140),
    periodDays: assertInteger(Number(payload.periodDays || 1), 1, 3650),
    dailyRate: assertAmount(payload.dailyRate ?? 0, 0),
    minAmount: assertAmount(payload.minAmount ?? 0, 0),
    status
  };
}

function validateImportPath(path) {
  const segments = String(path || "").split("/").filter(Boolean);
  const allowedRoots = ["system_settings", "tasks", "public"];
  if (segments.length < 2 || segments.length % 2 !== 0 || !allowedRoots.includes(segments[0])) {
    throw new ApiError(400, `Import path is not allowed: ${path}`, "invalid_import_path");
  }
}

function reviveImportValue(value) {
  if (value === "__SERVER_TIMESTAMP__") return new Date();
  if (Array.isArray(value)) return value.map(reviveImportValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, nestedValue]) => [key, reviveImportValue(nestedValue)]));
  }
  return value;
}

async function readJson(request) {
  if (!request.body) return {};
  const contentType = request.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) return {};
  return request.json();
}

function jsonResponse(payload, status, request, env) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...corsHeaders(request, env)
    }
  });
}

function corsPreflight(request, env) {
  return new Response(null, { status: 204, headers: corsHeaders(request, env) });
}

function corsHeaders(request, env) {
  const origin = request.headers.get("Origin") || "";
  const allowedOrigins = String(env.ALLOWED_ORIGINS || "").split(",").map((item) => item.trim()).filter(Boolean);
  const allowOrigin = allowedOrigins.includes(origin) ? origin : allowedOrigins[0] || "*";
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Authorization,Content-Type,x-bootstrap-secret",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin"
  };
}

function normalizeError(error) {
  if (error instanceof ApiError) return error;
  return new ApiError(500, error?.message || "Internal server error.", "internal");
}

class ApiError extends Error {
  constructor(status, message, code = "error") {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function requireEnv(env, key) {
  const value = env[key];
  if (!value) throw new ApiError(500, `Missing Worker environment variable: ${key}`, "missing_env");
  return value;
}

function normalizePrivateKey(value) {
  return String(value || "").replace(/\\n/g, "\n").trim();
}

function stripMeta(record) {
  const { id, __name, ...data } = record || {};
  return data;
}

function stripUndefined(value) {
  if (Array.isArray(value)) return value.map(stripUndefined);
  if (!value || typeof value !== "object" || value instanceof Date) return value;
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined).map(([key, item]) => [key, stripUndefined(item)]));
}

function roundMoney(value) {
  return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
}

function slugify(value) {
  return String(value || "task").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 64) || "task";
}

function randomCode(length) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
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

function encodeBase64Url(value) {
  const bytes = typeof value === "string" ? new TextEncoder().encode(value) : value;
  return bytesToBase64Url(bytes);
}

function bytesToBase64Url(bytes) {
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function decodeBase64UrlToBytes(value) {
  return decodeBase64ToBytes(String(value).replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(String(value).length / 4) * 4, "="));
}

function decodeBase64ToBytes(value) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function decodeBase64UrlToString(value) {
  return new TextDecoder().decode(decodeBase64UrlToBytes(value));
}

function constantTimeEqual(a, b) {
  const left = new TextEncoder().encode(a);
  const right = new TextEncoder().encode(b);
  return constantTimeBytesEqual(left, right);
}

function constantTimeBytesEqual(left, right) {
  const maxLength = Math.max(left.length, right.length);
  let diff = left.length ^ right.length;
  for (let index = 0; index < maxLength; index += 1) {
    diff |= (left[index % left.length] || 0) ^ (right[index % right.length] || 0);
  }
  return diff === 0;
}
