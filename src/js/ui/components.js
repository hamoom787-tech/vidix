import {
  ArrowUpRight,
  BadgeDollarSign,
  BadgeInfo,
  BookOpen,
  BriefcaseBusiness,
  Building2,
  Copy,
  Gem,
  Landmark,
  LayoutDashboard,
  Link,
  Lock,
  LogOut,
  Menu,
  MessageSquareLock,
  Network,
  Newspaper,
  Play,
  PlaySquare,
  PlusCircle,
  Send,
  ShieldCheck,
  Signature,
  SunMoon,
  Timer,
  UploadCloud,
  UserCog,
  UserPlus,
  WalletCards,
  X,
  createIcons
} from "lucide";
import {
  banners,
  catalogTasks,
  cryptoNetworks,
  depositPackages,
  investmentPlans,
  navItems,
  payoutFeed,
  quickActions,
  ranks,
  vipLevels
} from "../data/catalog";
import { calculatePlanReturn, formatMoney } from "../utils/formatters";

export function hydrateIcons() {
  createIcons({
    icons: {
      ArrowUpRight,
      BadgeDollarSign,
      BadgeInfo,
      BookOpen,
      BriefcaseBusiness,
      Building2,
      Copy,
      Gem,
      Landmark,
      LayoutDashboard,
      Link,
      Lock,
      LogOut,
      Menu,
      MessageSquareLock,
      Network,
      Newspaper,
      Play,
      PlaySquare,
      PlusCircle,
      Send,
      ShieldCheck,
      Signature,
      SunMoon,
      Timer,
      UploadCloud,
      UserCog,
      UserPlus,
      WalletCards,
      X
    }
  });
}

export function renderNavigation({ desktopEl, mobileEl, activeRoute, onNavigate }) {
  const renderButton = (item) => `
    <button class="nav-item ${item.route === activeRoute ? "active" : ""}" type="button" data-route="${item.route}">
      <i data-lucide="${item.icon}"></i>
      <span>${item.label}</span>
    </button>
  `;

  desktopEl.innerHTML = navItems.map(renderButton).join("");
  mobileEl.innerHTML = navItems
    .filter((item) => ["home", "tasks", "vip", "team", "profile"].includes(item.route))
    .map(renderButton)
    .join("");

  [...desktopEl.querySelectorAll("[data-route]"), ...mobileEl.querySelectorAll("[data-route]")].forEach((button) => {
    button.addEventListener("click", () => onNavigate(button.dataset.route));
  });

  hydrateIcons();
}

export function renderHome(container, profile) {
  const balances = profile?.balances || {};
  container.innerHTML = `
    <section class="hero-grid">
      <div class="announcement-slider" id="announcement-slider">
        ${banners
          .map(
            (banner, index) => `
              <article class="slide ${index === 0 ? "active" : ""}" style="background: linear-gradient(rgba(8,17,31,.08), rgba(8,17,31,.86)), url('${banner.image}') center/cover;">
                <span class="eyebrow">${banner.kicker}</span>
                <h2>${banner.title}</h2>
                <p>${banner.body}</p>
              </article>
            `
          )
          .join("")}
      </div>

      <aside class="feed-card">
        <div class="section-head">
          <div>
            <h2>Live Earnings Feed</h2>
            <p>Approved activity feed rendered from platform-safe entries.</p>
          </div>
          <span class="status-pill success"><i data-lucide="badge-info"></i> Live</span>
        </div>
        <div class="feed-list">
          ${payoutFeed
            .map(
              (item) => `
                <div class="feed-row">
                  <span>User <strong>${item.user}</strong> ${item.label}</span>
                  <strong>${formatMoney(item.amount)}</strong>
                </div>
              `
            )
            .join("")}
        </div>
      </aside>
    </section>

    <section class="ticker">
      <strong>Updates</strong>
      <div class="ticker-track">
        <span>سياسة السحب: تتم مراجعة الطلبات خلال يوم عمل.</span>
        <span>إشعار أمان: لا تشارك كلمة مرور الأموال مع أي شخص.</span>
        <span>العضويات M8-M10 جاهزة للتفعيل بعد مراجعة الامتثال.</span>
      </div>
    </section>

    <section class="metrics-grid">
      ${metricCard("Main Wallet", balances.main)}
      ${metricCard("Commission", balances.commission)}
      ${metricCard("Today", profile?.income?.today)}
      ${metricCard("This Month", profile?.income?.month)}
      ${metricCard("Total Revenue", profile?.income?.total)}
    </section>

    <section class="quick-grid">
      ${quickActions
        .map(
          (action) => `
            <button class="quick-action" type="button" data-route="${action.route}">
              <span><i data-lucide="${action.icon}"></i></span>
              <strong>${action.label}</strong>
              <small class="muted">فتح القسم</small>
            </button>
          `
        )
        .join("")}
    </section>

    <section class="panel">
      <div class="section-head">
        <div>
          <h2>Task Hall | قاعة العمل</h2>
          <p>Premium task thumbnails filtered by VIP level on the server.</p>
        </div>
        <button class="secondary-button" type="button" data-route="tasks">عرض المهام</button>
      </div>
      <div class="task-grid" style="margin-top: 14px;">
        ${catalogTasks.map(taskPreview).join("")}
      </div>
    </section>
  `;
}

