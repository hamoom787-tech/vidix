import {
  applyForCorporateRank,
  bindCryptoWallet,
  claimTaskReward,
  confirmPhoneCode,
  createWatchTimer,
  getTeamReport,
  joinInvestmentPlan,
  loginWithEmail,
  logout,
  signUpWithEmail,
  startPhoneVerification,
  submitDeposit,
  submitWithdrawal,
  upgradeMembership,
  watchAuth,
  watchUserProfile
} from "./platform-controller";
import { investmentPlans } from "./data/catalog";
import {
  closeModal,
  hydrateIcons,
  renderContractModal,
  renderDeposit,
  renderFund,
  renderHome,
  renderNavigation,
  renderProfile,
  renderRanks,
  renderTaskModal,
  renderTasks,
  renderTeam,
  renderVip,
  renderWithdraw,
  showToast
} from "./ui/components";
import { activatePage, createRouter, updatePageTitle } from "./ui/router";

const state = {
  authMode: "login",
  authChannel: "email",
  phoneConfirmation: null,
  user: null,
  profile: null,
  unsubscribeProfile: null,
  teamReport: null
};

const elements = {
  shell: document.querySelector(".app-shell"),
  authPanel: document.querySelector("#auth-panel"),
  appContent: document.querySelector("#app-content"),
  authForm: document.querySelector("#auth-form"),
  desktopNav: document.querySelector("#desktop-nav"),
  mobileNav: document.querySelector("#mobile-nav"),
  modalRoot: document.querySelector("#modal-root"),
  sidebar: document.querySelector(".sidebar")
};

const router = createRouter({
  onRouteChange: (route) => {
    activatePage(route);
    updatePageTitle(route);
    renderNavigation({
      desktopEl: elements.desktopNav,
      mobileEl: elements.mobileNav,
      activeRoute: route,
      onNavigate: router.navigate
    });
    renderRoute(route);
    elements.sidebar.classList.remove("open");
  }
});

bootstrap();

function bootstrap() {
  hydrateIcons();
  bindChromeEvents();
  bindAuthEvents();

  watchAuth((user) => {
    state.user = user;
    elements.authPanel.classList.toggle("hidden", Boolean(user));
    elements.appContent.classList.toggle("hidden", !user);

    if (state.unsubscribeProfile) state.unsubscribeProfile();
    if (!user) {
      state.profile = null;
      return;
    }

    state.unsubscribeProfile = watchUserProfile(user.uid, async (profile) => {
      state.profile = profile;
      document.querySelector("#profile-initials").textContent = initials(profile?.displayName || user.email || "CS");
      state.teamReport = await getTeamReport().catch(() => null);
      router.start();
    });
  });

  router.start();
  startSliderLoop();
}

function bindChromeEvents() {
  document.querySelector("#theme-toggle").addEventListener("click", () => {
    const nextTheme = elements.shell.dataset.theme === "dark" ? "light" : "dark";
    elements.shell.dataset.theme = nextTheme;
    localStorage.setItem("theme", nextTheme);
  });

  elements.shell.dataset.theme = localStorage.getItem("theme") || "dark";
  document.querySelector("#menu-toggle").addEventListener("click", () => elements.sidebar.classList.toggle("open"));
  document.querySelector("#profile-chip").addEventListener("click", () => router.navigate("profile"));
}

function bindAuthEvents() {
  document.querySelectorAll("[data-auth-mode]").forEach((button) => {
    button.addEventListener("click", () => {
      state.authMode = button.dataset.authMode;
      document.querySelectorAll("[data-auth-mode]").forEach((segment) => segment.classList.remove("active"));
      button.classList.add("active");
      document.querySelectorAll(".signup-only").forEach((item) => item.classList.toggle("hidden", state.authMode !== "signup"));
      document.querySelector("#auth-submit-label").textContent = state.authMode === "signup" ? "إنشاء حساب" : "دخول آمن";
    });
  });

  document.querySelectorAll("[data-auth-channel]").forEach((button) => {
    button.addEventListener("click", () => {
      state.authChannel = button.dataset.authChannel;
      document.querySelectorAll("[data-auth-channel]").forEach((segment) => segment.classList.remove("active"));
      button.classList.add("active");
      document.querySelectorAll(".email-auth-field").forEach((item) => item.classList.toggle("hidden", state.authChannel !== "email"));
      document.querySelectorAll(".phone-auth-field").forEach((item) => item.classList.toggle("hidden", state.authChannel !== "phone"));
      document.querySelector("#auth-email").required = state.authChannel === "email";
      document.querySelector("#auth-password").required = state.authChannel === "email";
    });
  });

  document.querySelector("#send-otp-button").addEventListener("click", async () => {
    try {
      state.phoneConfirmation = await startPhoneVerification(document.querySelector("#auth-phone").value);
      showToast("SMS code sent.");
    } catch (error) {
      showToast(error.message || "Could not send SMS code.");
    }
  });

  elements.authForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const payload = {
      email: document.querySelector("#auth-email").value,
      password: document.querySelector("#auth-password").value,
      referralCode: document.querySelector("#auth-referral").value,
      fundPassword: document.querySelector("#auth-fund-password").value,
      otpCode: document.querySelector("#auth-otp").value
    };

    try {
      if (state.authChannel === "phone") {
        await confirmPhoneCode({
          confirmationResult: state.phoneConfirmation,
          otpCode: payload.otpCode,
          mode: state.authMode,
          referralCode: payload.referralCode,
          fundPassword: payload.fundPassword
        });
        showToast(state.authMode === "signup" ? "Phone account created securely." : "Phone sign-in complete.");
      } else if (state.authMode === "signup") {
        await signUpWithEmail(payload);
        showToast("Account created securely.");
      } else {
        await loginWithEmail(payload);
        showToast("Signed in.");
      }
    } catch (error) {
      showToast(error.message || "Authentication failed.");
    }
  });
}

