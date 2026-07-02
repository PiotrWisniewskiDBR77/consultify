/**
 * Initiative Gate AI — durable telemetry (M13 Depth · Fala 1 · G4).
 *
 * SSOT spec: docs/product/INITIATIVE_GATE_AI_SPEC.md §7.
 *
 * Records one `initiative_gate_ai_events` row per gate evaluation/transition the
 * feature touched (how often AI flags, how often it gets overridden). The data
 * powers the §7 success metrics.
 *
 * FAIL-SAFE by design: telemetry must NEVER break a transition. A missing table
 * (migration not yet applied) or any write error is logged at warn level and
 * swallowed — the caller is never made to fail because of a telemetry hiccup.
 */
import { run as dbRun, tableExists } from '../../utils/DbPromise.js';
import Logger from '../../utils/Logger.js';

const LOG_PREFIX = '[initiative:gateAi:telemetry]';
const TABLE = 'initiative_gate_ai_events';

export interface GateAiEvent {
  organizationId: string;
  initiativeId: string;
  gate: string;
  score?: number | null;
  timelineBlock?: boolean;
  blocked?: boolean;
  overridden?: boolean;
  overrideReason?: string | null;
  userId?: string | null;
}

/** boolean → 1/0 (DB stores INTEGER flags, matching the gate-ai flag table). */
function bit(value?: boolean): number {
  return value ? 1 : 0;
}

/**
 * Record a single gate-AI telemetry event. Best-effort: guards on the table
 * existing, wraps the write in try/catch, and on any error just warns + returns.
 */
export async function recordGateAiEvent(e: GateAiEvent): Promise<void> {
  try {
    const orgId = String(e?.organizationId || '').trim();
    if (!orgId) return;

    const exists = await tableExists(TABLE);
    if (!exists) return;

    const score =
      e.score === null || e.score === undefined || !Number.isFinite(Number(e.score))
        ? null
        : Math.round(Number(e.score));

    await dbRun(
      `INSERT INTO ${TABLE}
         (organization_id, initiative_id, gate, score, timeline_block, blocked, overridden, override_reason, user_id, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())`,
      [
        orgId,
        e.initiativeId || null,
        e.gate || null,
        score,
        bit(e.timelineBlock),
        bit(e.blocked),
        bit(e.overridden),
        e.overrideReason || null,
        e.userId || null,
      ]
    );
  } catch (err: any) {
    // Fail-safe: telemetry never breaks a transition.
    Logger.warn(`${LOG_PREFIX} record failed (swallowed):`, err?.message);
  }
}
