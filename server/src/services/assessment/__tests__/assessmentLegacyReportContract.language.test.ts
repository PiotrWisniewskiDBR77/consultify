/**
 * DEC-461 / R1 — ograniczenie metodyczne raportu legacy jest zgodne z językiem
 * raportu NA POZIOMIE SERWISU, nie tylko kompozytora.
 *
 * ★ DLACZEGO TEN PLIK ISTNIEJE (Wpis 7 + Wpis 8, KANAL.md). Poprzedni blok
 * `R1 / DEC-461` w `g1.reportLanguage.test.ts` buduje kontrakt WPROST przez
 * `composeReportContract({ limitations: [reportI18n(language).legacyLimitation] })`,
 * czyli OMIJA `AssessmentLegacyReportContractService.build()`. Skutek: mutacja
 * serwisu (powrót do zaszytego PO POLSKU literału w `limitations`) zostawiała
 * tamten blok ZIELONY — nie bronił naprawy. Ten plik woła `build(..., 'en')`
 * przez serwis i sprawdza, że to SERWIS wstawia ograniczenie w języku raportu.
 *
 * DOWÓD MUTACYJNY (WYKONANY, DEC-461/W8): przywrócenie w
 * `assessmentLegacyReportContractService.ts` twardego literału
 * `const limitations = ['Wynik pochodzi z oceny … bez załączonych dowodów.']`
 * (zamiast `[reportI18n(language).legacyLimitation]`) zrobiono realnie i
 * uruchomiono ten plik: 2 z 3 testów poszły CZERWONE —
 * „EN: build() wstawia ograniczenie po angielsku (0 diakrytyków w finalConclusions)"
 * oraz „domyślnie (bez language) build() zwraca ograniczenie po angielsku —
 * DEC-461 en-first" (oba łapią polskie zdanie wyciekające do `finalConclusions`
 * raportu EN). Test PL zostaje zielony, bo dla 'pl' literał i slot są bajtowo
 * równe. Naprawa przywrócona → 3/3 zielone.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Minimalny mock wejścia build(): serwis legacy czyta wyłącznie przez
// `DbPromise.get(sql, params, { fallback })`. Sterujemy odpowiedzią po
// fragmencie SQL — tak samo, jak dane wracałyby z żywej bazy (Wpis 7:
// „minimalny mock wejścia build()"). Zero wspólnego stanu, zero stash.
const ASSESSMENT_ID = 'assess-r1-service';
const ORGANIZATION_ID = 'org-r1-service';

const ANSWERS_JSON = JSON.stringify({
  drd: {
    areas: {
      '1A': { achievedLevel: 2, targetLevel: 5 },
      '2A': { achievedLevel: 2, targetLevel: 5 },
      '3A': { achievedLevel: 2, targetLevel: 5 },
      '4A': { achievedLevel: 2, targetLevel: 5 },
      '5A': { achievedLevel: 2, targetLevel: 5 },
      '6A': { achievedLevel: 2, targetLevel: 5 },
      '7A': { achievedLevel: 2, targetLevel: 5 },
    },
  },
});

const ASSESSMENT_ROW = {
  id: ASSESSMENT_ID,
  name: 'Legacy DRD workshop',
  project_id: null,
  created_at: '2026-09-01T10:00:00.000Z',
  updated_at: '2026-09-02T10:00:00.000Z',
  answers_json: ANSWERS_JSON,
  created_by: 'user-r1',
};

vi.mock('../../../utils/DbPromise.js', () => {
  const get = async (sql: string) => {
    if (sql.includes('FROM assessments')) return ASSESSMENT_ROW;
    if (sql.includes('FROM projects')) return { name: 'Legacy project', description: null };
    if (sql.includes('FROM organizations')) return { name: 'Northwind Manufacturing Ltd.', industry: 'manufacturing' };
    if (sql.includes('FROM organization_profiles')) return { industry: 'manufacturing', employee_count: 340 };
    if (sql.includes('FROM users')) return { first_name: 'James', last_name: 'Whitfield' };
    return null;
  };
  const api = { get, all: async () => [], run: async () => ({ success: true }), exec: async () => ({ success: true }) };
  return { ...api, default: api };
});

const { AssessmentLegacyReportContractService } = await import(
  '../assessmentLegacyReportContractService.js'
);
const { reportI18n } = await import('../assessmentReportI18n.js');

const POLSKIE_DIAKRYTYKI = /[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/gu;

const LEGACY_LIMITATION_PL_HISTORYCZNY =
  'Wynik pochodzi z oceny prowadzonej w warsztacie DRD (magazyn zastany), nie z ' +
  'zamrożonego Outputu jądra metodycznego — poziomy są zadeklarowane, bez załączonych dowodów.';

describe('DEC-461 / R1 — AssessmentLegacyReportContractService.build() a język ograniczenia', () => {
  let service: InstanceType<typeof AssessmentLegacyReportContractService>;

  beforeEach(() => {
    service = new AssessmentLegacyReportContractService();
  });

  it('EN: build() wstawia ograniczenie po angielsku (0 diakrytyków w finalConclusions)', async () => {
    const { contract } = await service.build(ORGANIZATION_ID, ASSESSMENT_ID, 'en');

    expect(contract.language).toBe('en');
    // `limitations` jest wejściem kompozytora; na kontrakcie wyjściowym żyje
    // jako dosłowny cytat w `finalConclusions` — i to jest właśnie ścieżka
    // wycieku, którą R1 domknął. Jeśli SERWIS wróci do twardego literału PL,
    // `finalConclusions` dla 'en' złapie polskie diakrytyki i ten test zgaśnie.
    const finalConclusions = contract.finalConclusions;
    expect(finalConclusions).toBeTruthy();
    expect(finalConclusions).toContain(reportI18n('en').legacyLimitation);
    expect(finalConclusions).not.toMatch(POLSKIE_DIAKRYTYKI);
  });

  it('PL: build() cytuje ograniczenie dosłownie, bajt w bajt jak historyczny literał', async () => {
    const { contract } = await service.build(ORGANIZATION_ID, ASSESSMENT_ID, 'pl');

    expect(contract.language).toBe('pl');
    expect(reportI18n('pl').legacyLimitation).toBe(LEGACY_LIMITATION_PL_HISTORYCZNY);
    expect(contract.finalConclusions).toContain(LEGACY_LIMITATION_PL_HISTORYCZNY);
  });

  it('domyślnie (bez language) build() zwraca ograniczenie po angielsku — DEC-461 en-first', async () => {
    const { contract } = await service.build(ORGANIZATION_ID, ASSESSMENT_ID);
    expect(contract.language).toBe('en');
    expect(contract.finalConclusions).toContain(reportI18n('en').legacyLimitation);
    expect(contract.finalConclusions).not.toMatch(POLSKIE_DIAKRYTYKI);
  });
});