export function renderTasks(container, onOpenTask) {
  container.innerHTML = `
    <section class="section-head">
      <div>
        <h2>Task Center</h2>
        <p>Watch-time is client-side UX only; rewards are validated by Cloud Functions.</p>
      </div>
      <div class="segmented-control" style="max-width: 420px;">
        <button class="segment active" type="button" data-status-tab="all">All</button>
        <button class="segment" type="button" data-status-tab="processing">Processing</button>
        <button class="segment" type="button" data-status-tab="completed">Completed</button>
        <button class="segment" type="button" data-status-tab="failed">Failed</button>
      </div>
    </section>
    <section class="task-grid">
      ${catalogTasks
        .map(
          (task) => `
            <article class="task-card">
              ${taskPreview(task)}
              <div class="task-meta">
                <span class="status-pill"><i data-lucide="timer"></i> ${task.durationSeconds}s</span>
                <strong>${formatMoney(task.reward)}</strong>
              </div>
              <button class="primary-button" type="button" data-open-task="${task.id}">
                <i data-lucide="play"></i>
                <span>بدء المهمة</span>
              </button>
            </article>
          `
        )
        .join("")}
    </section>
  `;

  container.querySelectorAll("[data-open-task]").forEach((button) => {
    button.addEventListener("click", () => onOpenTask(catalogTasks.find((task) => task.id === button.dataset.openTask)));
  });
}

export function renderTaskModal({ modalRoot, task, onClaim, onClose, onStartTimer }) {
  modalRoot.innerHTML = `
    <article class="contract-sheet">
      <div class="section-head">
        <div>
          <span class="eyebrow">${task.category}</span>
          <h2>${task.title}</h2>
          <p>Reward: ${formatMoney(task.reward)} | Required: ${task.vipRequired}</p>
        </div>
        <button class="icon-button" type="button" data-close-modal aria-label="Close">
          <i data-lucide="x"></i>
        </button>
      </div>
      <div class="video-frame" style="margin-top: 14px;">
        <iframe src="${task.videoUrl}" title="${task.title}" allowfullscreen></iframe>
      </div>
      <div class="status-row" style="margin-top: 14px;">
        <span class="status-pill warning"><i data-lucide="timer"></i> <span id="task-countdown">${task.durationSeconds}</span>s</span>
        <button class="primary-button" id="claim-task-button" type="button" disabled>
          <i data-lucide="lock"></i>
          <span>استلام</span>
        </button>
      </div>
    </article>
  `;

  const closeButton = modalRoot.querySelector("[data-close-modal]");
  const claimButton = modalRoot.querySelector("#claim-task-button");
  const countdown = modalRoot.querySelector("#task-countdown");
  closeButton.addEventListener("click", onClose);

  onStartTimer({
    seconds: task.durationSeconds,
    onTick: (remaining) => {
      countdown.textContent = String(Math.max(remaining, 0));
    },
    onReady: () => {
      claimButton.disabled = false;
      claimButton.querySelector("i").setAttribute("data-lucide", "badge-dollar-sign");
      claimButton.querySelector("span").textContent = "استلام المكافأة";
      hydrateIcons();
    }
  });

  claimButton.addEventListener("click", () => onClaim(task.id));
  hydrateIcons();
}

