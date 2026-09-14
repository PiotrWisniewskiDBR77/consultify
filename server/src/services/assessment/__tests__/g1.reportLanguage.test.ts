/**
 * [ODMROZENIE 04_ASSESSMENT DEC-510] FALA G1 / kryterium S1.4 —
 * ANGIELSKI RAPORT BEZ POLSKICH OGONKÓW.
 *
 * ★ POMIAR, KTÓRY TEN PLIK PILNUJE. Na żywym raporcie Northwind
 * (`report.docx`, 127 830 B, org EN, 14.09.2026) w `word/document.xml`
 * było **92 polskie diakrytyki w 8 przebiegach tekstu**:
 *   · 7 × 13 znaków = podpis pod matrycą per oś
 *     („Tabela obejmuje 9 obszarów osi 1. …"),
 *     `assessmentNarrativeComposer.ts` → `matrixCaption`;
 *   · 1 znak = okładkowe „340 osób” (`formatEmployeeCount`).
 * Te same „osób” dawały jedyny polski znak w PPTX (1/4015) i PDF (1/4442).
 *
 * ZAKRES G1 JEST WĄSKI I JAWNY: tłumaczymy DWA ujścia powyżej, a nie całą
 * prozę silnika narracji. Dlaczego — patrz test „DŁUG JAWNY" na końcu pliku:
 * pozostałe sekcje narracyjne (streszczenie zarządcze, wnioski rozdziałów,
 * komentarze obszarów, linia decyzyjna) to ~390 linii polskiej gramatyki
 * w `assessmentNarrativeComposer.ts` i osobna decyzja produktowa. Ten test
 * NIE udaje, że tego długu nie ma — mierzy go, żeby nie urósł po cichu.
 *
 * DOWÓD MUTACYJNY: przywrócenie w kompozytorze zaszytego polskiego literału
 * `matrixCaption` (albo `formatHeadcountPL` w miejscu `formatHeadcount`)
 * robi pierwszy test czerwonym.
 */
import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';

import { renderDocumentSchemaToDocxBuffer } from '../../documentStudio/documentDocxRenderer.js';
import { buildAssessmentDeckModel } from '../assessmentDeckModel.js';
import {
  buildAssessmentDrdReportSchema,
  type AssessmentReportContract,
} from '../assessmentDrdReportSchemaService.js';
import {
  composeReportContract,
  type ReportContractInput,
} from '../assessmentReportContractComposer.js';
import { formatEmployeeCount } from '../assessmentReportContractService.js';

