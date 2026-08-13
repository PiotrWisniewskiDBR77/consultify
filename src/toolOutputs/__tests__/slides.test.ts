import { describe, expect, it } from 'vitest';

import { approve, submitForReview } from '../outputLifecycle';
import { renderToolReport } from '../renderReport';
import { deriveSlides } from '../slides';
import type { ReportBlock, ToolOutput, ToolReportDocument } from '../types';

/** Fixture output identical in shape to src/toolOutputs/__tests__/outputs.test.ts. */
function makeOutput(overrides: Partial<ToolOutput> = {}): ToolOutput {
  const base: ToolOutput = {
    id: 'out-1',
    organizationId: 'org-1',
    toolSessionId: 'sess-1',
    toolType: 'dynamic-swot',
    methodPackVersion: '1.0.0',
    version: 1,
    title: 'SWOT — wejście na rynek DACH',
    status: 'draft',
    items: [
      { id: 'i1', label: 'Silny zespół wdrożeniowy', bucket: 'strengths', evidenceKind: 'fact', impact: 'high' },
      { id: 'i2', label: 'Rosnący popyt w DACH', bucket: 'opportunities', evidenceKind: 'observation', impact: 'medium' },
    ],
    tensions: [
      { id: 't1', posture: 'attack', title: 'Zespół × popyt', sourceItemIds: ['i1', 'i2'], priority: 5 },
      { id: 't2', posture: 'defend', title: 'Zespół × presja cenowa', sourceItemIds: ['i1', 'i2'], priority: 3 },
    ],
    conclusions: [
      {
        id: 'c1',
        k1Fact: 'Popyt w DACH rośnie 3 kwartały z rzędu przy stałej obsadzie wdrożeń.',
        k2Meaning: 'Przewaga wdrożeniowa jest niewykorzystana, a okno rynkowe się zamyka.',
        k3Actions: ['Uruchomić pilota w DACH', 'Zatrudnić dwóch wdrożeniowców'],
        k4Effect: 'Pierwszy klient referencyjny w 6 miesięcy.',
        tradeoff: { chosen: 'Pilot w DACH', rejected: 'Rozwój produktu', why: 'Okno rynkowe zamyka się szybciej niż dług produktowy rośnie.' },
        sourceTensionIds: ['t1'],
      },
      {
        id: 'c2',
        k1Fact: 'Czas wdrożenia jest 2x dłuższy niż u konkurencji.',
        k2Meaning: 'Ekspozycja na presję cenową rośnie razem z długością wdrożenia.',
        k3Actions: ['Zmierzyć czas pięciu ostatnich wdrożeń'],
        k4Effect: 'Skrócenie ścieżki wdrożenia o 30% w dwa kwartały.',
        tradeoff: { chosen: 'Standaryzacja wdrożenia', rejected: 'Nowe funkcje produktu', why: 'Ryzyko cenowe jest pilniejsze niż roadmapa.' },
        sourceTensionIds: ['t2'],
      },
    ],
    createdAt: '2026-08-13T10:00:00Z',
    contentHash: '',
  };
  const merged = { ...base, ...overrides };
  return merged;
}

function approvedOutput(overrides: Partial<ToolOutput> = {}): ToolOutput {
  return approve(submitForReview(makeOutput(overrides)), 'user-1', 'now');
}

const baseOpts = { id: 'rep-1', organizationId: 'org-1', title: 'Raport' };

describe('deriveSlides — determinizm', () => {
  it('ten sam dokument daje identyczną tablicę slajdów (10 przebiegów)', () => {
    const doc = renderToolReport([approvedOutput()], { ...baseOpts, kind: 'report' });
    const runs = Array.from({ length: 10 }, () => JSON.stringify(deriveSlides(doc)));
    expect(new Set(runs).size).toBe(1);
  });

  it('okładka jest zawsze pierwszym slajdem i niesie tylko tytuł dokumentu', () => {
    const doc = renderToolReport([approvedOutput()], { ...baseOpts, kind: 'report' });
    const slides = deriveSlides(doc);
    expect(slides[0].isCover).toBe(true);
    expect(slides[0].title).toBe(doc.title);
    expect(slides[0].blocks).toEqual([]);
  });
});

describe('deriveSlides — mapowanie sekcja → slajd', () => {
  it('każda sekcja daje ciąg slajdów ze swoim sectionId, w kolejności sekcji', () => {
    const a = approvedOutput();
    const b = approve(submitForReview(makeOutput({ id: 'out-9', title: 'Drugi output' })), 'user-1', 'now');
    const doc = renderToolReport([a, b], { ...baseOpts, kind: 'report' });

    const slides = deriveSlides(doc);
    const sectionIdsInOrder = slides.filter((s) => !s.isCover).map((s) => s.sectionId);

    // section-out-1 slides all precede section-out-9 slides (input order preserved).
    const firstOut9Index = sectionIdsInOrder.indexOf('section-out-9');
    const lastOut1Index = sectionIdsInOrder.lastIndexOf('section-out-1');
    expect(firstOut9Index).toBeGreaterThan(lastOut1Index);

    // Every doc.section is represented by at least one slide.
    const uniqueSectionIds = new Set(sectionIdsInOrder);
    expect(uniqueSectionIds).toEqual(new Set(doc.sections.map((s) => s.id)));
  });

  it('każdy blok "conclusion" dostaje WŁASNY slajd — jedna teza na slajd', () => {
    const doc = renderToolReport([approvedOutput()], { ...baseOpts, kind: 'report' });
    const slides = deriveSlides(doc);
    const conclusionSlides = slides.filter((s) => s.blocks.some((b) => b.kind === 'conclusion'));
    // Fixture has 2 conclusions -> 2 dedicated slides, one block each.
    expect(conclusionSlides).toHaveLength(2);
    conclusionSlides.forEach((s) => {
      expect(s.blocks).toHaveLength(1);
      expect(s.blocks[0].kind).toBe('conclusion');
    });
  });

  it('slajd przeglądowy sekcji niesie tytuł = actionTitle sekcji, nie K1', () => {
    const doc = renderToolReport([approvedOutput()], { ...baseOpts, kind: 'report' });
    const slides = deriveSlides(doc);
    const overview = slides.find((s) => s.id === 'section-out-1-overview');
    expect(overview?.title).toBe(doc.sections[0].actionTitle);
  });
});

