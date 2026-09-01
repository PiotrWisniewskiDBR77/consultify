/**
 * Pakiet E — OWN-FIN-014 ("tabela wskaźników ma sztywny, ubogi zestaw
 * kolumn, nie korzysta ze standardu tabel, nie pozwala zarządzać pojedynczym
 * wskaźnikiem"). Czysta logika konsumowana przez `AnalysisKpiTable.tsx`
 * (renderuje `StandardTable`, kanon `src/components/standard/StandardTable.tsx`
 * — kontroler "Kolumny"/pin/reorder/reset/persystencja localStorage już tam
 * istnieje, ten plik NIE reimplementuje kontrolera, tylko dostarcza
 * `TableColumn[]`/`TableRow[]` zgodne z jego kontraktem).
 *
 * Katalog pól (brief, dosłownie): nazwa+kategoria · wzór ze składnikami ·
 * ogólne zasady interpretacji · wartości per okres (historyczne+prognozowane)
 * · zmiana r/r (wartość+%) · benchmark branżowy (zakres+źródło+data) ·
 * interpretacja KONKRETNEGO wyniku · status jakości/dostępności · przeznaczenia
 * downstream.
 */

import { Decimal } from 'decimal.js';

import type { AnalysisKpiTier, AnalysisKpiValueDto } from '../../../services/api/financeV2.types';
import {
  financeValueDisplayReasonLabel,
  formatAnalysisKpiValueForDisplay,
} from '../../../services/api/financeV2.types';
import type { TableColumn, TableRow } from '../../standard/StandardTable';

// ---------------------------------------------------------------------------
// YoY delta — MISSING/NA nigdy nie stają się 0 przez odejmowanie/dzielenie.
//
// ★ Decimal, nie float (task #E3, ta sama dyscyplina co `analysisKpiCompute.ts`
// — "korekta koordynatora 2026-08-12, master plan §2.4: wartość jako Decimal…
// zaokrąglanie WYŁĄCZNIE na granicy prezentacji"). `valueDecimal` (string
// pełnej precyzji z API) trafia PROSTO do `Decimal` — odejmowanie i dzielenie
// poniżej są arytmetyką Decimal, nigdy `Number() - Number()`/`/`. `.toNumber()`
// jest wołane RAZ, na samym końcu (granica prezentacji — `YoyDelta` jest
// konsumowany przez `.toFixed(1)`/porównania sortowania, gdzie `number` jest
// właściwym kształtem), nie w środku obliczeń.
//
// Konkretny przypadek (weryfikator pakietu E, sabotaż): current="0.2",
// prior="-0.1" → `Number('0.2') - Number('-0.1')` daje `0.30000000000000004`
// (IEEE-754, ten sam artefakt co klasyczne `0.1 + 0.2`) zamiast dokładnego
// `0.3`. Regresja przypięta w `analysisKpiTable.contract.test.ts`.
// ---------------------------------------------------------------------------

export interface YoyDelta {
  status: 'COMPUTED' | 'MISSING_CURRENT' | 'MISSING_PRIOR' | 'PRIOR_ZERO_PCT_UNDEFINED';
  absoluteDelta: number | null;
  percentDelta: number | null;
}

