import { describe, expect, it } from 'vitest';

import {
  INITIATIVE_TRANSITION_MATRIX,
  InitiativeStatus,
  Role,
  getTransitionDefinition,
  isValidTransition,
  validateTransition,
  type InitiativeStatusType,
  type TransitionValidationContext,
} from '../../../../server/src/constants/initiativeStatuses';

const validContext: TransitionValidationContext = {
  userRole: Role.ADMIN,
  isAuthor: true,
  title: 'Tytuł',
  justification: 'Uzasadnienie',
  description: 'Opis',
  ownerId: 'owner-1',
  scope: 'Zakres',
  reason: 'Powód',
  pendingTasks: 0,
  hasBlockingDecisions: false,
  hasCurrentGoDecision: true,
  hasAcceptedHandoff: true,
  startDate: '2026-09-06',
};

describe('DEC-424 — kanoniczna macierz siedmiu statusów', () => {
  it('ma dokładnie siedem statusów i dziesięć jawnych krawędzi', () => {
    expect(Object.values(InitiativeStatus)).toEqual([
      'PROPOSED', 'DRAFT', 'PENDING_APPROVAL', 'APPROVED',
      'IN_EXECUTION', 'CLOSED', 'REJECTED',
    ]);
    expect(INITIATIVE_TRANSITION_MATRIX).toHaveLength(10);
  });

  it('odrzuca każdą parę spoza macierzy, w tym przejścia ze statusów terminalnych', () => {
    const statuses = Object.values(InitiativeStatus) as InitiativeStatusType[];
    for (const from of statuses) {
      for (const to of statuses) {
        const inMatrix = getTransitionDefinition(from, to) !== null;
        expect(isValidTransition(from, to), `${from} -> ${to}`).toBe(inMatrix);
      }
    }
    expect(INITIATIVE_TRANSITION_MATRIX.every((row) => row.from !== InitiativeStatus.CLOSED)).toBe(true);
    expect(INITIATIVE_TRANSITION_MATRIX.every((row) => row.from !== InitiativeStatus.REJECTED)).toBe(true);
  });

  it.each(INITIATIVE_TRANSITION_MATRIX)(
    '$from -> $to wymaga jednej z przypisanych ról',
    (row) => {
      const denied = validateTransition(row.from, row.to, {
        ...validContext,
        userRole: Role.TEAM_MEMBER,
      });
      expect(denied.valid).toBe(false);
      expect(denied.requiredRoles).toEqual(row.roles);

      const allowed = validateTransition(row.from, row.to, {
        ...validContext,
        userRole: row.roles[0],
      });
      expect(allowed.valid).toBe(true);
    }
  );

  it('ADMIN nie omija warunku merytorycznego', () => {
    expect(validateTransition(InitiativeStatus.PROPOSED, InitiativeStatus.REJECTED, {
      userRole: Role.ADMIN,
    })).toMatchObject({ valid: false, reason: 'Reason is required' });
  });
});
