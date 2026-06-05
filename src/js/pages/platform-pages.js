import { onAuthStateChanged, signOut } from "firebase/auth";
import { collection, doc, getDoc, getDocs, limit, onSnapshot, orderBy, query, updateDoc, where } from "firebase/firestore";
import { auth, db } from "../firebase-config";
import { apiRequest } from "../api/backend-client";
import { loginUser, registerNewUser } from "../firebase-auth";
import { submitDepositRequest, submitWithdrawalRequest } from "../wallet-firestore";
import { escapeHtml, formatMoney, showToast, withLoading } from "../ui/async-ui";
import { formatDate, todayKey } from "../utils/formatters";
import { assertCryptoWallet, assertFundPassword } from "../utils/validators";

const PAGE = document.body.dataset.page || "home";
const ROOT = document.querySelector("#page-root");
const PUBLIC_PAGES = new Set(["auth"]);
const LEVEL_ORDER = ["M0", "M1", "M2", "M3", "M4", "M5", "M6", "M7", "M8", "M9", "M10"];
const CERTIFICATE_ARCHIVE = "/assets/images/certificates/legacy-mbitir-status-certificate.jpg";

const AVATARS = [
  { id: "emerald", label: "Emerald", url: "/assets/images/avatars/avatar-emerald.svg" },
  { id: "sapphire", label: "Sapphire", url: "/assets/images/avatars/avatar-sapphire.svg" },
  { id: "gold", label: "Gold", url: "/assets/images/avatars/avatar-gold.svg" },
  { id: "violet", label: "Violet", url: "/assets/images/avatars/avatar-violet.svg" },
  { id: "carbon", label: "Carbon", url: "/assets/images/avatars/avatar-carbon.svg" },
  { id: "neon", label: "Neon", url: "/assets/images/avatars/avatar-neon.svg" }
];

const RANKS = [
  { id: "team-leader", title: "Team Leader", salary: 150, milestone: "12 active Level A downlines" },
  { id: "team-captain", title: "Team Captain", salary: 350, milestone: "30 Level A members and 5 M3 members" },
  { id: "team-supervisor", title: "Team Supervisor", salary: 700, milestone: "80 active team members across 3 levels" },
  { id: "junior-manager", title: "Junior Manager", salary: 1200, milestone: "150 active team members and M5 leadership" },
  { id: "regional-manager", title: "Regional Manager", salary: 2500, milestone: "Regional team performance review approval" },
  { id: "marketing-director", title: "Marketing Director", salary: 5000, milestone: "Executive compliance and revenue review" }
];

const EN_TEXT = new Map([
  ["الرئيسية", "Home"], ["المهام", "Tasks"], ["شحن", "Deposit"], ["حسابي", "Account"], ["رجوع", "Back"],
  ["تسجيل الدخول", "Sign in"], ["دخول", "Login"], ["إنشاء حساب", "Sign up"], ["البريد الإلكتروني", "Email"],
  ["كلمة مرور الحساب", "Account password"], ["كود الدعوة", "Invitation code"], ["كلمة مرور الصندوق", "Fund password"],
  ["متابعة آمنة", "Secure continue"], ["رصيد VidiX", "VidiX Balance"], ["اليوم", "Today"],
  ["متابعة الأرباح المباشرة", "Live Payout Tracker"], ["مهام اليوم", "Daily Tasks"], ["قاعة المهام", "Task Hall"],
  ["تم إنهاء كل مهام اليوم.", "All daily tasks are completed."], ["وقت المشاهدة المتبقي", "Remaining watch time"],
  ["استلام المكافأة", "Claim reward"], ["جاري بدء الجلسة...", "Starting session..."], ["شحن الرصيد", "Deposit balance"],
  ["طريقة الدفع", "Payment method"], ["المبلغ", "Amount"], ["إثبات الدفع", "Payment proof"], ["إرسال طلب الشحن", "Submit deposit"],
  ["نسخ بيانات الدفع", "Copy payment details"], ["فتح رابط الدفع", "Open payment link"], ["طلب سحب", "Withdrawal request"],
  ["المحفظة المربوطة", "Bound wallet"], ["لم يتم ربط محفظة بعد", "No wallet bound"], ["اربط محفظة أولاً", "Bind wallet first"],
  ["مصدر السحب", "Wallet source"], ["إرسال طلب السحب", "Submit withdrawal"], ["مستويات العضوية", "Membership levels"],
  ["انضم الآن", "Join now"], ["المستوى الحالي", "Current level"], ["مفتوح", "Unlocked"], ["اختار صورة الحساب", "Choose avatar"],
  ["شكل الحساب", "Profile style"], ["اضغط للحفظ", "Tap to save"], ["الرصيد الأساسي", "Main balance"], ["العمولة", "Commission"],
  ["إجمالي الأرباح", "Total revenue"], ["تفاصيل الفاتورة", "Invoice details"], ["سجلات الصندوق المالي", "Financial fund logs"],
  ["ربط محفظة كريبتو", "Bind crypto wallet"], ["تغيير كلمة مرور الصندوق", "Change fund password"], ["منصب الشركة", "Company rank"],
  ["لوحة الإدارة", "Admin panel"], ["تسجيل الخروج", "Sign out"], ["الشبكة", "Network"], ["عنوان المحفظة", "Wallet address"],
  ["حفظ المحفظة", "Save wallet"], ["كلمة مرور الصندوق الجديدة", "New fund password"], ["حفظ كلمة المرور", "Save password"],
  ["صندوق الاستثمار", "Investment fund"], ["سجل الاستثمارات", "Investment history"], ["استثمار الآن", "Invest now"],
  ["تقرير الفريق", "Team report"], ["إجمالي الفريق", "Total team"], ["المسجلين اليوم", "New today"], ["عمولات الفريق", "Team commission"],
  ["نسخ رابط الدعوة", "Copy invite link"], ["لا يوجد أعضاء في هذا المستوى.", "No members in this level."], ["تقديم طلب", "Apply"],
  ["دليل الموظف", "Employee guide"], ["عن VidiX", "About VidiX"], ["الشهادات", "Certificates"]
]);