export function computeYoyDelta(
  current: Pick<AnalysisKpiValueDto['value'], 'status' | 'valueDecimal'>,
  prior: Pick<AnalysisKpiValueDto['value'], 'status' | 'valueDecimal'> | null
): YoyDelta {
  const currentIsPresent =
    current.status === 'PRESENT_ZERO' || current.status === 'PRESENT_NONZERO';
  if (!currentIsPresent || current.valueDecimal === null) {
    return { status: 'MISSING_CURRENT', absoluteDelta: null, percentDelta: null };
  }
  if (!prior) {
    return { status: 'MISSING_PRIOR', absoluteDelta: null, percentDelta: null };
  }
  const priorIsPresent = prior.status === 'PRESENT_ZERO' || prior.status === 'PRESENT_NONZERO';
  if (!priorIsPresent || prior.valueDecimal === null) {
    return { status: 'MISSING_PRIOR', absoluteDelta: null, percentDelta: null };
  }
  const currentDecimal = new Decimal(current.valueDecimal);
  const priorDecimal = new Decimal(prior.valueDecimal);
  const absoluteDeltaDecimal = currentDecimal.minus(priorDecimal);
  if (priorDecimal.isZero()) {
    // % zmiany od zera jest matematycznie nieokreślona (dzielenie przez 0) —
    // NIGDY nie renderuj 0%/Infinity%, pokaż wartość bezwzględną z jawnym
    // powodem braku procentu, nie fałszywym "0%".
    return {
      status: 'PRIOR_ZERO_PCT_UNDEFINED',
      absoluteDelta: absoluteDeltaDecimal.toNumber(),
      percentDelta: null,
    };
  }
  const percentDeltaDecimal = absoluteDeltaDecimal.dividedBy(priorDecimal).times(100);
  return {
    status: 'COMPUTED',
    absoluteDelta: absoluteDeltaDecimal.toNumber(),
    percentDelta: percentDeltaDecimal.toNumber(),
  };
}

// ---------------------------------------------------------------------------
// Grupowanie po KPI — `GET /analysis/:id/kpi-values` zwraca JEDEN wiersz PER
// (kpiCode, periodId) (analysis.routes.ts:143-170, `AnalysisKpiValueDto.periodId`
// jest polem obowiązkowym pojedynczego okresu). Brief wymaga jednego WIERSZA
// TABELI per wskaźnik z wartościami "per okres (historyczne+prognozowane)" w
// osobnych kolumnach — więc ten moduł grupuje DTO backendu PRZED zbudowaniem
// `TableRow`, zamiast (błędnie) renderować jeden wiersz per (kpi, okres) z
// zawsze pustymi kolumnami okresów.
//
// Determinizm (CLAUDE.md/brief §12 — "sortuj W PAMIĘCI przed
// hashowaniem/sumowaniem, dodawanie float nie jest łączne"): ten moduł nie
// sumuje liczb, ale ITERACJA po `Map` ma kolejność insercji, która zależy od
// kolejności odpowiedzi API (niezagwarantowanej) — więc `kpiCode` jest jawnie
// SORTOWANY przed zwróceniem wierszy, żeby dwa wywołania z tymi samymi
// danymi (różna kolejność sieciowa) dały IDENTYCZNĄ kolejność wierszy.
// ---------------------------------------------------------------------------

export interface AnalysisKpiGroup {
  kpiCode: string;
  kpiName: string;
  category: string | null;
  tier: AnalysisKpiTier;
  /** Wpis z najnowszego okresu spośród `periodColumnIdsChronological`, dla którego istnieje wiersz — steruje wartością bieżącą/YoY/kebab/detail. */
  latestValue: AnalysisKpiValueDto;
  /** Wartość z okresu bezpośrednio poprzedzającego `latestValue` (do YoY) — `null` gdy brak/pierwszy okres z danymi. */
  priorPeriodValue: AnalysisKpiValueDto['value'] | null;
  /** Wartość TEGO KPI w KAŻDYM okresie kolumnowym, kluczowana `periodId`==id kolumny. `undefined` = brak wiersza compute dla tego okresu (odróżnione od MISSING/NA, które SĄ wierszem ze statusem braku). */
  periodValuesByColumnId: Record<string, AnalysisKpiValueDto['value'] | undefined>;
}

