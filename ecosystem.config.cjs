/**
 * PM2 ecosystem for the Trading Dashboard.
 *
 * One-time install (PowerShell as the same user you trade as):
 *   npm install -g pm2 pm2-windows-startup
 *   pnpm install
 *   pnpm db:migrate
 *   pnpm db:seed          # only first time on a fresh data.db
 *   pnpm build
 *   pnpm start:pm2        # registers the process + saves dump
 *   pm2-startup install   # boot resurrection on Windows
 *
 * Daily ops:
 *   pm2 status            # list processes
 *   pm2 logs trading-dashboard
 *   pm2 restart trading-dashboard
 *   pm2 stop trading-dashboard
 *
 * After pulling new code:
 *   pnpm install && pnpm db:migrate && pnpm build && pm2 restart trading-dashboard
 */
module.exports = {
  apps: [
    {
      name: "trading-dashboard",
      /* Use pnpm to invoke `next start` so package.json scripts stay
         authoritative. cmd /c is required so Windows resolves the pnpm shim. */
      script: process.platform === "win32" ? "cmd" : "pnpm",
      args: process.platform === "win32" ? "/c pnpm start" : "start",
      cwd: __dirname,
      env: {
        NODE_ENV: "production",
        PORT: "3000",
      },
      autorestart: true,
      max_restarts: 10,
      min_uptime: "30s",
      max_memory_restart: "512M",
      out_file: "./logs/out.log",
      error_file: "./logs/error.log",
      merge_logs: true,
      time: true,
    },
  ],
};
