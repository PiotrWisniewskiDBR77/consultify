/**
 * H1c / DEC-506 — DOMKNIĘCIE blokera, który mierzył tripwire
 * `h1b-lifecycle-target-vocabulary-gap.test.ts` (usunięty tym samym commitem).
 *
 * CO MIERZYŁ TRIPWIRE (14.09): `EarlyLifecycleProposalSchema` przyjmował pięć
 * celów (PROMOTED · PLANNING · SCHEDULED · EXECUTING · DONE), a jedyny writer
 * statusu (`coerceInitiativeStatusForWrite`) znał wyłącznie siedem kodów P12 —
 * więc ŻADEN cel, który dało się zaproponować, nie był zapisywalny. Zatwierdzona
 * recenzja A05 kończyła się 409 `UNKNOWN_TARGET_STATUS`, etap się nie zmieniał,
 * `initiative_handoffs` nie dostawał wiersza.
 *
 * CO MIERZY TEN TEST: że rozjazdu nie ma i że NIE zniknął przez złagodzenie
 * asercji — każdy z pięciu celów musi wrócić z OBIEMA prawdami naraz: etapem
 * silnika (12, DEC-490) i kodem kolumny (7, P12), a kod musi być jednym
 * z siedmiu przepuszczanych przez CHECK `initiatives_status_check_p12`.
 *
 * To jest asercja jednostkowa na granicy słowników. Dowód end-to-end
 * (propozycja → recenzja A05 → wykonanie → UPDATE + agregat + handoff na
 * żywym Postgresie) mieszka osobno, w teście RealPG
 * `initiativeLifecycleStageTransition.pg.test.ts`.
 */
import { describe, expect, it } from 'vitest';

import { InitiativeStatus } from '../../../constants/initiativeStatuses.js';
import { coerceInitiativeStatusForWrite } from '../../initiative/initiativeLifecycleCanon.js';

/** Dokładnie wartości `targetStatus` z `EarlyLifecycleProposalSchema`. */
const PROPOSABLE_TARGETS = ['PROMOTED', 'PLANNING', 'SCHEDULED', 'EXECUTING', 'DONE'] as const;

/** Tabela z DEC-506 — jawnie przepisana, żeby test padł przy cichej zmianie mapowania. */
const EXPECTED: Record<(typeof PROPOSABLE_TARGETS)[number], { stage: string; status: string }> = {
  PROMOTED: { stage: 'READY_FOR_DECISION', status: InitiativeStatus.PENDING_APPROVAL },
  PLANNING: { stage: 'READY_FOR_DECISION', status: InitiativeStatus.PENDING_APPROVAL },
  SCHEDULED: { stage: 'SCHEDULED', status: InitiativeStatus.APPROVED },
  EXECUTING: { stage: 'IN_EXECUTION', status: InitiativeStatus.IN_EXECUTION },
  DONE: { stage: 'CLOSED', status: InitiativeStatus.CLOSED },
};

describe('H1c — słowniki się zeszły (bloker H1b domknięty)', () => {
  it.each(PROPOSABLE_TARGETS)(
    'cel „%s" da się zaproponować I zapisać — etap silnika + kod kolumny',
    (target) => {
      const result = coerceInitiativeStatusForWrite(target);
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error(`cel ${target} nadal odrzucany przez writera`);
      expect(result.stage).toBe(EXPECTED[target].stage);
      expect(result.status).toBe(EXPECTED[target].status);
      // Bezpiecznik na obejście „zwróćmy cokolwiek": kod MUSI przejść CHECK P12.
      expect(Object.values(InitiativeStatus)).toContain(result.status);
    }
  );

  it('writer nadal ODMAWIA wartości spoza obu słowników (nie zgadujemy)', () => {
    const bad = coerceInitiativeStatusForWrite('STEP4_PILOT');
    expect(bad.ok).toBe(false);
    if (bad.ok) throw new Error('writer zaczął zgadywać — canon §5.5 złamany');
    expect(bad.code).toBe('UNKNOWN_STATUS');
  });
});
