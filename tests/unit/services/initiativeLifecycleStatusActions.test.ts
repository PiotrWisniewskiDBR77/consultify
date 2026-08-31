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
 * same key, EXECUTING" (status BLOCKED dostawał „Start Execution" ORAZ
 * „Unblock"). Test pilnuje niezmiennika dla WSZYSTKICH statusów, nie tylko
 * tego jednego — bo dowolne nowe przejście wchodzące do statusu osiągalnego
 * z dwóch stron odtworzy ten sam defekt.
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

  it('BLOCKED oferuje odblokowanie do EXECUTING dokładnie raz, pod nazwą Unblock', () => {
    const actions = getStatusActions(InitiativeStatus.BLOCKED);
    const toExecuting = actions.filter((a) => a.targetStatus === InitiativeStatus.EXECUTING);
    expect(toExecuting).toHaveLength(1);
    expect(toExecuting[0]?.label).toBe('Unblock');
  });

  it('SCHEDULED zachowuje „Start Execution" (straż nie zabrała akcji właściwemu statusowi)', () => {
    const actions = getStatusActions(InitiativeStatus.SCHEDULED);
    expect(actions.map((a) => a.label)).toContain('Start Execution');
  });
});
