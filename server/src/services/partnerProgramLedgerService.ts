/**
 * P29 Partner program — canonical lifecycle + append-only ledger (FINAL 29).
 * Balances are derived; entries are never rewritten.
 */

import { v4 as uuidv4 } from 'uuid';

import { getDatabase } from '../database/Database.js';
import type { IDatabase } from '../database/IDatabase.js';
import * as DbPromise from '../utils/DbPromise.js';
import logger from '../utils/Logger.js';

export const PARTNER_LEDGER_ENTRY_TYPES = [
  'accrual.posted',
  'accrual.adjustment',
  'accrual.reversal',
  'hold.placed',
  'hold.released',
  'payout.requested',
  'payout.approved',
  'payout.executed',
  'payout.failed',
  'payout.reconciled',
  'dispute.opened',
  'dispute.resolved',
  'lifecycle.transition',
] as const;

export type PartnerLedgerEntryType = (typeof PARTNER_LEDGER_ENTRY_TYPES)[number];

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
  rule_version: string;
  related_entry_id: string | null;
  dispute_status: string | null;
}

/**
 * How `paidOut` relates to the payout register the Earnings list renders.
 *
 * `RECONCILED`            — ledger reconciliations and settled payouts agree.
 * `LEDGER_BEHIND_REGISTER`— settled payouts exist that the ledger has not
 *                           reconciled yet (this is demo's situation: a
 *                           COMPLETED payout of 514.80 EUR seeded straight into
 *                           `partner_payouts` with no `payout.reconciled` entry).
 * `REGISTER_UNAVAILABLE`  — the payout register could not be read, so no
 *                           cross-check was possible.
 */
export type PartnerPaidReconciliationStatus =
  | 'RECONCILED'
  | 'LEDGER_BEHIND_REGISTER'
  | 'REGISTER_UNAVAILABLE';

export interface PartnerPaidReconciliation {
  status: PartnerPaidReconciliationStatus;
  /** Sum of `payout.reconciled` ledger entries. */
  ledgerReconciled: number;
  /** Sum of COMPLETED rows in `partner_payouts` — the register the UI lists. */
  settledPayouts: number;
  /** settledPayouts - ledgerReconciled, clamped at 0. */
  unreconciledAmount: number;
}

export interface PartnerProgramBalances {
  grossEarned: number;
  /**
   * Canonical "paid" figure. Projected from the SETTLED PAYOUT REGISTER
   * (`partner_payouts` COMPLETED) — deliberately the same register the payout
   * list renders, so the total and the list can never contradict each other.
   * The ledger stays canonical for accruals and holds; `paidReconciliation`
   * makes the projection explicit rather than papering over a divergence.
   */
  paidOut: number;
  heldAmount: number;
  availableToPayout: number;
  currency: string;
  paidReconciliation?: PartnerPaidReconciliation;
}

export interface PartnerProgramWhatNextContext {
  lifecyclePhase: PartnerLifecyclePhase;
  balances: PartnerProgramBalances;
  audience: 'partner' | 'operator';
  partnerOrgStatus?: string | null;
  /** Ostatni hold.placed gdy heldAmount > 0 (P29-B exceptional path) */
  activeHold?: { reasonCode: string | null; note: string | null; amount: number } | null;
}

/**
 * Jawne kroki „what next” — ta sama semantyka dla portalu partnera i wieży operatora (FINAL 29 §2.3.6, §8.1 P29-B).
 */
