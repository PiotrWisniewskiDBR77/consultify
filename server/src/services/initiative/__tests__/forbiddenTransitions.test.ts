/**
 * P11 §2.3.2 — Forbidden transitions test suite (AC-30).
 * Verifies that the transition matrix rejects backward and invalid transitions.
 */
import { describe, expect, it } from 'vitest';

import {
  InitiativeStatus,
  type InitiativeStatusType,
  isValidTransition,
  VALID_TRANSITIONS,
  validateTransition,
} from '../../../constants/initiativeStatuses.js';

const ALL_STATUSES = Object.values(InitiativeStatus) as InitiativeStatusType[];

const FORBIDDEN_PAIRS: Array<[InitiativeStatusType, InitiativeStatusType, string]> = [
  [InitiativeStatus.DONE, InitiativeStatus.EXECUTING, 'delivered cannot revert to executing'],
  [InitiativeStatus.DONE, InitiativeStatus.APPROVED, 'delivered cannot jump back to approved'],
  [InitiativeStatus.DONE, InitiativeStatus.PLANNING, 'delivered cannot revert to planning'],
  [InitiativeStatus.TRACKING, InitiativeStatus.DONE, 'tracking cannot revert to done'],
  [InitiativeStatus.TRACKING, InitiativeStatus.EXECUTING, 'tracking cannot revert to executing'],
  [InitiativeStatus.ARCHIVED, InitiativeStatus.EXECUTING, 'archived cannot revert to executing'],
  [InitiativeStatus.ARCHIVED, InitiativeStatus.DRAFT, 'archived cannot revert to draft'],
  [InitiativeStatus.CANCELLED, InitiativeStatus.EXECUTING, 'cancelled cannot revert to executing'],
  [InitiativeStatus.CANCELLED, InitiativeStatus.PLANNING, 'cancelled cannot revert to planning'],
  [InitiativeStatus.EXECUTING, InitiativeStatus.APPROVED, 'executing cannot revert to approved'],
  [InitiativeStatus.EXECUTING, InitiativeStatus.PLANNING, 'executing cannot revert to planning'],
  [InitiativeStatus.EXECUTING, InitiativeStatus.DRAFT, 'executing cannot revert to draft'],
  [InitiativeStatus.APPROVED, InitiativeStatus.REVIEW, 'approved cannot revert to review'],
  [InitiativeStatus.APPROVED, InitiativeStatus.DRAFT, 'approved cannot revert to draft'],
  [InitiativeStatus.PLANNING, InitiativeStatus.REVIEW, 'planning cannot revert to review'],
  [InitiativeStatus.SCHEDULED, InitiativeStatus.APPROVED, 'scheduled cannot revert to approved'],
  [InitiativeStatus.BLOCKED, InitiativeStatus.DONE, 'blocked cannot skip to done'],
  [InitiativeStatus.BLOCKED, InitiativeStatus.APPROVED, 'blocked cannot revert to approved'],
];

describe('P11 §2.3.2 — forbidden transitions (AC-30)', () => {
  it.each(FORBIDDEN_PAIRS)('rejects %s → %s (%s)', (from, to, _reason) => {
    expect(isValidTransition(from, to)).toBe(false);
  });

  it('ARCHIVED is a terminal state with zero valid transitions', () => {
    const next = VALID_TRANSITIONS[InitiativeStatus.ARCHIVED];
    expect(next).toEqual([]);
  });

  it('no status can transition to itself', () => {
    for (const status of ALL_STATUSES) {
      expect(isValidTransition(status, status)).toBe(false);
    }
  });

  it('every transition in VALID_TRANSITIONS is forward or explicitly allowed (no hidden backward)', () => {
    // Typed as the full status union: the literal list omits members (BLOCKED,
    // CANCELLED) that `indexOf` is legitimately probed with below.
    const forwardOrder: InitiativeStatusType[] = [
      InitiativeStatus.DRAFT,
      InitiativeStatus.PENDING_REVIEW,
      InitiativeStatus.REVIEW,
      InitiativeStatus.PROMOTED,
      InitiativeStatus.PLANNING,
      InitiativeStatus.APPROVED,
      InitiativeStatus.SCHEDULED,
      InitiativeStatus.EXECUTING,
      InitiativeStatus.DONE,
      InitiativeStatus.TRACKING,
      InitiativeStatus.ARCHIVED,
    ];

    const allowedBackward = new Set(['PENDING_REVIEW→DRAFT', 'REVIEW→DRAFT', 'BLOCKED→EXECUTING']);

    for (const [from, targets] of Object.entries(VALID_TRANSITIONS)) {
      for (const to of targets as InitiativeStatusType[]) {
        if (to === InitiativeStatus.CANCELLED || to === InitiativeStatus.ARCHIVED) continue;

        const fromIdx = forwardOrder.indexOf(from as InitiativeStatusType);
        const toIdx = forwardOrder.indexOf(to as InitiativeStatusType);
        const key = `${from}→${to}`;

        if (fromIdx >= 0 && toIdx >= 0 && toIdx < fromIdx) {
          expect(allowedBackward.has(key)).toBe(true);
        }
      }
    }
  });

  it('validateTransition rejects invalid from→to with descriptive reason', () => {
    const result = validateTransition(InitiativeStatus.DONE, InitiativeStatus.EXECUTING, {
      userRole: 'ADMIN' as any,
    });
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('Cannot transition');
  });
});