const EN_LOOKUP = createTranslationLookup(EN_TEXT);

const state = {
  user: null,
  profile: null,
  profileUnsubscribe: null,
  walletSettings: null,
  watchSession: null,
  watchTask: null,
  countdownTimer: null,
  authMode: "login"
};

bootstrap();

function bootstrap() {
  bindLanguageButtons();
  bindShell();
  setActiveNav();
  showLoading();

  onAuthStateChanged(auth, (user) => {
    state.user = user;
    state.profile = null;
    state.profileUnsubscribe?.();
    state.profileUnsubscribe = null;

    if (!user) {
      updateShellProfile(null);
      if (!PUBLIC_PAGES.has(PAGE)) {
        window.location.href = "/auth.html";
        return;
      }
      renderPage().catch(showError);
      return;
    }

    if (PAGE === "auth") {
      window.location.href = "/";
      return;
    }

    state.profileUnsubscribe = onSnapshot(doc(db, "users", user.uid), (snapshot) => {
      state.profile = snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null;
      updateShellProfile(state.profile);
      renderPage().catch(showError);
    }, showError);
  });
}

function bindShell() {
  document.querySelector("[data-logout]")?.addEventListener("click", async (event) => {
    await withLoading(event.currentTarget, async () => {
      await signOut(auth);
      window.location.href = "/auth.html";
    }, "...");
  });
}

function bindLanguageButtons() {
  const language = localStorage.getItem("vidix-language") || "ar";
  document.documentElement.lang = language;
  document.documentElement.dir = language === "en" ? "ltr" : "rtl";
  document.querySelectorAll("[data-language]").forEach((button) => {
    button.classList.toggle("active", button.dataset.language === language);
    button.addEventListener("click", () => {
      localStorage.setItem("vidix-language", button.dataset.language);
      window.location.reload();
    });
  });
  applyTextTranslations(document.body);
}

async function renderPage() {
  if (!ROOT) return;

  const renderers = {
    auth: renderAuthPage,
    home: renderHomePage,
    tasks: renderTasksPage,
    watch: renderWatchPage,
    vip: renderVipPage,
    deposit: renderDepositPage,
    withdraw: renderWithdrawPage,
    profile: renderProfilePage,
    wallet: renderWalletPage,
    "fund-password": renderFundPasswordPage,
    invoice: renderInvoicePage,
    fund: renderFundPage,
    team: renderTeamPage,
    rank: renderRankPage,
    guide: renderGuidePage,
    about: renderAboutPage,
    certificates: renderCertificatesPage
  };

  await (renderers[PAGE] || renderers.home)();
  applyTextTranslations();
}

function currentLanguage() {
  return localStorage.getItem("vidix-language") || "ar";
}

function applyTextTranslations(root = document.body) {
  const language = currentLanguage();
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  nodes.forEach((node) => {
    const original = node.nodeValue;
    const trimmed = original.trim();
    if (!trimmed) return;
    const normalized = decodeMojibake(trimmed);
    if (language === "ar") {
      if (normalized !== trimmed) node.nodeValue = original.replace(trimmed, normalized);
      return;
    }
    const translated = EN_LOOKUP.get(trimmed) || EN_LOOKUP.get(normalized);
    if (!translated) return;
    node.nodeValue = original.replace(trimmed, translated);
  });
}

function createTranslationLookup(source) {
  const lookup = new Map();
  source.forEach((value, key) => {
    lookup.set(key, value);
    lookup.set(decodeMojibake(key), value);
  });
  return lookup;
}

function decodeMojibake(value) {
  if (!/[ÃƒÃ‚Ã˜Ã™Ã¢ØÙ]/.test(value)) return value;
  try {
    const bytes = Uint8Array.from([...value].map((character) => character.charCodeAt(0) & 0xff));
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return value;
  }
}

async function renderAuthPage() {
  const referralFromUrl = new URLSearchParams(window.location.search).get("ref") || "VX-ROOT";
  ROOT.innerHTML = `
    <section class="page-title">
      <small>Secure Access</small>
      <h1>تسجيل الدخول</h1>
    </section>
    <section class="card card-pad stack">
      <div class="grid-2">
        <button class="button primary" data-auth-mode="login" type="button">دخول</button>
        <button class="button ghost" data-auth-mode="signup" type="button">إنشاء حساب</button>
      </div>
      <form class="stack" id="auth-form">
        <label class="field">البريد الإلكتروني<input id="auth-email" type="email" autocomplete="email" required /></label>
        <label class="field">كلمة مرور الحساب<input id="auth-password" type="password" autocomplete="current-password" required /></label>
        <label class="field signup-only hidden">كود الدعوة<input id="auth-referral" type="text" value="${escapeHtml(referralFromUrl)}" /></label>
        <label class="field signup-only hidden">كلمة مرور الصندوق<input id="auth-fund-password" type="password" placeholder="6 أرقام أو أكثر" /></label>
        <button class="button primary" id="auth-submit" type="submit">متابعة آمنة</button>
      </form>
    </section>
  `;

  ROOT.querySelectorAll("[data-auth-mode]").forEach((button) => {
    button.addEventListener("click", () => {
      state.authMode = button.dataset.authMode;
      renderAuthMode();
    });
  });
  ROOT.querySelector("#auth-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const submitter = event.submitter;
    await withLoading(submitter, async () => {
      if (state.authMode === "signup") {
        await registerNewUser({
          email: value("#auth-email"),
          password: value("#auth-password"),
          invitationCode: value("#auth-referral"),
          fundPassword: value("#auth-fund-password"),
          displayName: value("#auth-email").split("@")[0] || "VidiX Member"
        });
      } else {
        await loginUser({ email: value("#auth-email"), password: value("#auth-password") });
      }
      window.location.href = "/";
    });
  });
  renderAuthMode();
}

