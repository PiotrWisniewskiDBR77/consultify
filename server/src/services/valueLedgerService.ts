/**
 * M16/3.4 — Frozen Baseline & Value Ledger.
 *
 * A KPI's tracked value is split into two immutable layers:
 *   1. value_baselines       — a frozen snapshot (the "starting point"); only one
 *                              is_active=1 per (org, initiative, kpi). Re-freezing
 *                              deactivates the previous baseline and inserts a new one.
 *   2. value_ledger_entries  — append-only, auditable corrections applied on top of
 *                              the active baseline, each carrying provenance.
 *
 * Current value = active baseline.frozen_value + Σ ledger.value_delta.
 *
 * The DB-touching methods are org-scoped (every read/write filters by organization_id).
 * `currentValueFromLedger` is pure (no DB) so it can be unit-tested and reused in API.
 */

import { v4 as uuidv4 } from 'uuid';

import * as DbPromise from '../utils/DbPromise.js';
import logger from '../utils/Logger.js';

export interface ValueBaselineRow {
  id: string;
  organization_id: string;
  initiative_id: string;
  kpi_id: string;
  frozen_value: number;
  frozen_at: string;
  frozen_by: string | null;
  source_snapshot: string | null;
  is_active: number;
}

export interface ValueLedgerEntryRow {
  id: string;
  organization_id: string;
  initiative_id: string;
  entry_type: string;
  value_delta: number;
  reason: string | null;
  provenance: string | null;
  created_by: string | null;
  created_at: string;
}

export interface FreezeBaselineInput {
  initiativeId: string;
  kpiId: string;
  value: number;
  frozenBy?: string | null;
  sourceSnapshot?: unknown;
}

export interface AppendLedgerEntryInput {
  initiativeId: string;
  entryType: string;
  valueDelta: number;
  reason?: string | null;
  provenance?: unknown;
  createdBy?: string | null;
}

export interface AuditTrailStep {
  /** 'baseline' for the frozen starting point, otherwise the entry's entry_type. */
  kind: string;
  id: string | null;
  delta: number;
  /** Running value after applying this step. */
  runningTotal: number;
  reason?: string | null;
  provenance?: string | null;
  at?: string | null;
}

export interface CurrentValueResult {
  current: number;
  baselineValue: number;
  auditTrail: AuditTrailStep[];
}

let schemaEnsured = false;

async function ensureSchema(): Promise<void> {
  if (schemaEnsured) return;
  try {
    await DbPromise.run(
      `CREATE TABLE IF NOT EXISTS value_baselines (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL,
        initiative_id TEXT NOT NULL,
        kpi_id TEXT NOT NULL,
        frozen_value REAL NOT NULL DEFAULT 0,
        frozen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        frozen_by TEXT,
        source_snapshot TEXT,
        is_active INTEGER NOT NULL DEFAULT 1
      )`,
      []
    );
    await DbPromise.run(
      `CREATE TABLE IF NOT EXISTS value_ledger_entries (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL,
        initiative_id TEXT NOT NULL,
        entry_type TEXT NOT NULL,
        value_delta REAL NOT NULL DEFAULT 0,
        reason TEXT,
        provenance TEXT,
        created_by TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`,
      []
    );
    await DbPromise.run(
      `CREATE INDEX IF NOT EXISTS idx_value_baselines_active
        ON value_baselines(organization_id, initiative_id, kpi_id, is_active)`,
      []
    );
    await DbPromise.run(
      `CREATE INDEX IF NOT EXISTS idx_value_ledger_entries_initiative
        ON value_ledger_entries(organization_id, initiative_id, created_at)`,
      []
    );
    schemaEnsured = true;
  } catch (e) {
    logger.warn('[ValueLedger] ensureSchema failed', e);
    throw e;
  }
}

function serializeSnapshot(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value);
  } catch {
    return null;
  }
}

/**
 * Pure derivation — the single source of truth for "what is this KPI worth now".
 * current = baseline.frozen_value + Σ entries.value_delta, with a full step-by-step
 * audit trail (baseline first, then entries in the order supplied).
 */
export function currentValueFromLedger(
  baseline: { frozen_value: number; id?: string; frozen_at?: string | null } | null,
  entries: Array<{
    id?: string;
    entry_type?: string;
    value_delta: number;
    reason?: string | null;
    provenance?: string | null;
    created_at?: string | null;
  }> = []
): CurrentValueResult {
  const baselineValue = Number(baseline?.frozen_value) || 0;
  let running = baselineValue;
  const auditTrail: AuditTrailStep[] = [];

  auditTrail.push({
    kind: 'baseline',
    id: baseline?.id ?? null,
    delta: baselineValue,
    runningTotal: running,
    at: baseline?.frozen_at ?? null,
  });

  for (const e of entries) {
    const delta = Number(e.value_delta) || 0;
    running += delta;
    auditTrail.push({
      kind: e.entry_type ?? 'adjustment',
      id: e.id ?? null,
      delta,
      runningTotal: running,
      reason: e.reason ?? null,
      provenance: e.provenance ?? null,
      at: e.created_at ?? null,
    });
  }

  return {
    current: Math.round(running * 1e6) / 1e6,
    baselineValue,
    auditTrail,
  };
}

