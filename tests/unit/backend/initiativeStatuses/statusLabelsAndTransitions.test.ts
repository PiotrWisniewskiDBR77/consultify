import { describe, expect, it } from 'vitest';
import { InitiativeStatus, getLifecycleOrder, getStatusLabel, getValidNextStatuses, isValidTransition, validateTransition } from '../../../../server/src/constants/initiativeStatuses.ts';

describe('initiativeStatuses: DEC-424 labels + transition helpers', () => {
  it('returns the generated translation key from metadata', () => {
    expect(getStatusLabel(InitiativeStatus.DRAFT)).toBe('initiatives.status.DRAFT');
  });
  it('returns the exact seven-status lifecycle order', () => {
    expect(getLifecycleOrder()).toEqual(Object.values(InitiativeStatus));
  });
  it('checks transitions through the canonical matrix', () => {
    expect(isValidTransition(InitiativeStatus.DRAFT, InitiativeStatus.PENDING_APPROVAL)).toBe(true);
    expect(isValidTransition(InitiativeStatus.DRAFT, InitiativeStatus.APPROVED)).toBe(false);
    expect(getValidNextStatuses(InitiativeStatus.DRAFT)).toEqual([InitiativeStatus.PENDING_APPROVAL]);
  });
  it('requires a reason on canonical rejection', () => {
    const result = validateTransition(InitiativeStatus.IN_EXECUTION, InitiativeStatus.REJECTED, { userRole: 'PMO' });
    expect(result).toEqual({ valid: false, reason: 'Reason is required' });
  });
});