async function renderHomePage() {
  const [tasks, completed] = await Promise.all([getActiveTasks(), getCompletedToday()]);
  const done = tasks.filter((task) => completed.has(task.id)).length;
  const main = Number(state.profile?.balances?.main || 0);
  const commission = Number(state.profile?.balances?.commission || 0);
  ROOT.innerHTML = `
    <section class="card card-pad stack">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:12px">
        <div>
          <p class="muted" style="margin:0">رصيد VidiX</p>
          <strong class="money" style="font-size:34px">${formatMoney(main + commission)}</strong>
        </div>
        <span class="badge gold">${escapeHtml(state.profile?.vipLevel || "M0")} Member</span>
      </div>
      <div class="grid-3">
        ${statBox("اليوم", formatMoney(state.profile?.income?.today || 0))}
        ${statBox("VIP", state.profile?.vipLevel || "M0", "gold")}
        ${statBox("المهام", `${done}/2`)}
      </div>
    </section>

    <section class="card" style="overflow:hidden">
      <video src="/assets/videos/vidix-ad-1.mp4" autoplay muted loop playsinline style="width:100%;aspect-ratio:16/9;object-fit:cover;display:block"></video>
    </section>

    <section class="grid-3">
      ${quickLink("/deposit.html", "شحن", "plus")}
      ${quickLink("/withdraw.html", "سحب", "send")}
      ${quickLink("/team.html", "دعوة", "users")}
      ${quickLink("/guide.html", "الدليل", "book")}
      ${quickLink("/certificates.html", "الشهادات", "star")}
      ${quickLink("/about.html", "عن الشركة", "building")}
    </section>

    <section class="card card-pad stack">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <h2 style="margin:0">متابعة الأرباح المباشرة</h2>
        <span class="badge">LIVE</span>
      </div>
      ${payoutRows()}
    </section>

    <section class="page-title">
      <small>Task Hall</small>
      <h1>مهام اليوم</h1>
    </section>
    <section class="stack">
      ${tasks.slice(0, 2).map((task) => taskCard(task, completed.has(task.id))).join("")}
    </section>
  `;
}

async function renderTasksPage() {
  const [tasks, completed] = await Promise.all([getActiveTasks(), getCompletedToday()]);
  const done = tasks.filter((task) => completed.has(task.id)).length;
  ROOT.innerHTML = `
    <section class="page-title">
      <small>Task Hall</small>
      <h1>قاعة المهام</h1>
    </section>
    <section class="card card-pad stack">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <strong>مهام اليوم</strong>
        <span class="badge gold">${done}/2</span>
      </div>
      <p class="muted" style="margin:0">مهمتان فقط يوميًا، كل فيديو بقيمة $1.00. المهام المكتملة لا تتكرر إلا في اليوم التالي.</p>
    </section>
    <section class="stack">
      ${tasks.slice(0, 2).map((task) => taskCard(task, completed.has(task.id))).join("")}
      ${done >= 2 ? `<article class="card card-pad"><strong class="money">تم إنهاء كل مهام اليوم.</strong></article>` : ""}
    </section>
  `;
}

async function renderWatchPage() {
  const taskId = new URLSearchParams(window.location.search).get("taskId");
  if (!taskId) {
    window.location.href = "/tasks.html";
    return;
  }
  const task = await getTask(taskId);
  state.watchTask = task;
  ROOT.innerHTML = `
    <section class="page-title">
      <small>Watch Task</small>
      <h1>${escapeHtml(task.title)}</h1>
    </section>
    <section class="task-card">
      <img src="${escapeHtml(task.posterUrl)}" alt="${escapeHtml(task.title)}" />
      <div class="card-pad stack">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:12px">
          <span class="badge gold">${escapeHtml(task.vipRequired || "M0")}</span>
          <strong class="money">${formatMoney(task.reward)}</strong>
        </div>
        <p class="muted" style="margin:0">سيبدأ عداد المشاهدة المؤمن من السيرفر. لا يمكن الاستلام قبل انتهاء الوقت.</p>
      </div>
    </section>
    <section class="card card-pad stack" style="text-align:center">
      <p class="muted" style="margin:0">وقت المشاهدة المتبقي</p>
      <strong class="money" style="font-size:52px"><span id="watch-countdown">${Number(task.durationSeconds || 12)}</span>s</strong>
      <div class="progress-track"><div class="progress-fill" id="watch-progress" style="width:100%"></div></div>
      <button class="button ghost" id="claim-button" type="button" disabled>جاري بدء الجلسة...</button>
    </section>
  `;
  await startSecureWatch(task);
}

async function renderVipPage() {
  const levels = await getVipLevels();
  const current = state.profile?.vipLevel || "M0";
  ROOT.innerHTML = `
    <section class="page-title">
      <small>VIP Board</small>
      <h1>مستويات العضوية</h1>
    </section>
    <section class="stack">
      ${levels.map((level) => vipCard(level, current)).join("")}
    </section>
  `;
  ROOT.querySelectorAll("[data-join-vip]").forEach((button) => {
    button.addEventListener("click", async () => {
      await withLoading(button, async () => {
        await apiRequest("/vip/upgrade", { body: { levelId: button.dataset.joinVip } });
        showToast("تمت ترقية العضوية بنجاح.", "success");
      }, "...");
    });
  });
}