export function renderVip(container, onJoin) {
  container.innerHTML = `
    <section class="section-head">
      <div>
        <h2>VIP Membership Levels</h2>
        <p>Activation uses a server transaction: deduct balance, upgrade tier, write ledger.</p>
      </div>
    </section>
    <section class="tier-grid">
      ${vipLevels
        .map(
          (level) => `
            <article class="tier-card ${level.featured ? "featured" : ""}">
              <span class="status-pill ${level.featured ? "success" : ""}">${level.id}</span>
              <div class="tier-price">${formatMoney(level.price)}</div>
              <ul class="tier-list">
                <li>Daily tasks: <strong>${level.dailyTasks}</strong></li>
                <li>Reward/task: <strong>${formatMoney(level.reward)}</strong></li>
                <li>Daily profit: <strong>${formatMoney(level.dailyProfit)}</strong></li>
                <li>Monthly: <strong>${formatMoney(level.monthlyProfit)}</strong></li>
                <li>Yearly: <strong>${formatMoney(level.yearlyProfit)}</strong></li>
              </ul>
              <button class="primary-button" type="button" data-join-level="${level.id}">
                <i data-lucide="gem"></i>
                <span>الانضمام الآن</span>
              </button>
            </article>
          `
        )
        .join("")}
    </section>
    <section class="panel">
      <div class="section-head">
        <div>
          <h2>Upgrade Breakdown</h2>
          <p>Network tier percentages are configurable in system_settings/referrals.</p>
        </div>
      </div>
      <div class="tree-grid" style="margin-top: 14px;">
        <div class="tree-node"><strong>Level A</strong><p class="muted">4% commission on approved upgrade/deposit events.</p></div>
        <div class="tree-node"><strong>Level B</strong><p class="muted">2% commission for verified second-level activity.</p></div>
        <div class="tree-node"><strong>Level C</strong><p class="muted">1% commission for verified third-level activity.</p></div>
      </div>
    </section>
  `;

  container.querySelectorAll("[data-join-level]").forEach((button) => {
    button.addEventListener("click", () => onJoin(button.dataset.joinLevel));
  });
}

export function renderDeposit(container, onSubmit) {
  const defaultNetwork = cryptoNetworks[0];
  container.innerHTML = `
    <section class="hero-grid">
      <form class="panel" id="deposit-form">
        <div class="section-head">
          <div>
            <h2>Cryptocurrency Deposit</h2>
            <p>Deposits remain pending until admin approval credits the main wallet.</p>
          </div>
        </div>
        <div class="form-grid" style="margin-top: 14px;">
          <label>Network
            <select id="deposit-network">
              ${cryptoNetworks.map((network) => `<option value="${network.id}">${network.label}</option>`).join("")}
            </select>
          </label>
          <label>Amount
            <input id="deposit-amount" type="number" min="20" step="0.01" value="20" required />
          </label>
        </div>
        <div class="package-grid" style="margin-top: 12px;">
          ${depositPackages
            .map((amount, index) => `<button class="package-button ${index === 0 ? "active" : ""}" type="button" data-package="${amount}">$${amount}</button>`)
            .join("")}
        </div>
        <div class="form-grid" style="margin-top: 14px;">
          <label>TxID / Hash
            <input id="deposit-txid" type="text" placeholder="Blockchain transaction hash" required />
          </label>
          <label>Receipt screenshot
            <input id="deposit-receipt" type="file" accept="image/png,image/jpeg,image/webp,application/pdf" required />
          </label>
        </div>
        <button class="primary-button" style="margin-top: 14px;" type="submit">
          <i data-lucide="upload-cloud"></i>
          <span>إرسال للمراجعة</span>
        </button>
      </form>
      <aside class="panel">
        <div class="section-head">
          <div>
            <h2>Admin Wallet</h2>
            <p>Replace this address in system settings before production.</p>
          </div>
        </div>
        <div class="qr-box" style="margin-top: 14px;">
          <img id="deposit-qr" src="${qrUrl(defaultNetwork.qrSeed)}" alt="Deposit QR code" />
          <strong id="deposit-wallet">${defaultNetwork.wallet}</strong>
          <button class="secondary-button" type="button" data-copy-wallet>Copy</button>
        </div>
      </aside>
    </section>
  `;

  const amountInput = container.querySelector("#deposit-amount");
  const walletLabel = container.querySelector("#deposit-wallet");
  const qrImage = container.querySelector("#deposit-qr");
  const networkSelect = container.querySelector("#deposit-network");

  container.querySelectorAll("[data-package]").forEach((button) => {
    button.addEventListener("click", () => {
      amountInput.value = button.dataset.package;
      container.querySelectorAll("[data-package]").forEach((item) => item.classList.remove("active"));
      button.classList.add("active");
    });
  });

  networkSelect.addEventListener("change", () => {
    const network = cryptoNetworks.find((item) => item.id === networkSelect.value) || defaultNetwork;
    walletLabel.textContent = network.wallet;
    qrImage.src = qrUrl(network.qrSeed);
  });

  container.querySelector("[data-copy-wallet]").addEventListener("click", () => navigator.clipboard.writeText(walletLabel.textContent));
  container.querySelector("#deposit-form").addEventListener("submit", (event) => {
    event.preventDefault();
    onSubmit({
      network: networkSelect.value,
      amount: amountInput.value,
      txId: container.querySelector("#deposit-txid").value,
      receiptFile: container.querySelector("#deposit-receipt").files[0]
    });
  });
}

