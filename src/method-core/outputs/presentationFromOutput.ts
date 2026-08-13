/**
 * Wyprowadzenie bloków prezentacji z zamrożonego Outputu.
 *
 * ★ Powód powstania (2026-08-13). `MethodPresentationView` istniał, był
 * przetestowany i oceniony przez niezależny audyt MPQ na 30/30 — ale miał
 * ZERO callerów produkcyjnych. Klient nie widział go nigdy. Brakującym
 * ogniwem był właśnie ten plik: sposób zamiany Outputu na `PresentationSourceBlock[]`.
 * Harness demonstracyjny miał bloki pisane ręcznie, więc luka nie rzucała się
 * w oczy — ekran wyglądał na gotowy, bo w harnessie był.
 *
 * ★★ ZASADA NADRZĘDNA: ten moduł NIE PISZE TREŚCI.
 * `keyMessage` slajdu to `finding.businessMeaning` — zdanie napisane przez
 * metodykę i zatwierdzone w procesie oceny, nie sformułowane tutaj. Tak samo
 * `recommendation` i `expectedOutcome`. Gdyby ten plik zaczął układać własne
 * zdania, tworzyłby treść doradczą bez dowodu i bez zatwierdzenia — czyli
 * dokładnie to, czego zakazuje kontrakt Assessment.
 *
 * Draftów nie przepuszczamy: `createPresentationSourceBlock` odrzuca finding
 * o statusie proposed/needs-evidence, chyba że wywołujący jawnie poprosi o
 * oznaczony draft. Tutaj NIE prosimy — do prezentacji dla klienta wchodzi
 * wyłącznie treść zaakceptowana.
 */
import { createPresentationSourceBlock } from './presentationSourceBlock';
import type { AssessmentOutput, Finding, PresentationSourceBlock } from './types';

/** Kolejność slajdów: największa luka najpierw — to jest wniosek, nie alfabet. */
function byGapDesc(a: Finding, b: Finding): number {
  return (b.gap ?? -1) - (a.gap ?? -1);
}

export interface BuildPresentationBlocksOptions {
  /** Kto wygenerował — prowadzi do `provenance`, nigdy nie zgadywane. */
  readonly generatedBy?: 'human' | 'teresa';
  /** Znacznik czasu; wstrzykiwany, żeby wynik był deterministyczny w testach. */
  readonly generatedAt?: string;
  /** Domyślnie materiał dla klienta — świadoma decyzja, nie przypadek. */
  readonly confidentiality?: 'internal_only' | 'client_deliverable' | 'public';
  /**
   * Mapa `unitId -> nazwa czytelna dla człowieka`.
   *
   * ★ Slajd dla klienta nie może pokazywać `1A`/`1B`. Nazw NIE wyprowadzamy
   * tutaj, bo ten moduł jest metodyko-agnostyczny — dostarcza je wywołujący,
   * który zna strukturę swojej metody. Brak nazwy => zostaje identyfikator
   * (uczciwie, zamiast zgadywać).
   */
  readonly unitNames?: Readonly<Record<string, string>>;
}

/**
 * Polska odmiana po liczebniku: „1 jednostki", „2 jednostek", „5 jednostek".
 * Slajd idzie do klienta — „0 z 1 jednostek" to widoczny błąd językowy.
 */
function unitsGenitive(n: number): string {
  return n === 1 ? 'jednostki' : 'jednostek';
}

/**
 * Zdanie przewodnie slajdu przeglądowego, POLICZONE z danych — nie napisane.
 * To arytmetyka na Outpucie (ile jednostek osiąga cel, gdzie jest największa
 * luka), a nie teza doradcza. Dlatego wolno je tu złożyć.
 */
