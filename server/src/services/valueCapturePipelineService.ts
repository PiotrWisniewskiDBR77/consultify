/**
 * Value Capture Pipeline Service (M16/3.3)
 *
 * Models initiatives advancing through value-capture stage-gates G0..G5.
 * A gate only advances when its exit criteria are met AND a sign-off is recorded.
 * Provides a pipeline funnel (count + value + conversion per gate).
 *
 * Pure helpers (GATE_ORDER, nextGate, canAdvance, pipelineFunnel) are
 * side-effect free and independently testable; DB helpers are org-scoped.
 */

import { all, get, run } from '../utils/DbPromise.js';
import logger from '../utils/Logger.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Gate = 'G0' | 'G1' | 'G2' | 'G3' | 'G4' | 'G5';
export type GateStatus = 'pending' | 'passed' | 'blocked';

export interface ValueCaptureGate {
  id: string;
  organizationId: string;
  initiativeId: string;
  gate: Gate;
  status: GateStatus;
  criteria: string | null;
  signedOffBy: string | null;
  signedOffAt: string | null;
  valueEvidence: number | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface AdvanceCheck {
  ok: boolean;
  reason?: string;
}

export interface FunnelStage {
  gate: Gate;
  count: number;
  totalValue: number;
  /** Conversion ratio from the previous gate's count (0..1); 1 for the first gate. */
  conversionFromPrev: number;
}

export interface CreateGateInput {
  initiativeId: string;
  gate: Gate;
  status?: GateStatus;
  criteria?: string | null;
  valueEvidence?: number | null;
}

// ---------------------------------------------------------------------------
// Pure logic
// ---------------------------------------------------------------------------

/** Canonical ordering of value-capture stage-gates. */
export const GATE_ORDER: readonly Gate[] = ['G0', 'G1', 'G2', 'G3', 'G4', 'G5'];

/**
 * The gate that follows `g`, or null if `g` is the last gate (G5) or unknown.
 */
export function nextGate(g: Gate): Gate | null {
  const idx = GATE_ORDER.indexOf(g);
  if (idx < 0 || idx >= GATE_ORDER.length - 1) return null;
  return GATE_ORDER[idx + 1];
}

/**
 * A gate may advance to the next stage only when its exit criteria are met
 * AND a sign-off has been recorded. The terminal gate (G5) cannot advance.
 */
export function canAdvance(
  currentGate: Gate,
  criteriaMet: boolean,
  signedOff: boolean
): AdvanceCheck {
  if (!GATE_ORDER.includes(currentGate)) {
    return { ok: false, reason: `Unknown gate: ${currentGate}` };
  }
  if (nextGate(currentGate) === null) {
    return { ok: false, reason: `${currentGate} is the final gate; nothing to advance to` };
  }
  if (!criteriaMet && !signedOff) {
    return { ok: false, reason: 'Exit criteria not met and sign-off missing' };
  }
  if (!criteriaMet) {
    return { ok: false, reason: 'Exit criteria not met' };
  }
  if (!signedOff) {
    return { ok: false, reason: 'Sign-off required to advance' };
  }
  return { ok: true };
}

/**
 * Build a pipeline funnel: for each gate in canonical order, the number of
 * initiatives currently at that gate, the sum of their value evidence, and the
 * conversion ratio from the previous gate's count.
 *
 * The first gate always reports conversionFromPrev = 1. When a previous gate
 * has zero count, conversion is reported as 0 (no base to convert from).
 */
export function pipelineFunnel(gates: ValueCaptureGate[]): FunnelStage[] {
  const counts = new Map<Gate, number>();
  const values = new Map<Gate, number>();
  for (const g of GATE_ORDER) {
    counts.set(g, 0);
    values.set(g, 0);
  }

  for (const row of gates) {
    if (!counts.has(row.gate)) continue; // ignore unknown gate labels
    counts.set(row.gate, (counts.get(row.gate) ?? 0) + 1);
    values.set(row.gate, (values.get(row.gate) ?? 0) + (row.valueEvidence ?? 0));
  }

  const stages: FunnelStage[] = [];
  let prevCount: number | null = null;
  for (const gate of GATE_ORDER) {
    const count = counts.get(gate) ?? 0;
    const totalValue = values.get(gate) ?? 0;
    let conversionFromPrev: number;
    if (prevCount === null) {
      conversionFromPrev = 1;
    } else if (prevCount === 0) {
      conversionFromPrev = 0;
    } else {
      conversionFromPrev = count / prevCount;
    }
    stages.push({ gate, count, totalValue, conversionFromPrev });
    prevCount = count;
  }
  return stages;
}

// ---------------------------------------------------------------------------
// DB mapping
// ---------------------------------------------------------------------------

function mapRow(r: any): ValueCaptureGate {
  return {
    id: String(r.id),
    organizationId: String(r.organization_id),
    initiativeId: String(r.initiative_id),
    gate: r.gate as Gate,
    status: (r.status ?? 'pending') as GateStatus,
    criteria: r.criteria ?? null,
    signedOffBy: r.signed_off_by ?? null,
    signedOffAt: r.signed_off_at ?? null,
    valueEvidence:
      r.value_evidence === null || r.value_evidence === undefined ? null : Number(r.value_evidence),
    createdAt: r.created_at ?? null,
    updatedAt: r.updated_at ?? null,
  };
}

// ---------------------------------------------------------------------------
// DB operations (org-scoped)
// ---------------------------------------------------------------------------

/**
 * List value-capture gates for an organization, optionally filtered to a single
 * initiative, ordered by initiative then canonical gate order.
 */
export async function listGates(orgId: string, initiativeId?: string): Promise<ValueCaptureGate[]> {
  const params: unknown[] = [orgId];
  let sql = `SELECT * FROM value_capture_gates WHERE organization_id = ?`;
  if (initiativeId) {
    sql += ` AND initiative_id = ?`;
    params.push(initiativeId);
  }
  sql += ` ORDER BY initiative_id ASC, gate ASC`;
  const rows = await all(sql, params);
  return (rows ?? []).map(mapRow);
}

/**
 * Create a new gate record for an initiative within an organization.
 */
export async function createGate(orgId: string, data: CreateGateInput): Promise<ValueCaptureGate> {
  if (!GATE_ORDER.includes(data.gate)) {
    throw new Error(`Invalid gate: ${data.gate}`);
  }
  const id = `vcg_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
  const status: GateStatus = data.status ?? 'pending';
  await run(
    `INSERT INTO value_capture_gates
       (id, organization_id, initiative_id, gate, status, criteria, value_evidence, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
    [
      id,
      orgId,
      data.initiativeId,
      data.gate,
      status,
      data.criteria ?? null,
      data.valueEvidence ?? null,
    ]
  );
  const row = await get(`SELECT * FROM value_capture_gates WHERE id = ? AND organization_id = ?`, [
    id,
    orgId,
  ]);
  if (!row) throw new Error('Failed to load created gate');
  return mapRow(row);
}

/**
 * Advance a gate by recording a sign-off. Validates canAdvance against the
 * gate's current criteria/sign-off state; on success marks the gate 'passed'
 * and stamps the sign-off. Throws when advancement is not permitted.
 */
export async function advanceGate(
  orgId: string,
  id: string,
  opts: { signedOffBy: string }
): Promise<ValueCaptureGate> {
  const row = await get(`SELECT * FROM value_capture_gates WHERE id = ? AND organization_id = ?`, [
    id,
    orgId,
  ]);
  if (!row) throw new Error('Gate not found');
  const gate = mapRow(row);

  const criteriaMet = gate.criteria !== null && String(gate.criteria).trim().length > 0;
  const signedOff = Boolean(opts.signedOffBy);

  const check = canAdvance(gate.gate, criteriaMet, signedOff);
  if (!check.ok) {
    throw new Error(check.reason ?? 'Cannot advance gate');
  }

  await run(
    `UPDATE value_capture_gates
        SET status = 'passed', signed_off_by = ?, signed_off_at = datetime('now'), updated_at = datetime('now')
      WHERE id = ? AND organization_id = ?`,
    [opts.signedOffBy, id, orgId]
  );

  const updated = await get(
    `SELECT * FROM value_capture_gates WHERE id = ? AND organization_id = ?`,
    [id, orgId]
  );
  if (!updated) throw new Error('Failed to reload advanced gate');
  logger.info(`[valueCapture] gate ${id} advanced (${gate.gate}) by ${opts.signedOffBy}`);
  return mapRow(updated);
}