export function buildPartnerWhatNextGuidance(ctx: PartnerProgramWhatNextContext): string[] {
  const lines: string[] = [];
  const { lifecyclePhase: phase, balances: b, audience: aud, activeHold } = ctx;

  if (activeHold && b.heldAmount > 0) {
    if (aud === 'partner') {
      lines.push(
        'Część środków jest zablokowana (hold). Sprawdź kategorię poniżej; w razie potrzeby skontaktuj się z operatorem programu.'
      );
      if (activeHold.reasonCode) {
        lines.push(`Kategoria (non-sensitive): ${activeHold.reasonCode}`);
      }
    } else {
      lines.push(
        `Aktywny hold: ${activeHold.amount} ${b.currency}. Po weryfikacji dodaj wpis hold.released lub korektę; audyt w ledgerze.`
      );
      if (activeHold.note?.trim()) {
        lines.push(`Notatka operatora: ${activeHold.note.trim()}`);
      }
    }
  }

  switch (phase) {
    case 'onboard':
      lines.push(
        aud === 'partner'
          ? 'Uzupełnij onboarding; przejście do fazy activate wykonuje operator platformy.'
          : 'Gdy wymagania onboard są spełnione: POST .../partner-settlements/program/:partnerOrgId/lifecycle z { toPhase: "activate" }.'
      );
      break;
    case 'activate':
      lines.push(
        aud === 'operator'
          ? 'Włącz naliczanie: transition do earn, potem ewentualnie wpisy accrual.posted w ledgerze.'
          : 'Konto w aktywacji — po stronie operatora przejdziesz do fazy earn (narzędzia referral).'
      );
      break;
    case 'earn':
      if (aud === 'partner' && b.availableToPayout > 0 && !(activeHold && b.heldAmount > 0)) {
        lines.push(
          'Możesz przejść do fazy payout: POST /api/v8/partner/program/lifecycle/request-payout-phase (wymaga kompletnych ustawień wypłat).'
        );
      }
      if (aud === 'operator') {
        lines.push(
          'Ten sam ledger co u partnera: GET status/ledger po stronie partnera i superadmin program/:id/status — jedna prawda.'
        );
        lines.push(
          'Wpisy hold/accrual/payout: POST .../partner-settlements/program/:partnerOrgId/ledger-entry (tylko operator).'
        );
      }
      break;
    case 'payout':
      lines.push(
        aud === 'partner'
          ? 'Trwa żądanie / rozliczenie wypłaty; operator dokończy payout w ledgerze, potem powrót do earn.'
          : 'Zaksięguj payout.approved / payout.executed / payout.reconciled, potem transition z powrotem do earn.'
      );
      break;
    default:
      break;
  }

  return lines.filter(Boolean);
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
  ruleVersion?: string | null;
  relatedEntryId?: string | null;
  disputeStatus?: 'open' | 'upheld' | 'rejected' | 'withdrawn' | null;
}

let schemaEnsured = false;

export function isPartnerLedgerEntryType(value: unknown): value is PartnerLedgerEntryType {
  return (
    typeof value === 'string' &&
    PARTNER_LEDGER_ENTRY_TYPES.includes(value as PartnerLedgerEntryType)
  );
}

function parseChecklist(raw: string | null | undefined): Record<string, unknown> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

async function buildOnboardChecklistSnapshot(
  db: IDatabase,
  partnerOrgId: string
): Promise<Record<string, unknown>> {
  const row = await DbPromise.get<{
    terms_accepted?: boolean | number | null;
    privacy_accepted?: boolean | number | null;
    pricing_tier?: string | null;
    completed?: boolean | number | null;
  }>(
    db,
    `SELECT uos.terms_accepted, uos.privacy_accepted, uos.pricing_tier, uos.completed
     FROM partner_users pu
     LEFT JOIN user_onboarding_status uos ON uos.user_id = pu.user_id
     WHERE pu.partner_org_id = ? AND pu.status = 'active'
     ORDER BY pu.joined_at ASC, pu.created_at ASC
     LIMIT 1`,
    [partnerOrgId]
  );

  return {
    termsAccepted: Boolean(row?.terms_accepted),
    privacyAccepted: Boolean(row?.privacy_accepted),
    pricingTierSelected: Boolean(String(row?.pricing_tier || '').trim()),
    onboardingCompleted: Boolean(row?.completed),
    verifiedAt: new Date().toISOString(),
  };
}