export function renderWithdraw(container, profile, onSubmit) {
  const wallet = profile?.wallets?.trc20?.address || "";
  container.innerHTML = `
    <form class="panel" id="withdraw-form">
      <div class="section-head">
        <div>
          <h2>Withdrawal</h2>
          <p>Requires bound wallet and fund password. Server deducts balance atomically.</p>
        </div>
        ${wallet ? '<span class="status-pill success">Wallet bound</span>' : '<span class="status-pill warning">Wallet required</span>'}
      </div>
      <div class="form-grid" style="margin-top: 14px;">
        <label>Source wallet
          <select id="withdraw-source">
            <option value="main">Main Wallet</option>
            <option value="commission">Commission Wallet</option>
          </select>
        </label>
        <label>Amount
          <input id="withdraw-amount" type="number" min="10" step="0.01" required />
        </label>
        <label>Wallet Address
          <input id="withdraw-wallet" type="text" value="${wallet}" required />
        </label>
        <label>Fund Password
          <input id="withdraw-password" type="password" required />
        </label>
      </div>
      <button class="primary-button" style="margin-top: 14px;" type="submit">
        <i data-lucide="send"></i>
        <span>إرسال طلب السحب</span>
      </button>
    </form>
  `;

  container.querySelector("#withdraw-form").addEventListener("submit", (event) => {
    event.preventDefault();
    onSubmit({
      sourceWallet: container.querySelector("#withdraw-source").value,
      walletAddress: container.querySelector("#withdraw-wallet").value,
      amount: container.querySelector("#withdraw-amount").value,
      fundPassword: container.querySelector("#withdraw-password").value
    });
  });
}

