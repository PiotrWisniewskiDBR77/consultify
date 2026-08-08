/**
 * Initiative Auto-Start Job
 *
 * Transitions initiatives from SCHEDULED → EXECUTING when start date is reached.
 *
 * - Runs from Scheduler (cron) in non-test environments
 * - Best-effort: does not fail the scheduler loop
 *
 * ★ INI-005 fix (2026-08-01): this job used to do its own raw
 * `UPDATE initiatives SET status = 'EXECUTING' ...` — a SECOND, unaudited,
 * unauthorized copy of the SCHEDULED->EXECUTING transition with ZERO
 * reference to `decisions`/GO-NO-GO/gate/readiness anywhere in this file. An
 * adversarial review proved live (on real Postgres) that an initiative whose
 * approved GO decision had since been SUPERSEDED by a newer NO-GO decision
 * for the same gate — exactly the rework-cycle scenario the H16 fix's
 * decision-currency logic (`hasApprovedGateDecision`) exists to catch — still
 * got silently flipped to EXECUTING by this job, completely bypassing the
 * canonical engine and its doc-comment claim of being the single choke-point.
 *
 * FIX: this job no longer writes `initiatives.status` itself. It selects
 * candidates (unchanged query, modulo the COALESCE type-cast fix below) and
 * hands EACH one to the SAME `executeInitiativeTransition` engine used by
 * PATCH /:id/status, POST /:id/approve and POST /:id/start-execution, via an
 * explicit, honestly-labeled SYSTEM actor (see `initiativeTransitionService.ts`
 * — `InitiativeTransitionActor`). That actor is narrowly authorized for
 * EXACTLY the START gate and nothing else, and — critically — does NOT skip
 * the GO/NO-GO decision-currency check: if the current decision for the
 * initiative's gate isn't an approved, current `GOVERNANCE_DECISION_MAKING`
 * decision, the transition is refused and the initiative is simply left
 * SCHEDULED (skipped this tick, not an error — it will be picked up again on
 * a later run once/if a fresh GO decision lands).
 */

import { InitiativeStatus } from '../constants/initiativeStatuses.js';
import {
  executeInitiativeTransition,
  type InitiativeTransitionActor,
} from '../services/initiative/initiativeTransitionService.js';
import logger from '../utils/Logger.js';
import * as queryHelpers from '../utils/queryHelpers.js';

// Stable, honest, non-human-impersonating actor identity for this job's
// writes. NOT a UUID that could be mistaken for a real user row — plain
// `system:<feature>` sentinel strings are the established convention in this
// codebase for exactly this situation (see e.g. `automationRulesEngine.ts`'s
// `actorId: 'system'` / `actorType: 'SYSTEM'`, and
// `tabeleConsultingTemplatesSeeder.ts`'s `DEFAULT_SYSTEM_USER_ID =
// 'system:tabele-template-seeder-...'`). Verified live against the acceptance
// Postgres instance: neither `initiative_status_history.changed_by` nor
// `initiative_history.changed_by` (nor any `initiatives.*_by` lifecycle
// column) carries a foreign-key constraint to `users`, so this plain string
// is safe to write and — unlike NULL — remains honestly traceable as a
// system action in every audit row it touches.
const SYSTEM_ACTOR_ID = 'system:initiative-auto-start';
const SYSTEM_ACTOR_LABEL = 'System (initiative auto-start scheduler)';
const SYSTEM_ACTOR: InitiativeTransitionActor = {
  kind: 'system',
  systemActorId: SYSTEM_ACTOR_ID,
  systemActorLabel: SYSTEM_ACTOR_LABEL,
};

export async function autoStartScheduledInitiatives(options: { limit?: number } = {}): Promise<{
  scanned: number;
  started: number;
  skippedMissingDate: number;
  /** Current decision for the gate is missing/pending/NO-GO/stale — the
   *  exact bypass this fix closes. Not an error: the initiative stays
   *  SCHEDULED and will be re-evaluated on a later tick. */
  skippedNoGoDecision: number;
  /** Any other non-throwing refusal from the canonical engine (readiness
   *  block, a concurrent transition already moved the row, etc.). */
  skippedOtherReason: number;
  errors: number;
}> {
  const limit = Number(options.limit ?? 200);
  const nowIso = new Date().toISOString();

  let started = 0;
  let errors = 0;
  let skippedMissingDate = 0;
  let skippedNoGoDecision = 0;
  let skippedOtherReason = 0;

  // Select candidates. Use ISO string comparison (works for ISO timestamps).
  //
  // ★ INI-005 fix (2026-08-01): `planned_start_date` is `text` and
  // `start_date` is `timestamp without time zone` in the live schema (verified
  // against the acceptance Postgres instance) — `COALESCE(planned_start_date,
  // start_date)` therefore throws `COALESCE types text and timestamp without
  // time zone cannot be matched` on every run, which the outer try/catch in
  // the scheduler swallowed silently, meaning this job never actually ran.
  // Casting both sides to `timestamptz` fixes the type mismatch.
  const rows = await queryHelpers.queryAll<any>(
    `SELECT id, organization_id as "organizationId", status, planned_start_date as "plannedStartDate", start_date as "startDate"
     FROM initiatives
     WHERE UPPER(status) = 'SCHEDULED'
     ORDER BY COALESCE(planned_start_date::timestamptz, start_date::timestamptz) ASC
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
      // Single canonical choke-point (INI-005 fix) — same engine, same row
      // lock, same atomic state UPDATE + initiative_status_history +
      // initiative_history writes on one pinned PG client, same GO/NO-GO
      // decision-currency check, as every HTTP transition path. Nothing here
      // duplicates that validation.
      const result = await executeInitiativeTransition({
        orgId,
        initiativeId,
        actorId: SYSTEM_ACTOR_ID,
        nextStatusInput: InitiativeStatus.EXECUTING,
        reason: 'Auto-started by timeline (planned start date reached)',
        actor: SYSTEM_ACTOR,
      });

      if (result.ok === true) {
        started++;
        continue;
      }

      // Not an error — a refusal. Distinguish the GO/NO-GO case (the bypass
      // this fix closes) from everything else so it's observable/countable,
      // not silent. The initiative is simply left SCHEDULED either way.
      if (result.body?.rule === 'GATE_DECISION_REQUIRED') {
        skippedNoGoDecision++;
        logger.info(
          `[initiativeAutoStartJob] skipped ${initiativeId}: no current approved GOVERNANCE_DECISION_MAKING decision`
        );
      } else {
        skippedOtherReason++;
        logger.info(
          `[initiativeAutoStartJob] skipped ${initiativeId}: ${String(
            result.body?.rule || result.body?.error || 'transition refused'
          )}`
        );
      }
    } catch (e: any) {
      errors++;
      logger.error('[initiativeAutoStartJob] Failed to auto-start initiative', {
        initiativeId,
        error: String(e?.message || e),
      });
    }
  }

  return {
    scanned: rows?.length || 0,
    started,
    skippedMissingDate,
    skippedNoGoDecision,
    skippedOtherReason,
    errors,
  };
}

export default { autoStartScheduledInitiatives };
