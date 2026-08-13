/**
 * Slide Mode — czysta funkcja dzieląca `ToolReportDocument` na dyskretne
 * slajdy (STREAM H2, 2026-08-13).
 *
 * KONTEKST: `ToolReportView` przyjmował `presentationMode`, ale renderował
 * jedną przewijaną kolumnę — nie było realnego trybu slajdów. Ten moduł NIE
 * jest nowym źródłem treści: bierze GOTOWY, deterministyczny dokument (ten
 * sam, który `renderToolReport` zwraca dla Report i Presentation) i wyłącznie
 * PRZEGRUPOWUJE jego bloki na slajdy — nic nie liczy, nic nie skraca, nic nie
 * wymyśla. Ten sam dokument (ten sam `contentHash`) zawsze daje ten sam
 * zestaw slajdów w tej samej kolejności.
 *
 * ZASADA "jeden dominujący wniosek na slajd": blok `conclusion` (K1-K4 +
 * trade-off) zawsze dostaje WŁASNY slajd — to jest jedna teza. Pozostałe
 * bloki sekcji (signature-visual/tension-list/evidence-list/paragraph)
 * trafiają razem na jeden slajd "przeglądowy" tej sekcji, bo są kontekstem
 * jednej tezy, nie osobnymi tezami.
 */

import type { ReportBlock, ReportSection, ToolReportDocument } from './types';

export interface Slide {
  /** Deterministyczny, stabilny w obrębie dokumentu (section.id + rola). */
  id: string;
  /** `'__cover__'` dla slajdu tytułowego — nie pochodzi z żadnej sekcji. */
  sectionId: string;
  /** -1 dla okładki; w przeciwnym razie indeks sekcji w `doc.sections`. */
  sectionIndex: number;
  /** Okładka niesie WYŁĄCZNIE tytuł dokumentu — zero wynalezionej treści. */
  isCover: boolean;
  /** Nagłówek slajdu — dla sekcji to `section.actionTitle` (wniosek), bez zmian. */
  title: string;
  /** Bloki dosłownie przeniesione z `ReportSection.blocks` — bez edycji. */
  blocks: ReportBlock[];
}

function sectionSlides(section: ReportSection, sectionIndex: number): Slide[] {
  const leadBlocks = section.blocks.filter((b) => b.kind !== 'conclusion');
  const conclusionBlocks = section.blocks.filter((b) => b.kind === 'conclusion');

  const slides: Slide[] = [];

  // Slajd przeglądowy sekcji: wszystko poza konkluzjami (kontekst tezy).
  // Pomijany, gdy sekcja ma WYŁĄCZNIE konkluzje — inaczej dwa razy pokazalibyśmy
  // ten sam nagłówek na pustym slajdzie tuż przed pierwszą tezą.
  if (leadBlocks.length > 0 || conclusionBlocks.length === 0) {
    slides.push({
      id: `${section.id}-overview`,
      sectionId: section.id,
      sectionIndex,
      isCover: false,
      title: section.actionTitle,
      blocks: leadBlocks,
    });
  }

  // Jeden slajd na konkluzję — jedna dominująca teza na slajd.
  conclusionBlocks.forEach((block, i) => {
    slides.push({
      id: `${section.id}-conclusion-${i}`,
      sectionId: section.id,
      sectionIndex,
      isCover: false,
      title: section.actionTitle,
      blocks: [block],
    });
  });

  return slides;
}

/**
 * Dzieli dokument na slajdy. Czysta funkcja: ten sam `doc` (ta sama
 * zawartość — porównywalna przez `contentHash`) zawsze daje identyczną,
 * deterministyczną tablicę. Żadnego `Date.now()`, `Math.random()`, żadnego
 * odczytu spoza `doc`.
 */
export function deriveSlides(doc: ToolReportDocument): Slide[] {
  const cover: Slide = {
    id: 'cover',
    sectionId: '__cover__',
    sectionIndex: -1,
    isCover: true,
    title: doc.title,
    blocks: [],
  };

  const body = doc.sections.flatMap((section, i) => sectionSlides(section, i));

  return [cover, ...body];
}
