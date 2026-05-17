/**
 * Validation Status Service (Block B · EPIC-T9 · Sprint 3)
 *
 * Owns the `tp_records.validation_status` lifecycle. The state machine
 * deliberately keeps AI auto-promotion impossible — promotion to `verified`
 * requires a human actor (B-S2 service-level invariant).
 *
 * State machine:
 *
 *   ┌────────────┐   verifyHuman    ┌──────────┐   flag       ┌─────────┐
 *   │ unverified │ ───────────────▶ │ verified │ ───────────▶ │ flagged │
 *   └────────────┘                  └──────────┘              └─────────┘
 *         ▲                              ▲   reset                ▲
 *         │ flag                          ──── (admin only) ───────
 *         │
 *         └─────── reset (admin only, from any state) ────────────┘
 *
 * Allowed transitions (current → next):
 *   unverified → verified   (any data_editor)
 *   unverified → flagged    (any data_editor)
 *   verified   → flagged    (any data_editor)
 *   verified   → unverified (super-admin only)
 *   flagged    → verified   (any data_editor)
 *   flagged    → unverified (super-admin only)
 *
 * Audit:
 *   * Every flip writes `tp_audit_events` with
 *     `entity_type='record_validation'`, `entity_id=<recordId>`.
 *   * Audit is the source of truth for the `validation_status_history` UI;
 *     no separate ledger column exists.
 *
 * Confidence recompute:
 *   * After a successful flip the service triggers
 *     `confidenceScoringService.recompute(recordId)` so the score reflects
 *     the new bonus / penalty. The recompute is best-effort — failures are
 *     logged but do not roll back the state change.
 */

import { getDatabase } from '../../database/Database.js';
import logger from '../../utils/Logger.js';
import auditService from './AuditService.js';
import confidenceScoringService from './ConfidenceScoringService.js';

export type ValidationStatus = 'unverified' | 'verified' | 'flagged';

const ALLOWED_TRANSITIONS: Record<ValidationStatus, ValidationStatus[]> = {
  unverified: ['verified', 'flagged'],
  verified: ['flagged', 'unverified'],
  flagged: ['verified', 'unverified'],
};

// Transitions back to `unverified` are admin-only by policy: they erase the
// signal that someone looked at the record. `flagged → verified` is allowed
// for any data_editor because flagging is the easier action and recovery
// must be cheap.
const ADMIN_ONLY_TRANSITIONS: Set<string> = new Set([
  'verified->unverified',
  'flagged->unverified',
]);

export interface SetStatusOptions {
  actorUserId: string;
  isSuperAdmin?: boolean;
  note?: string;
}

export interface SetStatusResult {
  recordId: string;
  previous: ValidationStatus;
  next: ValidationStatus;
  changed: boolean;
}

function makeError(code: string, message: string): Error {
  const err = new Error(message);
  (err as { code?: string }).code = code;
  return err;
}

function isValidationStatus(v: unknown): v is ValidationStatus {
  return v === 'unverified' || v === 'verified' || v === 'flagged';
}

const validationStatusService = {
  ALLOWED_TRANSITIONS,

  getAllowedTransitions(currentStatus: ValidationStatus): ValidationStatus[] {
    return [...(ALLOWED_TRANSITIONS[currentStatus] ?? [])];
  },

  isAdminOnlyTransition(from: ValidationStatus, to: ValidationStatus): boolean {
    return ADMIN_ONLY_TRANSITIONS.has(`${from}->${to}`);
  },

  async getStatus(recordId: string): Promise<ValidationStatus | null> {
    if (!recordId) throw makeError('INVALID_INPUT', 'recordId is required');
    const db = getDatabase();
    const result = await db.query('SELECT validation_status FROM tp_records WHERE id = $1', [
      recordId,
    ]);
    const row = result.rows[0] as { validation_status: ValidationStatus | null } | undefined;
    if (!row) return null;
    return (row.validation_status as ValidationStatus | null) ?? 'unverified';
  },

  async setStatus(
    recordId: string,
    nextStatus: ValidationStatus,
    options: SetStatusOptions
  ): Promise<SetStatusResult> {
    if (!recordId) throw makeError('INVALID_INPUT', 'recordId is required');
    if (!isValidationStatus(nextStatus)) {
      throw makeError('INVALID_INPUT', `Invalid validation_status: ${String(nextStatus)}`);
    }
    if (!options?.actorUserId) {
      throw makeError('INVALID_INPUT', 'actorUserId is required');
    }

    const current = await this.getStatus(recordId);
    if (current === null) {
      throw makeError('RECORD_NOT_FOUND', `Record not found: ${recordId}`);
    }

    if (current === nextStatus) {
      return { recordId, previous: current, next: current, changed: false };
    }

    const allowed = ALLOWED_TRANSITIONS[current] ?? [];
    if (!allowed.includes(nextStatus)) {
      throw makeError(
        'INVALID_VALIDATION_TRANSITION',
        `Invalid transition from '${current}' to '${nextStatus}'. Allowed: ${
          allowed.join(', ') || '(none)'
        }`
      );
    }

    if (this.isAdminOnlyTransition(current, nextStatus) && !options.isSuperAdmin) {
      throw makeError(
        'TRANSITION_REQUIRES_SUPER_ADMIN',
        `Transition '${current}' → '${nextStatus}' requires super-admin`
      );
    }

    const db = getDatabase();
    const updateResult = await db.query(
      `UPDATE tp_records SET validation_status = $1 WHERE id = $2 RETURNING id`,
      [nextStatus, recordId]
    );
    if (updateResult.rows.length === 0) {
      // Race: record disappeared between SELECT and UPDATE.
      throw makeError('RECORD_NOT_FOUND', `Record disappeared mid-update: ${recordId}`);
    }

    try {
      await auditService.logEvent(
        'record_validation_status_changed',
        'record_validation',
        recordId,
        options.actorUserId,
        { validation_status: current },
        { validation_status: nextStatus },
        {
          note: options.note ?? null,
          is_super_admin: options.isSuperAdmin ?? false,
        }
      );
    } catch (auditErr) {
      logger.error('[ValidationStatusService] audit emit failed (state already mutated)', {
        recordId,
        from: current,
        to: nextStatus,
        error: (auditErr as Error).message,
      });
    }

    // Recompute confidence to reflect the new bonus / penalty. Best-effort —
    // do NOT roll back the state change if recompute throws (the score will
    // catch up on the next mutation or via a manual recompute).
    try {
      await confidenceScoringService.recompute(recordId);
    } catch (recomputeErr) {
      logger.warn('[ValidationStatusService] confidence recompute after flip failed', {
        recordId,
        error: (recomputeErr as Error).message,
      });
    }

    return { recordId, previous: current, next: nextStatus, changed: true };
  },
};

export type ValidationStatusService = typeof validationStatusService;
export default validationStatusService;
