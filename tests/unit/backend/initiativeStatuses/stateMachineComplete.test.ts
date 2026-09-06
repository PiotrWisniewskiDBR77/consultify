import { describe, expect, it } from 'vitest';

import {
  GATE_TRANSITIONS, INITIATIVE_FLAGS, INITIATIVE_TRANSITION_MATRIX, InitiativeStatus,
  Role, STATUS_METADATA, getGateForTransition, getValidNextStatuses, isValidTransition,
  validateTransition,
} from '../../../../server/src/constants/initiativeStatuses.ts';

const statuses = Object.values(InitiativeStatus);

describe('DEC-424 complete state machine', () => {
  it('contains exactly seven statuses and two independent flags', () => {
    expect(statuses).toEqual(['PROPOSED', 'DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'IN_EXECUTION', 'CLOSED', 'REJECTED']);
    expect(INITIATIVE_FLAGS).toEqual(['on_hold', 'archived']);
  });

  it('keeps server metadata language-neutral', () => {
    for (const status of statuses) expect(STATUS_METADATA[status].labelKey).toBe(`initiatives.status.${status}`);
    expect(JSON.stringify(STATUS_METADATA)).not.toContain('labelPL');
  });

  it('accepts exactly the matrix edges and rejects every other pair', () => {
    for (const from of statuses) for (const to of statuses) {
      const expected = INITIATIVE_TRANSITION_MATRIX.some((edge) => edge.from === from && edge.to === to);
      expect(isValidTransition(from, to), `${from}->${to}`).toBe(expected);
      expect(getValidNextStatuses(from).includes(to), `${from}->${to}`).toBe(expected);
    }
  });

  it('maps every matrix edge to its declared gate', () => {
    for (const edge of INITIATIVE_TRANSITION_MATRIX) {
      expect(getGateForTransition(edge.from, edge.to)).toBe(edge.gate);
      expect(GATE_TRANSITIONS[edge.gate].from).toContain(edge.from);
    }
  });

  it('requires substantive conditions even for ADMIN', () => {
    expect(validateTransition(InitiativeStatus.DRAFT, InitiativeStatus.PENDING_APPROVAL, { userRole: Role.ADMIN, hasRequiredArtefacts: false }).valid).toBe(false);
    expect(validateTransition(InitiativeStatus.APPROVED, InitiativeStatus.IN_EXECUTION, { userRole: Role.ADMIN, hasAcceptedHandoff: false, startDate: null }).valid).toBe(false);
  });

  it('accepts a complete APPROVED -> IN_EXECUTION handoff', () => {
    expect(validateTransition(InitiativeStatus.APPROVED, InitiativeStatus.IN_EXECUTION, { userRole: Role.PMO, hasAcceptedHandoff: true, startDate: '2026-09-07' }).valid).toBe(true);
  });
});
