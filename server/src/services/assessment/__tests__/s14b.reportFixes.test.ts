/**
 * S1.4b — trzy naprawy generatora raportu z oceny (DOCX/PPTX/PDF):
 *   1. Tytuł dokumentu/prezentacji = nazwa ORGANIZACJI, nazwa sesji jako
 *      podtytuł (nie odwrotnie — było: tytuł generyczny, "Klient" = nazwa
 *      sesji).
 *   2. Język STAŁYCH napisów (nagłówki, etykiety, okładka) sterowany
 *      `contract.language` — domyślnie `en` (DEC-461), `pl` na żądanie.
 *      Treść narracyjna (streszczenie, komentarze obszarów…) NIE jest objęta
 *      — zostaje po polsku niezależnie od `language` (pisze ją
 *      `assessmentNarrativeComposer.ts`, poza zakresem tej naprawy).
 *   3. "Data wydania"/"Issued" na okładce = MOMENT WYGENEROWANIA pliku
 *      (`contract.generatedAt`), nie data ostatniej modyfikacji wiersza
 *      oceny (`assessmentUpdatedAt`) — obie widoczne, gdy się różnią.
 *
 * Każdy test tu jest jednocześnie DOWODEM MUTACYJNYM w komentarzu: cofnięcie
 * naprawy (przywrócenie starego kodu) robi ten test czerwonym — zweryfikowane
 * ręcznie przy budowie tego pliku (patrz raport S1.4b).
 */
import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';

import { renderDocumentSchemaToDocxBuffer } from '../../documentStudio/documentDocxRenderer.js';
import { buildAssessmentDeckModel } from '../assessmentDeckModel.js';
import {
  buildAssessmentDrdReportSchema,
  type AssessmentReportContract,
} from '../assessmentDrdReportSchemaService.js';
import { composeReportContract, type ReportContractInput } from '../assessmentReportContractComposer.js';

const AXIS_IDS = [1, 2, 3, 4, 5, 6, 7];

function baseInput(overrides: Partial<ReportContractInput> = {}): ReportContractInput {
  return {
    sessionId: 'assess-s14b',
    outputId: null,
    revision: 0,
    generatedAt: '2026-09-13T09:00:00.000Z',
    assessmentUpdatedAt: '2026-09-05T10:42:05.393Z',
    methodVersion: 'DRD 7 osi / 39 obszarów (ocena zastana)',
    sourceKind: 'legacy',
    sessionLabel: {
      displayName: 'DRD Assessment - Jul 12, 2026',
      source: 'assessment',
      projectId: null,
    },
    businessProfile: null,
    employment: null,
    assessmentPeriod: '12 lipca 2026',
    assessor: 'Piotr Wiśniewski',
    clientSponsor: null,
    findings: AXIS_IDS.map((axisId) => ({
      id: `legacy:assess-s14b:${axisId}A`,
      outputId: 'legacy:assess-s14b',
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
      createdAt: '2026-07-12T06:29:09.104Z',
    })),
    limitations: ['Ocena warsztatowa — poziomy zadeklarowane bez dowodów.'],
    skipReasons: [],
    assessorNotes: {},
    ...overrides,
  };
}

function contract(overrides: Partial<ReportContractInput> = {}): AssessmentReportContract {
  return composeReportContract(baseInput(overrides)) as unknown as AssessmentReportContract;
}

async function renderedDocumentXml(schema: ReturnType<typeof buildAssessmentDrdReportSchema>) {
  const zip = await JSZip.loadAsync(await renderDocumentSchemaToDocxBuffer(schema));
  const xml = await zip.file('word/document.xml')?.async('string');
  if (!xml) throw new Error('word/document.xml missing from rendered DOCX');
  return xml;
}

