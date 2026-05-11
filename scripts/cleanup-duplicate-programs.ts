/**
 * One-time cleanup: merge duplicate `programs` rows (introduced by a prior
 * non-idempotent seed run). For each (firmId, name) group, keep the lowest
 * id and reassign rule_templates + accounts referencing the duplicates to
 * the canonical id, then delete the duplicates.
 *
 * Safe to re-run. After this completes, the idempotent seed in seed.ts
 * prevents recurrence.
 */
import Database from "better-sqlite3";

const sqlite = new Database("data.db");
sqlite.pragma("foreign_keys = ON");

const programs = sqlite
  .prepare("SELECT id, firm_id, name FROM programs ORDER BY id")
  .all() as { id: number; firm_id: number; name: string }[];

const canonByKey = new Map<string, number>();
for (const p of programs) {
  const key = `${p.firm_id}:${p.name}`;
  if (!canonByKey.has(key)) canonByKey.set(key, p.id);
}

const updateTpl = sqlite.prepare(
  "UPDATE rule_templates SET program_id = ? WHERE program_id = ?",
);
const updateAcct = sqlite.prepare(
  "UPDATE accounts SET program_id = ? WHERE program_id = ?",
);
const deleteProg = sqlite.prepare("DELETE FROM programs WHERE id = ?");

let removed = 0;
let reassignedTpls = 0;
let reassignedAccts = 0;

sqlite.transaction(() => {
  for (const p of programs) {
    const key = `${p.firm_id}:${p.name}`;
    const canon = canonByKey.get(key)!;
    if (p.id === canon) continue;
    const tplInfo = updateTpl.run(canon, p.id);
    reassignedTpls += Number(tplInfo.changes);
    const acctInfo = updateAcct.run(canon, p.id);
    reassignedAccts += Number(acctInfo.changes);
    deleteProg.run(p.id);
    removed++;
  }
})();

console.log(
  `cleaned ${removed} duplicate programs · ${reassignedTpls} rule_templates moved · ${reassignedAccts} accounts moved`,
);

/* Also dedupe rule_templates that share the same (program_id, stage_type, version)
   — possible if cleanup above moved two duplicates into the same canonical slot. */
const tpls = sqlite
  .prepare(
    "SELECT id, program_id, stage_type, version FROM rule_templates ORDER BY id",
  )
  .all() as {
  id: number;
  program_id: number;
  stage_type: string;
  version: number;
}[];
const tplCanon = new Map<string, number>();
const tplToDelete: number[] = [];
for (const t of tpls) {
  const key = `${t.program_id}:${t.stage_type}:${t.version}`;
  if (tplCanon.has(key)) {
    tplToDelete.push(t.id);
  } else {
    tplCanon.set(key, t.id);
  }
}
if (tplToDelete.length > 0) {
  const moveAcctTpl = sqlite.prepare(
    "UPDATE accounts SET rule_template_id = ? WHERE rule_template_id = ?",
  );
  const delTpl = sqlite.prepare("DELETE FROM rule_templates WHERE id = ?");
  sqlite.transaction(() => {
    for (const dupId of tplToDelete) {
      const dup = tpls.find((t) => t.id === dupId)!;
      const key = `${dup.program_id}:${dup.stage_type}:${dup.version}`;
      const canon = tplCanon.get(key)!;
      moveAcctTpl.run(canon, dupId);
      delTpl.run(dupId);
    }
  })();
  console.log(`cleaned ${tplToDelete.length} duplicate rule_templates`);
}

sqlite.close();
console.log("✓ cleanup complete");
