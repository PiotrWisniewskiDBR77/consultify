import { describe, expect, it } from 'vitest';

import {
  InitiativeStatus,
  getLifecycleProgress,
  isActiveStatus,
  isTerminalStatus,
  needsAttention,
} from '../../../../server/src/constants/initiativeStatuses.ts';

describe('initiativeStatuses: lifecycle progress + flags', () => {
  it('returns stable lifecycle progress values for key statuses', () => {
    expect(getLifecycleProgress(InitiativeStatus.DRAFT)).toBe(5);
    expect(getLifecycleProgress(InitiativeStatus.EXECUTING)).toBe(70);
    expect(getLifecycleProgress(InitiativeStatus.TRACKING)).toBe(100);
  });

  it('treats CANCELLED and ARCHIVED as terminal', () => {
    expect(isTerminalStatus(InitiativeStatus.CANCELLED)).toBe(true);
    expect(isTerminalStatus(InitiativeStatus.ARCHIVED)).toBe(true);
    expect(isTerminalStatus(InitiativeStatus.DONE)).toBe(false);
  });

  it('marks non-terminal statuses as active', () => {
    expect(isActiveStatus(InitiativeStatus.DRAFT)).toBe(true);
    expect(isActiveStatus(InitiativeStatus.ARCHIVED)).toBe(false);
  });

  it('flags attention-needed statuses', () => {
    expect(needsAttention(InitiativeStatus.BLOCKED)).toBe(true);
    expect(needsAttention(InitiativeStatus.PENDING_REVIEW)).toBe(true);
    expect(needsAttention(InitiativeStatus.REVIEW)).toBe(true);
  });

  it('does not flag attention for ordinary states', () => {
    expect(needsAttention(InitiativeStatus.DRAFT)).toBe(false);
    expect(needsAttention(InitiativeStatus.EXECUTING)).toBe(false);
  });
});
