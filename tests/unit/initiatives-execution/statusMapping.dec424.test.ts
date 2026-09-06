import { describe, expect, it } from 'vitest';

import { InitiativeStatus } from '../../../packages/shared/src/constants/initiativeStatuses.generated';
import { INITIATIVE_LIFECYCLE } from '../../../src/contracts/initiatives-execution/foundation';
import { mapInitiativeStatus } from '../../../src/contracts/initiatives-execution/statusMapping';

describe('DEC-424 — jedno mapowanie runtime-v1', () => {
  it('obsługuje 12/12 wartości i zachowuje każdą w relacji odwrotnej', () => {
    expect(INITIATIVE_LIFECYCLE).toHaveLength(12);
    for (const lifecycle of INITIATIVE_LIFECYCLE) {
      const projection = mapInitiativeStatus({ direction: 'runtime-to-status', lifecycle });
      expect(Object.values(InitiativeStatus)).toContain(projection.status);
      const inverse = mapInitiativeStatus({ direction: 'status-to-runtime', status: projection.status });
      expect(inverse, lifecycle).toContain(lifecycle);
    }
  });

  it('ARCHIVED daje CLOSED z flagą archived, a EFFECTIVENESS_REVIEWED nie wpada w DRAFT', () => {
    expect(mapInitiativeStatus({ direction: 'runtime-to-status', lifecycle: 'ARCHIVED' }))
      .toEqual({ status: 'CLOSED', archived: true });
    expect(mapInitiativeStatus({ direction: 'runtime-to-status', lifecycle: 'EFFECTIVENESS_REVIEWED' }).status)
      .toBe('CLOSED');
  });

  it('nie zgaduje nieznanego kodu legacy', () => {
    expect(mapInitiativeStatus({ direction: 'legacy-to-runtime', status: 'UNKNOWN_P12' })).toBeNull();
  });
});
