export const navItems = [
  { route: "home", label: "الرئيسية", icon: "layout-dashboard", title: "لوحة التشغيل" },
  { route: "tasks", label: "المهمة", icon: "play-square", title: "قاعة العمل" },
  { route: "vip", label: "المستوى", icon: "gem", title: "عضويات VIP" },
  { route: "deposit", label: "شحن", icon: "wallet-cards", title: "شحن العملات" },
  { route: "withdraw", label: "سحب", icon: "send", title: "طلب سحب" },
  { route: "team", label: "الفريق", icon: "network", title: "تقرير الفريق" },
  { route: "fund", label: "الصندوق", icon: "landmark", title: "صندوق الاستثمار" },
  { route: "rank", label: "المنصب", icon: "briefcase-business", title: "منصب الشركة" },
  { route: "profile", label: "حسابي", icon: "user-cog", title: "حسابي" }
];

export const mobileNavRoutes = ["home", "tasks", "vip", "team", "profile"];

export const banners = [
  {
    title: "منصة مهام واستثمارات بإدارة مالية محمية",
    kicker: "Secure Cloudflare Architecture",
    body: "كل عملية مالية حساسة تمر عبر Cloudflare Worker مع سجل Ledger قابل للتدقيق.",
    image:
      "https://images.unsplash.com/photo-1642427749670-f20e2e76ed8c?auto=format&fit=crop&w=1600&q=80"
  },
  {
    title: "واجهات عربية وإنجليزية جاهزة للتوسع",
    kicker: "Mobile-first SPA",
    body: "تصميم داكن/فاتح، تنقل سفلي، بطاقات VIP، ومركز مهام سريع وواضح.",
    image:
      "https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=1600&q=80"
  },
  {
    title: "نظام إحالة بثلاث طبقات مع تقارير دقيقة",
    kicker: "Team intelligence",
    body: "لا يتم احتساب العمولات إلا من عمليات معتمدة ومؤرشفة داخل الخادم.",
    image:
      "https://images.unsplash.com/photo-1556155092-490a1ba16284?auto=format&fit=crop&w=1600&q=80"
  }
];

export const newsItems = [
  "سياسة السحب: تتم مراجعة الطلبات خلال يوم عمل بعد اعتماد بيانات المحفظة.",
  "إشعار أمان: لا تشارك كلمة مرور الأموال أو TxID مع أي شخص خارج المنصة.",
  "تحديث العضويات: تمت إضافة مستويات M8-M10 في صفحة VIP."
];

export const quickActions = [
  { route: "deposit", label: "شحن", icon: "plus-circle" },
  { route: "withdraw", label: "سحب", icon: "arrow-up-right" },
  { route: "team", label: "دعوة", icon: "user-plus" },
  { route: "profile", label: "دليل الموظف", icon: "book-open" },
  { route: "rank", label: "أخبار الشركة", icon: "newspaper" },
  { route: "profile", label: "ملف الشركة", icon: "building-2" }
];

export const vipLevels = [
  { id: "M0", price: 0, dailyTasks: 1, reward: 0.25, featured: false },
  { id: "M1", price: 20, dailyTasks: 2, reward: 0.55, featured: false },
  { id: "M2", price: 125, dailyTasks: 5, reward: 1.0, featured: true },
  { id: "M3", price: 250, dailyTasks: 8, reward: 1.35, featured: false },
  { id: "M4", price: 700, dailyTasks: 14, reward: 2.2, featured: false },
  { id: "M5", price: 2300, dailyTasks: 22, reward: 4.0, featured: false },
  { id: "M6", price: 5000, dailyTasks: 32, reward: 6.5, featured: false },
  { id: "M7", price: 9000, dailyTasks: 44, reward: 8.75, featured: false },
  { id: "M8", price: 15000, dailyTasks: 58, reward: 11.0, featured: false },
  { id: "M9", price: 25000, dailyTasks: 72, reward: 15.0, featured: false },
  { id: "M10", price: 50000, dailyTasks: 100, reward: 21.0, featured: false }
].map((level) => ({
  ...level,
  dailyProfit: +(level.dailyTasks * level.reward).toFixed(2),
  monthlyProfit: +(level.dailyTasks * level.reward * 30).toFixed(2),
  yearlyProfit: +(level.dailyTasks * level.reward * 365).toFixed(2)
}));

