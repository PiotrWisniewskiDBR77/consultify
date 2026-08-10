/**
 * OKR-E006 — Decision-resolution scan (design §10.4 recommendation (b)).
 *
 * NOT wired to a live cron — same P10 posture `okrCycleScheduler.ts`
 * (OKR-E001) states for itself and `okrCheckInScheduler.ts` (OKR-E004)
 * repeats: "pure, fully-tested, directly-callable function... wiring an
 * actual periodic trigger is out of scope." Safe to call repeatedly
 * (`acknowledgeDecisionResolution` is itself idempotent by construction —
 * a second call on an already-acknowledged link throws
 * `OkrSupportRequestValidationError('ALREADY_ACKNOWLEDGED')`, caught and
 * skipped here, not surfaced as a scan failure), mirroring
 * `okrCheckInScheduler.ts`'s own per-row error-isolation discipline: one bad
 * link never aborts the whole pass.
 *
 * Design §10.4/§16 Open Question #4: human-triggered vs. scheduled
 * acknowledgement was presented as a recommendation, not silently decided.
 * This file implements the scheduled/service-actor option (b) — recording
 * an already-true fact (the Decision resolved) needs no human judgment,
 * unlike ROI-E007's D7 freshness flag. The human-triggered option (a) is
 * still fully available: a route/UI can call `acknowledgeDecisionResolution`
 * directly with a real `actorUserId` at any time; this scanner is an
 * additional, optional path for links nobody manually acknowledges.
 */
import { acquirePgClient } from '../../../database/PostgresDatabase.js';

import { acknowledgeDecisionResolution, OkrDecisionNotYetResolvedError } from './okrDecisionCommands.js';
import { OkrSupportRequestValidationError } from './okrSupportCommands.js';

export const OKR_DECISION_RESOLUTION_SCANNER_ACTOR = 'system:okr_decision_resolution_scanner';

export interface ScanAndAcknowledgeResolvedDecisionLinksInput {
  organizationId: string;
}

export interface ScanAndAcknowledgeResolvedDecisionLinksResult {
  scanned: number;
  acknowledged: number;
  stillUnresolved: number;
  errors: Array<{ linkId: string; error: string }>;
}

interface UnacknowledgedLinkRow {
  link_id: string;
  row_version: number;
}

/**
 * Scans every `okr_vnext_decision_links` row with
 * `resolution_acknowledged = false` for one organization, and calls
 * `acknowledgeDecisionResolution` (actorUserId=null, the scheduled-actor
 * shape) for each. A link whose Decision has not reached a terminal outcome
 * yet (`OkrDecisionNotYetResolvedError`) is counted in `stillUnresolved`,
 * not `errors` — that is the expected, common outcome of a scan pass, not a
 * failure.
 */
export async function scanAndAcknowledgeResolvedDecisionLinks(
  input: ScanAndAcknowledgeResolvedDecisionLinksInput
): Promise<ScanAndAcknowledgeResolvedDecisionLinksResult> {
  const { organizationId } = input;

  const client = await acquirePgClient();
  let rows: UnacknowledgedLinkRow[];
  try {
    const result = await client.query<UnacknowledgedLinkRow>(
      `SELECT link_id, row_version FROM okr_vnext_decision_links
        WHERE organization_id = $1 AND resolution_acknowledged = false
        ORDER BY requested_at ASC`,
      [organizationId]
    );
    rows = result.rows;
  } finally {
    client.release();
  }

  let acknowledged = 0;
  let stillUnresolved = 0;
  const errors: Array<{ linkId: string; error: string }> = [];

  for (const row of rows) {
    try {
      await acknowledgeDecisionResolution({
        linkId: row.link_id,
        organizationId,
        expectedVersion: row.row_version,
        actorUserId: null,
        actorEffectiveRole: 'system',
        idempotencyKey: `okr-decision-resolution-scan:${organizationId}:${row.link_id}:${row.row_version}`,
      });
      acknowledged += 1;
    } catch (err) {
      if (err instanceof OkrDecisionNotYetResolvedError) {
        stillUnresolved += 1;
        continue;
      }
      if (err instanceof OkrSupportRequestValidationError && err.code === 'ALREADY_ACKNOWLEDGED') {
        // Race with a human-triggered acknowledgement between the SELECT
        // above and this call — not an error, the fact is already recorded.
        continue;
      }
      errors.push({ linkId: row.link_id, error: err instanceof Error ? err.message : String(err) });
    }
  }

  return { scanned: rows.length, acknowledged, stillUnresolved, errors };
}
