/**
 * AssessmentReportView — DRD structural labels (dimension/axis names only).
 *
 * ★ LICENCE BOUNDARY (deliberate, read before extending this file):
 * `compileDrdPack()`'s manifest states
 * `licence.usageRestriction: 'internal_only'` with an explicit notice:
 * "DRD/Digital Pathfinder jest metodyką licencjonowaną. Treści QBank v2 i
 * opisy poziomów pochodzą z materiałów DBR77 — zakaz kopiowania do
 * publicznych deliverables bez zgody właściciela metodyki."
 * (src/method-core/methods/drd/compileDrdPack.ts).
 *
 * This report is exactly the scenario that notice is about — "dokument,
 * który konsultant pokazuje zarządowi klienta" is a deliverable that leaves
 * the internal team. So this file deliberately exposes ONLY the
 * structural/topic labels (area name, axis name — e.g. "Procesy Sprzedaży",
 * "Zarządzanie Danymi") needed to say WHICH dimension a frozen number
 * belongs to. It does NOT expose `canonicalDefinition` / `examples` /
 * `technologyExamples` / `misScoringTraps` — the QBank v2 coaching content
 * the licence notice names specifically.
 *
 * ★★ ZGODA WŁAŚCICIELA METODYKI — POTWIERDZONA WPROST 2026-08-30 (wieczór).
 * Nadzorca toru grafiki zapytał właściciela dosłownie, czy potwierdza zgodę na
 * użycie opisów poziomów w raporcie WYCHODZĄCYM DO KLIENTA. Odpowiedź: TAK.
 * Uzasadnienie właściciela: raport bez definicji poziomów jest szkieletem,
 * a brak dobrego dokumentu z tego produktu jest jego najdłużej otwartym zarzutem.
 *
 * ZAKRES TEJ ZGODY — czytaj, zanim rozszerzysz plik dalej:
 *   OBJĘTE:      nazwa osi · opis osi · nazwa obszaru · tytuł i opis poziomu.
 *   NIEOBJĘTE:   warstwa coachingowa QBank v2 — `canonicalDefinition`,
 *                `examples`, `technologyExamples`, `misScoringTraps`.
 *                Na nią zgody NIE udzielono i nie wolno jej domniemywać.
 * Rozszerzenie poza „OBJĘTE" wymaga NOWEGO, osobnego pytania do właściciela.
 * Zapis decyzji: docs/program/grafika/KANON_Z_ODBIOROW.md.
 *
 * ★ 2026-08-30 — ZAKRES ROZSZERZONY O OPIS OSI I OPIS POZIOMU, na wyraźne
 * polecenie właściciela metodyki (DBR77 / dr Piotr Wiśniewski, ten sam
 * podmiot, którego dotyczy nota licencyjna). Jego specyfikacja raportu
 * z oceny brzmi dosłownie: „Siedem osi — dla każdej z nich opisujemy
 * najpierw samą oś, a następnie obszar". Bez `DRDAxis.description`
 * i `DRDLevel.title/description` tego zdania nie da się wykonać — raport
 * drukował sam nagłówek obszaru i liczby (zmierzone:
 * `docs/program/grafika/RAPORT_OCENY_STAN.md`, wymagania 2b i 2c = BRAK).
 * To jest właśnie „explicit go-ahead from the methodology owner", o który
 * prosił poprzedni akapit. Nadal NIE eksponujemy warstwy coachingowej
 * QBank v2 (przykłady, pułapki oceniania) — tylko definicję osi i definicję
 * poziomu, bo to one są treścią raportu dla klienta.
 *
 * ★ JĘZYK ŹRÓDŁA. Korpus metodyki w repo jest po angielsku dla osi
 * 1, 2, 3, 4 i 7; po polsku (w większości) dla osi 5 i 6; opisy SAMYCH osi
 * są angielskie we wszystkich siedmiu. Zmierzone na `DRD_STRUCTURE`
 * 2026-08-30: 233 tytuły poziomów, z tego PL 0/0/0/0/11/14/0, oraz 233
 * opisy poziomów, z tego PL 0/0/0/0/27/26/0. Dlatego każdy zwracany opis
 * niesie `sourceLanguage` — konsument MUSI to pokazać czytelnikowi zamiast
 * udawać, że angielski akapit w polskim dokumencie jest polski.
 * Język nie jest tu wpisany na sztywno, tylko liczony z korpusu
 * (`levelCorpusLanguage`), więc flaga sama się przełączy w dniu, w którym
 * tłumaczenie wejdzie do `drdStructure.ts`.
 *
 * Everything below is a pure, static DICTIONARY LOOKUP keyed by the
 * Output's OWN PINNED `methodPackVersion` — never a re-score, never a
 * "what would this be under the latest pack" guess. If the compiled pack's
 * version does not match the pinned version, lookups return `null` and the
 * caller falls back to the raw id — an honest degrade, not a mislabel.
 */