export function groupAnalysisKpiValuesByKpi(
  kpiValues: readonly AnalysisKpiValueDto[],
  periodColumnIdsChronological: readonly string[]
): AnalysisKpiGroup[] {
  const byKpiCode = new Map<string, AnalysisKpiValueDto[]>();
  for (const entry of kpiValues) {
    const bucket = byKpiCode.get(entry.kpiCode);
    if (bucket) bucket.push(entry);
    else byKpiCode.set(entry.kpiCode, [entry]);
  }

  const sortedKpiCodes = [...byKpiCode.keys()].sort((a, b) => a.localeCompare(b));
  const result: AnalysisKpiGroup[] = [];

  for (const kpiCode of sortedKpiCodes) {
    const entries = byKpiCode.get(kpiCode)!;
    const byPeriodId = new Map(entries.map((e) => [e.periodId, e] as const));

    const periodValuesByColumnId: Record<string, AnalysisKpiValueDto['value'] | undefined> = {};
    for (const columnId of periodColumnIdsChronological) {
      periodValuesByColumnId[columnId] = byPeriodId.get(columnId)?.value;
    }

    let latestEntry: AnalysisKpiValueDto | null = null;
    let priorPeriodValue: AnalysisKpiValueDto['value'] | null = null;
    for (let i = periodColumnIdsChronological.length - 1; i >= 0; i -= 1) {
      const match = byPeriodId.get(periodColumnIdsChronological[i]);
      if (!match) continue;
      latestEntry = match;
      for (let j = i - 1; j >= 0; j -= 1) {
        const priorMatch = byPeriodId.get(periodColumnIdsChronological[j]);
        if (priorMatch) {
          priorPeriodValue = priorMatch.value;
          break;
        }
      }
      break;
    }

    if (!latestEntry) {
      // Żaden wpis nie pasuje do znanych kolumn okresów (np. caller nie podał
      // `periodColumnIdsChronological` albo dane dotyczą okresu spoza
      // aktualnego widoku) — fallback deterministyczny: sortuj kopię PO
      // `periodId` (string, rosnąco) i weź ostatni, NIGDY nie ufaj kolejności
      // insercji z sieci.
      const sortedEntries = [...entries].sort((a, b) => a.periodId.localeCompare(b.periodId));
      latestEntry = sortedEntries[sortedEntries.length - 1];
    }

    result.push({
      kpiCode,
      kpiName: latestEntry.kpiName,
      category: latestEntry.category,
      tier: latestEntry.tier,
      latestValue: latestEntry,
      priorPeriodValue,
      periodValuesByColumnId,
    });
  }

  return result;
}

// ---------------------------------------------------------------------------
// Wiersz tabeli — spłaszczenie grupy (jeden KPI, wiele okresów) + pola
// pochodne (YoY, formuła, interpretacja) do kształtu `TableRow` (StandardTable,
// `[key:string]:any`).
// ---------------------------------------------------------------------------

export interface AnalysisKpiCatalogFormulaInfo {
  formulaDisplay: string; // np. "(Przychody − COGS) / Przychody"
  interpretationGeneral: string; // ogólna zasada ("wyższa wartość = lepsza rentowność")
  downstreamUses: string[]; // np. ["Model bazowy — driver marży", "Raport zarządczy Q3"]
}

export interface AnalysisKpiTableRowInput {
  group: AnalysisKpiGroup;
  formulaInfo: AnalysisKpiCatalogFormulaInfo | null;
  includedInReport: boolean;
  markedAsModelInput: boolean;
}

/** Komórka pojedynczego okresu — `undefined` (brak wiersza compute) dostaje WŁASNY powód, różny od MISSING/NA biznesowego. */
function formatPeriodCell(
  value: AnalysisKpiValueDto['value'] | undefined,
  unitType: string
): { text: string; isMissingLikeGlyph: boolean } {
  if (value === undefined) {
    return { text: '—', isMissingLikeGlyph: true };
  }
  return formatAnalysisKpiValueForDisplay({ value, unitType });
}

