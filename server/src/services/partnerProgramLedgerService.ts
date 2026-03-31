/**
 * P29 Partner program — canonical lifecycle + append-only ledger (FINAL 29).
 * Balances are derived; entries are never rewritten.
 */

import { v4 as uuidv4 } from 'uuid';

import { getDatabase } from '../database/Database.js';
import type { IDatabase } from '../database/IDatabase.js';
import * as DbPromise from '../utils/DbPromise.js';
import logger from '../utils/Logger.js';

export type PartnerLedgerEntryType =
  | 'accrual.posted'
  | 'accrual.adjustment'
  | 'accrual.reversal'
  | 'hold.placed'
  | 'hold.released'
  | 'payout.requested'
  | 'payout.approved'
  | 'payout.executed'
  | 'payout.failed'
  | 'payout.reconciled'
  | 'lifecycle.transition';

export type PartnerLifecyclePhase = 'onboard' | 'activate' | 'earn' | 'payout';

export interface PartnerLedgerEntryRow {
  id: string;
  partner_org_id: string;
  entry_type: string;
  amount: number;
  currency: string;
  occurred_at: string;
  recorded_at: string;
  source_ref: string;
  actor: string;
  actor_id: string | null;
  correlation_id: string | null;
  idempotency_key: string | null;
  reason_code: string | null;
  note: string | null;
}

export interface PartnerProgramBalances {
  grossEarned: number;
  paidOut: number;
  heldAmount: number;
  availableToPayout: number;
  currency: string;
}

export interface AppendLedgerEntryInput {
  partnerOrgId: string;
  entryType: PartnerLedgerEntryType;
  amount: number;
  currency?: string;
  occurredAt?: string;
  sourceRef?: Record<string, unknown>;
  actor: 'partner' | 'operator' | 'system';
  actorId?: string | null;
  correlationId?: string | null;
  idempotencyKey?: string | null;
  reasonCode?: string | null;
  note?: string | null;
}

let schemaEnsured = false;

async function ensurePartnerProgramSchema(db: IDatabase): Promise<void> {
  if (schemaEnsured) return;
  try {
    await DbPromise.run(
      db,
      `CREATE TABLE IF NOT EXISTS partner_program_runtime (
        partner_org_id TEXT PRIMARY KEY,
        lifecycle_phase TEXT NOT NULL DEFAULT 'onboard',
        onboard_checklist_json TEXT NOT NULL DEFAULT '{}',
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        last_transition_at TEXT,
        last_transition_actor TEXT,
        last_transition_actor_id TEXT,
        last_transition_note TEXT
      )`
    );
    await DbPromise.run(
      db,
      `CREATE TABLE IF NOT EXISTS partner_program_ledger (
        id TEXT PRIMARY KEY,
        partner_org_id TEXT NOT NULL,
        entry_type TEXT NOT NULL,
        amount REAL NOT NULL DEFAULT 0,
        currency TEXT NOT NULL DEFAULT 'EUR',
        occurred_at TEXT NOT NULL,
        recorded_at TEXT NOT NULL DEFAULT (datetime('now')),
        source_ref TEXT NOT NULL DEFAULT '{}',
        actor TEXT NOT NULL,
        actor_id TEXT,
        correlation_id TEXT,
        idempotency_key TEXT UNIQUE,
        reason_code TEXT,
        note TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )`
    );
    await DbPromise.run(
      db,
      `CREATE INDEX IF NOT EXISTS idx_partner_program_ledger_partner_occurred
       ON partner_program_ledger(partner_org_id, occurred_at DESC)`
    );
    schemaEnsured = true;
  } catch (e) {
    logger.warn('[PartnerProgramLedger] ensureSchema', e);
    throw e;
  }
}

