/**
 * assessmentDeckModel — model prezentacji z oceny DRD (czysty, bez I/O).
 *
 * Jedno źródło prawdy dla OBU renderów: PPTX (`assessmentDeckPptxRenderer`)
 * i PDF (`assessmentDeckPdfRenderer`). Dzięki temu plik .pptx i plik .pdf tej
 * samej prezentacji nie mogą się rozjechać treścią ani układem — a to był
 * realny problem: PPTX szedł jedną trasą, PDF drugą, każda z własną paletą.
 *
 * GEOMETRIA JEST CZĘŚCIĄ MODELU, nie renderera. Każdy slajd deklaruje sloty
 * (prostokąty w calach, siatka 16:9 = 10" × 5.625" wg BRAND_EXPORT_CANON §5:
 * margines 0.5", strefa tytułu, strefa treści, stopka). Renderery tylko
 * wypełniają zadeklarowane prostokąty, więc „nachodzące pola" nie są kwestią
 * ostrożności — są sprawdzalne mechanicznie
 * (`evidence/dokument-plik-20260906/sprawdz-geometrie.mjs`).
 *
 * PALETA — BRAND_EXPORT_CANON §3 + motyw `executive` z themeRegistry:
 * navy #0C447C (dominant), teal #1D9E75 (accent), #5F5E5A (supporting),
 * #2C2C2A (tekst). Crimson #85182F NIE występuje (kanon §3 pkt 1).
 * FONTY — decyzja D1 (§11): wyłącznie Office-native. Ta sama rodzina co w
 * DOCX (Calibri / Calibri Light), żeby PPTX i DOCX tego samego deliverable
 * miały jeden motyw (§10 pkt 9).
 */
import DRD_STRUCTURE from '../../data/drdStructure.js';
import {
  areaAverage,
  areaLabel,
  axisLabel,
  priorityForGap,
  type AssessmentReportContract,
} from './assessmentDrdReportSchemaService.js';
import {
  formatReportDate,
  reportI18n,
  type ReportI18nShape,
  type ReportLanguage,
} from './assessmentReportI18n.js';

export const DECK_GEOMETRY = Object.freeze({
  slideW: 10,
  slideH: 5.625,
  margin: 0.5,
  titleY: 0.42,
  titleH: 0.62,
  kickerY: 0.2,
  kickerH: 0.2,
  contentY: 1.18,
  contentH: 3.72,
  /** Pas na jedno zdanie „co z tego wynika". Slajd, który je ma, ODDAJE tę
   * wysokość ze strefy treści — inaczej ostatni punkt listy wchodziłby pod
   * zdanie podsumowania (zmierzone na pierwszym renderze). */
  takeawayH: 0.42,
  footerY: 5.05,
  footerH: 0.28,
});

export const DECK_PALETTE = Object.freeze({
  dominant: '0C447C',
  supporting: '5F5E5A',
  accent: '1D9E75',
  text: '2C2C2A',
  muted: '6B6A66',
  hairline: 'D8DDE3',
  surface: 'F4F6F8',
  white: 'FFFFFF',
});

export const DECK_FONTS = Object.freeze({ heading: 'Calibri Light', body: 'Calibri' });