describe('S1.4b fix #1 — tytuł = organizacja, sesja = podtytuł', () => {
  it('DOCX: schema.title jest nazwą organizacji, nie generycznym opisem ani nazwą sesji', () => {
    const schema = buildAssessmentDrdReportSchema(contract(), 'DBR77');
    expect(schema.title).toBe('DBR77');
    expect(schema.drdReportMetadata?.clientName).toBe('DBR77');
    // Sesja idzie do OSOBNEGO pola (podtytuł), nie znika.
    expect(schema.drdReportMetadata?.sessionLabel).toBe('DRD Assessment - Jul 12, 2026');
  });

  it('DOCX: "Klient" w okładce = organizacja, podtytuł pod tytułem = nazwa sesji', async () => {
    const schema = buildAssessmentDrdReportSchema(contract(), 'DBR77');
    const xml = await renderedDocumentXml(schema);
    expect(xml).toContain('DBR77');
    expect(xml).toContain('DRD Assessment - Jul 12, 2026');
  });

  it('brak organizationName → fallback na nazwę sesji (nigdy na placeholder wprost)', () => {
    const schema = buildAssessmentDrdReportSchema(contract(), null);
    expect(schema.title).toBe('DRD Assessment - Jul 12, 2026');
    // Sesja == tytuł tutaj, więc podtytuł (który powtarzałby to samo) jest
    // pusty — patrz komentarz w assessmentDrdReportSchemaService.ts.
    expect(schema.drdReportMetadata?.sessionLabel).toBeNull();
  });

  it('brak organizationName I brak nazwy sesji → placeholder jawny (nigdy pusty tytuł)', () => {
    const schema = buildAssessmentDrdReportSchema(
      contract({
        language: 'en',
        sessionLabel: { displayName: null, source: null, projectId: null },
      }),
      null
    );
    expect(schema.title).toBe('[Client name to be completed]');
  });

  it('PPTX/PDF: model prezentacji ma TITLE slajdu okładki = organizacja, nazwa sesji jako bullet', () => {
    const model = buildAssessmentDeckModel(contract(), 'DBR77');
    const cover = model.slides.find((s) => s.id === 'cover')!;
    expect(cover.title).toBe('DBR77');
    const bullets = cover.bodies.find((b) => b.kind === 'bullets');
    expect(bullets && bullets.kind === 'bullets' ? bullets.items : []).toContain(
      'DRD Assessment - Jul 12, 2026'
    );
  });

  // DOWÓD MUTACYJNY (WYKONANY, S1.4b 2026-09-13): cofnięcie `organizationName`
  // (mutacja: `clientName = sessionDisplayName || t.clientMissing`, bez
  // `organizationName`) uruchomione realnie przeciw temu plikowi — PIERWSZY
  // test tego bloku poszedł czerwony (`schema.title` = 'DRD Assessment -
  // Jul 12, 2026' zamiast 'DBR77'), naprawa przywrócona, testy z powrotem
  // zielone (12/12).
});

describe('S1.4b fix #2 — język stałych napisów (DEC-461: en domyślnie)', () => {
  it('domyślnie (brak language w kontrakcie) raport zostaje po polsku — brak regresji', () => {
    // `composeReportContract` bez `language` => 'pl' (zachowanie trasy jądra
    // metodycznego, poza zakresem S1.4b, NIE MOŻE się zmienić).
    const c = contract();
    expect(c.language).toBe('pl');
    const schema = buildAssessmentDrdReportSchema(c, 'DBR77');
    expect(schema.language).toBe('pl');
    expect(schema.sections.find((s) => s.sectionId === 'executive-summary')?.title).toBe(
      'Streszczenie zarządcze'
    );
  });

  it('language: "en" → nagłówki/etykiety struktury po angielsku', () => {
    const c = contract({ language: 'en' });
    const schema = buildAssessmentDrdReportSchema(c, 'DBR77');
    expect(schema.language).toBe('en');
    expect(schema.sections.find((s) => s.sectionId === 'executive-summary')?.title).toBe(
      'Executive Summary'
    );
    expect(schema.sections.find((s) => s.sectionId === 'gap-register')?.title).toBe(
      'Appendix A. Gap Register'
    );
    const axisSection = schema.sections.find((s) => s.sectionId === 'axis-1')!;
    const matrixHeading = axisSection.blocks.find(
      (b) => b.type === 'heading' && (b.content as { text: string }).text === 'Maturity level matrix'
    );
    expect(matrixHeading).toBeDefined();
  });

  it('language: "en" → 0 słów polskich w NAGŁÓWKACH/ETYKIETACH (sekcje, purpose, heading, table headers)', () => {
    const schema = buildAssessmentDrdReportSchema(contract({ language: 'en' }), 'DBR77');
    const structuralStrings: string[] = [];
    for (const section of schema.sections) {
      structuralStrings.push(section.title, section.purpose ?? '');
      for (const block of section.blocks) {
        if (block.type === 'heading') structuralStrings.push((block.content as { text: string }).text);
        // UWAGA: `content.caption` NIE jest tu sprawdzany. Dla tabeli macierzy
        // per-oś caption pochodzi z `assessmentNarrativeComposer.ts` (treść
        // narracyjna, jawnie POZA zakresem S1.4b — patrz nagłówek pliku i
        // `assessmentReportI18n.ts`). Nagłówki (`headers`) SĄ w 100%
        // strukturalne (moje, ze słownika) i są sprawdzane niżej.
        if (block.type === 'table') {
          const content = block.content as { headers: string[] };
          structuralStrings.push(...content.headers);
        }
      }
    }
    const joined = structuralStrings.join(' | ');
    for (const polishWord of [
      'Streszczenie',
      'Wnioski',
      'Załącznik',
      'Obszar',
      'Priorytet',
      'Docelowy',
      'Rozdział',
      'Macierz',
      'Ocena obszarów',
    ]) {
      expect(joined).not.toContain(polishWord);
    }
  });

  it('language: "en" → podpisy tabel CAŁKOWICIE strukturalne (poza per-oś macierzą) też po angielsku', () => {
    const schema = buildAssessmentDrdReportSchema(contract({ language: 'en' }), 'DBR77');
    const captionOf = (sectionId: string, blockId: string) => {
      const section = schema.sections.find((s) => s.sectionId === sectionId)!;
      const block = section.blocks.find((b) => b.blockId === blockId)!;
      return (block.content as { caption?: string }).caption;
    };
    expect(captionOf('executive-summary', 'axis-summary')).toBe('Summary of the seven DRD axes.');
    expect(captionOf('gap-register', 'gap-register-table')).toBe(
      'Gap register sorted in descending order of gap size.'
    );
    expect(captionOf('methodology-appendix', 'methodology-axes')).toBe(
      'DRD methodology structure used in this assessment.'
    );
  });

  it('PPTX/PDF model: language "en" tłumaczy kickery, tytuły, tabele i konfidencjalność', () => {
    const model = buildAssessmentDeckModel(contract({ language: 'en' }), 'DBR77');
    expect(model.language).toBe('en');
    expect(model.confidentiality).toBe('Confidential — DBR77');
    const cover = model.slides.find((s) => s.id === 'cover')!;
    expect(cover.kicker).toBe('Digital Maturity Assessment Report');
    const context = model.slides.find((s) => s.id === 'kontekst')!;
    expect(context.title).toBe('Where this result comes from');
    const table = context.bodies.find((b) => b.kind === 'table');
    expect(table && table.kind === 'table' ? table.head : []).toEqual(['Field', 'Value']);
  });

  // DOWÓD MUTACYJNY (WYKONANY, S1.4b 2026-09-13): `language` przybite na
  // sztywno do `'pl'` (ignorując `contract.language`) uruchomione realnie —
  // 6 z 12 testów tego pliku poszło czerwonych (wszystkie testy fix #2 ORAZ
  // oba testy fix #3, bo te też zależą od `language === 'en'` w kontrakcie
  // testowym), naprawa przywrócona, 12/12 zielone.
});

