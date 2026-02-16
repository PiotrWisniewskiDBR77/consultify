import { describe, expect, it } from 'vitest';

import {
  InitiativeStatus,
  getLifecycleOrder,
  getStatusLabel,
  getValidNextStatuses,
  isValidTransition,
  validateTransition,
} from '../../../../server/src/constants/initiativeStatuses.ts';

describe('initiativeStatuses: labels + transitions helpers', () => {
  it('returns localized status labels from metadata', () => {
    expect(getStatusLabel(InitiativeStatus.DRAFT, 'pl')).toBe('Szkic');
    expect(getStatusLabel(InitiativeStatus.DRAFT, 'en')).toBe('Draft');
  });

  it('returns a deterministic lifecycle order list', () => {
    const order = getLifecycleOrder();
    expect(order[0]).toBe(InitiativeStatus.DRAFT);
    expect(order[1]).toBe(InitiativeStatus.PENDING_REVIEW);
    expect(order[order.length - 1]).toBe(InitiativeStatus.ARCHIVED);
  });

  it('checks validity of transitions via VALID_TRANSITIONS', () => {
    expect(isValidTransition(InitiativeStatus.DRAFT, InitiativeStatus.PENDING_REVIEW)).toBe(true);
    expect(isValidTransition(InitiativeStatus.DRAFT, InitiativeStatus.APPROVED)).toBe(false);
  });

  it('returns valid next statuses for a given status', () => {
    const next = getValidNextStatuses(InitiativeStatus.DRAFT);
    expect(next).toEqual(
      expect.arrayContaining([InitiativeStatus.PENDING_REVIEW, InitiativeStatus.CANCELLED])
    );
  });

  it('enforces additional validation rules (BLOCKED requires blockedReason)', () => {
    const res = validateTransition(InitiativeStatus.EXECUTING, InitiativeStatus.BLOCKED, {
      userRole: 'PMO',
    } as any);
    expect(res.valid).toBe(false);
    expect(res.reason).toBe('Blocked status requires a reason');
  });
});