/** Pure derivation for tests and API */
export function deriveBalancesFromEntries(
  entries: Array<{ entry_type: string; amount: number }>,
  currency = 'EUR'
): PartnerProgramBalances {
  let gross = 0;
  let paid = 0;
  let held = 0;
  for (const e of entries) {
    const a = Number(e.amount) || 0;
    switch (e.entry_type) {
      case 'accrual.posted':
        gross += a;
        break;
      case 'accrual.adjustment':
        gross += a;
        break;
      case 'accrual.reversal':
        gross -= a;
        break;
      case 'hold.placed':
        held += a;
        break;
      case 'hold.released':
        held -= a;
        break;
      case 'payout.executed':
        paid += Math.abs(a);
        break;
      default:
        break;
    }
  }
  const available = Math.max(0, gross - paid - held);
  return {
    grossEarned: Math.round(gross * 10000) / 10000,
    paidOut: Math.round(paid * 10000) / 10000,
    heldAmount: Math.max(0, Math.round(held * 10000) / 10000),
    availableToPayout: Math.round(available * 10000) / 10000,
    currency,
  };
}

const LIFECYCLE_EDGES: Record<
  PartnerLifecyclePhase,
  Partial<Record<PartnerLifecyclePhase, { actor: 'partner' | 'operator' | 'system' }>>
> = {
  onboard: { activate: { actor: 'operator' } },
  activate: { earn: { actor: 'operator' } },
  earn: { payout: { actor: 'partner' } },
  payout: { earn: { actor: 'operator' } },
};

