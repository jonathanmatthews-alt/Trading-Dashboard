/**
 * PM2 ecosystem for the Trading Dashboard.
 *
 * Uses npm (not pnpm) because pnpm v10+ silently blocks the native-
 * binding postinstall for better-sqlite3 every time it runs.
 *
 * One-time install (cmd.exe as the same user you trade as):
 *   scripts\setup-windows.cmd
 *
 * Daily ops:
 *   pm2 status                       (list processes)
 *   pm2 logs trading-dashboard       (live log tail)
 *   pm2 restart trading-dashboard
 *   pm2 stop trading-dashboard
 *
 * After pulling new code:
 *   npm install && npm run db:migrate && npm run build && pm2 restart trading-dashboard
 */
module.exports = {
  apps: [
    {
      name: "trading-dashboard",
      /* Use npm to invoke `next start` so package.json scripts stay
         authoritative. cmd /c is required so Windows resolves the npm shim. */
      script: process.platform === "win32" ? "cmd" : "npm",
      args: process.platform === "win32" ? "/c npm start" : "start",
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