function isOnboardChecklistComplete(checklist: Record<string, unknown>): boolean {
  return Boolean(
    checklist.termsAccepted &&
    checklist.privacyAccepted &&
    checklist.pricingTierSelected &&
    checklist.onboardingCompleted
  );
}

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
      case 'payout.reconciled':
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

/**
 * P29-C §2.3.5: dual-control threshold — kwoty powyżej progu lub first payout wymagają
 * jawnego `elevatedRiskConfirmed: true` w `sourceRef` wpisu payout.approved / payout.executed.
 */
const DUAL_CONTROL_PAYOUT_THRESHOLD = 1000;

export function requiresDualControl(
  entryType: PartnerLedgerEntryType,
  amount: number,
  isFirstPayout: boolean
): boolean {
  if (entryType !== 'payout.approved' && entryType !== 'payout.executed') return false;
  if (isFirstPayout) return true;
  return Math.abs(amount) >= DUAL_CONTROL_PAYOUT_THRESHOLD;
}

export class PartnerProgramLedgerService {
  static async appendEntry(
    input: AppendLedgerEntryInput
  ): Promise<{ id: string; duplicate?: boolean }> {
    const db = getDatabase();
    await ensurePartnerProgramSchema(db);

    if (!isPartnerLedgerEntryType(input.entryType)) {
      throw Object.assign(
        new Error(`Unsupported partner ledger entry type: ${String(input.entryType)}`),
        {
          code: 'P29_LEDGER_ENTRY_TYPE_INVALID',
          entryType: input.entryType,
        }
      );
    }

    if (!Number.isFinite(input.amount)) {
      throw Object.assign(new Error('Partner ledger amount must be finite'), {
        code: 'P29_LEDGER_AMOUNT_INVALID',
      });
    }

    const governedEntry = input.entryType !== 'lifecycle.transition';
    const ruleVersion = String(input.ruleVersion || '').trim();
    if (governedEntry && !ruleVersion) {
      throw Object.assign(new Error(`ruleVersion is required for ${input.entryType}`), {
        code: 'P29_LEDGER_RULE_VERSION_REQUIRED',
      });
    }
    const relatedEntryRequired = [
      'accrual.adjustment',
      'accrual.reversal',
      'dispute.opened',
      'dispute.resolved',
    ].includes(input.entryType);
    if (relatedEntryRequired && !input.relatedEntryId) {
      throw Object.assign(new Error(`relatedEntryId is required for ${input.entryType}`), {
        code: 'P29_LEDGER_RELATED_ENTRY_REQUIRED',
      });
    }

    if (requiresDualControl(input.entryType, input.amount, false)) {
      const prevPayout = await DbPromise.get<{ id: string }>(
        db,
        `SELECT id FROM partner_program_ledger WHERE partner_org_id = ? AND entry_type = 'payout.executed' LIMIT 1`,
        [input.partnerOrgId]
      );
      const isFirst = !prevPayout;
      if (requiresDualControl(input.entryType, input.amount, isFirst)) {
        const confirmed = (input.sourceRef as Record<string, unknown> | undefined)
          ?.elevatedRiskConfirmed;
        if (!confirmed) {
          throw Object.assign(
            new Error(
              `Dual-control required for ${input.entryType} (amount=${input.amount}, firstPayout=${isFirst}). Pass sourceRef.elevatedRiskConfirmed = true.`
            ),
            { code: 'P29_DUAL_CONTROL_REQUIRED', amount: input.amount, isFirstPayout: isFirst }
          );
        }
      }
    }

    if (input.idempotencyKey) {
      const existing = await DbPromise.get<{ id: string }>(
        db,
        `SELECT id FROM partner_program_ledger WHERE partner_org_id = ? AND idempotency_key = ?`,
        [input.partnerOrgId, input.idempotencyKey]
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
        source_ref, actor, actor_id, correlation_id, idempotency_key, reason_code, note,
        rule_version, related_entry_id, dispute_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
        governedEntry ? ruleVersion : input.ruleVersion || 'lifecycle-v1',
        input.relatedEntryId ?? null,
        input.disputeStatus ?? null,
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
              source_ref, actor, actor_id, correlation_id, idempotency_key, reason_code, note,
              rule_version, related_entry_id, dispute_status
       FROM partner_program_ledger
       WHERE partner_org_id = ?
       ORDER BY occurred_at DESC, recorded_at DESC
       LIMIT ? OFFSET ?`,
      [partnerOrgId, limit, offset]
    );
    return rows;
  }

  static async getBalances(
    partnerOrgId: string,
    currency = 'EUR'
  ): Promise<PartnerProgramBalances> {
    const db = getDatabase();
    await ensurePartnerProgramSchema(db);
    const rows = await DbPromise.all<{ entry_type: string; amount: number }>(
      db,
      `SELECT entry_type, amount FROM partner_program_ledger WHERE partner_org_id = ?`,
      [partnerOrgId],
      { fallback: false }
    );
    const ledgerBalances = deriveBalancesFromEntries(rows, currency);

    // Cross-check the ledger's reconciled total against the settled payout
    // register and project `paidOut` from the register, so the Earnings total
    // and the Payouts list always speak from the same source. Previously the
    // total came from the ledger alone and rendered "0 paid" directly above a
    // COMPLETED payout — a contradiction the partner had no way to explain.
    let settledPayouts: number | null = null;
    try {
      const settled = await DbPromise.get<{ total: number | string | null }>(
        db,
        `SELECT COALESCE(SUM(net_amount), 0) AS total
           FROM partner_payouts
          WHERE partner_org_id = ? AND status = 'COMPLETED'`,
        [partnerOrgId],
        { fallback: false }
      );
      settledPayouts = Math.round((Number(settled?.total) || 0) * 10000) / 10000;
    } catch (e) {
      logger.warn('[PartnerProgramLedger] settled payout register unreadable', e);
    }

    if (settledPayouts === null) {
      return {
        ...ledgerBalances,
        paidReconciliation: {
          status: 'REGISTER_UNAVAILABLE',
          ledgerReconciled: ledgerBalances.paidOut,
          settledPayouts: 0,
          unreconciledAmount: 0,
        },
      };
    }

    const ledgerReconciled = ledgerBalances.paidOut;
    const paidOut = Math.max(ledgerReconciled, settledPayouts);
    const unreconciledAmount = Math.round(Math.max(0, settledPayouts - ledgerReconciled) * 10000) / 10000;

    return {
      ...ledgerBalances,
      paidOut,
      availableToPayout:
        Math.round(Math.max(0, ledgerBalances.grossEarned - paidOut - ledgerBalances.heldAmount) * 10000) /
        10000,
      paidReconciliation: {
        status: unreconciledAmount > 0 ? 'LEDGER_BEHIND_REGISTER' : 'RECONCILED',
        ledgerReconciled,
        settledPayouts,
        unreconciledAmount,
      },
    };
  }

  /** Ostatni wpis hold.placed (dla komunikatów hold / review). */
  static async getLatestHoldPlaced(
    partnerOrgId: string
  ): Promise<{ amount: number; reason_code: string | null; note: string | null } | null> {
    const db = getDatabase();
    await ensurePartnerProgramSchema(db);
    const row = await DbPromise.get<{
      amount: number;
      reason_code: string | null;
      note: string | null;
    }>(
      db,
      `SELECT amount, reason_code, note FROM partner_program_ledger
       WHERE partner_org_id = ? AND entry_type = 'hold.placed'
       ORDER BY occurred_at DESC LIMIT 1`,
      [partnerOrgId],
      { fallback: false }
    );
    return row ?? null;
  }

  /**
   * P29-B: jedna odpowiedź statusu dla partnera i operatora + whatNext + hold (bounded exposure).
   */
  static async getProgramStatusDetail(
    partnerOrgId: string,
    audience: 'partner' | 'operator'
  ): Promise<{
    runtime: Awaited<ReturnType<typeof PartnerProgramLedgerService.getOrCreateRuntime>>;
    balances: PartnerProgramBalances;
    whatNext: string[];
    hold: {
      amount: number;
      reasonCode: string | null;
      note: string | null;
    } | null;
    degraded?: { reason: string; snapshotAt: string };
  }> {
    const runtime = await this.getOrCreateRuntime(partnerOrgId);

    let balances: PartnerProgramBalances;
    let degraded: { reason: string; snapshotAt: string } | undefined;
    try {
      balances = await this.getBalances(partnerOrgId);
    } catch (e) {
      logger.warn('[PartnerProgramLedger] getBalances failed — returning zero snapshot', e);
      // A zero snapshot is NOT a statement that the partner earned nothing —
      // it means we could not read the ledger. `degraded` is what the UI keys
      // on to say so out loud instead of rendering a confident 0.
      balances = {
        grossEarned: 0,
        paidOut: 0,
        heldAmount: 0,
        availableToPayout: 0,
        currency: 'EUR',
        paidReconciliation: {
          status: 'REGISTER_UNAVAILABLE',
          ledgerReconciled: 0,
          settledPayouts: 0,
          unreconciledAmount: 0,
        },
      };
      degraded = { reason: 'ledger_unavailable', snapshotAt: new Date().toISOString() };
    }

    const latestHold =
      balances.heldAmount > 0 ? await this.getLatestHoldPlaced(partnerOrgId) : null;
    const activeHoldForGuidance =
      latestHold && balances.heldAmount > 0
        ? {
            reasonCode: latestHold.reason_code,
            note: latestHold.note,
            amount: Number(latestHold.amount),
          }
        : undefined;
    const whatNext = buildPartnerWhatNextGuidance({
      lifecyclePhase: runtime.lifecycle_phase,
      balances,
      audience,
      partnerOrgStatus: runtime.partner_status,
      activeHold: activeHoldForGuidance ?? null,
    });
    const hold =
      latestHold && balances.heldAmount > 0
        ? {
            amount: Number(latestHold.amount),
            reasonCode: latestHold.reason_code,
            note: audience === 'operator' ? latestHold.note : null,
          }
        : null;
    return { runtime, balances, whatNext, hold, ...(degraded ? { degraded } : {}) };
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
    const derivedChecklist = await buildOnboardChecklistSnapshot(db, partnerOrgId);
    const derivedChecklistJson = JSON.stringify(derivedChecklist);

    if (!row) {
      const initialPhase: PartnerLifecyclePhase = partnerStatus === 'active' ? 'earn' : 'onboard';
      const ts = new Date().toISOString();
      await DbPromise.run(
        db,
        `INSERT INTO partner_program_runtime (
          partner_org_id, lifecycle_phase, onboard_checklist_json, updated_at
        ) VALUES (?, ?, ?, ?)`,
        [partnerOrgId, initialPhase, derivedChecklistJson, ts]
      );
      row = { lifecycle_phase: initialPhase, onboard_checklist_json: derivedChecklistJson };
    } else {
      await DbPromise.run(
        db,
        `UPDATE partner_program_runtime
         SET onboard_checklist_json = ?, updated_at = ?
         WHERE partner_org_id = ?`,
        [derivedChecklistJson, new Date().toISOString(), partnerOrgId]
      );
      row = {
        ...row,
        onboard_checklist_json: derivedChecklistJson,
      };
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
      throw Object.assign(new Error('Operator-only transition'), {
        code: 'P29_LIFECYCLE_FORBIDDEN',
      });
    }
    if (rule.actor === 'partner' && params.actor !== 'partner') {
      throw Object.assign(new Error('Partner-only transition'), {
        code: 'P29_LIFECYCLE_FORBIDDEN',
      });
    }
    if (from === 'onboard' && params.toPhase === 'activate') {
      const checklist = parseChecklist(rt.onboard_checklist_json);
      if (!isOnboardChecklistComplete(checklist)) {
        throw Object.assign(new Error('Onboarding checklist incomplete'), {
          code: 'P29_ONBOARDING_INCOMPLETE',
          checklist,
        });
      }
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
