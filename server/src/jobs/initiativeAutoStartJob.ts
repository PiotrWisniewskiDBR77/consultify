/**
 * Initiative Auto-Start Job
 *
 * Transitions initiatives from SCHEDULED → EXECUTING when start date is reached.
 *
 * - Runs from Scheduler (cron) in non-test environments
 * - Best-effort: does not fail the scheduler loop
 * - Writes audit trail to initiative_status_history when available
 */

import { v4 as uuidv4 } from 'uuid';

import { GateType, InitiativeStatus } from '../constants/initiativeStatuses.js';
import logger from '../utils/Logger.js';
import * as queryHelpers from '../utils/queryHelpers.js';

export async function autoStartScheduledInitiatives(options: { limit?: number } = {}): Promise<{
  scanned: number;
  started: number;
  skippedMissingDate: number;
  errors: number;
}> {
  const limit = Number(options.limit ?? 200);
  const nowIso = new Date().toISOString();

  let started = 0;
  let errors = 0;
  let skippedMissingDate = 0;

  // Select candidates. Use ISO string comparison (works for ISO timestamps).
  const rows = await queryHelpers.queryAll<any>(
    `SELECT id, organization_id as "organizationId", status, planned_start_date as "plannedStartDate", start_date as "startDate"
     FROM initiatives
     WHERE UPPER(status) = 'SCHEDULED'
     ORDER BY COALESCE(planned_start_date, start_date) ASC
     LIMIT ?`,
    [limit]
  );

  for (const r of rows || []) {
    const initiativeId = String(r.id);
    const orgId = String(r.organizationId);
    const startDate = r.startDate ? String(r.startDate) : null;
    const plannedStartDate = r.plannedStartDate ? String(r.plannedStartDate) : null;
    const effectiveStart = plannedStartDate || startDate;

    if (!effectiveStart) {
      skippedMissingDate++;
      continue;
    }

    // Only start when start date is reached
    if (String(effectiveStart) > nowIso) {
      continue;
    }

    try {
      const now = new Date().toISOString();

      // Update status only if still SCHEDULED (idempotent)
      const updateRes = await queryHelpers.queryRun(
        `UPDATE initiatives
         SET status = ?, updated_at = ?, execution_started_at = ?
         WHERE id = ? AND organization_id = ? AND UPPER(status) = 'SCHEDULED'`,
        [InitiativeStatus.EXECUTING, now, now, initiativeId, orgId]
      );

      // Some drivers return { changes }, some return void. We treat "no throw" as ok.
      const changes = Number((updateRes as any)?.changes ?? 1);
      if (changes <= 0) continue;

      started++;

      // Audit trail (best-effort)
      try {
        const historyId = uuidv4();
        await queryHelpers.queryRun(
          `INSERT INTO initiative_status_history (id, initiative_id, organization_id, from_status, to_status, changed_by, reason, gate_type, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            historyId,
            initiativeId,
            orgId,
            InitiativeStatus.SCHEDULED,
            InitiativeStatus.EXECUTING,
            null,
            'Auto-started by timeline (planned start date reached)',
            GateType.START,
            now,
          ]
        );
      } catch {
        // best-effort
      }
    } catch (e: any) {
      errors++;
      logger.error('[InitiativeAutoStartJob] Failed to auto-start initiative', {
        initiativeId,
        error: String(e?.message || e),
      });
    }
  }

  return { scanned: rows?.length || 0, started, skippedMissingDate, errors };
}

export default { autoStartScheduledInitiatives };
