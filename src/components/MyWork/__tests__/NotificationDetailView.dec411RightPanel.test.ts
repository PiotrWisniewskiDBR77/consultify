/**
 * DEC-411: powiadomienie jest lekką kartą systemową. CTO pierwotnie zatwierdził,
 * że prawy panel pokazuje wyłącznie Akcje i Historię; kod innych sekcji zostaje,
 * ale nie wchodzi do widocznego kontraktu.
 *
 * NADPISANE CZĘŚCIOWO (odbiór A1, F8, 2026-09-10): DEC-411 kolidowała z K7
 * (standard n-Type/SPEC-A §18.1 DoD: tabela Właściwości jest OBOWIĄZKOWA dla
 * każdej karty N) — kolizji nikt wcześniej nie odnotował, DEC-411 wyłączyła K7
 * "przy okazji" razem z resztą. Naprawa: `properties` wraca do widocznego
 * kontraktu (mandatory), a `relations`/`evidence` dołożone obok (K10 —
 * milczenie jest błędem; obie mają już bezpieczną treść, zero nowych wywołań
 * backendu). `comments` ZOSTAJE wyłączona — to osobna, już wcześniej zgłoszona
 * kolizja (ETAP 2.1), nierozstrzygnięta tym fixem. `results` też zostaje
 * wyłączona (poza zakresem F8, nie zgłoszona jako defekt w odbiorze A1).
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const source = readFileSync(path.resolve(__dirname, '../NotificationDetailView.tsx'), 'utf8');

describe('NotificationDetailView — widoczny kontrakt prawego panelu DEC-411 + F8', () => {
  it('dopuszcza Akcje, Właściwości (K7), Powiązania, Źródła i Historię — Komentarze i Rezultaty zostają wyłączone', () => {
    const match = source.match(/notificationRightPanelContract = new Set\(\[([^\]]+)]\)/);
    expect(match).not.toBeNull();
    const ids = [...match![1].matchAll(/'([^']+)'/g)].map((item) => item[1]);
    expect(ids).toEqual(['actions', 'properties', 'relations', 'evidence', 'history']);
    expect(ids).not.toContain('comments');
    expect(ids).not.toContain('results');
  });

  it('filtruje panel przez zatwierdzony kontrakt, zachowując implementacje poza ekranem', () => {
    expect(source).toContain('notificationRightPanelContract.has(section.id)');
    for (const retainedImplementation of [
      "id: 'properties'",
      "id: 'relations'",
      "id: 'evidence'",
      "id: 'results'",
      "id: 'comments'",
    ]) {
      expect(source).toContain(retainedImplementation);
    }
  });
});