/**
 * Freeze a new baseline for (org, initiative, kpi): deactivate any prior active
 * baseline, then insert the new active row.
 */
export async function freezeBaseline(
  orgId: string,
  input: FreezeBaselineInput
): Promise<ValueBaselineRow> {
  await ensureSchema();
  const id = uuidv4();
  const now = new Date().toISOString();

  await DbPromise.run(
    `UPDATE value_baselines
       SET is_active = 0
     WHERE organization_id = ? AND initiative_id = ? AND kpi_id = ? AND is_active = 1`,
    [orgId, input.initiativeId, input.kpiId],
    { fallback: false }
  );

  const sourceSnapshot = serializeSnapshot(input.sourceSnapshot);
  const frozenValue = Number(input.value) || 0;

  const ins = await DbPromise.run(
    `INSERT INTO value_baselines (
      id, organization_id, initiative_id, kpi_id, frozen_value, frozen_at, frozen_by, source_snapshot, is_active
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`,
    [
      id,
      orgId,
      input.initiativeId,
      input.kpiId,
      frozenValue,
      now,
      input.frozenBy ?? null,
      sourceSnapshot,
    ],
    { fallback: false }
  );

  if (!ins.success) {
    throw Object.assign(new Error(ins.error || 'Baseline insert failed'), {
      code: 'M16_BASELINE_WRITE_FAILED',
    });
  }

  return {
    id,
    organization_id: orgId,
    initiative_id: input.initiativeId,
    kpi_id: input.kpiId,
    frozen_value: frozenValue,
    frozen_at: now,
    frozen_by: input.frozenBy ?? null,
    source_snapshot: sourceSnapshot,
    is_active: 1,
  };
}

/** The single active (frozen) baseline for a KPI, or null. */
export async function getActiveBaseline(
  orgId: string,
  initiativeId: string,
  kpiId: string
): Promise<ValueBaselineRow | null> {
  await ensureSchema();
  const row = await DbPromise.get<ValueBaselineRow>(
    `SELECT id, organization_id, initiative_id, kpi_id, frozen_value, frozen_at,
            frozen_by, source_snapshot, is_active
       FROM value_baselines
      WHERE organization_id = ? AND initiative_id = ? AND kpi_id = ? AND is_active = 1
      ORDER BY frozen_at DESC
      LIMIT 1`,
    [orgId, initiativeId, kpiId],
    { fallback: false }
  );
  return row ?? null;
}

/** Append an auditable correction entry (with provenance) to the ledger. */
export async function appendLedgerEntry(
  orgId: string,
  data: AppendLedgerEntryInput
): Promise<ValueLedgerEntryRow> {
  await ensureSchema();
  const id = uuidv4();
  const now = new Date().toISOString();
  const provenance = serializeSnapshot(data.provenance);
  const valueDelta = Number(data.valueDelta) || 0;

  const ins = await DbPromise.run(
    `INSERT INTO value_ledger_entries (
      id, organization_id, initiative_id, entry_type, value_delta, reason, provenance, created_by, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      orgId,
      data.initiativeId,
      data.entryType,
      valueDelta,
      data.reason ?? null,
      provenance,
      data.createdBy ?? null,
      now,
    ],
    { fallback: false }
  );

  if (!ins.success) {
    throw Object.assign(new Error(ins.error || 'Ledger insert failed'), {
      code: 'M16_LEDGER_WRITE_FAILED',
    });
  }

  return {
    id,
    organization_id: orgId,
    initiative_id: data.initiativeId,
    entry_type: data.entryType,
    value_delta: valueDelta,
    reason: data.reason ?? null,
    provenance,
    created_by: data.createdBy ?? null,
    created_at: now,
  };
}

/** All ledger entries for an initiative (org-scoped), oldest first. */
export async function getLedger(
  orgId: string,
  initiativeId: string
): Promise<ValueLedgerEntryRow[]> {
  await ensureSchema();
  const rows = await DbPromise.all<ValueLedgerEntryRow>(
    `SELECT id, organization_id, initiative_id, entry_type, value_delta, reason,
            provenance, created_by, created_at
       FROM value_ledger_entries
      WHERE organization_id = ? AND initiative_id = ?
      ORDER BY created_at ASC, id ASC`,
    [orgId, initiativeId],
    { fallback: false }
  );
  return rows;
}

export const ValueLedgerService = {
  freezeBaseline,
  getActiveBaseline,
  appendLedgerEntry,
  getLedger,
  currentValueFromLedger,
};

export default ValueLedgerService;
