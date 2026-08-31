/**
 * Group (dimension/axis) LABEL resolution for every Output-derived assessment
 * surface — report document, presentation deck, and anything else that has to
 * print WHICH dimension a frozen number belongs to.
 *
 * ★ WHY THIS LIVES HERE AND NOT IN THE KERNEL (read before "simplifying"):
 * `ReportGroupResult.groupName` is produced by `groupResultsFrom()` in
 * `src/method-core/outputs/reportSnapshot.ts`, which sets `groupName: groupId`
 * — it echoes the RAW aggregation key (`axis-1`, a SIRI pillar id, an audit
 * clause prefix). That is not a bug in the kernel: `src/method-core/outputs/`
 * is deliberately methodology-agnostic and must not import a specific
 * methodology's dictionary. `resolveDrdAxisName` reads `@/services/drdStructure`
 * (a UI-layer service) through the licence-gated `drdLabels.ts` boundary;
 * pulling that into the kernel would invert the layering AND drag
 * licence-restricted DRD content into a module every method pack shares.
 * `reportSnapshot.test.ts` additionally pins `buildReportSnapshot.length === 2`
 * as a canon guard against extra parameters on that signature.
 *
 * So names are resolved ONE layer up — in the view-model builders that already
 * know the Output's own pinned `methodPackId`/`methodPackVersion`. This is not
 * a violation of buildPresentationDeck's "zero przeliczania w komponencie"
 * rule: that rule is about NUMBERS (no new average/ratio/score). A label is a
 * static dictionary lookup, and it happens in the BUILDER, never in the slide.
 *
 * ★ HONEST DEGRADE: unknown pack, version mismatch, or unknown group id all
 * return `null`, and every caller falls back to the raw id. A wrong name on a
 * board-facing deck is worse than a raw id.
 */
import { listDrdAxisNarratives, resolveDrdAxisName, type DrdSourceLanguage } from './report/drdLabels';

/**
 * Resolves one `aggregation.byGroup` key to a human-readable dimension name,
 * dispatching on the Output's OWN pinned method pack. Returns `null` when the
 * name cannot be established with certainty — never a guess.
 *
 * Method packs other than DRD (SIRI pillars, audit clause groups) have no
 * structural-label dictionary wired yet, so they resolve to `null` and render
 * their raw group id, exactly as they do today. Adding one is a new branch
 * here — no change to the kernel or to any consumer.
 */
export function resolveGroupName(
  methodPackId: string,
  methodPackVersion: string,
  groupId: string
): string | null {
  return resolveDrdAxisName(methodPackId, methodPackVersion, groupId);
}

/**
 * Convenience wrapper for the common "name or raw id" call, so consumers do
 * not each re-invent the fallback.
 */
export function groupNameOrId(
  methodPackId: string,
  methodPackVersion: string,
  groupId: string
): string {
  return resolveGroupName(methodPackId, methodPackVersion, groupId) ?? groupId;
}

// ---------------------------------------------------------------------------
// MACIERZ obszary × poziomy — model widoku, jedna sztuka na oś
//
// ★ PO CO. Odbiór właściciela ekranu prezentacji z oceny (2026-08-30):
// „Jeśli to ma być raport, to musi być opis, muszą być na nim macierze, muszą
// być ich opisy. Teraz nie ma macierzy nawet." Deck miał wyłącznie profil per
// oś (siedem słupków), czyli JEDNĄ liczbę na oś — a macierz jest w metodyce
// narzędziem: pokazuje KAŻDY obszar na drabinie poziomów naraz.
//
// Model powstaje TU, o warstwę wyżej niż jądro (patrz nagłówek pliku): liczby
// są kopiowane wprost z `output.current`/`output.target`, struktura osi
// i nazwy obszarów pochodzą z licencjonowanej bramki `drdLabels`. Zero
// przeliczania — żadnej średniej, żadnego rozgłaszania wyniku osi na obszary
// (dokładnie ten błąd popełnia generator HTML przez trasę produktu:
// `areaScoresFromAxisData` rozdaje jedną liczbę osi wszystkim jej obszarom,
// zmierzone w `docs/program/grafika/RAPORT_OCENY_STAN.md`, Część II).
// ---------------------------------------------------------------------------