async function renderDepositPage() {
  const settings = await getWalletSettings();
  state.walletSettings = settings;
  const methods = (settings.depositNetworks || []).filter((method) => method.status === "active");
  ROOT.innerHTML = `
    <section class="page-title">
      <small>Deposit</small>
      <h1>شحن الرصيد</h1>
    </section>
    <section class="card card-pad stack">
      <div class="grid-3">
        ${[20, 125, 250, 700, 2300, 5000].map((amount, index) => `<button class="button ${index === 0 ? "primary" : "ghost"}" data-package="${amount}" type="button">$${amount}</button>`).join("")}
      </div>
      <label class="field">طريقة الدفع<select id="deposit-method">${methods.map((method) => `<option value="${escapeHtml(method.id)}">${escapeHtml(method.label || method.id)}</option>`).join("")}</select></label>
      <div id="method-details"></div>
      <label class="field">المبلغ<input id="deposit-amount" type="number" min="1" step="0.01" value="20" /></label>
      <p class="muted" id="deposit-note"></p>
      <label class="field">TxID / Reference<input id="deposit-txid" type="text" placeholder="Transaction hash or payment reference" /></label>
      <label class="field">إثبات الدفع<input id="deposit-proof" type="text" placeholder="Receipt URL, Vodafone reference, or InstaPay confirmation" /></label>
      <button class="button primary" id="deposit-submit" type="button">إرسال طلب الشحن</button>
    </section>
  `;
  bindDeposit(settings);
}

async function renderWithdrawPage() {
  const wallet = firstBoundWallet(state.profile?.wallets);
  ROOT.innerHTML = `
    <section class="page-title">
      <small>Withdraw</small>
      <h1>طلب سحب</h1>
    </section>
    <section class="card card-pad stack">
      <div class="list-row">
        <p class="muted" style="margin:0 0 6px">المحفظة المربوطة</p>
        <strong dir="ltr">${escapeHtml(wallet?.address || "لم يتم ربط محفظة بعد")}</strong>
      </div>
      ${wallet ? "" : `<a class="button gold" href="/wallet.html">اربط محفظة أولاً</a>`}
      <label class="field">مصدر السحب<select id="withdraw-source"><option value="commission">Commission Wallet</option><option value="main">Main Wallet</option></select></label>
      <label class="field">المبلغ<input id="withdraw-amount" type="number" min="10" step="0.01" /></label>
      <label class="field">كلمة مرور الصندوق<input id="withdraw-fund-password" type="password" /></label>
      <button class="button primary" id="withdraw-submit" type="button" ${wallet ? "" : "disabled"}>إرسال طلب السحب</button>
    </section>
  `;
  ROOT.querySelector("#withdraw-submit")?.addEventListener("click", async (event) => {
    await withLoading(event.currentTarget, async () => {
      const result = await submitWithdrawalRequest({
        sourceWallet: value("#withdraw-source"),
        walletAddress: wallet.address,
        amount: Number(value("#withdraw-amount")),
        fundPassword: value("#withdraw-fund-password")
      });
      showToast(`تم إرسال السحب. الصافي ${formatMoney(result.netAmount)}`, "success");
    }, "...");
  });
}

async function renderProfilePage() {
  const avatar = selectedAvatar();
  ROOT.innerHTML = `
    <section class="card card-pad stack" style="text-align:center">
      <img src="${escapeHtml(avatar.url)}" alt="avatar" style="width:96px;height:96px;border-radius:24px;margin:auto;object-fit:cover;border:1px solid rgba(0,230,118,.5);padding:5px" />
      <h1 style="margin:0">حسابي</h1>
      <p class="muted" style="margin:0">UID: ${escapeHtml(state.profile?.id || "")}</p>
    </section>
    <section class="card card-pad stack">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <div><small class="muted">شكل الحساب</small><h2 style="margin:4px 0 0">اختار صورة الحساب</h2></div>
        <span class="badge">اضغط للحفظ</span>
      </div>
      <div class="avatar-grid">${AVATARS.map((item) => avatarButton(item, avatar.id)).join("")}</div>
    </section>
    <section class="grid-2">
      ${statBox("الرصيد الأساسي", formatMoney(state.profile?.balances?.main || 0))}
      ${statBox("العمولة", formatMoney(state.profile?.balances?.commission || 0))}
      ${statBox("اليوم", formatMoney(state.profile?.income?.today || 0))}
      ${statBox("إجمالي الأرباح", formatMoney(state.profile?.income?.total || 0))}
    </section>
    <section class="stack">
      ${profileLink("/invoice.html", "تفاصيل الفاتورة")}
      ${profileLink("/fund.html", "سجلات الصندوق المالي")}
      ${profileLink("/wallet.html", "ربط محفظة كريبتو")}
      ${profileLink("/fund-password.html", "تغيير كلمة مرور الصندوق")}
      ${profileLink("/rank.html", "منصب الشركة")}
      ${profileLink("/admin.html", "لوحة الإدارة")}
      <button class="button danger" data-logout type="button">تسجيل الخروج</button>
    </section>
  `;
  bindAvatarPicker();
  bindShell();
}

async function renderWalletPage() {
  const current = firstBoundWallet(state.profile?.wallets);
  ROOT.innerHTML = `
    <section class="page-title"><small>Wallet</small><h1>ربط محفظة كريبتو</h1></section>
    <section class="card card-pad stack">
      <div class="list-row">
        <p class="muted" style="margin:0 0 6px">المحفظة الحالية</p>
        <strong dir="ltr">${escapeHtml(current?.address || "لا يوجد")}</strong>
      </div>
      <label class="field">الشبكة<select id="wallet-network"><option value="TRC20">USDT TRC20</option><option value="BSC">BSC / BEP20</option><option value="ETH">Ethereum / ERC20</option></select></label>
      <label class="field">عنوان المحفظة<input id="wallet-address" type="text" dir="ltr" placeholder="T... or 0x..." /></label>
      <label class="field">كلمة مرور الصندوق<input id="wallet-fund-password" type="password" /></label>
      <button class="button primary" id="wallet-submit" type="button">حفظ المحفظة</button>
    </section>
  `;
  ROOT.querySelector("#wallet-submit").addEventListener("click", async (event) => {
    await withLoading(event.currentTarget, async () => {
      const walletAddress = assertCryptoWallet(value("#wallet-address"));
      const fundPassword = assertFundPassword(value("#wallet-fund-password"));
      await apiRequest("/wallet/bind", { body: { walletAddress, network: value("#wallet-network"), fundPassword } });
      showToast("تم ربط المحفظة.", "success");
    }, "...");
  });
}

