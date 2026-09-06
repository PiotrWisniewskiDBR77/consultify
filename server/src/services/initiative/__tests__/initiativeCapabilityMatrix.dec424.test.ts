import { describe, expect, it } from 'vitest';

import { GateType } from '../../../constants/initiativeStatuses';
import { canExecuteGate } from '../initiativeCapabilityMatrix';

describe('DEC-424 — fail closed i administracja', () => {
  it('brak bramki oznacza zakaz, a nie przejście bez kontroli', () => {
    expect(canExecuteGate({
      gate: null,
      effectiveRoles: ['ADMIN'],
      steeringBoardEnabled: true,
      conditionSatisfied: true,
    })).toBe(false);
  });

  it.each(['ADMIN', 'SUPERADMIN'])('%s omija rolę, ale nie warunek merytoryczny', (role) => {
    expect(canExecuteGate({
      gate: GateType.APPROVE,
      effectiveRoles: [role],
      steeringBoardEnabled: true,
      conditionSatisfied: false,
    })).toBe(false);
    expect(canExecuteGate({
      gate: GateType.APPROVE,
      effectiveRoles: [role],
      steeringBoardEnabled: true,
      conditionSatisfied: true,
    })).toBe(true);
  });
});