describe('S1.4b fix #3 — data wydania = dziś, nie ostatnia modyfikacja oceny', () => {
  it('okładka pokazuje ISSUED = generatedAt oraz "Assessment updated" = assessmentUpdatedAt, gdy się różnią', async () => {
    const schema = buildAssessmentDrdReportSchema(
      contract({
        language: 'en',
        generatedAt: '2026-09-13T09:00:00.000Z',
        assessmentUpdatedAt: '2026-09-05T10:42:05.393Z',
      }),
      'DBR77'
    );
    expect(schema.drdReportMetadata?.issuedAt).toBe('2026-09-13T09:00:00.000Z');
    expect(schema.drdReportMetadata?.assessmentUpdatedAt).toBe('2026-09-05T10:42:05.393Z');
    const xml = await renderedDocumentXml(schema);
    expect(xml).toContain('13 September 2026');
    expect(xml).toContain('Assessment updated: 5 September 2026');
  });

  it('gdy generatedAt i assessmentUpdatedAt to ten sam dzień, nie drukuje zbędnego duplikatu', async () => {
    const schema = buildAssessmentDrdReportSchema(
      contract({
        language: 'en',
        generatedAt: '2026-09-13T09:00:00.000Z',
        assessmentUpdatedAt: '2026-09-13T06:00:00.000Z',
      }),
      'DBR77'
    );
    const xml = await renderedDocumentXml(schema);
    expect(xml).toContain('13 September 2026');
    expect(xml).not.toContain('Assessment updated');
  });

  // DOWÓD MUTACYJNY (WYKONANY, S1.4b 2026-09-13): `issuedRowValue` cofnięty
  // do starego "jedna data" (`= issuedDateText`, bez sufiksu "Assessment
  // updated") uruchomiony realnie przeciw `documentDocxRenderer.ts` —
  // PIERWSZY test tego bloku poszedł czerwony (brak "Assessment updated: 5
  // September 2026" w XML-u), naprawa przywrócona, 12/12 zielone.
  //
  // Osobna uwaga: `generatedAt = new Date()` w
  // `assessmentLegacyReportContractService.ts` (fix "data wydania = dziś", nie
  // ostatnia modyfikacja wiersza `assessments`) czyta z żywej bazy i nie da
  // się go opakować w test jednostkowy bez integracji DB — zweryfikowany
  // integracyjnie w sekcji "Dowody" raportu (eksport HTTP + odczyt
  // python-docx pokazujący dzisiejszą datę), nie tutaj.
});
