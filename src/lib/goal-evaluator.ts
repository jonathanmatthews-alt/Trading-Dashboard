import "server-only";
import { db, schema } from "@/db/client";
import { and, eq, sql } from "drizzle-orm";

/**
 * Mechanical goal definition shapes (decoded from goals.mechanicalDef JSON).
 */
type MechanicalDef =
  | { kind: "no_trade_after"; time: string /* "HH:MM" 24h */ }
  | { kind: "max_trades_per_day"; n: number }
  | { kind: "no_mistake_tag"; mistake: string };

function parseDef(raw: string | null): MechanicalDef | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as MechanicalDef;
    if (
      v.kind === "no_trade_after" ||
      v.kind === "max_trades_per_day" ||
      v.kind === "no_mistake_tag"
    ) {
      return v;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Compare an entry timestamp ("YYYY-MM-DDTHH:MM[:SS]") to a "HH:MM" cutoff
 * for the same date. Returns true if the trade was opened AT OR AFTER the
 * cutoff time on the date.
 */
function entryAtOrAfter(entryTime: string, cutoff: string): boolean {
  const entryHm = entryTime.slice(11, 16); // "HH:MM"
  return entryHm >= cutoff;
}

/**
 * Re-evaluate every mechanical goal for `dateIso` against the day's trades
 * and write the result into `goalDailyChecks`. Idempotent: replaces any
 * existing row for (goalId, dateIso). Reflective goals are not touched —
 * their daily check rows come from manual UI input.
 */
export async function evaluateGoalsForDate(dateIso: string): Promise<{
  evaluated: number;
}> {
  const goals = await db
    .select()
    .from(schema.goals)
    .where(and(eq(schema.goals.archived, false), eq(schema.goals.type, "mechanical")));
  if (goals.length === 0) return { evaluated: 0 };

  /* Load the day's trade events. */
  const events = await db
    .select()
    .from(schema.tradeEvents)
    .where(sql`substr(${schema.tradeEvents.entryTime}, 1, 10) = ${dateIso}`);
  const eventIds = events.map((e) => e.id);

  /* Mistake tags on those events (only needed if any goal uses no_mistake_tag). */
  const usesMistakeGoal = goals.some(
    (g) => parseDef(g.mechanicalDef)?.kind === "no_mistake_tag",
  );
  let mistakeRows: { tradeEventId: number; name: string }[] = [];
  if (usesMistakeGoal && eventIds.length > 0) {
    const rows = await db
      .select({
        tradeEventId: schema.tradeEventMistakes.tradeEventId,
        name: schema.mistakes.name,
      })
      .from(schema.tradeEventMistakes)
      .leftJoin(
        schema.mistakes,
        eq(schema.tradeEventMistakes.mistakeId, schema.mistakes.id),
      );
    mistakeRows = rows
      .filter(
        (r): r is { tradeEventId: number; name: string } =>
          r.name != null && eventIds.includes(r.tradeEventId),
      );
  }

  let evaluated = 0;
  for (const goal of goals) {
    const def = parseDef(goal.mechanicalDef);
    if (!def) continue;

    let passed = true;
    if (def.kind === "no_trade_after") {
      passed = !events.some((e) => entryAtOrAfter(e.entryTime, def.time));
    } else if (def.kind === "max_trades_per_day") {
      passed = events.length <= def.n;
    } else if (def.kind === "no_mistake_tag") {
      passed = !mistakeRows.some((r) => r.name === def.mistake);
    }

    /* Upsert via delete-then-insert (no unique constraint on the table). */
    await db
      .delete(schema.goalDailyChecks)
      .where(
        and(
          eq(schema.goalDailyChecks.goalId, goal.id),
          eq(schema.goalDailyChecks.date, dateIso),
        ),
      );
    await db.insert(schema.goalDailyChecks).values({
      goalId: goal.id,
      date: dateIso,
      passed,
      autoChecked: true,
    });
    evaluated++;
  }

  return { evaluated };
}

/**
 * Manual mark for reflective goals. Replaces any existing row.
 */
export async function setReflectiveCheck(
  goalId: number,
  dateIso: string,
  passed: boolean,
): Promise<void> {
  await db
    .delete(schema.goalDailyChecks)
    .where(
      and(
        eq(schema.goalDailyChecks.goalId, goalId),
        eq(schema.goalDailyChecks.date, dateIso),
      ),
    );
  await db.insert(schema.goalDailyChecks).values({
    goalId,
    date: dateIso,
    passed,
    autoChecked: false,
  });
}
