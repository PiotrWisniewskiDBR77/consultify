/**
 * [ODMROZENIE 04_ASSESSMENT DEC-510] FALA G1 + K3 / kryterium S1.4 —
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
 * K3/W73 domyka jawny dług pozostawiony przez G1: pozostałe sekcje
 * narracyjne korzystają ze słownika i reguł gramatycznych wybranego locale.
 * Dziewięć rodzin bloków niżej przypina zachowanie raportu z findingami.
 *
 * DOWÓD MUTACYJNY: przywrócenie w kompozytorze zaszytego polskiego literału
 * `matrixCaption` (albo `formatHeadcountPL` w miejscu `formatHeadcount`)
 * robi pierwszy test czerwonym.
 *
 * ★ TEN PLIK NIE IMPORTUJE `pdf-parse` — i nie jest to przypadek. `pdf-parse`
 * ciągnie własną, zagnieżdżoną kopię natywnego `@napi-rs/canvas` (0.1.80),
 * a rasteryzator bloku `chart` używany przez `renderDocumentSchemaToDocxBuffer`
 * ładuje kopię aplikacyjną (1.0.9). Dwa fizyczne buildy Skia w jednym procesie
 * Node zabijają proces przy pierwszym rysowaniu po imporcie (zmierzone: bez
 * `pdf-parse` render DOCX daje 226 614 B i RC=0, z importem RC=139). Asercje
 * warstwy tekstowej PPTX/PDF żyją dlatego w `g1.reportPdfText.test.ts`, który
 * vitest uruchamia w osobnym procesie.
 */
import { createHash } from 'node:crypto';

import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';

import { renderDocumentSchemaToDocxBuffer } from '../../documentStudio/documentDocxRenderer.js';
import { buildAssessmentDeckModel } from '../assessmentDeckModel.js';
import {
  buildAssessmentDrdReportSchema,
  type AssessmentReportContract,
} from '../assessmentDrdReportSchemaService.js';
import { formatEmployeeCount } from '../assessmentReportContractService.js';
import { reportI18n } from '../assessmentReportI18n.js';
import {
  kontrakt,
  POLSKIE_DIAKRYTYKI,
  zFindingami,
  zOgraniczeniem,
} from './g1.reportFixture.js';

