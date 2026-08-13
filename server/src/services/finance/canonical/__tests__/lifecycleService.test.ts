/**
 * Pure unit tests for the WP-B02 state machine — no database. Every branch
 * runs synchronously against plain data, per the module's own design goal
 * (see the header comment in `lifecycleService.ts`).
 */
import { describe, expect, it } from 'vitest';

import {
  allowedActionsFromStatus,
  checkSelfApproval,
  defaultRiskTierForArtifactType,
  escalateRiskTier,
  isRiskTierDowngrade,
  isTerminal,
  resolveExpectedVersion,
  validateTransition,
} from '../lifecycleService.js';

describe('validateTransition — WP-B02 §3.2 transition table', () => {
  it('T2: DRAFT -> READY_FOR_REVIEW allowed for preparer', () => {
    const result = validateTransition('DRAFT', 'submit_for_review', 'preparer');
    expect(result).toEqual({ ok: true, toStatus: 'READY_FOR_REVIEW', requiresReason: false });
  });

  it('rejects a transition not defined for the current status (STATE_PRECONDITION_FAILED)', () => {
    const result = validateTransition('DRAFT', 'archive', 'finance_admin');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('STATE_PRECONDITION_FAILED');
  });

  it('rejects a role not in the allow-list for that transition (FORBIDDEN)', () => {
    const result = validateTransition('READY_FOR_REVIEW', 'start_review', 'preparer');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('FORBIDDEN');
  });

  it('T6 request_changes requires a reason (REASON_REQUIRED) when reasonProvided is false', () => {
    const result = validateTransition('IN_REVIEW', 'request_changes', 'reviewer', { reasonProvided: false });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('REASON_REQUIRED');
  });

  it('T6 request_changes succeeds once a reason is provided', () => {
    const result = validateTransition('IN_REVIEW', 'request_changes', 'reviewer', { reasonProvided: true });
    expect(result).toEqual({ ok: true, toStatus: 'NEEDS_CHANGES', requiresReason: true });
  });

  it('T11 invalidate is reachable by finance_admin and approver, requires a reason', () => {
    expect(validateTransition('APPROVED', 'invalidate', 'finance_admin', { reasonProvided: true }).ok).toBe(true);
    expect(validateTransition('APPROVED', 'invalidate', 'approver', { reasonProvided: true }).ok).toBe(true);
    expect(validateTransition('APPROVED', 'invalidate', 'preparer', { reasonProvided: true }).ok).toBe(false);
  });

  it('T7 resume_editing: NEEDS_CHANGES -> DRAFT for the preparer', () => {
    expect(validateTransition('NEEDS_CHANGES', 'resume_editing', 'preparer')).toEqual({
      ok: true,
      toStatus: 'DRAFT',
      requiresReason: false,
    });
  });

  it('withdraw has two legal source statuses (T3 from READY_FOR_REVIEW, T5 from IN_REVIEW), both -> DRAFT', () => {
    expect(validateTransition('READY_FOR_REVIEW', 'withdraw', 'preparer').ok).toBe(true);
    expect(validateTransition('IN_REVIEW', 'withdraw', 'preparer').ok).toBe(true);
  });

  it('terminal statuses have no outgoing transitions in the table (approve/reopen are handled elsewhere)', () => {
    for (const status of ['SUPERSEDED', 'ARCHIVED', 'INVALIDATED'] as const) {
      expect(isTerminal(status)).toBe(true);
      const result = validateTransition(status, 'submit_for_review', 'finance_admin');
      expect(result.ok).toBe(false);
    }
  });
});

describe('allowedActionsFromStatus — drives the UI action bar (OWN-FIN-012)', () => {
  it('DRAFT + preparer allows submit_for_review only', () => {
    expect(allowedActionsFromStatus('DRAFT', 'preparer')).toEqual(['submit_for_review']);
  });

  it('IN_REVIEW + approver allows request_changes and approve (approve is synthesized, not in TRANSITIONS)', () => {
    const actions = allowedActionsFromStatus('IN_REVIEW', 'approver');
    expect(actions).toContain('request_changes');
    expect(actions).toContain('approve');
  });

  it('APPROVED + approver allows archive, invalidate, and reopen', () => {
    const actions = allowedActionsFromStatus('APPROVED', 'approver');
    expect(actions).toEqual(expect.arrayContaining(['archive', 'invalidate', 'reopen']));
  });

  it('viewer never gets any mutating action', () => {
    for (const status of ['DRAFT', 'READY_FOR_REVIEW', 'IN_REVIEW', 'APPROVED', 'NEEDS_CHANGES'] as const) {
      expect(allowedActionsFromStatus(status, 'viewer')).toEqual([]);
    }
  });
});

