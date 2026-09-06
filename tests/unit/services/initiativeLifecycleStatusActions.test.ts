import { describe, expect, it } from 'vitest';

import {
  getStatusActions,
  VALID_TRANSITIONS,
} from '../../../src/services/initiativeLifecycle';
import { InitiativeStatus } from '../../../src/types/initiative';

/**
 * Niezmiennik listy akcji statusu: `targetStatus` jest KLUCZEM, nie etykietą.
 *
 * ★ Powód powstania (2026-08-30, tor grafiki, ekran
 * `assessment-initiatives-panel`): konsumenci renderują `getStatusActions()`
 * jako listę kluczowaną po `targetStatus` — `<option key={a.targetStatus}>`
 * w `InitiativesManagementPanel` / `ExecutionInitiativeStatusControl` oraz
 * `id: status-<target>` w kebabie StandardTable. Dwie akcje o tym samym
 * `targetStatus` dawały twardy błąd Reacta „Encountered two children with the
 * same key. Test pilnuje niezmiennika dla wszystkich siedmiu statusów DEC-424.
 */
describe('getStatusActions — targetStatus jako klucz listy', () => {
  const ALL_STATUSES = Object.keys(VALID_TRANSITIONS) as InitiativeStatus[];

  it.each(ALL_STATUSES)('%s: żadne dwie akcje nie dzielą targetStatus', (status) => {
    const targets = getStatusActions(status).map((a) => a.targetStatus);
    expect(targets).toHaveLength(new Set(targets).size);
  });

  it('każdy targetStatus jest prawidłowym przejściem z tego statusu', () => {
    ALL_STATUSES.forEach((status) => {
      getStatusActions(status).forEach((action) => {
        expect(VALID_TRANSITIONS[status]).toContain(action.targetStatus);
      });
    });
  });

  it('pokrywa dokładnie siedem kodów DEC-424', () => {
    expect(ALL_STATUSES).toEqual(Object.values(InitiativeStatus));
  });

  it('APPROVED oferuje przejście do IN_EXECUTION dokładnie raz', () => {
    const actions = getStatusActions(InitiativeStatus.APPROVED);
    expect(actions.filter((a) => a.targetStatus === InitiativeStatus.IN_EXECUTION)).toHaveLength(1);
  });
});
