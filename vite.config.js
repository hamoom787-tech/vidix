import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        app: resolve(__dirname, "index.html"),
        auth: resolve(__dirname, "auth.html"),
        tasks: resolve(__dirname, "tasks.html"),
        watch: resolve(__dirname, "watch.html"),
        vip: resolve(__dirname, "vip.html"),
        deposit: resolve(__dirname, "deposit.html"),
        withdraw: resolve(__dirname, "withdraw.html"),
        profile: resolve(__dirname, "profile.html"),
        wallet: resolve(__dirname, "wallet.html"),
        fundPassword: resolve(__dirname, "fund-password.html"),
        invoice: resolve(__dirname, "invoice.html"),
        fund: resolve(__dirname, "fund.html"),
        team: resolve(__dirname, "team.html"),
        rank: resolve(__dirname, "rank.html"),
        guide: resolve(__dirname, "guide.html"),
        about: resolve(__dirname, "about.html"),
        certificates: resolve(__dirname, "certificates.html"),
        admin: resolve(__dirname, "admin.html")
      }
    }
  }
});