export function renderTeam(container, profile, report) {
  const invitationCode = profile?.referralCode || "CS-DEMO";
  const referralLink = `${location.origin}${location.pathname}?invite=${invitationCode}`;
  container.innerHTML = `
    <section class="panel">
      <div class="section-head">
        <div>
          <h2>Invitation Network</h2>
          <p>Share your invitation code and track verified 3-tier activity.</p>
        </div>
      </div>
      <div class="form-grid" style="margin-top: 14px;">
        <label>Invitation Code
          <input value="${invitationCode}" readonly />
        </label>
        <label>Referral Link
          <input id="referral-link" value="${referralLink}" readonly />
        </label>
      </div>
      <button class="secondary-button" style="margin-top: 12px;" type="button" data-copy-referral>
        <i data-lucide="copy"></i>
        <span>Copy to Clipboard</span>
      </button>
    </section>
    <section class="metrics-grid">
      ${metricCard("Total Team", report?.total || 0, "")}
      ${metricCard("New Today", report?.newToday || 0, "")}
      ${metricCard("Referral Commission", report?.commissionTotal || 0)}
      ${metricCard("Active VIP Levels", Object.keys(report?.activeVipByLevel || {}).length, "")}
      ${metricCard("Tier Depth", 3, "")}
    </section>
    <section class="tree-grid">
      <div class="tree-node"><strong>Level A | 4%</strong><p class="muted">${report?.levels?.A?.length || 0} direct members</p></div>
      <div class="tree-node"><strong>Level B | 2%</strong><p class="muted">${report?.levels?.B?.length || 0} second-level members</p></div>
      <div class="tree-node"><strong>Level C | 1%</strong><p class="muted">${report?.levels?.C?.length || 0} third-level members</p></div>
    </section>
  `;

  container.querySelector("[data-copy-referral]").addEventListener("click", () => navigator.clipboard.writeText(referralLink));
}

export function renderFund(container, onJoin, onDetails) {
  container.innerHTML = `
    <section class="section-head">
      <div>
        <h2>Investment Chest</h2>
        <p>Plans should be reviewed for local financial compliance before public launch.</p>
      </div>
    </section>
    <section class="fund-grid">
      ${investmentPlans
        .map((plan) => {
          const sample = calculatePlanReturn(plan.minAmount, plan.dailyRate, plan.periodDays);
          return `
            <article class="fund-card">
              <span class="status-pill success">${plan.periodDays} Days</span>
              <h3>${plan.title}</h3>
              <p class="muted">${plan.description}</p>
              <div class="tier-list">
                <span>Daily rate: <strong>${plan.dailyRate}%</strong></span>
                <span>Minimum: <strong>${formatMoney(plan.minAmount)}</strong></span>
                <span>Sample maturity: <strong>${formatMoney(sample.maturity)}</strong></span>
              </div>
              <div class="form-actions">
                <button class="primary-button" type="button" data-join-plan="${plan.id}">Join</button>
                <button class="secondary-button" type="button" data-plan-details="${plan.id}">Details</button>
              </div>
            </article>
          `;
        })
        .join("")}
    </section>
  `;

  container.querySelectorAll("[data-join-plan]").forEach((button) => button.addEventListener("click", () => onJoin(button.dataset.joinPlan)));
  container.querySelectorAll("[data-plan-details]").forEach((button) => button.addEventListener("click", () => onDetails(button.dataset.planDetails)));
}

export function renderRanks(container, onApply) {
  container.innerHTML = `
    <section class="section-head">
      <div>
        <h2>Corporate Ranks</h2>
        <p>Applications create an auditable contract acceptance record.</p>
      </div>
    </section>
    <section class="rank-grid">
      ${ranks
        .map(
          (rank) => `
            <article class="rank-card">
              <span class="status-pill"><i data-lucide="briefcase-business"></i> ${rank.title}</span>
              <h3>${formatMoney(rank.salary)} / month</h3>
              <p class="muted">${rank.milestone}</p>
              <button class="primary-button" type="button" data-apply-rank="${rank.id}">Apply</button>
            </article>
          `
        )
        .join("")}
    </section>
  `;

  container.querySelectorAll("[data-apply-rank]").forEach((button) => {
    button.addEventListener("click", () => onApply(ranks.find((rank) => rank.id === button.dataset.applyRank)));
  });
}