import { compileDrdPack, DRD_METHOD_PACK_ID } from '@/method-core/methods/drd/compileDrdPack';
import { DRD_STRUCTURE } from '@/services/drdStructure';

export interface DrdUnitLabel {
  readonly unitId: string;
  readonly unitName: string;
  readonly axisId: string;
  readonly axisName: string;
  readonly order: number;
  readonly levelScale: readonly number[];
}

let cachedPack: ReturnType<typeof compileDrdPack>['pack'] | null = null;
let cachedPackFailed = false;

function getCompiledDrdPack(): ReturnType<typeof compileDrdPack>['pack'] | null {
  if (cachedPackFailed) return null;
  if (!cachedPack) {
    try {
      cachedPack = compileDrdPack().pack;
    } catch {
      cachedPackFailed = true;
      return null;
    }
  }
  return cachedPack;
}

/** Axis id (`axis-${n}`) -> Polish axis name, from the same source the
 * compiler reads (`DRD_STRUCTURE`) — structural topic labels only. */
const AXIS_NAME_BY_ID: Record<string, string> = Object.fromEntries(
  DRD_STRUCTURE.map((axis) => [`axis-${axis.id}`, axis.namePL || axis.name])
);

/**
 * Resolves a unit id to its structural label, GATED on the Output's own
 * pinned `methodPackId`/`methodPackVersion` matching what's actually
 * compiled here. Returns `null` for a non-DRD pack, a version mismatch, or
 * an unknown unit id — every caller must have a raw-id fallback.
 */
export function resolveDrdUnitLabel(
  methodPackId: string,
  methodPackVersion: string,
  unitId: string
): DrdUnitLabel | null {
  if (methodPackId !== DRD_METHOD_PACK_ID) return null;
  const pack = getCompiledDrdPack();
  if (!pack) return null;
  if (pack.manifest.version !== methodPackVersion) return null;
  const unit = pack.units.find((u) => u.unitId === unitId);
  if (!unit || !unit.parentId) return null;
  return {
    unitId: unit.unitId,
    unitName: unit.name,
    axisId: unit.parentId,
    axisName: AXIS_NAME_BY_ID[unit.parentId] ?? unit.parentId,
    order: unit.order,
    levelScale: unit.levelScale,
  };
}

/**
 * Resolves an axis GROUP id (`aggregation.byGroup`'s own keys — e.g.
 * `axis-1`, NOT a unit id) to its Polish axis name, same
 * pinned-version-gated honesty contract as `resolveDrdUnitLabel` above.
 *
 * ★ 2026-08-26 night-fixes-a (NIGHT_SWEEP_A_REPORT_20260826.md — Assessment
 * FIX-ATOM #8): `AssessmentReportDocument.tsx`'s "Wynik per wymiar (oś)"
 * section rendered these raw `axis-N` keys straight into the document —
 * the exact same axes the "Jednostka oceny" table two sections below
 * already resolves to full Polish names via `resolveDrdUnitLabel`'s own
 * `axisName`. This closes that gap using the SAME dictionary
 * (`AXIS_NAME_BY_ID`), not a second one.
 */
