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
  priorityForGap,
  resolveDrdLevelLabelPL,
  type AssessmentReportContract,
} from './assessmentDrdReportSchemaService.js';

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
  readonly slides: readonly DeckSlide[];
}

const PL_DATE = new Intl.DateTimeFormat('pl-PL', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

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

function skrot(text: string, maxWords: number): string {
  const words = text.trim().split(/\s+/u);
  return words.length <= maxWords ? text.trim() : `${words.slice(0, maxWords).join(' ')}…`;
}

function procent(value: number | null): string {
  return value === null ? '—' : `${value}%`;
}

interface AxisStat {
  readonly axisId: number;
  readonly namePL: string;
  readonly current: number | null;
  readonly target: number | null;
  readonly assessed: number;
  readonly total: number;
  readonly maxGap: number | null;
  readonly criticalCount: number;
}

export function policzOsie(contract: AssessmentReportContract): AxisStat[] {
  return contract.chapters.map((chapter) => {
    const gaps = chapter.matrix.areas.flatMap((area) => (area.gap === null ? [] : [area.gap]));
    return {
      axisId: chapter.axisId,
      namePL: chapter.axisNamePL ?? chapter.axisName,
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
  const clientName = contract.sessionLabel.displayName ?? 'Klient do uzupełnienia';
  const org = organizationName ?? clientName;
  const osie = policzOsie(contract);
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
  const dataPL = PL_DATE.format(new Date(contract.generatedAt));

  const slides: DeckSlide[] = [];

  // 1 — okładka
  slides.push({
    id: 'cover',
    kicker: 'Raport z oceny dojrzałości cyfrowej',
    title: clientName,
    cover: true,
    bodies: [
      {
        kind: 'bullets',
        rect: { x: G.margin, y: 3.1, w: CONTENT_W, h: 1.4 },
        items: [
          `Metodyka: ${contract.methodVersion}`,
          `Data wydania: ${dataPL}`,
          `Zakres: ${DRD_STRUCTURE.length} osi, ${wszystkie} obszarów`,
        ],
      },
    ],
    takeaway: null,
  });

  // 2 — agenda
  slides.push({
    id: 'agenda',
    kicker: 'Plan prezentacji',
    title: 'Agenda',
    bodies: [
      {
        kind: 'bullets',
        rect: fullRect(),
        items: [
          'Kontekst oceny i źródło danych',
          'Wynik ogólny — profil siedmiu osi',
          'Oś po osi: co zmierzono i gdzie jest luka',
          'Rejestr luk — obszary o największym dystansie',
          'Priorytety wynikające z luk',
          'Następne kroki',
        ],
      },
    ],
    takeaway: null,
  });

  // 3 — kontekst
  slides.push({
    id: 'kontekst',
    kicker: 'Kontekst',
    title: 'Skąd pochodzi ten wynik',
    bodies: [
      {
        kind: 'table',
        rect: fullRect(),
        head: ['Pole', 'Wartość'],
        widths: [0.32, 0.68],
        rows: [
          ['Organizacja', org],
          ['Przedmiot oceny', clientName],
          ['Profil działalności', contract.businessProfile ?? 'Brak danych w ocenie'],
          ['Zatrudnienie', contract.employment ?? 'Brak danych w ocenie'],
          ['Okres oceny', contract.assessmentPeriod ?? 'Brak danych w ocenie'],
          ['Oceniający', contract.assessor ?? 'Brak danych w ocenie'],
          [
            'Źródło wyniku',
            contract.sourceKind === 'legacy'
              ? 'Ocena prowadzona w warsztacie DRD — poziomy zadeklarowane, bez załączonych dowodów'
              : 'Zamrożony Output jądra metodycznego',
          ],
          ['Pokrycie', `${ocenione} z ${wszystkie} obszarów ma zapisany poziom`],
        ],
      },
    ],
    takeaway: null,
  });

  // 4 — wynik ogólny (wykres natywny)
  slides.push({
    id: 'wynik-ogolny',
    kicker: 'Wynik ogólny',
    title: 'Profil dojrzałości na siedmiu osiach',
    bodies: [
      {
        kind: 'chart',
        rect: fullRect(true),
        categories: osie.map((axis) => `${axis.axisId}. ${skrot(axis.namePL, 3)}`),
        series: [
          { label: 'Poziom obecny', values: osie.map((axis) => axis.current ?? 0) },
          { label: 'Poziom docelowy', values: osie.map((axis) => axis.target ?? 0) },
        ],
        maxValue: 100,
      },
    ],
    takeaway: `Luk krytycznych (dystans co najmniej 3 poziomy): ${krytyczne.length} z ${luki.length} zmierzonych obszarów.`,
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
    // dokleiło do cytatu następny fakt silnika i urwało go w połowie.
    const notatka = chapter.areaComments.find((comment) => comment.assessorNote);
    const notatkaTekst = notatka?.assessorNote
      ? `${notatka.unitId}: ${skrot(notatka.assessorNote, 22)}`
      : null;
    slides.push({
      id: `os-${chapter.axisId}`,
      kicker: `Oś ${chapter.axisId} z ${DRD_STRUCTURE.length}`,
      title: skrot(stat.namePL, 8),
      bodies: [
        {
          kind: 'stat',
          rect: {
            ...halfRect('left', true),
            h: contentH(true) * 0.42,
          },
          value: `${procent(stat.current)} → ${procent(stat.target)}`,
          caption: `Poziom obecny wobec docelowego; oceniono ${stat.assessed} z ${stat.total} obszarów.`,
        },
        {
          kind: 'bullets',
          rect: {
            ...halfRect('left', true),
            y: G.contentY + contentH(true) * 0.46,
            h: contentH(true) * 0.54,
          },
          items: [
            `Największa luka na osi: ${stat.maxGap ?? '—'}`,
            `Obszary z luką co najmniej 3: ${stat.criticalCount}`,
            ...(notatkaTekst ? [notatkaTekst] : []),
          ],
        },
        {
          kind: 'table',
          rect: halfRect('right', true),
          head: ['Obszar', 'Ob.', 'Doc.', 'Luka'],
          widths: [0.58, 0.14, 0.14, 0.14],
          rows: najwieresztaWiersze(najwieksze),
        },
      ],
      takeaway:
        stat.maxGap === null
          ? 'Brak zmierzonych luk na tej osi.'
          : `Priorytet osi: ${priorityForGap(stat.maxGap)}.`,
    });
  }

  // 12 — rejestr luk
  slides.push({
    id: 'rejestr-luk',
    kicker: 'Macierz DRD',
    title: 'Obszary o największej luce',
    bodies: [
      {
        kind: 'table',
        rect: fullRect(true),
        head: ['Obszar', 'Oś', 'Luka', 'Poziom docelowy'],
        widths: [0.4, 0.28, 0.1, 0.22],
        rows: lukiMalejaco.slice(0, 10).map(({ chapter, area, gap }) => [
          `${area.unitId} ${skrot(area.unitNamePL ?? area.unitName, 6)}`,
          skrot(chapter.axisNamePL ?? chapter.axisName, 4),
          String(gap),
          area.targetLevel === null
            ? '—'
            : skrot(
                `${area.targetLevel} — ${resolveDrdLevelLabelPL(chapter.axisId, area.targetLevel)}`,
                5
              ),
        ]),
      },
    ],
    takeaway: `Rejestr obejmuje ${luki.length} obszarów ze zmierzoną luką; pokazano 10 największych.`,
  });

  // 13 — priorytety
  const priorytety = new Map<string, number>();
  for (const entry of luki) {
    const key = priorityForGap(entry.gap);
    priorytety.set(key, (priorytety.get(key) ?? 0) + 1);
  }
  slides.push({
    id: 'priorytety',
    kicker: 'Priorytety',
    title: 'Co wynika z rozkładu luk',
    bodies: [
      {
        kind: 'table',
        rect: halfRect('left'),
        head: ['Priorytet', 'Liczba obszarów'],
        widths: [0.6, 0.4],
        rows: [...priorytety.entries()].map(([key, count]) => [key, String(count)]),
      },
      {
        kind: 'bullets',
        rect: halfRect('right'),
        items: [
          contract.programDecisionLine?.direction ?? 'Kierunek: brak danych w ocenie',
          contract.programDecisionLine?.priority ?? 'Priorytet: brak danych w ocenie',
          contract.sourceKind === 'legacy'
            ? 'Rekomendacje per obszar nie zostały zapisane w tej ocenie — priorytet wynika wyłącznie z wielkości luki.'
            : 'Rekomendacje per obszar pochodzą z findingów zamrożonego Outputu.',
        ],
      },
    ],
    takeaway: null,
  });

  // 14 — następne kroki
  slides.push({
    id: 'nastepne-kroki',
    kicker: 'Następne kroki',
    title: 'Od wyniku do działania',
    bodies: [
      {
        kind: 'bullets',
        rect: fullRect(),
        items: [
          `Potwierdzić poziomy w ${krytyczne.length} obszarach z luką co najmniej 3 i uzupełnić dowody.`,
          `Uzupełnić ${wszystkie - ocenione} obszarów bez zapisanego poziomu albo świadomie je pominąć z uzasadnieniem.`,
          'Przypisać właściciela do każdego obszaru o priorytecie krytycznym.',
          'Ustalić horyzont czasowy — ocena go nie zawiera i nie jest tu dopisywany.',
          'Zatwierdzić raport i przenieść luki do rejestru inicjatyw.',
        ],
      },
    ],
    takeaway: null,
  });

  return {
    title: `Raport z oceny dojrzałości cyfrowej — ${clientName}`,
    clientName,
    organizationName: org,
    generatedAt: contract.generatedAt,
    confidentiality: `Poufne — ${clientName}`,
    slides,
  };
}

function najwieresztaWiersze(
  areas: readonly AssessmentReportContract['chapters'][number]['matrix']['areas'][number][]
): string[][] {
  if (areas.length === 0) return [['Brak zmierzonych obszarów', '—', '—', '—']];
  return areas.map((area) => [
    `${area.unitId} ${skrot(area.unitNamePL ?? area.unitName, 5)}`,
    area.currentLevel === null ? '—' : String(area.currentLevel),
    area.targetLevel === null ? '—' : String(area.targetLevel),
    area.gap === null ? '—' : String(area.gap),
  ]);
}