export const catalogTasks = [
  {
    id: "task-trailer-001",
    title: "Mission Brief Trailer",
    category: "Movie Trailers",
    vipRequired: "M0",
    reward: 0.25,
    durationSeconds: 12,
    thumbnail:
      "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=900&q=80",
    videoUrl: "https://www.youtube.com/embed/ysz5S6PUM-U"
  },
  {
    id: "task-short-002",
    title: "Market Product Clip",
    category: "Short Videos",
    vipRequired: "M1",
    reward: 0.55,
    durationSeconds: 12,
    thumbnail:
      "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=900&q=80",
    videoUrl: "https://www.youtube.com/embed/jNQXAC9IVRw"
  },
  {
    id: "task-cinema-003",
    title: "Cinema Release Promo",
    category: "Premium Videos",
    vipRequired: "M2",
    reward: 1,
    durationSeconds: 12,
    thumbnail:
      "https://images.unsplash.com/photo-1505686994434-e3cc5abf1330?auto=format&fit=crop&w=900&q=80",
    videoUrl: "https://www.youtube.com/embed/tgbNymZ7vqY"
  }
];

export const payoutFeed = [
  { user: "75300*****", amount: 37, label: "earned" },
  { user: "81142*****", amount: 12.5, label: "completed tasks worth" },
  { user: "69073*****", amount: 74, label: "received approved payout" },
  { user: "92815*****", amount: 19, label: "earned" },
  { user: "54298*****", amount: 43.75, label: "completed tasks worth" }
];

export const depositPackages = [20, 125, 250, 700, 2300, 5000, 9000];

export const cryptoNetworks = [
  {
    id: "USDT_TRC20",
    label: "USDT - TRC20",
    wallet: "0xf4eca9ac6d3df1aed0d819e16ad9214448ae4cd0",
    qrSeed: "BINANCE_USDT_BSC_0xf4eca9ac6d3df1aed0d819e16ad9214448ae4cd0"
  },
  {
    id: "USDC_ETH",
    label: "USDC - Ethereum",
    wallet: "0xf4eca9ac6d3df1aed0d819e16ad9214448ae4cd0",
    qrSeed: "USDC_ETH_0xf4eca9ac6d3df1aed0d819e16ad9214448ae4cd0"
  }
];

export const investmentPlans = [
  {
    id: "doomsday-180",
    title: "Avengers: Doomsday Plan",
    periodDays: 180,
    dailyRate: 2,
    minAmount: 100,
    description:
      "خطة أصول ثابتة بعائد يومي محسوب ومقفل حتى تاريخ الاستحقاق. يتم إرجاع أصل المبلغ مع الفائدة عند نهاية الفترة."
  },
  {
    id: "sapphire-90",
    title: "Sapphire Growth Plan",
    periodDays: 90,
    dailyRate: 1.2,
    minAmount: 50,
    description:
      "خطة قصيرة المدى للمتابعة التجريبية، مناسبة للحسابات التي تحتاج دورة أسرع ومخاطر أقل."
  },
  {
    id: "emerald-365",
    title: "Emerald Reserve",
    periodDays: 365,
    dailyRate: 2.5,
    minAmount: 500,
    description:
      "خطة طويلة المدى بعائد أعلى، تتطلب مراجعة شروط الامتثال قبل التفعيل."
  }
];

export const ranks = [
  {
    id: "team-leader",
    title: "Team Leader",
    salary: 150,
    milestone: "12 active Level A downlines"
  },
  {
    id: "team-captain",
    title: "Team Captain",
    salary: 350,
    milestone: "30 active Level A downlines and 5 M3 members"
  },
  {
    id: "team-supervisor",
    title: "Team Supervisor",
    salary: 700,
    milestone: "80 active team members across 3 levels"
  },
  {
    id: "junior-manager",
    title: "Junior Manager",
    salary: 1200,
    milestone: "Three Team Captains in direct organization"
  },
  {
    id: "regional-manager",
    title: "Regional Manager",
    salary: 2500,
    milestone: "Regional volume and compliance review"
  },
  {
    id: "marketing-director",
    title: "Marketing Director",
    salary: 5000,
    milestone: "Executive approval and verified marketing network"
  }
];