async function renderFundPasswordPage() {
  ROOT.innerHTML = `
    <section class="page-title"><small>Security</small><h1>كلمة مرور الصندوق</h1></section>
    <section class="card card-pad stack">
      <p class="muted" style="margin:0">استخدم كلمة مختلفة عن كلمة مرور الدخول. مطلوبة للسحب وربط المحفظة.</p>
      <label class="field">كلمة مرور الصندوق الجديدة<input id="new-fund-password" type="password" /></label>
      <button class="button primary" id="fund-password-submit" type="button">حفظ كلمة المرور</button>
    </section>
  `;
  ROOT.querySelector("#fund-password-submit").addEventListener("click", async (event) => {
    await withLoading(event.currentTarget, async () => {
      await apiRequest("/auth/set-fund-password", { body: { fundPassword: assertFundPassword(value("#new-fund-password")) } });
      showToast("تم تحديث كلمة مرور الصندوق.", "success");
    }, "...");
  });
}

async function renderInvoicePage() {
  const items = await getLedgerItems();
  ROOT.innerHTML = `
    <section class="page-title"><small>Ledger</small><h1>تفاصيل الفاتورة</h1></section>
    <section class="stack">
      ${items.length ? items.map(ledgerRow).join("") : emptyCard("لا توجد حركات مالية حتى الآن.")}
    </section>
  `;
}

async function renderFundPage() {
  const [plans, investments] = await Promise.all([getInvestmentPlans(), getUserInvestments()]);
  ROOT.innerHTML = `
    <section class="page-title"><small>Investment Fund</small><h1>صندوق الاستثمار</h1></section>
    <section class="stack">
      ${plans.map(planCard).join("")}
    </section>
    <section class="page-title" style="margin-top:20px"><small>History</small><h1>سجل الاستثمارات</h1></section>
    <section class="stack">
      ${investments.length ? investments.map(investmentRow).join("") : emptyCard("لا توجد استثمارات حالية.")}
    </section>
  `;
  ROOT.querySelectorAll("[data-invest-plan]").forEach((button) => {
    button.addEventListener("click", async () => {
      const amount = window.prompt("اكتب مبلغ الاستثمار بالدولار");
      if (!amount) return;
      await withLoading(button, async () => {
        await apiRequest("/investments", { body: { planId: button.dataset.investPlan, amount: Number(amount) } });
        showToast("تم إنشاء الاستثمار.", "success");
      }, "...");
    });
  });
}

async function renderTeamPage() {
  const report = await getTeamReport();
  const invitation = state.profile?.referralCode || "VX-ROOT";
  const link = `${window.location.origin}/auth.html?ref=${encodeURIComponent(invitation)}`;
  ROOT.innerHTML = `
    <section class="page-title"><small>Team Report</small><h1>تقرير الفريق</h1></section>
    <section class="card card-pad stack">
      <span class="badge gold">${escapeHtml(invitation)}</span>
      <p class="muted" style="margin:0" dir="ltr">${escapeHtml(link)}</p>
      <button class="button primary" data-copy="${escapeHtml(link)}" type="button">نسخ رابط الدعوة</button>
    </section>
    <section class="grid-2">
      ${statBox("إجمالي الفريق", report.total)}
      ${statBox("المسجلين اليوم", report.newToday)}
      ${statBox("عمولات الفريق", formatMoney(report.commissionTotal))}
      ${statBox("VIP نشط", Object.values(report.activeVipByLevel).reduce((a, b) => a + b, 0))}
    </section>
    <section class="stack">
      ${["A", "B", "C"].map((level) => teamLevelCard(level, report.levels[level] || [])).join("")}
    </section>
  `;
  bindCopyButtons();
}

async function renderRankPage() {
  ROOT.innerHTML = `
    <section class="page-title"><small>Corporate Rank</small><h1>منصب الشركة</h1></section>
    <section class="stack">
      ${RANKS.map(rankCard).join("")}
    </section>
  `;
  ROOT.querySelectorAll("[data-apply-rank]").forEach((button) => {
    button.addEventListener("click", async () => {
      const accepted = window.confirm("هل توافق على اتفاقية العمل الرقمية وشروط مراجعة الإدارة؟");
      if (!accepted) return;
      await withLoading(button, async () => {
        await apiRequest("/ranks/apply", { body: { rankId: button.dataset.applyRank } });
        showToast("تم إرسال طلب المنصب للمراجعة.", "success");
      }, "...");
    });
  });
}

async function renderGuidePage() {
  ROOT.innerHTML = infoPage("دليل الموظف", [
    "سجل الدخول، شاهد مهمتين يوميًا، وانتظر انتهاء العداد قبل الاستلام.",
    "كل فيديو نشط يدفع $1 إلى رصيد العمولة بعد تحقق السيرفر.",
    "الشحن والسحب يخضعان لمراجعة الإدارة، ولا تشارك كلمة مرور الصندوق."
  ]);
}

async function renderAboutPage() {
  ROOT.innerHTML = infoPage("عن VidiX", [
    "VidiX منصة مهام فيديو وتجارب عضوية وإحالات مبنية على Firebase وCloudflare Worker.",
    "كل العمليات المالية الحساسة تتم من السيرفر لتقليل التلاعب والتكرار.",
    "النسخة الحالية مهيأة للنشر على Firebase Hosting مع لوحة إدارة منفصلة."
  ]);
}

async function renderCertificatesPage() {
  ROOT.innerHTML = `
    <section class="page-title">
      <small>VidiX Documents</small>
      <h1>الشهادات</h1>
    </section>
    <section class="card card-pad stack">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:12px">
        <div>
          <strong>أرشيف مستندات الشركة</strong>
          <p class="muted" style="margin:6px 0 0">تم نقل ملف الشهادة من جذر المشروع إلى مسار الأصول الصحيح.</p>
        </div>
        <span class="badge gold">Document</span>
      </div>
      <a href="${CERTIFICATE_ARCHIVE}" target="_blank" rel="noopener">
        <img class="certificate-image" src="${CERTIFICATE_ARCHIVE}" alt="Uploaded certificate document" />
      </a>
      <p class="muted" style="margin:0">ملاحظة: المستند الحالي مرفوع كأرشيف فقط. استبدله بشهادة رسمية باسم VidiX قبل عرضه كإثبات قانوني عام.</p>
      <a class="button ghost" href="${CERTIFICATE_ARCHIVE}" target="_blank" rel="noopener">فتح المستند</a>
    </section>
  `;
}

