/**
 * [ODMROZENIE 05_INITIATIVES DEC-453] Przegląd DBR77 (2026-09-08).
 *
 * `initiatives.scope.activeHint` / `allHint` (tooltip pod przełącznikiem
 * Aktywne/Wszystkie w Inicjatywach) opisywały NIEISTNIEJĄCY cykl życia:
 * "Przegląd → Promowana → Planowanie → Zatwierdzona → Zaplanowana" i
 * "Szkic, W realizacji, Zablokowana, Zakończona, Zarchiwizowana..." — żaden
 * z tych statusów (Promowana/Planowanie/Zaplanowana/Zablokowana/
 * Zarchiwizowana) nie istnieje w bieżącym enumie `InitiativeStatus`
 * (DRAFT/PENDING_APPROVAL/APPROVED/IN_EXECUTION/CLOSED/REJECTED, plus flaga
 * ON_HOLD). Zmierzone na danych DBR77 (kopia stagingu, 104 inicjatywy) przy
 * najechaniu na przełącznik zakresu — treść była myląca (opisywała inny,
 * martwy model statusów). Naprawiono treść PL i EN tak, by wymieniała
 * WYŁĄCZNIE statusy z aktualnego SSOT
 * (`packages/shared/src/constants/initiativeStatuses.generated.ts`).
 */
import { describe, expect, it } from 'vitest';

import plTranslation from '../../../public/locales/pl/translation.json';
import enTranslation from '../../../public/locales/en/translation.json';
import { INITIATIVE_STATUS_LABEL_KEYS } from '../../../packages/shared/src/constants/initiativeStatuses.generated';

// Słowa opisujące statusy, których NIE MA w aktualnym enumie — jeśli któreś
// z nich wróci do treści hintu, znaczy że ktoś przywrócił martwy model.
const MARTWE_SLOWA_PL = ['Promowana', 'Planowanie', 'Zaplanowana', 'Zablokowana', 'Zarchiwizowana'];
const MARTWE_SLOWA_EN = ['Promoted', 'Planning', 'Scheduled', 'Blocked', 'Archived'];

describe('initiatives.scope hint — tylko realne statusy (DEC-453, przegląd DBR77)', () => {
  it('enum InitiativeStatus zawiera dokładnie 7 statusów (kontrola założenia testu)', () => {
    expect(Object.keys(INITIATIVE_STATUS_LABEL_KEYS).sort()).toEqual(
      ['APPROVED', 'CLOSED', 'DRAFT', 'IN_EXECUTION', 'PENDING_APPROVAL', 'PROPOSED', 'REJECTED'].sort()
    );
  });

  it('PL: activeHint i allHint nie zawierają martwych statusów sprzed naprawy', () => {
    const scope = (plTranslation as any).initiatives.scope;
    for (const slowo of MARTWE_SLOWA_PL) {
      expect(scope.activeHint).not.toContain(slowo);
      expect(scope.allHint).not.toContain(slowo);
    }
  });

  it('EN: activeHint i allHint nie zawierają martwych statusów sprzed naprawy', () => {
    const scope = (enTranslation as any).initiatives.scope;
    for (const slowo of MARTWE_SLOWA_EN) {
      expect(scope.activeHint).not.toContain(slowo);
      expect(scope.allHint).not.toContain(slowo);
    }
  });

  it('PL: allHint wymienia realne statusy terminalne/wstrzymania (Zamknięta, Odrzucona, Wstrzymana)', () => {
    const scope = (plTranslation as any).initiatives.scope;
    expect(scope.allHint).toContain('Zamknięta');
    expect(scope.allHint).toContain('Odrzucona');
    expect(scope.allHint).toContain('Wstrzymana');
  });

  it('EN: allHint wymienia realne statusy terminalne/wstrzymania (Closed, Rejected, On hold)', () => {
    const scope = (enTranslation as any).initiatives.scope;
    expect(scope.allHint).toContain('Closed');
    expect(scope.allHint).toContain('Rejected');
    expect(scope.allHint).toContain('On hold');
  });

  it('PL: activeHint opisuje realny łańcuch aktywny (Szkic ... W realizacji)', () => {
    const scope = (plTranslation as any).initiatives.scope;
    expect(scope.activeHint).toContain('Szkic');
    expect(scope.activeHint).toContain('W realizacji');
  });

  it('EN: activeHint opisuje realny łańcuch aktywny (Draft ... In execution)', () => {
    const scope = (enTranslation as any).initiatives.scope;
    expect(scope.activeHint).toContain('Draft');
    expect(scope.activeHint).toContain('In execution');
  });
});