export function toAnalysisKpiTableRow(input: AnalysisKpiTableRowInput): TableRow {
  const { group } = input;
  const display = formatAnalysisKpiValueForDisplay(group.latestValue);
  const yoy = computeYoyDelta(group.latestValue.value, group.priorPeriodValue);

  const periodCells: Record<string, string> = {};
  const periodCellIsMissingLike: Record<string, boolean> = {};
  for (const [columnId, value] of Object.entries(group.periodValuesByColumnId)) {
    const cell = formatPeriodCell(value, group.latestValue.unitType);
    periodCells[`period.${columnId}`] = cell.text;
    periodCellIsMissingLike[`period.${columnId}`] = cell.isMissingLikeGlyph;
  }

  return {
    id: group.kpiCode,
    kpiCode: group.kpiCode,
    kpiName: group.kpiName,
    category: group.category ?? '—',
    tier: group.tier,
    valueDisplay: display.text,
    valueIsMissingLike: display.isMissingLikeGlyph,
    valueStatus: group.latestValue.value.status,
    valueReason: financeValueDisplayReasonLabel(group.latestValue.value.status),
    yoyDelta: yoy,
    formulaDisplay: input.formulaInfo?.formulaDisplay ?? '—',
    interpretationGeneral: input.formulaInfo?.interpretationGeneral ?? '—',
    interpretationSpecific: group.latestValue.interpretationText ?? '—',
    benchmark: group.latestValue.benchmark,
    qualityFlag: group.latestValue.qualityFlag ?? 'OK',
    downstreamUses: input.formulaInfo?.downstreamUses ?? [],
    includedInReport: input.includedInReport,
    markedAsModelInput: input.markedAsModelInput,
    // Id reprezentatywnego wpisu backendu (najnowszy okres) — kebab/detail
    // operują na TYM konkretnym `kpiValueId`, wiersz tabeli grupuje po `kpiCode`.
    representativeKpiValueId: group.latestValue.kpiValueId,
    ...periodCells,
    __periodCellIsMissingLike: periodCellIsMissingLike,
    // Zachowaj oryginalne DTO (najnowszy okres) do karty szczegółowej
    // (kebab/row click) — StandardTable nie interpretuje dodatkowych pól,
    // tylko przekazuje `row`.
    __kpiValue: group.latestValue,
    __periodValuesByColumnId: group.periodValuesByColumnId,
  };
}

// ---------------------------------------------------------------------------
// Formatowanie komórek NIE-string (`StandardTable`/`FilterableTable` bez
// `column.render` robi `row[column.id]` wprost — obiekt (`YoyDelta`,
// `benchmark`) rzucony w React jako dziecko wywala runtime "Objects are not
// valid as a React child". Złapane REALNYM zrzutem/testem DOM
// (`AnalysisWorkspace.smoke.test.tsx`), nie samą logiką — dokładnie dlatego,
// że logika (`toAnalysisKpiTableRow`) nie renderuje niczego, więc test czystej
// funkcji nie widzi tego defektu.
// ---------------------------------------------------------------------------