async function startSecureWatch(task) {
  const claim = ROOT.querySelector("#claim-button");
  const countdown = ROOT.querySelector("#watch-countdown");
  const progress = ROOT.querySelector("#watch-progress");
  try {
    const session = await apiRequest("/tasks/start", { body: { taskId: task.id } });
    state.watchSession = session;
    const total = Number(session.durationSeconds || task.durationSeconds || 12);
    const startedAt = performance.now();
    claim.textContent = "استلام المكافأة";

    state.countdownTimer = window.setInterval(() => {
      const elapsed = Math.floor((performance.now() - startedAt) / 1000);
      const remaining = Math.max(0, total - elapsed);
      countdown.textContent = remaining;
      progress.style.width = `${(remaining / total) * 100}%`;
      if (remaining <= 0) {
        window.clearInterval(state.countdownTimer);
        claim.disabled = false;
        claim.classList.remove("ghost");
        claim.classList.add("primary");
        claim.textContent = `استلام ${formatMoney(task.reward)}`;
      }
    }, 250);

    claim.addEventListener("click", async (event) => {
      if (event.currentTarget.disabled) return;
      await withLoading(event.currentTarget, async () => {
        await apiRequest("/tasks/complete", { body: { taskId: task.id, watchSessionId: session.sessionId } });
        showToast("تم استلام المكافأة.", "success");
        window.location.href = "/tasks.html";
      }, "...");
    });
  } catch (error) {
    claim.textContent = error.message;
    claim.disabled = true;
    showError(error);
  }
}

function bindDeposit(settings) {
  const amountInput = ROOT.querySelector("#deposit-amount");
  const methodSelect = ROOT.querySelector("#deposit-method");
  const renderMethod = () => {
    const method = selectedPaymentMethod(settings);
    ROOT.querySelector("#method-details").innerHTML = methodCard(method);
    updateDepositNote(settings);
    bindCopyButtons();
  };

  ROOT.querySelectorAll("[data-package]").forEach((button) => {
    button.addEventListener("click", () => {
      ROOT.querySelectorAll("[data-package]").forEach((item) => {
        item.classList.toggle("primary", item === button);
        item.classList.toggle("ghost", item !== button);
      });
      const method = selectedPaymentMethod(settings);
      const usd = Number(button.dataset.package || 20);
      amountInput.value = String((method.currency || "USDT").toUpperCase() === "EGP" ? Math.ceil(usd * Number(settings.fx?.usdtEgpRate || 50)) : usd);
      updateDepositNote(settings);
    });
  });

  methodSelect.addEventListener("change", renderMethod);
  amountInput.addEventListener("input", () => updateDepositNote(settings));
  ROOT.querySelector("#deposit-submit").addEventListener("click", async (event) => {
    await withLoading(event.currentTarget, async () => {
      const result = await submitDepositRequest({
        paymentMethod: value("#deposit-method"),
        amount: Number(value("#deposit-amount")),
        txId: value("#deposit-txid"),
        receiptReference: value("#deposit-proof")
      });
      showToast(`تم إرسال طلب الشحن: ${result.depositId}`, "success");
    }, "...");
  });
  renderMethod();
}

function bindAvatarPicker() {
  ROOT.querySelectorAll("[data-avatar-id]").forEach((button) => {
    button.addEventListener("click", async () => {
      await withLoading(button, async () => {
        const avatar = AVATARS.find((item) => item.id === button.dataset.avatarId) || AVATARS[0];
        await updateDoc(doc(db, "users", state.user.uid), { avatarId: avatar.id, avatarUrl: avatar.url, updatedAt: new Date() });
        showToast("تم حفظ صورة الحساب.", "success");
      }, "");
    });
  });
}

function bindCopyButtons() {
  ROOT.querySelectorAll("[data-copy]").forEach((button) => {
    button.addEventListener("click", async () => {
      await navigator.clipboard.writeText(button.dataset.copy);
      showToast("تم النسخ.", "success");
    });
  });
}

async function getActiveTasks() {
  const snapshot = await getDocs(query(collection(db, "tasks"), where("status", "==", "active"), orderBy("sortOrder", "asc"), limit(20)));
  const userLevelIndex = LEVEL_ORDER.indexOf(state.profile?.vipLevel || "M0");
  return snapshot.docs
    .map((taskDoc) => ({ id: taskDoc.id, ...taskDoc.data() }))
    .filter((task) => LEVEL_ORDER.indexOf(task.vipRequired || "M0") <= userLevelIndex);
}

async function getTask(taskId) {
  const snapshot = await getDoc(doc(db, "tasks", taskId));
  if (!snapshot.exists()) throw new Error("Task not found.");
  return { id: snapshot.id, ...snapshot.data() };
}

async function getCompletedToday() {
  const snapshot = await getDocs(
    query(collection(db, "user_tasks"), where("uid", "==", state.user.uid), where("dayKey", "==", todayKey()), where("status", "==", "completed"), limit(20))
  );
  return new Set(snapshot.docs.map((item) => item.data().taskId));
}

async function getVipLevels() {
  const snapshot = await getDoc(doc(db, "system_settings", "vip_levels"));
  return snapshot.data()?.levels || [];
}

async function getWalletSettings() {
  return apiRequest("/settings/wallets", { method: "GET", authRequired: false });
}

async function getInvestmentPlans() {
  const snapshot = await getDoc(doc(db, "system_settings", "investment_plans"));
  return (snapshot.data()?.plans || []).filter((plan) => plan.status === "active");
}