export function resolveDrdAxisName(
  methodPackId: string,
  methodPackVersion: string,
  axisGroupId: string
): string | null {
  if (methodPackId !== DRD_METHOD_PACK_ID) return null;
  const pack = getCompiledDrdPack();
  if (!pack) return null;
  if (pack.manifest.version !== methodPackVersion) return null;
  return AXIS_NAME_BY_ID[axisGroupId] ?? null;
}

export function isDrdPack(methodPackId: string): boolean {
  return methodPackId === DRD_METHOD_PACK_ID;
}

// ---------------------------------------------------------------------------
// Warstwa OPISOWA metodyki (oś · obszar · poziom) — patrz nagłówek pliku.
// ---------------------------------------------------------------------------

export type DrdSourceLanguage = 'pl' | 'en';

/** Polskie znaki diakrytyczne — jedyny sygnał języka, jaki niesie korpus
 * (`drdStructure.ts` nie ma pola `lang`). Świadomie NIE używamy tego na
 * pojedynczym zdaniu poziomu: siedem polskich zdań w osiach 5 i 6 nie ma
 * ani jednej diakrytyki („Prowadzona jest analiza ryzyka.") i zostałyby
 * oznaczone jako angielskie. Dlatego decyzja zapada na CAŁYM korpusie osi
 * (funkcja niżej), a nie na zdaniu. */
