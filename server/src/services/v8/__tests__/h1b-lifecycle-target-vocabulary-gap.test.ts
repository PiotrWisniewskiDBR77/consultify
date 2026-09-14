/**
 * H1b — POMIAR BLOKERA, nie obejście: słownik celów przejścia rozjechał się ze
 * słownikiem zapisu statusu inicjatywy.
 *
 * CO ZMIERZONO (14.09, świeża baza po `migrate.postgres.ts`):
 *  - `EarlyLifecycleProposalSchema` (`routes/pmo/initiatives.routes.ts`)
 *    przyjmuje PIĘĆ celów: PROMOTED · PLANNING · SCHEDULED · EXECUTING · DONE.
 *  - Jedyny writer statusu (`executeInitiativeTransition`) przepuszcza cel
 *    przez `coerceInitiativeStatusForWrite`, a ten zna WYŁĄCZNIE siedem kodów
 *    z `constants/initiativeStatuses.ts` (PROPOSED · DRAFT · PENDING_APPROVAL ·
 *    APPROVED · IN_EXECUTION · CLOSED · REJECTED) — zawężonych świadomie przez
 *    migrację `20262103_p12_initiative_status_slownik.sql`, która postawiła też
 *    twardy CHECK `initiatives_status_check_p12` na tych samych siedmiu.
 *  - `normalizeStatus` w `initiativeTransitionService` robi tylko
 *    `toUpperCase()`; NIE stosuje `LEGACY_INITIATIVE_STATUS_MAP`, które
 *    umiałoby zmapować SCHEDULED→APPROVED, EXECUTING→IN_EXECUTION, DONE→CLOSED.
 *
 * SKUTEK: żaden z pięciu celów, które da się zaproponować, nie jest zapisywalny.
 * Zatwierdzona propozycja kończy się `UNKNOWN_TARGET_STATUS` → adapter rzuca
 * `initiative_transition_denied` → `POST /:id/lifecycle-transition-executions`
 * oddaje 409. Etap inicjatywy się NIE zmienia i `initiative_handoffs` NIE
 * dostaje wiersza — mimo że recenzja A05 została już trwale zapisana.
 *
 * Dlatego H1b dowozi PRZEWÓD (odczyt + ekran + wołanie istniejących tras),
 * a domknięcia łańcucha NIE ogłasza. Naprawa wymaga decyzji, nie zgadywania:
 * albo słownik celów schodzi do siedmiu kodów, albo writer dostaje mapowanie
 * 12 etapów (DEC-490) na 7 kodów bazy — druga droga rusza kanoniczny słownik
 * P12 i bramkę CHECK, więc nie mieści się w „przewodzie".
 *
 * TEN TEST JEST TRIPWIRE'M: gdy blokera nie będzie, zrobi się CZERWONY i każe
 * dopisać właściwą asercję (przejście się zapisało) zamiast cicho zniknąć.
 */
import { describe, expect, it } from 'vitest';

import { coerceInitiativeStatusForWrite } from '../../initiative/initiativeLifecycleCanon.js';

/** Dokładnie wartości `targetStatus` z `EarlyLifecycleProposalSchema`. */
const PROPOSABLE_TARGETS = ['PROMOTED', 'PLANNING', 'SCHEDULED', 'EXECUTING', 'DONE'] as const;

describe('H1b — rozjazd słowników (bloker domknięcia łańcucha)', () => {
  it.each(PROPOSABLE_TARGETS)(
    'cel „%s" da się ZAPROPONOWAĆ, ale writer statusu go ODMAWIA',
    (target) => {
      const result = coerceInitiativeStatusForWrite(target);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.code).toBe('UNKNOWN_STATUS');
    }
  );

  it('mapowanie zgodności ISTNIEJE, ale writer go nie używa — to jest brakujący przewód', async () => {
    const { normalizeInitiativeStatus } = await import(
      '../../../constants/initiativeStatuses.js'
    );
    // Gdyby `normalizeStatus` w initiativeTransitionService wołało to mapowanie,
    // cztery z pięciu celów miałyby dokąd trafić.
    expect(normalizeInitiativeStatus('SCHEDULED')).toBe('APPROVED');
    expect(normalizeInitiativeStatus('EXECUTING')).toBe('IN_EXECUTION');
    expect(normalizeInitiativeStatus('DONE')).toBe('CLOSED');
    expect(normalizeInitiativeStatus('PROMOTED')).toBe('PENDING_APPROVAL');
  });
});