const POLSKIE_DIAKRYTYKI = /[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/gu;

const AXIS_IDS = [1, 2, 3, 4, 5, 6, 7] as const;

/**
 * Fixture „Northwind-like" = DOKŁADNY kształt oceny, na której padł pomiar 92.
 *
 * ★ ZWERYFIKOWANE NA DOWODZIE, nie założone: w realnym `report.docx`
 * Northwind (`v2/s14nw/report.docx`) sekcja „Executive Summary" drukuje
 * „No content in this section…", a matryca ma same „—". Ocena NIE MA
 * findingów przeniesionych do kontraktu — dlatego cała proza kompozytora
 * zwraca `null`, a jedynym polskim tekstem w dokumencie zostaje podpis pod
 * matrycą (7 × 13 znaków) i okładkowe „340 osób" (1 znak). 92 razem.
 *
 * Wszystkie dane fixture'u są po angielsku (oceniający, etykieta sesji,
 * okres), więc KAŻDY polski ogonek w wyniku pochodzi z generatora, nie
 * z danych.
 *
 * Fixture Z findingami żyje niżej, w bloku „DŁUG JAWNY" — i pokazuje, że
 * ocena z treścią leje do angielskiego dokumentu pełną polską narrację.
 */
function wejscieBezLuk(overrides: Partial<ReportContractInput> = {}): ReportContractInput {
  return {
    sessionId: 'assess-g1-nw',
    outputId: null,
    revision: 0,
    generatedAt: '2026-09-14T09:00:00.000Z',
    assessmentUpdatedAt: '2026-09-06T10:42:05.393Z',
    methodVersion: 'DRD assessment (recorded)',
    sourceKind: 'legacy',
    language: 'en',
    sessionLabel: {
      displayName: 'Operational Excellence Programme',
      source: 'project',
      projectId: null,
    },
    businessProfile: 'Manufacturing',
    employment: formatEmployeeCount(340, 'en'),
    assessmentPeriod: '7 August 2026',
    assessor: 'James Whitfield',
    clientSponsor: null,
    findings: [],
    limitations: [],
    skipReasons: [],
    assessorNotes: {},
    ...overrides,
  };
}

function kontrakt(overrides: Partial<ReportContractInput> = {}): AssessmentReportContract {
  return composeReportContract(wejscieBezLuk(overrides)) as unknown as AssessmentReportContract;
}

async function tekstDokumentu(contract: AssessmentReportContract, organizationName: string) {
  const zip = await JSZip.loadAsync(
    await renderDocumentSchemaToDocxBuffer(buildAssessmentDrdReportSchema(contract, organizationName))
  );
  const xml = await zip.file('word/document.xml')?.async('string');
  if (!xml) throw new Error('word/document.xml missing from rendered DOCX');
  return xml;
}

describe('G1 / S1.4 — DOCX dla organizacji EN nie ma polskich diakrytyk', () => {
  it('fixture Northwind-like (EN): word/document.xml ma 0 polskich diakrytyk', async () => {
    const xml = await tekstDokumentu(kontrakt(), 'Northwind Manufacturing Ltd.');
    const trafienia = xml.match(POLSKIE_DIAKRYTYKI) ?? [];
    // Pomiar sprzed naprawy na tym samym kształcie danych: 92.
    expect(trafienia.join('')).toBe('');
    expect(trafienia).toHaveLength(0);
  });

  it('podpis pod matrycą jest po angielsku i niesie te same liczby co polski', () => {
    const contract = kontrakt();
    const caption = contract.chapters[0].matrix.caption.content!;
    expect(caption).toContain('The table covers');
    expect(caption).toContain('areas of axis 1');
    expect(caption).toContain('recorded assessment');
    expect(caption).toContain('2026-09-14');
    expect(caption).not.toMatch(POLSKIE_DIAKRYTYKI);
    // Okno kontraktu dla tego slotu to 30–60 słów — angielski wariant musi
    // się w nim mieścić, inaczej renderer podmieni go na placeholder.
    const slowa = caption.trim().split(/\s+/u).length;
    expect(slowa).toBeGreaterThanOrEqual(30);
    expect(slowa).toBeLessThanOrEqual(60);
  });

  it('okładka EN: „Employment" = „340 employees", nigdy „340 osób"', async () => {
    expect(formatEmployeeCount(340, 'en')).toBe('340 employees');
    expect(formatEmployeeCount(1, 'en')).toBe('1 employee');
    const xml = await tekstDokumentu(kontrakt(), 'Northwind Manufacturing Ltd.');
    expect(xml).toContain('340 employees');
    expect(xml).not.toContain('340 os');
  });

  it('deck (PPTX/PDF model) EN: kontekst zatrudnienia bez polskiego ogonka', () => {
    const model = buildAssessmentDeckModel(kontrakt(), 'Northwind Manufacturing Ltd.');
    const wszystko = JSON.stringify(model);
    expect(wszystko).toContain('340 employees');
    expect(wszystko).not.toMatch(/340 os/u);
  });
});

describe('G1 / S1.4 — polski raport NIE zmienia się ani o znak', () => {
  it('language: "pl" → podpis pod matrycą jest literalnie tym, co przed naprawą', () => {
    const contract = kontrakt({ language: 'pl' });
    expect(contract.chapters[0].matrix.caption.content).toBe(
      'Tabela obejmuje 9 obszarów osi 1. Kolumny poziomów pokazują skalę od 1 do 7; ' +
        'Luka jest różnicą między poziomem docelowym i obecnym, a Priorytet wynika ' +
        'z wielkości luki. Źródłem są dane zapisanej oceny z dnia 2026-09-14.'
    );
  });

  it('language: "pl" (jądro metodyczne) → źródłem jest „zamrożony Output", jak dotąd', () => {
    const contract = kontrakt({ language: 'pl', sourceKind: 'method-core' });
    expect(contract.chapters[0].matrix.caption.content).toContain('zamrożonego Outputu');
  });

  it('brak `language` w wejściu → zachowanie sprzed naprawy (polski)', () => {
    const contract = kontrakt({ language: undefined });
    expect(contract.chapters[0].matrix.caption.content).toContain('Tabela obejmuje');
  });

  it('odmiana liczebnika PL zostaje nietknięta (1 osoba / 2 osoby / 5 osób / 13 osób)', () => {
    expect(formatEmployeeCount(1, 'pl')).toBe('1 osoba');
    expect(formatEmployeeCount(2, 'pl')).toBe('2 osoby');
    expect(formatEmployeeCount(5, 'pl')).toBe('5 osób');
    expect(formatEmployeeCount(13, 'pl')).toBe('13 osób');
    expect(formatEmployeeCount(340, 'pl')).toBe('340 osób');
    // Domyślny język = 'pl' — wołacz jądra metodycznego nie podaje języka.
    expect(formatEmployeeCount(340)).toBe('340 osób');
  });
});

describe('G1 / S1.4 — DŁUG JAWNY: proza silnika narracji jest nadal polska', () => {
  /**
   * To NIE jest test „działa" — to test „wiemy, ile zostało", i jest tu po to,
   * żeby nikt (łącznie ze mną) nie przeczytał zielonego pliku wyżej jako
   * „angielski raport jest gotowy".
   *
   * Ocena, która MA findingi, dostaje pełną narrację z
   * `assessmentNarrativeComposer.ts` — i ta narracja jest polska także przy
   * `language: 'en'`. Zmierzone na tym fixture: streszczenie zarządcze,
   * wnioski końcowe, komentarz KAŻDEGO obszaru. To ~390 linii polskiej
   * gramatyki (odmiana przez przypadki w logice, nie w słowniku) i osobna
   * decyzja produktowa — świadomie poza zakresem G1.
   *
   * Gdy ktoś tę narrację przetłumaczy, ten test zrobi się czerwony i każe
   * zaktualizować meldunek — zamiast pozwolić długowi zniknąć bez śladu.
   */
  const zFindingami = (): AssessmentReportContract =>
    kontrakt({
      findings: AXIS_IDS.map((axisId) => ({
        id: `legacy:assess-g1-nw:${axisId}A`,
        outputId: 'legacy:assess-g1-nw',
        unitId: `${axisId}A`,
        unitName: `Area ${axisId}A`,
        currentLevel: 2,
        targetLevel: 5,
        gap: 3,
        supportingEvidence: [],
        contradictingEvidence: [],
        businessMeaning: '',
        rootCauseHypothesis: null,
        riskOrOpportunity: null,
        recommendation: '',
        prerequisite: null,
        expectedOutcome: null,
        kpiProposal: null,
        confidence: 'medium' as const,
        priorityRationale: null,
        sourceLocators: [],
        createdAt: '2026-09-06T06:29:09.104Z',
      })),
    });

  it('ocena Z findingami: raport EN nadal niesie polską narrację (stan znany, nie regresja)', async () => {
    const xml = await tekstDokumentu(zFindingami(), 'Northwind Manufacturing Ltd.');
    expect(xml).toMatch(POLSKIE_DIAKRYTYKI);
  });

  it('dług jest nazwany po sekcjach — streszczenie, wnioski, komentarze obszarów', () => {
    const contract = zFindingami();
    const polskie = (text: string | null | undefined) =>
      Boolean(text) && new RegExp(POLSKIE_DIAKRYTYKI.source, 'u').test(String(text));
    expect(polskie(contract.executiveSummary)).toBe(true);
    expect(polskie(contract.finalConclusions)).toBe(true);
    // `introduction` bywa `null`, gdy nie mieści się w oknie 120–180 słów —
    // wtedy renderer drukuje placeholder ZE SŁOWNIKA (już angielski). Nigdy
    // nie jest angielską prozą: albo polska, albo nic.
    // `introduction`/`conclusion` bywają `null`, gdy nie mieszczą się w swoim
    // oknie długości (120–180 / 180–260 słów) — wtedy renderer drukuje
    // placeholder ZE SŁOWNIKA (już angielski). Nigdy nie są angielską prozą:
    // albo polska, albo nic. Dlatego asercja jest „null albo polski".
    for (const slot of [
      contract.chapters[0].introduction.content,
      contract.chapters[0].conclusion.content,
    ]) {
      expect(slot === null || polskie(slot)).toBe(true);
    }
    expect(polskie(contract.chapters[0].areaComments[0].content)).toBe(true);
  });

  it('…ale podpis pod matrycą jest angielski RÓWNIEŻ w ocenie z findingami', () => {
    expect(zFindingami().chapters[0].matrix.caption.content).toContain('The table covers');
  });
});