function overviewKeyMessage(output: AssessmentOutput, nameOf: (id: string) => string): string {
  const ids = Object.keys(output.target).filter((id) => output.target[id] != null);
  const atTarget = ids.filter((id) => (output.gap[id] ?? 1) <= 0).length;
  const worst = ids
    .filter((id) => (output.gap[id] ?? 0) > 0)
    .sort((a, b) => (output.gap[b] ?? 0) - (output.gap[a] ?? 0))[0];

  if (ids.length === 0) return 'Brak ustalonych poziomów docelowych.';
  if (!worst) return `Wszystkie oceniane jednostki (${atTarget}/${ids.length}) osiągają poziom docelowy.`;
  return `${atTarget} z ${ids.length} ${unitsGenitive(ids.length)} osiąga cel; największa luka: ${nameOf(worst)} (${output.gap[worst]}).`;
}

/**
 * Zwraca bloki gotowe dla `MethodPresentationView`:
 *  1. jeden blok przeglądowy (gap chart po wszystkich jednostkach),
 *  2. po jednym bloku na KAŻDY zaakceptowany finding, w kolejności luki.
 *
 * Findingi nieprzyjęte są pomijane — nie są ukrywane przed użytkownikiem
 * (widzi je w Output), po prostu nie trafiają do materiału klienckiego.
 */
export function buildPresentationBlocksFromOutput(
  output: AssessmentOutput,
  options: BuildPresentationBlocksOptions = {}
): readonly PresentationSourceBlock[] {
  const generatedBy = options.generatedBy ?? 'human';
  const generatedAt = options.generatedAt ?? output.createdAt;
  const confidentiality = options.confidentiality ?? 'client_deliverable';
  const nameOf = (id: string): string => options.unitNames?.[id] ?? id;

  const blocks: PresentationSourceBlock[] = [];

  // Płaska mapa `nazwa -> poziom bieżący`. `SlideBars` renderuje wykres tylko
  // dla PŁASKIEJ mapy (`isUnitLevelMap`); zagnieżdżona cicho nie rysuje nic.
  const overviewSnapshot: Record<string, number | null> = {};
  for (const id of Object.keys(output.current)) overviewSnapshot[nameOf(id)] = output.current[id] ?? null;

  // 1. Przegląd — jedna dominująca geometria: luka current -> target.
  blocks.push(
    createPresentationSourceBlock(output, {
      blockType: 'gap_chart',
      blockId: `${output.id}-overview`,
      finding: null,
      dataSnapshot: overviewSnapshot,
      title: 'Stan obecny wobec celu',
      keyMessage: overviewKeyMessage(output, nameOf),
      visualIntent: 'comparison',
      preferredLayouts: ['chart', 'matrix'],
      density: 'sparse',
      themeTokens: {},
      confidentiality,
      generatedBy,
      generatedAt,
    })
  );

  // 2. Po jednym slajdzie na zaakceptowany finding.
  for (const finding of [...output.findings].sort(byGapDesc)) {
    try {
      blocks.push(
        createPresentationSourceBlock(output, {
          blockType: 'finding',
          blockId: `${output.id}-${finding.id}`,
          finding,
          // Klucz to NAZWA, nie `1A` — to snapshot prezentacyjny (etykiety
          // slajdu), nie rekord domenowy.
          dataSnapshot: {
            [`${finding.unitName} — obecnie`]: finding.currentLevel,
            [`${finding.unitName} — cel`]: finding.targetLevel,
          },
          title: finding.unitName,
          // ★ Słowa metodyki, nie moje. To jest wniosek dla klienta.
          keyMessage: finding.businessMeaning,
          visualIntent: 'recommendation',
          preferredLayouts: ['two_column', 'chart'],
          density: 'standard',
          themeTokens: {},
          confidentiality,
          generatedBy,
          generatedAt,
        })
      );
    } catch {
      // `createPresentationSourceBlock` odrzuca treść nieprzyjętą (proposed /
      // needs-evidence). To POPRAWNE zachowanie, nie błąd do obejścia:
      // materiał dla klienta nie może zawierać niezatwierdzonych wniosków.
      // Finding pozostaje widoczny w Output — tam jest jego miejsce.
      continue;
    }
  }

  return blocks;
}