function renderRoute(route) {
  const profile = state.profile || {};
  const page = document.querySelector(`[data-route="${route}"]`);
  if (!page) return;

  const actions = {
    home: () => {
      renderHome(page, profile);
      page.querySelectorAll("[data-route]").forEach((button) => button.addEventListener("click", () => router.navigate(button.dataset.route)));
      hydrateIcons();
    },
    tasks: () => {
      renderTasks(page, (task) => {
        renderTaskModal({
          modalRoot: elements.modalRoot,
          task,
          onStartTimer: createWatchTimer,
          onClose: () => closeModal(elements.modalRoot),
          onClaim: async (taskId) => {
            try {
              await claimTaskReward(taskId);
              showToast("Reward claimed and sent for secure ledger update.");
              closeModal(elements.modalRoot);
            } catch (error) {
              showToast(error.message || "Task claim failed.");
            }
          }
        });
      });
      hydrateIcons();
    },
    vip: () => {
      renderVip(page, async (levelId) => {
        try {
          await upgradeMembership(levelId);
          showToast(`${levelId} upgrade requested.`);
        } catch (error) {
          showToast(error.message || "Upgrade failed.");
        }
      });
      hydrateIcons();
    },
    deposit: () => {
      renderDeposit(page, async (payload) => {
        try {
          await submitDeposit(payload);
          showToast("Deposit submitted for admin approval.");
        } catch (error) {
          showToast(error.message || "Deposit submission failed.");
        }
      });
      hydrateIcons();
    },
    withdraw: () => {
      renderWithdraw(page, profile, async (payload) => {
        try {
          await submitWithdrawal(payload);
          showToast("Withdrawal request created.");
        } catch (error) {
          showToast(error.message || "Withdrawal failed.");
        }
      });
      hydrateIcons();
    },
    team: () => {
      renderTeam(page, profile, state.teamReport);
      hydrateIcons();
    },
    fund: () => {
      renderFund(
        page,
        async (planId) => {
          const amount = window.prompt("Investment amount in USD");
          if (!amount) return;
          try {
            await joinInvestmentPlan({ planId, amount });
            showToast("Investment request created.");
          } catch (error) {
            showToast(error.message || "Investment failed.");
          }
        },
        (planId) => {
          const plan = investmentPlans.find((item) => item.id === planId);
          if (!plan) return;
          elements.modalRoot.innerHTML = `<article class="contract-sheet"><h2>${plan.title}</h2><p class="muted">${plan.description}</p><button class="primary-button" type="button" data-close-modal>Close</button></article>`;
          elements.modalRoot.querySelector("[data-close-modal]").addEventListener("click", () => closeModal(elements.modalRoot));
        }
      );
      hydrateIcons();
    },
    rank: () => {
      renderRanks(page, (rank) => {
        renderContractModal({
          modalRoot: elements.modalRoot,
          rank,
          onClose: () => closeModal(elements.modalRoot),
          onAccept: async (rankId) => {
            try {
              await applyForCorporateRank(rankId);
              showToast("Contract accepted and application logged.");
              closeModal(elements.modalRoot);
            } catch (error) {
              showToast(error.message || "Rank application failed.");
            }
          }
        });
      });
      hydrateIcons();
    },
    profile: () => {
      renderProfile(
        page,
        profile,
        async (payload) => {
          try {
            await bindCryptoWallet(payload);
            showToast("Wallet binding request completed.");
          } catch (error) {
            showToast(error.message || "Wallet binding failed.");
          }
        },
        logout
      );
      hydrateIcons();
    }
  };

  actions[route]?.();
}

function startSliderLoop() {
  window.setInterval(() => {
    const slides = [...document.querySelectorAll(".slide")];
    if (!slides.length) return;
    const activeIndex = slides.findIndex((slide) => slide.classList.contains("active"));
    slides[activeIndex]?.classList.remove("active");
    slides[(activeIndex + 1) % slides.length].classList.add("active");
  }, 5200);
}

function initials(value) {
  return String(value)
    .split(/[ @._-]/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}