export interface AxisMatrixArea {
  readonly id: string;
  readonly name: string;
  /** `null` = obszar NIEobjęty tą oceną. Nigdy 0 — zero to wynik, brak to brak. */
  readonly currentLevel: number | null;
  readonly targetLevel: number | null;
}

export interface AxisMatrixModel {
  readonly axisId: string;
  readonly axisNumber: number;
  readonly axisName: string;
  readonly description: string | null;
  readonly descriptionLanguage: DrdSourceLanguage;
  readonly levelCount: number;
  /** Wiersze macierzy, malejąco. `title === null` → podpis samym numerem. */
  readonly levels: readonly { readonly level: number; readonly title: string | null }[];
  /** Czy nazwy poziomów są wspólne dla całej osi (patrz `sharedLevelLadder`). */
  readonly hasSharedLadder: boolean;
  readonly levelLanguage: DrdSourceLanguage;
  /** WSZYSTKIE obszary osi — także nieocenione, żeby było widać brak pomiaru. */
  readonly areas: readonly AxisMatrixArea[];
  readonly assessedCount: number;
}

/**
 * Buduje po jednej macierzy na oś metodyki. Zwraca WYŁĄCZNIE osie, w których
 * cokolwiek zmierzono — oś bez ani jednego ocenionego obszaru nie zasługuje na
 * własny slajd, bo pokazałaby pustą siatkę.
 *
 * Pusty wynik (obcy pakiet, niezgodna przypięta wersja) = deck bez slajdów
 * macierzy, czyli dokładnie dotychczasowe zachowanie — nigdy macierz
 * narysowana ze struktury innej wersji metodyki niż ta, którą oceniano.
 */
export function buildAxisMatrices(
  methodPackId: string,
  methodPackVersion: string,
  current: Readonly<Record<string, number | null>>,
  target: Readonly<Record<string, number | null>>
): readonly AxisMatrixModel[] {
  const axes = listDrdAxisNarratives(methodPackId, methodPackVersion);
  const out: AxisMatrixModel[] = [];
  for (const axis of axes) {
    const areas: AxisMatrixArea[] = axis.areas.map((a) => ({
      id: a.id,
      name: a.name,
      currentLevel: current[a.id] ?? null,
      targetLevel: target[a.id] ?? null,
    }));
    // „Ocenionych" = obszary z ROZSTRZYGNIĘTYM poziomem obecnym. Obszar,
    // który ma tylko cel (bo ktoś zadał cel, a stanu nie ustalono), jest
    // w macierzy widoczny jako samo ○ — ale nie jest zmierzony i nie wolno
    // go liczyć jako oceniony. Ta sama definicja co licznik w macierzy
    // (`currentLevel > 0`), więc podpis pod slajdem nie kłóci się z kartą
    // „Ocenionych" wewnątrz siatki.
    const assessedCount = areas.filter((a) => a.currentLevel !== null).length;
    const drawableCount = areas.filter((a) => a.currentLevel !== null || a.targetLevel !== null).length;
    if (drawableCount === 0) continue;
    const ladder = axis.sharedLevelLadder;
    const levels = Array.from({ length: axis.levelCount }, (_, i) => {
      const level = axis.levelCount - i; // najwyższy poziom u góry
      return { level, title: ladder?.find((l) => l.level === level)?.title ?? null };
    });
    out.push({
      axisId: axis.axisId,
      axisNumber: axis.axisNumber,
      axisName: axis.axisName,
      description: axis.description,
      descriptionLanguage: axis.descriptionLanguage,
      levelCount: axis.levelCount,
      levels,
      hasSharedLadder: ladder !== null,
      levelLanguage: axis.levelLanguage,
      areas,
      assessedCount,
    });
  }
  return out;
}