// Polski separator dziesiętny (przecinek, nie kropka) — ten sam wzorzec co
// `formatAnalysisKpiValueForDisplay` (financeV2.types.ts, `toLocaleString('pl-PL')`).
// NAPRAWIONE (powtórka 08-31): `.toFixed(1)` dawało „+7.1%"/„-12.3%" z kropką —
// dokładnie ta sama klasa defektu, którą wcześniej zamknięto na
// finance-valuation-workspace („Kropka zamiast przecinka dziesiętnego").
function formatPlPercent1(n: number): string {
  return n.toLocaleString('pl-PL', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

export function formatYoyDeltaText(yoy: YoyDelta): string {
  switch (yoy.status) {
    case 'COMPUTED':
      return yoy.percentDelta === null
        ? '—'
        : `${yoy.percentDelta >= 0 ? '+' : ''}${formatPlPercent1(yoy.percentDelta)}%`;
    case 'PRIOR_ZERO_PCT_UNDEFINED':
      return yoy.absoluteDelta === null
        ? '—'
        : `${yoy.absoluteDelta >= 0 ? '+' : ''}${yoy.absoluteDelta} (% nieokreślony)`;
    case 'MISSING_CURRENT':
    case 'MISSING_PRIOR':
      return '—';
    default: {
      const _exhaustive: never = yoy.status;
      return _exhaustive;
    }
  }
}

export function formatBenchmarkText(benchmark: AnalysisKpiValueDto['benchmark']): string {
  if (!benchmark) return '—';
  return `${benchmark.rangeLow}–${benchmark.rangeHigh} (${benchmark.industryCode}) · ${benchmark.source}`;
}

// ---------------------------------------------------------------------------
// Kolumny — persystencja widoku (widoczność/kolejność/pin) jest już
// zaimplementowana w `StandardTable` (prop `persistKey`, localStorage) — ten
// plik dostarcza tylko definicje. Kolumny okresów są DYNAMICZNE (per
// businessVersion — historyczne + prognozowane).
// ---------------------------------------------------------------------------

export const ANALYSIS_KPI_TABLE_PERSIST_KEY_PREFIX = 'finance-v3.analysis-kpi-table.columns.v1';

export function analysisKpiTablePersistKey(businessVersionId: string): string {
  return `${ANALYSIS_KPI_TABLE_PERSIST_KEY_PREFIX}.${businessVersionId}`;
}

/**
 * Rodzina „ucinany nagłówek" (2026-08-31, `finance-analysis-workspace`,
 * `evidence/grafika/148-finanse-parametry`) — ta sama przyczyna co
 * `OutputsAggregateTabContent.tsx`/`TemplatesManager.tsx` tego dnia:
 * `FilterableTable`'s `table-fixed` renderuje każdą kolumnę na jej
 * deklarowanym `width`; BEZ `width` (stan sprzed naprawy) `columnFit` ściska
 * WSZYSTKIE 11 kolumn do wspólnej podłogi (~120px przy 1440px/11 kolumn),
 * poniżej naturalnej szerokości nagłówków „OGÓLNA INTERPRETACJA"/
 * „INTERPRETACJA WYNIKU"/„PRZEZNACZENIE" — stąd ucięcie wielokropkiem.
 *
 * Szerokości poniżej zmierzone na żywym DOM-ie w harnessu
 * `finance-analysis-workspace` (`scene=draft-with-kpis`, 1440px, 6
 * wskaźników), DWIE osobne miary per kolumna (obie muszą się zmieścić):
 *  1. nagłówek — `th` sklonowany z `white-space:nowrap` (pełny tekst +
 *     padding + ikona sortu/filtra w jednej linii);
 *  2. DANE — `FilterableTable`'s domyślne renderowanie komórki (brak
 *     `column.render`, albo `render` zwracający goły string) owija treść w
 *     `CELL_TEXT_CLAMP_CLASS` (`block break-normal overflow-hidden
 *     text-ellipsis`) — łamie na SPACJACH, ale NAJSZERSZE POJEDYNCZE SŁOWO w
 *     komórce musi zmieścić się w szerokości kolumny, inaczej TO SŁOWO (nie
 *     cała komórka) dostaje własny wielokropek („Przychody" → „Prz…").
 *     Zmierzone na tym samym harnessu: najszersze słowo w kolumnie „Wzór"
 *     („(Przychody", nawiasy sklejone ze słowem w formule) = 73,49px — WIĘCEJ
 *     niż nagłówek „Wzór" (68,59px) potrzebuje. Pierwsza wersja tej naprawy
 *     (2026-08-31, pierwszy przebieg) budżetowała TYLKO nagłówki i dała
 *     „Wzór" 69px — nagłówek już się mieścił, ale DANE („Przychody / Aktywa
 *     razem") ucinały się do „Prz…"/„Akt…"/„raz…" na żywym zrzucie —
 *     dokładnie ten sam kształt defektu piętro niżej, złapany dopiero na
 *     PEŁNOROZDZIELCZYM zrzucie Playwright (scaled-down zrzut w toku pracy
 *     tego nie pokazał).
 *
 * Pełny tekst wszystkich 11 nagłówków na raz (suma ≈1434px) NIE mieści się w
 * budżecie (≈1326px na 11 kolumn), a „Wzór" osobno potrzebuje więcej niż
 * jego własny nagłówek — dwa najdłuższe nagłówki dostają krótszy synonim bez
 * zmiany znaczenia (właściciel/CLAUDE.md „spróbuj pełny tekst najpierw"):
 * „Ogólna interpretacja" → „Interpretacja" (ta sama zasada formuły co
 * „Wzór") i „Benchmark branżowy" → „Benchmark" (branżowość wynika z
 * kontekstu kolumny — wartość komórki to zawsze zakres branżowy). „Interpretacja
 * wyniku" (komentarz analityka do KONKRETNEGO wyniku, np. „Marża rośnie
 * dzięki niższym kosztom materiałów.") → „Komentarz" — trzeci synonim,
 * DOPISANY w drugim przebiegu tej naprawy: budżet zwolniony stąd (~72px)
 * przechodzi na „Wzór", który inaczej nie mieści swojego najszerszego słowa.
 * Kolumny okresów (`P-2025`/`P-2026`, DYNAMICZNE per businessVersion)
 * dostają stały budżet 80px — z zapasem nad zmierzonym „Q4 2026" (≈84px to
 * jedyny zmierzony przypadek szerszy niż `P-2025`/`FY2025`).
 */
export function buildAnalysisKpiColumns(
  periodLabels: readonly { id: string; label: string }[]
): TableColumn[] {
  const periodColumns: TableColumn[] = periodLabels.map((p) => ({
    id: `period.${p.id}`,
    label: p.label,
    align: 'right',
    sortable: false,
    width: '80px',
  }));

  return [
    { id: 'kpiName', label: 'Wskaźnik', sortable: true, align: 'left', width: '120px' },
    {
      id: 'category',
      label: 'Kategoria',
      sortable: true,
      align: 'left',
      filterable: true,
      width: '122px',
    },
    { id: 'formulaDisplay', label: 'Wzór', align: 'left', width: '122px' },
    { id: 'interpretationGeneral', label: 'Interpretacja', align: 'left', width: '131px' },
    ...periodColumns,
    {
      id: 'yoyDelta',
      label: 'Zmiana r/r',
      align: 'right',
      sortable: true,
      width: '121px',
      sortAccessor: (row: TableRow) =>
        (row.yoyDelta as YoyDelta).percentDelta ?? Number.NEGATIVE_INFINITY,
      render: (row: TableRow) => formatYoyDeltaText(row.yoyDelta as YoyDelta),
    },
    {
      id: 'benchmark',
      label: 'Benchmark',
      align: 'left',
      width: '110px',
      render: (row: TableRow) =>
        formatBenchmarkText(row.benchmark as AnalysisKpiValueDto['benchmark']),
    },
    { id: 'interpretationSpecific', label: 'Komentarz', align: 'left', width: '116px' },
    {
      id: 'qualityFlag',
      label: 'Jakość / dostępność',
      align: 'center',
      filterable: true,
      width: '176px',
    },
    { id: 'downstreamUses', label: 'Przeznaczenie', align: 'left', width: '133px' },
  ];
}

// ---------------------------------------------------------------------------
// Eksport — MUSI używać jawnie wybranego zestawu kolumn, NIE "co akurat
// widoczne" (brief: "eksport/raport używa jawnie wybranego zestawu, nie
// przypadkowo widocznych kolumn"). `explicitSelection===null` ⇒ eksport
// jeszcze nie skonfigurowany, caller pokazuje dialog wyboru zamiast zgadywać.
// ---------------------------------------------------------------------------

export interface AnalysisExportColumnSelection {
  columnIds: string[];
  selectedAtIso: string;
}

export function selectExportColumns(
  visibleColumnIds: readonly string[],
  explicitSelection: AnalysisExportColumnSelection | null
): { ok: true; columnIds: string[] } | { ok: false; reason: 'NO_EXPLICIT_SELECTION' } {
  void visibleColumnIds; // widoczność jest celowo IGNOROWANA — dowód na to, że export nie może po cichu podążać za widokiem.
  if (!explicitSelection || explicitSelection.columnIds.length === 0) {
    return { ok: false, reason: 'NO_EXPLICIT_SELECTION' };
  }
  return { ok: true, columnIds: [...explicitSelection.columnIds] };
}