async function tekstDokumentu(contract: AssessmentReportContract, organizationName: string) {
  const zip = await JSZip.loadAsync(
    await renderDocumentSchemaToDocxBuffer(
      buildAssessmentDrdReportSchema(contract, organizationName)
    )
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

describe('K3 / W73 — narracja oceny z findingami jest zgodna z językiem raportu', () => {
  const generatedNarrativeBlocks = (contract: AssessmentReportContract): string[] =>
    [
      contract.executiveSummary,
      contract.criticalGaps,
      contract.finalConclusions,
      contract.programDecisionLine.direction,
      contract.programDecisionLine.priority,
      contract.programDecisionLine.successCondition,
      ...contract.chapters.flatMap((chapter) => [
        chapter.introduction.content,
        chapter.conclusion.content,
        chapter.conclusion.decisionLine.direction,
        chapter.conclusion.decisionLine.priority,
        chapter.conclusion.decisionLine.successCondition,
        ...chapter.areaComments.map((area) => area.content),
      ]),
    ].filter((value): value is string => typeof value === 'string');

  it('9 rodzin bloków narracyjnych EN nie zawiera polskich znaków', () => {
    const contract = zFindingami('en');
    const firstChapter = contract.chapters[0];
    const blocks = {
      executiveSummary: contract.executiveSummary,
      criticalGaps: contract.criticalGaps,
      finalConclusions: contract.finalConclusions,
      programDirection: contract.programDecisionLine.direction,
      programPriority: contract.programDecisionLine.priority,
      chapterCaption: firstChapter.matrix.caption.content,
      chapterDirection: firstChapter.conclusion.decisionLine.direction,
      chapterPriority: firstChapter.conclusion.decisionLine.priority,
      areaComment: firstChapter.areaComments[0].content,
    };
    expect(Object.keys(blocks)).toHaveLength(9);
    const contaminated = Object.entries(blocks)
      .filter(
        ([, text]) => typeof text === 'string' && (text.match(POLSKIE_DIAKRYTYKI) ?? []).length > 0
      )
      .map(([name]) => name);
    expect(contaminated).toEqual([]);
    for (const [name, text] of Object.entries(blocks)) {
      expect(text, name).toBeTruthy();
    }
  });

  it('DOCX EN z findingami ma 0 polskich znaków', async () => {
    const xml = await tekstDokumentu(zFindingami('en'), 'Northwind Manufacturing Ltd.');
    expect(xml.match(POLSKIE_DIAKRYTYKI) ?? []).toHaveLength(0);
  });

  // Warstwa tekstowa PPTX i PDF dla tego samego kontraktu: `g1.reportPdfText.test.ts`
  // (osobny proces — patrz nagłówek tego pliku).

  it('PL jest snapshotem exact base: 26 bloków, PRZED=PO bajtowo', () => {
    const blocks = generatedNarrativeBlocks(zFindingami('pl'));
    expect(blocks).toHaveLength(26);
    expect(createHash('sha256').update(JSON.stringify(blocks)).digest('hex')).toBe(
      'dd2ed604dc34e2ae3b9f2c78646e00506ba2dcfdba90e061a641f918ad762074'
    );
  });
});

/**
 * [ODMROZENIE 03_ASSESSMENT DEC-461] R1 — OGRANICZENIE OCENY ZASTANEJ NIE
 * WYCIEKA PO POLSKU DO RAPORTU EN.
 *
 * ★ POMIAR, KTÓRY TEN BLOK PILNUJE. `assessmentLegacyReportContractService.ts`
 * wstawiał na sztywno POLSKIE zdanie do `limitations[]`; silnik narracji cytuje
 * je dosłownie do `finalConclusions` niezależnie od `language`, więc raport
 * legacy EN drukował **6 polskich diakrytyków** w syntezie (zmierzone na
 * kontrakcie `language:'en'` z niepustym `limitations`). Fixture G1 wyżej tego
 * nie łapał, bo używa `limitations: []`. Treść żyje teraz w
 * `reportI18n(language).legacyLimitation` — PL bajt w bajt jak dotąd.
 *
 * DOWÓD MUTACYJNY: podmiana `narrativeEn`/`en.legacyLimitation` na polski wariant
 * (albo powrót serwisu do literału) robi test EN czerwonym.
 */
const LEGACY_LIMITATION_PL_HISTORYCZNY =
  'Wynik pochodzi z oceny prowadzonej w warsztacie DRD (magazyn zastany), nie z ' +
  'zamrożonego Outputu jądra metodycznego — poziomy są zadeklarowane, bez załączonych dowodów.';

describe('R1 / DEC-461 — ograniczenie legacy zgodne z językiem raportu', () => {
  it('slot i18n: PL bajt w bajt jak historyczny literał, EN bez polskich znaków', () => {
    expect(reportI18n('pl').legacyLimitation).toBe(LEGACY_LIMITATION_PL_HISTORYCZNY);
    expect(reportI18n('en').legacyLimitation).not.toMatch(POLSKIE_DIAKRYTYKI);
  });

  it('EN: finalConclusions z niepustym limitations ma 0 polskich diakrytyków', () => {
    const finalConclusions = zOgraniczeniem('en').finalConclusions;
    expect(finalConclusions).toBeTruthy();
    expect(finalConclusions).not.toMatch(POLSKIE_DIAKRYTYKI);
    // Ograniczenie MUSI trafić do syntezy — inaczej test niczego nie pilnuje.
    expect(finalConclusions).toContain(reportI18n('en').legacyLimitation);
  });

  it('PL: finalConclusions cytuje ograniczenie dosłownie (bez zmiany treści)', () => {
    const finalConclusions = zOgraniczeniem('pl').finalConclusions;
    expect(finalConclusions).toBeTruthy();
    expect(finalConclusions).toContain(LEGACY_LIMITATION_PL_HISTORYCZNY);
  });

  it('DOCX EN z niepustym limitations ma 0 polskich znaków', async () => {
    const xml = await tekstDokumentu(zOgraniczeniem('en'), 'Northwind Manufacturing Ltd.');
    expect(xml.match(POLSKIE_DIAKRYTYKI) ?? []).toHaveLength(0);
  });

  // Warstwa tekstowa PPTX i PDF dla tego samego kontraktu: `g1.reportPdfText.test.ts`
  // (osobny proces — patrz nagłówek tego pliku).
});
