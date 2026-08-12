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

import type { TableColumn, TableRow } from '../../standard/StandardTable';
import type { AnalysisKpiTier, AnalysisKpiValueDto } from '../../../services/api/financeV2.types';
import { financeValueDisplayReasonLabel, formatFinanceValueForDisplay } from '../../../services/api/financeV2.types';

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
  const currentIsPresent = current.status === 'PRESENT_ZERO' || current.status === 'PRESENT_NONZERO';
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
    return { status: 'PRIOR_ZERO_PCT_UNDEFINED', absoluteDelta: absoluteDeltaDecimal.toNumber(), percentDelta: null };
  }
  const percentDeltaDecimal = absoluteDeltaDecimal.dividedBy(priorDecimal).times(100);
  return { status: 'COMPUTED', absoluteDelta: absoluteDeltaDecimal.toNumber(), percentDelta: percentDeltaDecimal.toNumber() };
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
function formatPeriodCell(value: AnalysisKpiValueDto['value'] | undefined): { text: string; isMissingLikeGlyph: boolean } {
  if (value === undefined) {
    return { text: '—', isMissingLikeGlyph: true };
  }
  return formatFinanceValueForDisplay(value);
}

export function toAnalysisKpiTableRow(input: AnalysisKpiTableRowInput): TableRow {
  const { group } = input;
  const display = formatFinanceValueForDisplay(group.latestValue.value);
  const yoy = computeYoyDelta(group.latestValue.value, group.priorPeriodValue);

  const periodCells: Record<string, string> = {};
  const periodCellIsMissingLike: Record<string, boolean> = {};
  for (const [columnId, value] of Object.entries(group.periodValuesByColumnId)) {
    const cell = formatPeriodCell(value);
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

export function formatYoyDeltaText(yoy: YoyDelta): string {
  switch (yoy.status) {
    case 'COMPUTED':
      return yoy.percentDelta === null ? '—' : `${yoy.percentDelta >= 0 ? '+' : ''}${yoy.percentDelta.toFixed(1)}%`;
    case 'PRIOR_ZERO_PCT_UNDEFINED':
      return yoy.absoluteDelta === null ? '—' : `${yoy.absoluteDelta >= 0 ? '+' : ''}${yoy.absoluteDelta} (% nieokreślony)`;
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

export function buildAnalysisKpiColumns(periodLabels: readonly { id: string; label: string }[]): TableColumn[] {
  const periodColumns: TableColumn[] = periodLabels.map((p) => ({
    id: `period.${p.id}`,
    label: p.label,
    align: 'right',
    sortable: false,
  }));

  return [
    { id: 'kpiName', label: 'Wskaźnik', sortable: true, align: 'left' },
    { id: 'category', label: 'Kategoria', sortable: true, align: 'left', filterable: true },
    { id: 'formulaDisplay', label: 'Wzór', align: 'left' },
    { id: 'interpretationGeneral', label: 'Ogólna interpretacja', align: 'left' },
    ...periodColumns,
    {
      id: 'yoyDelta',
      label: 'Zmiana r/r',
      align: 'right',
      sortable: true,
      sortAccessor: (row: TableRow) => (row.yoyDelta as YoyDelta).percentDelta ?? Number.NEGATIVE_INFINITY,
      render: (row: TableRow) => formatYoyDeltaText(row.yoyDelta as YoyDelta),
    },
    { id: 'benchmark', label: 'Benchmark branżowy', align: 'left', render: (row: TableRow) => formatBenchmarkText(row.benchmark as AnalysisKpiValueDto['benchmark']) },
    { id: 'interpretationSpecific', label: 'Interpretacja wyniku', align: 'left' },
    { id: 'qualityFlag', label: 'Jakość / dostępność', align: 'center', filterable: true },
    { id: 'downstreamUses', label: 'Przeznaczenie', align: 'left' },
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
