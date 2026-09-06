import { describe, expect, it } from 'vitest';
import { InitiativeStatus, getLifecycleProgress, isActiveStatus, isTerminalStatus, needsAttention } from '../../../../server/src/constants/initiativeStatuses.ts';

describe('initiativeStatuses: DEC-424 lifecycle + flags', () => {
  it('returns stable progress for the canonical lifecycle', () => {
    expect(getLifecycleProgress(InitiativeStatus.PROPOSED)).toBe(0);
    expect(getLifecycleProgress(InitiativeStatus.DRAFT)).toBe(10);
    expect(getLifecycleProgress(InitiativeStatus.IN_EXECUTION)).toBe(75);
    expect(getLifecycleProgress(InitiativeStatus.CLOSED)).toBe(100);
  });
  it('treats CLOSED and REJECTED as terminal', () => {
    expect(isTerminalStatus(InitiativeStatus.CLOSED)).toBe(true);
    expect(isTerminalStatus(InitiativeStatus.REJECTED)).toBe(true);
    expect(isTerminalStatus(InitiativeStatus.IN_EXECUTION)).toBe(false);
  });
  it('marks only non-terminal statuses as active', () => {
    expect(isActiveStatus(InitiativeStatus.DRAFT)).toBe(true);
    expect(isActiveStatus(InitiativeStatus.CLOSED)).toBe(false);
  });
  it('flags PENDING_APPROVAL as attention-needed', () => {
    expect(needsAttention(InitiativeStatus.PENDING_APPROVAL)).toBe(true);
    expect(needsAttention(InitiativeStatus.DRAFT)).toBe(false);
    expect(needsAttention(InitiativeStatus.IN_EXECUTION)).toBe(false);
  });
});