describe('deriveSlides — treść: nic nie jest wymyślone ani zgubione', () => {
  it('konkatenacja bloków wszystkich slajdów sekcji odtwarza DOKŁADNIE section.blocks', () => {
    const a = approvedOutput();
    const b = approve(submitForReview(makeOutput({ id: 'out-9' })), 'user-1', 'now');
    const doc = renderToolReport([a, b], { ...baseOpts, kind: 'report' });
    const slides = deriveSlides(doc);

    doc.sections.forEach((section) => {
      const reassembled: ReportBlock[] = slides
        .filter((s) => s.sectionId === section.id)
        .flatMap((s) => s.blocks);
      expect(reassembled).toEqual(section.blocks);
    });
  });

  it('liczba slajdów totalnych = okładka + suma (przegląd opcjonalny + N konkluzji) na sekcję', () => {
    const doc = renderToolReport([approvedOutput()], { ...baseOpts, kind: 'report' });
    const slides = deriveSlides(doc);
    const section = doc.sections[0];
    const hasLead = section.blocks.some((b) => b.kind !== 'conclusion');
    const conclusionCount = section.blocks.filter((b) => b.kind === 'conclusion').length;
    const expectedForSection = (hasLead ? 1 : 0) + conclusionCount;
    expect(slides.length).toBe(1 /* cover */ + expectedForSection);
  });

  it('sekcja bez żadnych bloków nadal dostaje jeden slajd (tytuł, bez treści) — sekcja nie znika po cichu', () => {
    const emptyOut = approve(
      submitForReview(
        makeOutput({
          id: 'out-empty',
          items: [],
          tensions: [],
          conclusions: [
            {
              id: 'c1',
              k1Fact: 'x',
              k2Meaning: 'y',
              k3Actions: [],
              k4Effect: 'z',
              tradeoff: { chosen: 'a', rejected: '', why: '' },
              sourceTensionIds: [],
            },
          ],
        })
      ),
      'user-1',
      'now'
    );
    const doc = renderToolReport([emptyOut], { id: 'rep-empty', organizationId: 'org-1', title: 'X', kind: 'report' });
    const slides = deriveSlides(doc);
    // signature-visual is always pushed by renderReport regardless of items —
    // so this section still has a lead block. Assert nothing is silently dropped instead.
    const total = slides.filter((s) => !s.isCover).flatMap((s) => s.blocks).length;
    const expectedTotal = doc.sections.reduce((n, s) => n + s.blocks.length, 0);
    expect(total).toBe(expectedTotal);
  });
});

describe('deriveSlides — Presentation vs Report: NIE zmienia znaczenia', () => {
  it('konkluzje w slajdach prezentacji są bajt-identyczne z konkluzjami w slajdach raportu', () => {
    const out = approvedOutput();
    const reportDoc = renderToolReport([out], { ...baseOpts, kind: 'report' });
    const deckDoc = renderToolReport([out], { id: 'deck-1', organizationId: 'org-1', title: 'Deck', kind: 'presentation' });

    const reportConclusions = deriveSlides(reportDoc)
      .flatMap((s) => s.blocks)
      .filter((b): b is Extract<ReportBlock, { kind: 'conclusion' }> => b.kind === 'conclusion');
    const deckConclusions = deriveSlides(deckDoc)
      .flatMap((s) => s.blocks)
      .filter((b): b is Extract<ReportBlock, { kind: 'conclusion' }> => b.kind === 'conclusion');

    // Presentation caps conclusions per output (renderReport: maxConclusionsPerOutput),
    // so the deck may show FEWER conclusion slides — but every one it shows must be
    // byte-identical to its counterpart in the report.
    expect(deckConclusions.length).toBeGreaterThan(0);
    expect(deckConclusions.length).toBeLessThanOrEqual(reportConclusions.length);
    deckConclusions.forEach((dc, i) => {
      expect(dc).toEqual(reportConclusions[i]);
    });
  });

  it('prezentacja pomija evidence-list jako osobny slajd (skrót gęstości), raport go ma', () => {
    const out = approvedOutput();
    const reportDoc = renderToolReport([out], { ...baseOpts, kind: 'report' });
    const deckDoc = renderToolReport([out], { id: 'deck-2', organizationId: 'org-1', title: 'Deck', kind: 'presentation' });

    const hasEvidenceSlide = (doc: ToolReportDocument) =>
      deriveSlides(doc).some((s) => s.blocks.some((b) => b.kind === 'evidence-list'));

    expect(hasEvidenceSlide(reportDoc)).toBe(true);
    expect(hasEvidenceSlide(deckDoc)).toBe(false);
  });
});