const PL_DIACRITICS = /[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/;

/**
 * Język korpusu opisów poziomów DANEJ OSI, liczony (nie wpisany na sztywno):
 * większość opisów z polskimi diakrytykami → oś przetłumaczona. Zmierzone
 * 2026-08-30: oś 5 = 27/30, oś 6 = 26/30, pozostałe = 0/25..0/63.
 */
function levelCorpusLanguage(axis: (typeof DRD_STRUCTURE)[number]): DrdSourceLanguage {
  let total = 0;
  let polish = 0;
  for (const area of axis.areas) {
    for (const level of area.levels) {
      total += 1;
      if (PL_DIACRITICS.test(level.description || level.title || '')) polish += 1;
    }
  }
  if (total === 0) return 'en';
  return polish * 2 > total ? 'pl' : 'en';
}

export interface DrdAxisNarrative {
  /** Klucz grupy agregacji: `axis-1`…`axis-7`. */
  readonly axisId: string;
  /** Numer osi wg metodyki (1..7) — kolejność rozdziałów raportu. */
  readonly axisNumber: number;
  readonly axisName: string;
  /** `DRDAxis.description` — definicja osi. `null`, gdy pakiet jej nie ma. */
  readonly description: string | null;
  readonly descriptionLanguage: DrdSourceLanguage;
  /** Ile poziomów ma skala tej osi (7/5/5/7/6/6/5). */
  readonly levelCount: number;
  /** Wszystkie obszary analityczne osi — także te NIEobjęte oceną. */
  readonly areas: readonly { readonly id: string; readonly name: string }[];
  /** Język korpusu opisów poziomów tej osi. */
  readonly levelLanguage: DrdSourceLanguage;
  /**
   * Drabina poziomów WSPÓLNA dla wszystkich obszarów tej osi, albo `null`,
   * gdy obszary mają własne, różne nazwy poziomów.
   *
   * ★ To NIE jest szczegół implementacyjny — to bezpiecznik przed fałszem.
   * Zmierzone 2026-08-30 na `DRD_STRUCTURE`: osie 1 i 2 mają jedną drabinę
   * dla wszystkich obszarów; oś 3 ma jeden obszar odstający (3B), a osie
   * 4, 5, 6 i 7 mają po CZTERY obszary z własną drabiną. Każdy, kto
   * podpisze wiersze macierzy nazwami z `axis.areas[0]`, wypisze dla osi
   * 4–7 nazwy poziomów innego obszaru — dokładnie ten sam błąd, który
   * generator DOCX popełnia na etykietach (`areas[0]`, patrz niżej).
   * `null` znaczy: podpisz wiersze samym numerem poziomu.
   */
  readonly sharedLevelLadder: readonly { readonly level: number; readonly title: string }[] | null;
}

/**
 * Siedem osi metodyki w kolejności metodycznej, z opisem osi i pełną listą
 * obszarów. Ta sama bramka na PRZYPIĘTĄ wersję pakietu co
 * `resolveDrdUnitLabel` — niezgodna wersja zwraca pustą listę, a raport
 * degraduje się do dotychczasowego, płaskiego układu zamiast pokazać opisy
 * z innej wersji metodyki niż ta, którą zamrożono.
 */
export function listDrdAxisNarratives(
  methodPackId: string,
  methodPackVersion: string
): readonly DrdAxisNarrative[] {
  if (methodPackId !== DRD_METHOD_PACK_ID) return [];
  const pack = getCompiledDrdPack();
  if (!pack) return [];
  if (pack.manifest.version !== methodPackVersion) return [];
  return DRD_STRUCTURE.map((axis) => ({
    axisId: `axis-${axis.id}`,
    axisNumber: axis.id,
    axisName: axis.namePL || axis.name,
    description: axis.description ?? null,
    descriptionLanguage: PL_DIACRITICS.test(axis.description ?? '') ? 'pl' : 'en',
    levelCount: axis.levelCount,
    areas: axis.areas.map((a) => ({ id: a.id, name: a.namePL || a.name })),
    levelLanguage: levelCorpusLanguage(axis),
    sharedLevelLadder: sharedLevelLadderOf(axis),
  }));
}

/** Patrz `DrdAxisNarrative.sharedLevelLadder`. Porównanie po tytułach
 * poziomów: jeden odstający obszar unieważnia wspólną drabinę dla całej osi
 * — bo wiersz macierzy jest jeden na całą oś. */
function sharedLevelLadderOf(
  axis: (typeof DRD_STRUCTURE)[number]
): readonly { level: number; title: string }[] | null {
  const first = axis.areas[0];
  if (!first) return null;
  const signature = (a: (typeof axis.areas)[number]): string =>
    a.levels.map((l) => `${l.level}:${l.title}`).join('|');
  const base = signature(first);
  if (!axis.areas.every((a) => signature(a) === base)) return null;
  return first.levels.map((l) => ({ level: l.level, title: l.title }));
}

export interface DrdLevelNarrative {
  readonly level: number;
  readonly title: string;
  readonly description: string;
  readonly sourceLanguage: DrdSourceLanguage;
}

/**
 * Opis KONKRETNEGO poziomu KONKRETNEGO obszaru.
 *
 * ★ Bierze `area.levels`, czyli poziomy TEGO obszaru. To jest ta sama
 * pułapka, na której przewrócił się generator DOCX: `resolveDrdLevelLabelPL`
 * (`server/src/services/assessment/assessmentDrdReportSchemaService.ts:190`)
 * przy braku etykiet na osi sięga po `axis.areas[0]`, więc obszar 6C
 * „Ochrona danych" dostawał w wydanym dokumencie nazwę poziomu obszaru 6A
 * („HR w strategii") — treść nieprawdziwą w dokumencie poufnym klienta
 * (`docs/program/grafika/RAPORT_OCENY_STAN.md`, Część I). Tu nie ma fallbacku
 * na inny obszar: nie ma poziomu → `null`.
 */
export function resolveDrdLevelNarrative(
  methodPackId: string,
  methodPackVersion: string,
  unitId: string,
  level: number | null | undefined
): DrdLevelNarrative | null {
  if (level === null || level === undefined) return null;
  if (methodPackId !== DRD_METHOD_PACK_ID) return null;
  const pack = getCompiledDrdPack();
  if (!pack) return null;
  if (pack.manifest.version !== methodPackVersion) return null;
  for (const axis of DRD_STRUCTURE) {
    const area = axis.areas.find((a) => a.id === unitId);
    if (!area) continue;
    const found = area.levels.find((l) => l.level === level);
    if (!found) return null;
    return {
      level: found.level,
      title: found.title,
      description: found.description,
      sourceLanguage: levelCorpusLanguage(axis),
    };
  }
  return null;
}