export class PartnerProgramLedgerService {
  static async appendEntry(input: AppendLedgerEntryInput): Promise<{ id: string; duplicate?: boolean }> {
    const db = getDatabase();
    await ensurePartnerProgramSchema(db);
    if (input.idempotencyKey) {
      const existing = await DbPromise.get<{ id: string }>(
        db,
        `SELECT id FROM partner_program_ledger WHERE idempotency_key = ?`,
        [input.idempotencyKey]
      );
      if (existing?.id) {
        return { id: existing.id, duplicate: true };
      }
    }
    const id = uuidv4();
    const now = new Date().toISOString();
    const occurredAt = input.occurredAt || now;
    const ins = await DbPromise.run(
      db,
      `INSERT INTO partner_program_ledger (
        id, partner_org_id, entry_type, amount, currency, occurred_at, recorded_at,
        source_ref, actor, actor_id, correlation_id, idempotency_key, reason_code, note
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        input.partnerOrgId,
        input.entryType,
        input.amount,
        input.currency || 'EUR',
        occurredAt,
        now,
        JSON.stringify(input.sourceRef || {}),
        input.actor,
        input.actorId ?? null,
        input.correlationId ?? null,
        input.idempotencyKey ?? null,
        input.reasonCode ?? null,
        input.note ?? null,
      ],
      { fallback: false }
    );
    if (!ins.success) {
      throw Object.assign(new Error(ins.error || 'Ledger insert failed'), {
        code: 'P29_LEDGER_WRITE_FAILED',
      });
    }
    return { id };
  }

  static async listEntries(
    partnerOrgId: string,
    opts: { limit?: number; offset?: number } = {}
  ): Promise<PartnerLedgerEntryRow[]> {
    const db = getDatabase();
    await ensurePartnerProgramSchema(db);
    const limit = Math.min(500, Math.max(1, opts.limit ?? 100));
    const offset = Math.max(0, opts.offset ?? 0);
    const rows = await DbPromise.all<PartnerLedgerEntryRow>(
      db,
      `SELECT id, partner_org_id, entry_type, amount, currency, occurred_at, recorded_at,
              source_ref, actor, actor_id, correlation_id, idempotency_key, reason_code, note
       FROM partner_program_ledger
       WHERE partner_org_id = ?
       ORDER BY occurred_at DESC, recorded_at DESC
       LIMIT ? OFFSET ?`,
      [partnerOrgId, limit, offset]
    );
    return rows;
  }

  static async getBalances(partnerOrgId: string, currency = 'EUR'): Promise<PartnerProgramBalances> {
    const db = getDatabase();
    await ensurePartnerProgramSchema(db);
    const rows = await DbPromise.all<{ entry_type: string; amount: number }>(
      db,
      `SELECT entry_type, amount FROM partner_program_ledger WHERE partner_org_id = ?`,
      [partnerOrgId],
      { fallback: false }
    );
    return deriveBalancesFromEntries(rows, currency);
  }

  static async getOrCreateRuntime(partnerOrgId: string): Promise<{
    lifecycle_phase: PartnerLifecyclePhase;
    onboard_checklist_json: string;
    partner_status: string | null;
  }> {
    const db = getDatabase();
    await ensurePartnerProgramSchema(db);
    let row = await DbPromise.get<{
      lifecycle_phase: string;
      onboard_checklist_json: string;
    }>(
      db,
      `SELECT lifecycle_phase, onboard_checklist_json FROM partner_program_runtime WHERE partner_org_id = ?`,
      [partnerOrgId]
    );
    const po = await DbPromise.get<{ status: string | null }>(
      db,
      `SELECT status FROM partner_organizations WHERE id = ?`,
      [partnerOrgId]
    );
    const partnerStatus = po?.status ?? null;
    if (!row) {
      const initialPhase: PartnerLifecyclePhase =
        partnerStatus === 'active' ? 'earn' : 'onboard';
      const ts = new Date().toISOString();
      await DbPromise.run(
        db,
        `INSERT INTO partner_program_runtime (
          partner_org_id, lifecycle_phase, onboard_checklist_json, updated_at
        ) VALUES (?, ?, ?, ?)`,
        [partnerOrgId, initialPhase, '{}', ts]
      );
      row = { lifecycle_phase: initialPhase, onboard_checklist_json: '{}' };
    }
    return {
      lifecycle_phase: row.lifecycle_phase as PartnerLifecyclePhase,
      onboard_checklist_json: row.onboard_checklist_json,
      partner_status: partnerStatus,
    };
  }

  static async transitionLifecycle(params: {
    partnerOrgId: string;
    toPhase: PartnerLifecyclePhase;
    actor: 'partner' | 'operator' | 'system';
    actorId?: string | null;
    reason?: string;
  }): Promise<{ ok: boolean; from: PartnerLifecyclePhase; to: PartnerLifecyclePhase }> {
    const db = getDatabase();
    await ensurePartnerProgramSchema(db);
    const rt = await this.getOrCreateRuntime(params.partnerOrgId);
    const from = rt.lifecycle_phase;
    const rule = LIFECYCLE_EDGES[from]?.[params.toPhase];
    if (!rule) {
      throw Object.assign(
        new Error(`Disallowed lifecycle transition ${from} -> ${params.toPhase}`),
        { code: 'P29_LIFECYCLE_INVALID', from, to: params.toPhase }
      );
    }
    if (rule.actor === 'operator' && params.actor !== 'operator') {
      throw Object.assign(new Error('Operator-only transition'), { code: 'P29_LIFECYCLE_FORBIDDEN' });
    }
    if (rule.actor === 'partner' && params.actor !== 'partner') {
      throw Object.assign(new Error('Partner-only transition'), { code: 'P29_LIFECYCLE_FORBIDDEN' });
    }
    const ts = new Date().toISOString();
    await DbPromise.run(
      db,
      `UPDATE partner_program_runtime SET
         lifecycle_phase = ?,
         updated_at = ?,
         last_transition_at = ?,
         last_transition_actor = ?,
         last_transition_actor_id = ?,
         last_transition_note = ?
       WHERE partner_org_id = ?`,
      [
        params.toPhase,
        ts,
        ts,
        params.actor,
        params.actorId ?? null,
        params.reason ?? null,
        params.partnerOrgId,
      ]
    );
    await this.appendEntry({
      partnerOrgId: params.partnerOrgId,
      entryType: 'lifecycle.transition',
      amount: 0,
      sourceRef: { from, to: params.toPhase },
      actor: params.actor,
      actorId: params.actorId ?? null,
      note: params.reason ?? null,
    });
    return { ok: true, from, to: params.toPhase };
  }
}

export default PartnerProgramLedgerService;