export function renderContractModal({ modalRoot, rank, onAccept, onClose }) {
  modalRoot.innerHTML = `
    <article class="contract-sheet">
      <div class="section-head">
        <div>
          <span class="eyebrow">Employment Contract | اتفاقية العمل</span>
          <h2>${rank.title}</h2>
        </div>
        <button class="icon-button" type="button" data-close-modal aria-label="Close">
          <i data-lucide="x"></i>
        </button>
      </div>
      <div class="contract-body">
        <p>English: The applicant confirms that all team activity, identity details, and accepted responsibilities are accurate. Salary eligibility depends on verified milestones, compliance review, and management approval.</p>
        <p>العربية: يقر مقدم الطلب بصحة بيانات الفريق والهوية والمسؤوليات المقبولة. أهلية الراتب تعتمد على تحقق الشروط ومراجعة الامتثال واعتماد الإدارة.</p>
        <p>Milestone: <strong>${rank.milestone}</strong></p>
      </div>
      <div class="form-actions">
        <button class="primary-button" type="button" data-accept-contract>
          <i data-lucide="signature"></i>
          <span>Agree / Accept</span>
        </button>
        <button class="secondary-button" type="button" data-close-modal>Cancel</button>
      </div>
    </article>
  `;
  modalRoot.querySelectorAll("[data-close-modal]").forEach((button) => button.addEventListener("click", onClose));
  modalRoot.querySelector("[data-accept-contract]").addEventListener("click", () => onAccept(rank.id));
  hydrateIcons();
}

export function renderProfile(container, profile, onBindWallet, onLogout) {
  const balances = profile?.balances || {};
  container.innerHTML = `
    <section class="metrics-grid">
      ${metricCard("Wallet Balance", balances.main)}
      ${metricCard("Commission Balance", balances.commission)}
      ${metricCard("Today's Income", profile?.income?.today)}
      ${metricCard("Month Income", profile?.income?.month)}
      ${metricCard("Total Revenue", profile?.income?.total)}
    </section>
    <section class="hero-grid">
      <form class="panel" id="wallet-form">
        <div class="section-head">
          <div>
            <h2>Account Info</h2>
            <p>Bind wallet, change avatar, and manage secure settings.</p>
          </div>
        </div>
        <div class="form-grid" style="margin-top: 14px;">
          <label>Network
            <select id="wallet-network">
              <option value="TRC20">TRC20</option>
              <option value="EVM">EVM</option>
            </select>
          </label>
          <label>Wallet Address
            <input id="wallet-address" value="${profile?.wallets?.trc20?.address || ""}" />
          </label>
          <label>Fund Password
            <input id="wallet-password" type="password" />
          </label>
        </div>
        <div class="form-actions">
          <button class="primary-button" type="submit"><i data-lucide="link"></i> Bind Wallet</button>
          <button class="secondary-button" type="button" data-logout><i data-lucide="log-out"></i> Logout</button>
        </div>
      </form>
      <aside class="panel">
        <h2>Menu</h2>
        <div class="tier-list">
          <span>Invoice Details | تفاصيل الفاتورة</span>
          <span>Financial Fund logs</span>
          <span>Daily Earning Reports</span>
          <span>Employee Guide text viewer</span>
          <span>App Download link</span>
        </div>
      </aside>
    </section>
  `;

  container.querySelector("#wallet-form").addEventListener("submit", (event) => {
    event.preventDefault();
    onBindWallet({
      network: container.querySelector("#wallet-network").value,
      walletAddress: container.querySelector("#wallet-address").value,
      fundPassword: container.querySelector("#wallet-password").value
    });
  });
  container.querySelector("[data-logout]").addEventListener("click", onLogout);
}

export function renderSimplePanel(container, title, body) {
  container.innerHTML = `<section class="panel"><h2>${title}</h2><p class="muted">${body}</p></section>`;
}

export function showToast(message) {
  const region = document.querySelector("#toast-region");
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = message;
  region.appendChild(toast);
  window.setTimeout(() => toast.remove(), 4200);
}

export function closeModal(modalRoot) {
  modalRoot.innerHTML = "";
}

function metricCard(label, value = 0, currency = "USD") {
  const display = currency ? formatMoney(value, currency) : Number(value || 0).toLocaleString("en-US");
  return `
    <article class="stat-card">
      <span class="metric-label">${label}</span>
      <strong class="metric-value">${display}</strong>
    </article>
  `;
}

function taskPreview(task) {
  return `
    <article>
      <div class="thumbnail">
        <img src="${task.thumbnail}" alt="${task.title}" loading="lazy" />
      </div>
      <div class="task-meta" style="margin-top: 10px;">
        <strong>${task.title}</strong>
        <span class="status-pill">${task.vipRequired}</span>
      </div>
    </article>
  `;
}

function qrUrl(seed) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(seed)}`;
}
