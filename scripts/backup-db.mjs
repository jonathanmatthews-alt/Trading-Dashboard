/**
 * Hot-backup the SQLite database safely while the dashboard is running.
 *
 * Uses better-sqlite3's online .backup() API which acquires the right locks
 * internally, so it's safe even mid-trade-log. Writes to backups/data-<ts>.db
 * and rolls off anything older than KEEP_DAYS (default 30).
 *
 * Usage:
 *   pnpm db:backup
 *   pnpm db:backup -- --keep 60
 *
 * Wire to a daily Task Scheduler job — setup-windows.ps1 does this for you.
 */
import Database from "better-sqlite3";
import { existsSync, mkdirSync, readdirSync, statSync, unlinkSync } from "node:fs";
import path from "node:path";

const SRC = process.env.DB_PATH ?? path.join(process.cwd(), "data.db");
const DEST_DIR = path.join(process.cwd(), "backups");

const keepArg = process.argv.indexOf("--keep");
const KEEP_DAYS =
  keepArg >= 0 ? Math.max(1, Number(process.argv[keepArg + 1])) : 30;

if (!existsSync(SRC)) {
  console.error(`✕ source DB not found: ${SRC}`);
  process.exit(1);
}
if (!existsSync(DEST_DIR)) mkdirSync(DEST_DIR, { recursive: true });

const ts = new Date()
  .toISOString()
  .replace(/[:.]/g, "-")
  .replace("T", "_")
  .slice(0, 19);
const destFile = path.join(DEST_DIR, `data-${ts}.db`);

const sourceDb = new Database(SRC, { readonly: true });
try {
  await sourceDb.backup(destFile);
  const bytes = statSync(destFile).size;
  console.log(`✓ backed up ${SRC} → ${destFile} (${(bytes / 1024).toFixed(1)} KB)`);
} finally {
  sourceDb.close();
}

/* Roll off old backups */
const cutoff = Date.now() - KEEP_DAYS * 24 * 60 * 60 * 1000;
let removed = 0;
for (const name of readdirSync(DEST_DIR)) {
  if (!/^data-.*\.db$/.test(name)) continue;
  const full = path.join(DEST_DIR, name);
  const mtime = statSync(full).mtimeMs;
  if (mtime < cutoff) {
    unlinkSync(full);
    removed++;
  }
}
if (removed > 0) console.log(`  · pruned ${removed} backup(s) older than ${KEEP_DAYS} days`);