async function getUserInvestments() {
  const snapshot = await getDocs(query(collection(db, "investments"), where("uid", "==", state.user.uid), orderBy("createdAt", "desc"), limit(50)));
  return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
}

async function getLedgerItems() {
  const snapshot = await getDocs(query(collection(db, "ledger"), where("uid", "==", state.user.uid), orderBy("createdAt", "desc"), limit(80)));
  return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
}

async function getTeamReport() {
  const report = { total: 0, newToday: 0, activeVipByLevel: {}, commissionTotal: 0, levels: { A: [], B: [], C: [] } };
  await Promise.all(["A", "B", "C"].map(async (level) => {
    const snapshot = await getDocs(query(collection(db, "users", state.user.uid, `downline_level_${level}`), limit(500)));
    const members = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
    report.levels[level] = members;
    report.total += members.length;
    members.forEach((member) => {
      if (member.registeredDayKey === todayKey()) report.newToday += 1;
      if (member.vipLevel && member.vipLevel !== "M0") report.activeVipByLevel[member.vipLevel] = (report.activeVipByLevel[member.vipLevel] || 0) + 1;
    });
  }));
  const ledger = await getDocs(query(collection(db, "ledger"), where("uid", "==", state.user.uid), where("type", "==", "referral_commission"), limit(500)));
  report.commissionTotal = ledger.docs.reduce((sum, item) => sum + Number(item.data().amount || 0), 0);
  return report;
}

function updateShellProfile(profile) {
  const avatar = AVATARS.find((item) => item.id === profile?.avatarId) || AVATARS[0];
  document.querySelectorAll("[data-shell-avatar]").forEach((image) => {
    image.src = avatar.url;
  });
}

function setActiveNav() {
  const navPage = PAGE === "home" ? "home" : PAGE;
  document.querySelectorAll("[data-nav-page]").forEach((link) => {
    link.classList.toggle("active", link.dataset.navPage === navPage);
  });
}

function renderAuthMode() {
  const signup = state.authMode === "signup";
  ROOT.querySelectorAll("[data-auth-mode]").forEach((button) => {
    const active = button.dataset.authMode === state.authMode;
    button.classList.toggle("primary", active);
    button.classList.toggle("ghost", !active);
  });
  ROOT.querySelectorAll(".signup-only").forEach((node) => node.classList.toggle("hidden", !signup));
  ROOT.querySelector("#auth-submit").textContent = signup ? "إنشاء حساب" : "متابعة آمنة";
}

function updateDepositNote(settings) {
  const method = selectedPaymentMethod(settings);
  const amount = Number(value("#deposit-amount") || 0);
  const note = ROOT.querySelector("#deposit-note");
  if (!method || !note) return;
  if ((method.currency || "USDT").toUpperCase() === "EGP") {
    const rate = Number(settings.fx?.usdtEgpRate || 50);
    note.textContent = `${amount.toFixed(2)} EGP = ${(amount / rate).toFixed(2)} USDT at ${rate.toFixed(2)} EGP/USDT`;
  } else {
    note.textContent = `${amount.toFixed(2)} USDT will be reviewed and credited as USD balance.`;
  }
}

function selectedPaymentMethod(settings) {
  const id = value("#deposit-method");
  return (settings.depositNetworks || []).find((method) => method.id === id) || settings.depositNetworks?.[0];
}

function showLoading() {
  if (ROOT) ROOT.innerHTML = `<div class="stack"><div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div></div>`;
}

function showError(error) {
  console.error(error);
  if (ROOT && (!ROOT.innerHTML.trim() || ROOT.querySelector(".skeleton"))) ROOT.innerHTML = emptyCard(error.message || "Operation failed.");
  showToast(error.message || "Operation failed.", "error");
}

function value(selector) {
  return ROOT.querySelector(selector)?.value?.trim() || "";
}

function selectedAvatar() {
  return AVATARS.find((item) => item.id === state.profile?.avatarId) || AVATARS[0];
}

function firstBoundWallet(wallets = {}) {
  return Object.values(wallets || {}).find((wallet) => wallet?.address);
}

function statBox(label, value, kind = "") {
  return `<article class="card card-pad"><small class="muted">${escapeHtml(label)}</small><strong class="${kind === "gold" ? "badge gold" : "money"}" style="display:block;margin-top:8px;font-size:${kind === "gold" ? "14px" : "20px"}">${escapeHtml(value)}</strong></article>`;
}

function quickLink(href, label, icon) {
  return `<a class="card card-pad action-tile" href="${href}"><span class="badge action-icon" aria-hidden="true">${iconSvg(icon)}</span><strong>${escapeHtml(label)}</strong></a>`;
}

function iconSvg(name) {
  const icons = {
    plus: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
    send: '<svg viewBox="0 0 24 24"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>',
    users: '<svg viewBox="0 0 24 24"><path d="M16 21a4 4 0 0 0-8 0"/><circle cx="12" cy="7" r="4"/><path d="M22 21a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
    book: '<svg viewBox="0 0 24 24"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5z"/></svg>',
    star: '<svg viewBox="0 0 24 24"><path d="m12 2 3.1 6.3 7 .9-5.1 4.9 1.3 6.9L12 17.7 5.7 21l1.3-6.9L1.9 9.2l7-.9Z"/></svg>',
    building: '<svg viewBox="0 0 24 24"><path d="M3 21h18"/><path d="M5 21V5a2 2 0 0 1 2-2h7v18"/><path d="M14 8h3a2 2 0 0 1 2 2v11"/><path d="M8 7h2M8 11h2M8 15h2"/></svg>'
  };
  return icons[name] || icons.star;
}

function payoutRows() {
  const rows = [
    ["User +2010****** completed task", "$1.00"],
    ["User +2011****** team commission", "$0.04"],
    ["User +9715****** deposit approved", "$125.00"],
    ["User +9665****** completed video", "$1.00"]
  ];
  return rows.map(([text, amount]) => `<div class="list-row" style="display:flex;justify-content:space-between;gap:10px"><span class="muted">${escapeHtml(text)}</span><strong class="money">${amount}</strong></div>`).join("");
}