describe('risk tier — WP-B02 §7.2', () => {
  it('default base tier per artifact type matches the ADR table', () => {
    expect(defaultRiskTierForArtifactType('STATEMENT_PACK')).toBe('MATERIAL');
    expect(defaultRiskTierForArtifactType('HISTORICAL_ANALYSIS')).toBe('LOW');
    expect(defaultRiskTierForArtifactType('BASELINE_MODEL')).toBe('MATERIAL');
    expect(defaultRiskTierForArtifactType('PREDICTION_SCENARIO')).toBe('MATERIAL');
    expect(defaultRiskTierForArtifactType('VALUATION_CASE')).toBe('HIGH_RISK');
  });

  it('escalateRiskTier moves exactly one level and never past HIGH_RISK', () => {
    expect(escalateRiskTier('LOW')).toBe('MATERIAL');
    expect(escalateRiskTier('MATERIAL')).toBe('HIGH_RISK');
    expect(escalateRiskTier('HIGH_RISK')).toBe('HIGH_RISK');
  });

  it('isRiskTierDowngrade flags any proposed tier below the computed floor, never above', () => {
    expect(isRiskTierDowngrade('MATERIAL', 'LOW')).toBe(true);
    expect(isRiskTierDowngrade('MATERIAL', 'MATERIAL')).toBe(false);
    expect(isRiskTierDowngrade('MATERIAL', 'HIGH_RISK')).toBe(false);
  });
});

describe('checkSelfApproval — WP-B02 §7.2 point 6 (SoD gate)', () => {
  it('LOW tier never blocks, even if approver === submitter', () => {
    const result = checkSelfApproval({ riskTier: 'LOW', approverUserId: 'u1', submittedBy: 'u1' });
    expect(result.forbidden).toBe(false);
  });

  it('MATERIAL blocks approver === submittedBy', () => {
    const result = checkSelfApproval({ riskTier: 'MATERIAL', approverUserId: 'u1', submittedBy: 'u1' });
    expect(result).toEqual({ forbidden: true, code: 'SELF_APPROVAL_FORBIDDEN', conflictingRole: 'preparer' });
  });

  it('MATERIAL blocks approver in the editor list even if not the submitter', () => {
    const result = checkSelfApproval({
      riskTier: 'MATERIAL',
      approverUserId: 'u2',
      submittedBy: 'u1',
      editorUserIds: ['u1', 'u2'],
    });
    expect(result.forbidden).toBe(true);
  });

  it('MATERIAL does NOT block the reviewer from approving (only HIGH_RISK does)', () => {
    const result = checkSelfApproval({
      riskTier: 'MATERIAL',
      approverUserId: 'u3',
      submittedBy: 'u1',
      reviewStartedBy: 'u3',
    });
    expect(result.forbidden).toBe(false);
  });

  it('HIGH_RISK additionally blocks approver === reviewStartedBy', () => {
    const result = checkSelfApproval({
      riskTier: 'HIGH_RISK',
      approverUserId: 'u3',
      submittedBy: 'u1',
      reviewStartedBy: 'u3',
    });
    expect(result).toEqual({ forbidden: true, code: 'SELF_APPROVAL_FORBIDDEN', conflictingRole: 'reviewer' });
  });

  it('a genuinely independent approver is never blocked at any tier', () => {
    const result = checkSelfApproval({
      riskTier: 'HIGH_RISK',
      approverUserId: 'u4',
      submittedBy: 'u1',
      editorUserIds: ['u1', 'u2'],
      reviewStartedBy: 'u3',
    });
    expect(result.forbidden).toBe(false);
  });
});

describe('resolveExpectedVersion — WP-B02 §4.2', () => {
  it('both present and equal -> resolved', () => {
    expect(resolveExpectedVersion(5, 5)).toEqual({ ok: true, expectedVersion: 5 });
  });

  it('both present and different -> AMBIGUOUS_VERSION_HINT', () => {
    const result = resolveExpectedVersion(5, 6);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('AMBIGUOUS_VERSION_HINT');
  });

  it('neither present, required -> EXPECTED_VERSION_REQUIRED', () => {
    const result = resolveExpectedVersion(undefined, undefined, { required: true });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('EXPECTED_VERSION_REQUIRED');
  });

  it('neither present, not required -> ok with undefined', () => {
    expect(resolveExpectedVersion(undefined, undefined, { required: false })).toEqual({
      ok: true,
      expectedVersion: undefined,
    });
  });

  it('only one present -> resolved to that one', () => {
    expect(resolveExpectedVersion(7, undefined)).toEqual({ ok: true, expectedVersion: 7 });
    expect(resolveExpectedVersion(undefined, 9)).toEqual({ ok: true, expectedVersion: 9 });
  });
});