export interface DeckRect {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

export type DeckBody =
  | { readonly kind: 'bullets'; readonly rect: DeckRect; readonly items: readonly string[] }
  | {
      readonly kind: 'table';
      readonly rect: DeckRect;
      readonly head: readonly string[];
      readonly rows: readonly (readonly string[])[];
      /** Udziały szerokości kolumn — suma zawsze 1. */
      readonly widths: readonly number[];
    }
  | {
      readonly kind: 'chart';
      readonly rect: DeckRect;
      readonly categories: readonly string[];
      readonly series: readonly { readonly label: string; readonly values: readonly number[] }[];
      readonly maxValue: number;
    }
  | {
      readonly kind: 'stat';
      readonly rect: DeckRect;
      readonly value: string;
      readonly caption: string;
    };

export interface DeckSlide {
  readonly id: string;
  readonly kicker: string;
  readonly title: string;
  readonly bodies: readonly DeckBody[];
  /** Jedno zdanie „co z tego wynika" — pod treścią, nad stopką. */
  readonly takeaway: string | null;
  readonly cover?: boolean;
}

export interface DeckModel {
  readonly title: string;
  readonly clientName: string;
  readonly organizationName: string;
  readonly generatedAt: string;
  readonly confidentiality: string;
  readonly language: ReportLanguage;
  readonly slides: readonly DeckSlide[];
}


const G = DECK_GEOMETRY;
const CONTENT_W = G.slideW - 2 * G.margin;

/** Prostokąt zdania podsumowującego — JEDNO miejsce dla obu rendererów i dla
 * skryptu sprawdzającego geometrię. */
export function takeawayRect(): DeckRect {
  return {
    x: G.margin,
    y: G.contentY + G.contentH - G.takeawayH + 0.08,
    w: CONTENT_W,
    h: 0.3,
  };
}

/** Wysokość strefy treści po ewentualnym oddaniu pasa na podsumowanie. */
function contentH(withTakeaway: boolean): number {
  return withTakeaway ? G.contentH - G.takeawayH : G.contentH;
}

/** Pełna strefa treści. */
function fullRect(withTakeaway = false): DeckRect {
  return { x: G.margin, y: G.contentY, w: CONTENT_W, h: contentH(withTakeaway) };
}

/** Lewa/prawa połowa strefy treści z przerwą 0.3" — nigdy się nie przecinają. */
function halfRect(side: 'left' | 'right', withTakeaway = false): DeckRect {
  const gap = 0.3;
  const w = (CONTENT_W - gap) / 2;
  return {
    x: side === 'left' ? G.margin : G.margin + w + gap,
    y: G.contentY,
    w,
    h: contentH(withTakeaway),
  };
}

/**
 * Ile wierszy zmieści się w prostokącie tabeli.
 *
 * ★ POMIAR, NIE ZAŁOŻENIE. pptxgenjs NIE przycina tabeli do zadeklarowanej
 * wysokości — rysuje tyle wierszy, ile dostanie, i wychodzi poza ramkę. Skrypt
 * `sprawdz-geometrie.mjs` tego nie złapie, bo w OOXML ramka ma nadal
 * zadeklarowaną wysokość; zobaczyłem to dopiero na renderze slajdu 12
 * (10 wierszy nachodziło na zdanie podsumowania). Dlatego liczba wierszy jest
 * ograniczana TU, w modelu — a nie „na oko" w rendererze.
 *
 * WYSOKOSC_WIERSZA = 0,34" to zmierzona wysokość wiersza tabeli przy 12 pt i
 * marginesie 0,06" (nagłówek liczony jak wiersz).
 */
const WYSOKOSC_WIERSZA = 0.34;

export function mieszczaceSieWiersze<T>(wiersze: readonly T[], rect: DeckRect): T[] {
  const pojemnosc = Math.max(1, Math.floor(rect.h / WYSOKOSC_WIERSZA) - 1);
  return wiersze.slice(0, pojemnosc);
}

function skrot(text: string, maxWords: number): string {
  const words = text.trim().split(/\s+/u);
  return words.length <= maxWords ? text.trim() : `${words.slice(0, maxWords).join(' ')}…`;
}

function procent(value: number | null): string {
  return value === null ? '—' : `${value}%`;
}

interface AxisStat {
  readonly axisId: number;
  /** Nazwa osi w JĘZYKU RAPORTU (EN-first ze struktury DRD dla `en`, nakładka
   * PL dla `pl` — patrz `axisLabel()` w `assessmentDrdReportSchemaService.ts`,
   * ta sama zasada). Pole zostaje `namePL` z nazwy historycznej (konsumowane
   * przez istniejące testy/wywołania), ale NIESIE etykietę dla bieżącego
   * `language`, nie zawsze polską. */
  readonly namePL: string;
  readonly current: number | null;
  readonly target: number | null;
  readonly assessed: number;
  readonly total: number;
  readonly maxGap: number | null;
  readonly criticalCount: number;
}

export function policzOsie(
  contract: AssessmentReportContract,
  language: ReportLanguage = 'pl'
): AxisStat[] {
  return contract.chapters.map((chapter) => {
    const gaps = chapter.matrix.areas.flatMap((area) => (area.gap === null ? [] : [area.gap]));
    return {
      axisId: chapter.axisId,
      namePL: language === 'pl' ? (chapter.axisNamePL ?? chapter.axisName) : chapter.axisName,
      current: areaAverage(chapter.matrix.areas, 'currentLevel', chapter.maxLevel),
      target: areaAverage(chapter.matrix.areas, 'targetLevel', chapter.maxLevel),
      assessed: chapter.matrix.areas.filter((area) => area.currentLevel !== null).length,
      total: chapter.matrix.areas.length,
      maxGap: gaps.length ? Math.max(...gaps) : null,
      criticalCount: chapter.matrix.areas.filter((area) => (area.gap ?? 0) >= 3).length,
    };
  });
}

/**
 * Buduje model prezentacji. Każde zdanie i każda liczba pochodzi z kontraktu
 * raportu — ta funkcja nie czyta bazy, nie liczy niczego poza średnimi, które
 * liczy już `areaAverage` silnika raportu, i nie dopisuje ani jednej opinii.
 */
export function buildAssessmentDeckModel(
  contract: AssessmentReportContract,
  organizationName: string | null
): DeckModel {
  const language: ReportLanguage = contract.language ?? 'pl';
  const t = reportI18n(language);
  const clientName = contract.sessionLabel.displayName ?? t.deckClientMissing;
  // S1.4b fix #1: `org` (organization name) drives the visible cover TITLE
  // (see slide 1 below) — `clientName` (session/assessment name) used to be
  // the cover title; it now shows up as the first cover bullet instead, and
  // stays the "Przedmiot oceny"/"Subject of assessment" row on the context
  // slide (unchanged there).
  const org = organizationName?.trim() || clientName;
  const osie = policzOsie(contract, language);
  const ocenione = contract.chapters.reduce(
    (sum, chapter) => sum + chapter.matrix.areas.filter((area) => area.currentLevel !== null).length,
    0
  );
  const wszystkie = DRD_STRUCTURE.reduce((sum, axis) => sum + axis.areas.length, 0);
  const luki = contract.chapters.flatMap((chapter) =>
    chapter.matrix.areas
      .filter((area) => area.gap !== null)
      .map((area) => ({ chapter, area, gap: area.gap as number }))
  );
  const lukiMalejaco = [...luki].sort(
    (left, right) =>
      right.gap - left.gap ||
      left.chapter.axisId - right.chapter.axisId ||
      left.area.unitId.localeCompare(right.area.unitId)
  );
  const krytyczne = luki.filter((entry) => entry.gap >= 3);
  const dataWydania = formatReportDate(new Date(contract.generatedAt), language);

  const slides: DeckSlide[] = [];

  // 1 — okładka. S1.4b fix #1: TITLE = nazwa organizacji (`org`), nie nazwa
  // sesji — sesja przenosi się do pierwszego bullet-a poniżej.
  slides.push({
    id: 'cover',
    kicker: t.deckReportKicker,
    title: org,
    cover: true,
    bodies: [
      {
        kind: 'bullets',
        rect: { x: G.margin, y: 3.1, w: CONTENT_W, h: 1.4 },
        items: [
          clientName,
          t.deckMethodologyBullet(contract.methodVersion),
          t.deckIssuedBullet(dataWydania),
          t.deckScopeBullet(DRD_STRUCTURE.length, wszystkie),
        ],
      },
    ],
    takeaway: null,
  });

  // 2 — agenda
  slides.push({
    id: 'agenda',
    kicker: t.deckAgendaKicker,
    title: 'Agenda',
    bodies: [
      {
        kind: 'bullets',
        rect: fullRect(),
        items: [...t.deckAgendaItems],
      },
    ],
    takeaway: null,
  });

  // 3 — kontekst
  slides.push({
    id: 'kontekst',
    kicker: t.deckContextKicker,
    title: t.deckContextTitle,
    bodies: [
      {
        kind: 'table',
        rect: fullRect(),
        head: [...t.deckContextHeaders],
        widths: [0.32, 0.68],
        rows: mieszczaceSieWiersze([
          [t.deckContextOrganization, org],
          [t.deckContextSubject, clientName],
          [t.deckContextBusinessProfile, contract.businessProfile ?? t.deckNoDataInAssessment],
          [t.deckContextEmployment, contract.employment ?? t.deckNoDataInAssessment],
          [t.deckContextAssessmentPeriod, contract.assessmentPeriod ?? t.deckNoDataInAssessment],
          [t.deckContextAssessor, contract.assessor ?? t.deckNoDataInAssessment],
          [
            t.deckContextSourceLabel,
            contract.sourceKind === 'legacy' ? t.deckContextSourceLegacy : t.deckContextSourceCore,
          ],
          [t.deckContextCoverageLabel, t.deckContextCoverage(ocenione, wszystkie)],
        ], fullRect()),
      },
    ],
    takeaway: null,
  });

  // 4 — wynik ogólny (wykres natywny)
  slides.push({
    id: 'wynik-ogolny',
    kicker: t.deckOverallKicker,
    title: t.deckOverallTitle,
    bodies: [
      {
        kind: 'chart',
        rect: fullRect(true),
        categories: osie.map((axis) => `${axis.axisId}. ${skrot(axis.namePL, 3)}`),
        series: [
          { label: t.deckSeriesCurrent, values: osie.map((axis) => axis.current ?? 0) },
          { label: t.deckSeriesTarget, values: osie.map((axis) => axis.target ?? 0) },
        ],
        maxValue: 100,
      },
    ],
    takeaway: t.deckOverallTakeaway(krytyczne.length, luki.length),
  });

  // 5–11 — jedna oś na slajd
  for (const chapter of contract.chapters) {
    const stat = osie.find((axis) => axis.axisId === chapter.axisId)!;
    const najwieksze = [...chapter.matrix.areas]
      .filter((area) => area.gap !== null)
      .sort(
        (left, right) =>
          (right.gap ?? 0) - (left.gap ?? 0) || left.unitId.localeCompare(right.unitId)
      )
      .slice(0, 4);
    // Notatka bierze się z WŁASNEGO pola kontraktu, nie z wycinania napisu ze
    // złożonego zdania — pierwsze podejście (slice po „Notatka oceniającego:")
    // dokleiło do cytatu następny fakt silnika i urwało go w połowie. Sama
    // notatka (`assessorNote`) to treść oceniającego, nie stały napis — S1.4b
    // jej nie tłumaczy, patrz `assessmentReportI18n.ts` nagłówek pliku.
    const notatka = chapter.areaComments.find((comment) => comment.assessorNote);
    const notatkaTekst = notatka?.assessorNote
      ? `${notatka.unitId}: ${skrot(notatka.assessorNote, 12)}`
      : null;
    slides.push({
      id: `os-${chapter.axisId}`,
      kicker: t.deckAxisOf(chapter.axisId, DRD_STRUCTURE.length),
      title: skrot(stat.namePL, 8),
      bodies: [
        {
          kind: 'stat',
          rect: {
            ...halfRect('left', true),
            h: contentH(true) * 0.42,
          },
          value: `${procent(stat.current)} → ${procent(stat.target)}`,
          caption: t.deckAxisStatCaption(stat.assessed, stat.total),
        },
        {
          kind: 'bullets',
          rect: {
            ...halfRect('left', true),
            y: G.contentY + contentH(true) * 0.46,
            h: contentH(true) * 0.54,
          },
          items: [
            t.deckAxisMaxGap(stat.maxGap ?? '—'),
            t.deckAxisCriticalCount(stat.criticalCount),
            ...(notatkaTekst ? [notatkaTekst] : []),
          ],
        },
        {
          kind: 'table',
          rect: halfRect('right', true),
          head: [...t.deckAxisTableHeaders],
          widths: [0.58, 0.14, 0.14, 0.14],
          rows: mieszczaceSieWiersze(
            najwieresztaWiersze(najwieksze, t, language),
            halfRect('right', true)
          ),
        },
      ],
      takeaway:
        stat.maxGap === null
          ? t.deckAxisTakeawayNoGaps
          : t.deckAxisTakeawayPriority(priorityForGap(stat.maxGap, language)),
    });
  }

  // 12 — rejestr luk
  const rejestrRect = fullRect(true);
  // Kolumna „Poziom docelowy" celowo pokazuje SAMĄ LICZBĘ, bez etykiety
  // poziomu: etykiety osi 3–7 są w korpusie metodyki po angielsku
  // („Expert", „Data from Physical…"), a angielskie słowo w polskiej
  // prezentacji dla klienta to defekt, nie detal. W raporcie DOCX etykieta
  // zostaje — tam jest miejsce, żeby ją opisać wraz z osią. Dla `en` to
  // ograniczenie nie istnieje (cały raport jest po angielsku), więc etykieta
  // ("level 3") jest tam bezpieczna.
  const rejestrWiersze = mieszczaceSieWiersze(
    lukiMalejaco.map(({ chapter, area, gap }) => [
      `${area.unitId} ${skrot(areaLabel(area, language), 6)}`,
      skrot(axisLabel(chapter, language), 4),
      String(gap),
      area.targetLevel === null ? '—' : `${t.deckGapRegisterLevelPrefix} ${area.targetLevel}`,
    ]),
    rejestrRect
  );
  slides.push({
    id: 'rejestr-luk',
    kicker: t.deckGapRegisterKicker,
    title: t.deckGapRegisterTitle,
    bodies: [
      {
        kind: 'table',
        rect: rejestrRect,
        head: [...t.deckGapRegisterHeaders],
        widths: [0.42, 0.3, 0.1, 0.18],
        rows: rejestrWiersze,
      },
    ],
    takeaway: t.deckGapRegisterTakeaway(luki.length, rejestrWiersze.length),
  });

  // 13 — priorytety
  const priorytety = new Map<string, number>();
  for (const entry of luki) {
    const key = priorityForGap(entry.gap, language);
    priorytety.set(key, (priorytety.get(key) ?? 0) + 1);
  }
  slides.push({
    id: 'priorytety',
    kicker: t.deckPrioritiesKicker,
    title: t.deckPrioritiesTitle,
    bodies: [
      {
        kind: 'table',
        rect: halfRect('left'),
        head: [...t.deckPrioritiesHeaders],
        widths: [0.6, 0.4],
        rows: [...priorytety.entries()].map(([key, count]) => [key, String(count)]),
      },
      {
        kind: 'bullets',
        rect: halfRect('right'),
        items: [
          contract.programDecisionLine?.direction ?? t.deckPrioritiesDirectionMissing,
          contract.programDecisionLine?.priority ?? t.deckPrioritiesPriorityMissing,
          contract.sourceKind === 'legacy'
            ? t.deckPrioritiesRecommendationLegacy
            : t.deckPrioritiesRecommendationCore,
        ],
      },
    ],
    takeaway: null,
  });

  // 14 — następne kroki
  slides.push({
    id: 'nastepne-kroki',
    kicker: t.deckNextStepsKicker,
    title: t.deckNextStepsTitle,
    bodies: [
      {
        kind: 'bullets',
        rect: fullRect(),
        // Punkt o obszarach bez poziomu pojawia się TYLKO wtedy, gdy takie
        // obszary są. „Uzupełnić 0 obszarów…" to zdanie, które nic nie znaczy,
        // a na slajdzie dla zarządu wygląda jak niedopilnowany generator.
        items: [
          t.deckNextStepsConfirm(krytyczne.length),
          ...(wszystkie - ocenione > 0
            ? [t.deckNextStepsFillMissing(wszystkie - ocenione)]
            : [t.deckNextStepsAllCovered]),
          t.deckNextStepsOwner,
          t.deckNextStepsHorizon,
          t.deckNextStepsApprove,
        ],
      },
    ],
    takeaway: null,
  });

  return {
    title: t.deckTitle(org),
    clientName,
    organizationName: org,
    generatedAt: contract.generatedAt,
    language,
    confidentiality: t.deckConfidentiality(org),
    slides,
  };
}

function najwieresztaWiersze(
  areas: readonly AssessmentReportContract['chapters'][number]['matrix']['areas'][number][],
  t: ReportI18nShape,
  language: ReportLanguage
): string[][] {
  if (areas.length === 0) return [[...t.deckNoAreasFallbackRow]];
  return areas.map((area) => [
    `${area.unitId} ${skrot(areaLabel(area, language), 5)}`,
    area.currentLevel === null ? '—' : String(area.currentLevel),
    area.targetLevel === null ? '—' : String(area.targetLevel),
    area.gap === null ? '—' : String(area.gap),
  ]);
}