function taskCard(task, completed) {
  return `
    <article class="task-card">
      <img src="${escapeHtml(task.posterUrl)}" alt="${escapeHtml(task.title)}" />
      <div class="card-pad stack">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:10px">
          <div><strong>${escapeHtml(task.title)}</strong><p class="muted" style="margin:4px 0 0">${Number(task.durationSeconds || 12)} ثانية مشاهدة</p></div>
          <strong class="money">${formatMoney(task.reward || 1)}</strong>
        </div>
        ${completed ? `<button class="button ghost" type="button" disabled>اكتملت اليوم</button>` : `<a class="button primary" href="/watch.html?taskId=${encodeURIComponent(task.id)}">ابدأ المشاهدة</a>`}
      </div>
    </article>
  `;
}

function vipCard(level, current) {
  const currentIndex = LEVEL_ORDER.indexOf(current);
  const levelIndex = LEVEL_ORDER.indexOf(level.id);
  const disabled = levelIndex <= currentIndex;
  return `
    <article class="vip-card stack">
      <span class="badge gold">VIP ${escapeHtml(level.id)}</span>
      <h2 style="margin:0">${escapeHtml(level.id)} Membership</h2>
      <p class="muted" style="margin:0">2 daily tasks • $1.00 reward • Unlock ${formatMoney(level.price || 0)}</p>
      <button class="button ${disabled ? "ghost" : "gold"}" data-join-vip="${escapeHtml(level.id)}" type="button" ${disabled ? "disabled" : ""}>${level.id === current ? "المستوى الحالي" : disabled ? "مفتوح" : "انضم الآن"}</button>
    </article>
  `;
}

function methodCard(method) {
  if (!method) return "";
  const detail = method.wallet || method.paymentLink || "";
  return `
    <article class="method-card stack">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:10px">
        <strong>${escapeHtml(method.label || method.id)}</strong>
        <span class="badge">${escapeHtml(method.currency || "USDT")}</span>
      </div>
      <code class="muted" dir="ltr" style="word-break:break-all">${escapeHtml(detail)}</code>
      <button class="button ghost" data-copy="${escapeHtml(detail)}" type="button">نسخ بيانات الدفع</button>
      ${method.paymentLink ? `<a class="button gold" href="${escapeHtml(method.paymentLink)}" target="_blank" rel="noopener">فتح رابط الدفع</a>` : ""}
    </article>
  `;
}

function avatarButton(avatar, selectedId) {
  return `<button class="avatar-option ${avatar.id === selectedId ? "active" : ""}" data-avatar-id="${escapeHtml(avatar.id)}" type="button"><img src="${escapeHtml(avatar.url)}" alt="${escapeHtml(avatar.label)}" /></button>`;
}

function profileLink(href, label) {
  return `<a class="list-row" href="${href}" style="display:flex;justify-content:space-between;align-items:center"><strong>${escapeHtml(label)}</strong><span class="muted">›</span></a>`;
}

function ledgerRow(item) {
  return `<article class="list-row"><div style="display:flex;justify-content:space-between;gap:10px"><strong>${escapeHtml(item.type || "transaction")}</strong><strong class="money">${formatMoney(item.amount || 0)}</strong></div><p class="muted" style="margin:6px 0 0">${escapeHtml(formatDate(item.createdAt))}</p></article>`;
}

function planCard(plan) {
  return `<article class="vip-card stack"><span class="badge gold">${Number(plan.periodDays || 0)} Days</span><h2 style="margin:0">${escapeHtml(plan.title)}</h2><p class="muted" style="margin:0">Daily profit ${Number(plan.dailyRate || 0).toFixed(2)}% • Minimum ${formatMoney(plan.minAmount || 0)}</p><button class="button gold" data-invest-plan="${escapeHtml(plan.id)}" type="button">استثمار الآن</button></article>`;
}

function investmentRow(item) {
  return `<article class="list-row"><div style="display:flex;justify-content:space-between;gap:10px"><strong>${escapeHtml(item.planId)}</strong><span class="badge">${escapeHtml(item.status)}</span></div><p class="muted" style="margin:6px 0 0">${formatMoney(item.amount || 0)} • ${Number(item.dailyRate || 0)}%</p></article>`;
}

function teamLevelCard(level, members) {
  return `<article class="card card-pad stack"><div style="display:flex;justify-content:space-between"><h2 style="margin:0">Level ${level}</h2><span class="badge gold">${members.length}</span></div>${members.length ? members.map((member) => `<div class="list-row" style="display:flex;justify-content:space-between;gap:8px"><span dir="ltr">${escapeHtml(member.phone || member.id.slice(0, 8) + "****")}</span><small class="muted">${escapeHtml(member.registeredDayKey || "-")}</small><strong class="badge gold">${escapeHtml(member.vipLevel || "M0")}</strong></div>`).join("") : `<p class="muted" style="margin:0">لا يوجد أعضاء في هذا المستوى.</p>`}</article>`;
}

function rankCard(rank) {
  return `<article class="vip-card stack"><span class="badge gold">${formatMoney(rank.salary)} / month</span><h2 style="margin:0">${escapeHtml(rank.title)}</h2><p class="muted" style="margin:0">${escapeHtml(rank.milestone)}</p><button class="button gold" data-apply-rank="${escapeHtml(rank.id)}" type="button">تقديم طلب</button></article>`;
}

function infoPage(title, lines) {
  return `<section class="page-title"><small>VidiX</small><h1>${escapeHtml(title)}</h1></section><section class="card card-pad stack">${lines.map((line) => `<p class="muted" style="margin:0">${escapeHtml(line)}</p>`).join("")}</section>`;
}

function emptyCard(message) {
  return `<article class="card card-pad"><p class="muted" style="margin:0">${escapeHtml(message)}</p></article>`;
}
