/**
 * Initiative due-date breach cron (M13 Depth · Seria R · R4 / E3 — domknięcie).
 *
 * Wires the pre-built `initiativeDueBreachService` (pure scan + idempotency) to a
 * real Postgres/SQLite back-end and exposes `runDueBreachScan()` for the
 * Scheduler. The scan finds overdue, still-open initiative tasks and fires
 * `notifyDueBreach` once per breach, recording `due_breach_notified_for` so a
 * daily run never re-spams the same due date.
 *
 * SAFE BY DEFAULT: the Scheduler only invokes this when
 * `INITIATIVE_DUE_BREACH_CRON_ENABLED === 'true'` (behavioural change → behind a
 * flag per the M13 DoD). The idempotency column is lazy-ensured (additive,
 * fail-safe) so no separate migration step is required.
 */
import {
  type DueBreachCandidate,
  type DueBreachDeps,
  type DueBreachResult,
  scanAndNotifyDueBreaches,
} from '../services/initiative/initiativeDueBreachService.js';
import { notifyDueBreach } from '../services/initiative/initiativeNotificationService.js';
import Logger from '../utils/Logger.js';
import * as queryHelpers from '../utils/queryHelpers.js';

const LOG = '[cron:initiative-due-breach]';
const NOTIFIED_COL = 'due_breach_notified_for';

/** Lazy-ensure the idempotency column on `tasks` (additive, fail-safe). */
async function ensureNotifiedColumn(): Promise<boolean> {
  try {
    const cols = await queryHelpers.getTableColumns('tasks');
    if (cols.some((c) => c.name === NOTIFIED_COL)) return true;
    await queryHelpers.queryRun(`ALTER TABLE tasks ADD COLUMN ${NOTIFIED_COL} TEXT`);
    Logger.info(`${LOG} added ${NOTIFIED_COL} column to tasks`);
    return true;
  } catch (e: any) {
    const msg = String(e?.message || e || '').toLowerCase();
    // Already present (race / dialect) → fine.
    if (msg.includes('exist') || msg.includes('duplicate')) return true;
    Logger.warn(`${LOG} ensureNotifiedColumn failed:`, e?.message);
    return false;
  }
}

const TERMINAL_SQL = "('DONE','COMPLETED','CANCELLED','CANCELED','ARCHIVED','CLOSED')";

/** DB-backed dependencies for the pure scan. */
export function buildDeps(hasNotifiedCol: boolean): DueBreachDeps {
  return {
    async fetchCandidates(now: Date): Promise<DueBreachCandidate[]> {
      const nowIso = now.toISOString();
      const notifiedSelect = hasNotifiedCol ? `t.${NOTIFIED_COL}` : 'NULL';
      const rows = await queryHelpers.queryAll<any>(
        `SELECT t.id          AS itemId,
                t.title       AS itemTitle,
                t.due_date    AS dueDate,
                t.status      AS status,
                t.initiative_id AS initiativeId,
                i.organization_id AS organizationId,
                i.owner_business_id  AS ownerBusinessId,
                i.owner_execution_id AS ownerExecutionId,
                i.sponsor_id         AS sponsorId,
                ${notifiedSelect} AS lastNotifiedDueDate
         FROM tasks t
         JOIN initiatives i ON i.id = t.initiative_id
         WHERE t.due_date IS NOT NULL
           AND t.due_date < ?
           AND COALESCE(UPPER(CAST(t.status AS TEXT)), '') NOT IN ${TERMINAL_SQL}`,
        [nowIso]
      );
      return (rows || []).map((r) => ({
        itemId: String(r.itemId),
        initiativeId: String(r.initiativeId),
        organizationId: String(r.organizationId),
        itemTitle: String(r.itemTitle || 'Task'),
        dueDate: r.dueDate ?? null,
        status: r.status ?? null,
        recipients: [r.ownerBusinessId, r.ownerExecutionId, r.sponsorId],
        lastNotifiedDueDate: r.lastNotifiedDueDate ?? null,
      }));
    },

    async notify(c: DueBreachCandidate): Promise<void> {
      await notifyDueBreach(
        c.organizationId,
        c.initiativeId,
        c.itemTitle,
        String(c.dueDate || ''),
        c.recipients
      );
    },

    markNotified: hasNotifiedCol
      ? async (c: DueBreachCandidate): Promise<void> => {
          await queryHelpers.queryRun(`UPDATE tasks SET ${NOTIFIED_COL} = ? WHERE id = ?`, [
            String(c.dueDate || ''),
            c.itemId,
          ]);
        }
      : undefined,
  };
}

/** Entry point for the Scheduler. Fail-safe: never throws. */
export async function runDueBreachScan(now: Date = new Date()): Promise<DueBreachResult> {
  const hasCol = await ensureNotifiedColumn();
  const deps = buildDeps(hasCol);
  return scanAndNotifyDueBreaches(now, deps);
}

export default runDueBreachScan;
