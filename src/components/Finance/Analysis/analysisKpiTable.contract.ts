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

import type { TableColumn, TableRow } from '../../standard/StandardTable';
import type { AnalysisKpiValueDto } from '../../../services/api/financeV2.types';
import { financeValueDisplayReasonLabel, formatFinanceValueForDisplay } from '../../../services/api/financeV2.types';

// ---------------------------------------------------------------------------
// YoY delta — MISSING/NA nigdy nie stają się 0 przez odejmowanie/dzielenie.
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
  const currentNum = Number(current.valueDecimal);
  const priorNum = Number(prior.valueDecimal);
  const absoluteDelta = currentNum - priorNum;
  if (priorNum === 0) {
    // % zmiany od zera jest matematycznie nieokreślona (dzielenie przez 0) —
    // NIGDY nie renderuj 0%/Infinity%, pokaż wartość bezwzględną z jawnym
    // powodem braku procentu, nie fałszywym "0%".
    return { status: 'PRIOR_ZERO_PCT_UNDEFINED', absoluteDelta, percentDelta: null };
  }
  return { status: 'COMPUTED', absoluteDelta, percentDelta: (absoluteDelta / priorNum) * 100 };
}

// ---------------------------------------------------------------------------
// Wiersz tabeli — spłaszczenie DTO backendu + pola pochodne (YoY, formuła,
// interpretacja) do kształtu `TableRow` (StandardTable, `[key:string]:any`).
// ---------------------------------------------------------------------------

export interface AnalysisKpiCatalogFormulaInfo {
  formulaDisplay: string; // np. "(Przychody − COGS) / Przychody"
  interpretationGeneral: string; // ogólna zasada ("wyższa wartość = lepsza rentowność")
  downstreamUses: string[]; // np. ["Model bazowy — driver marży", "Raport zarządczy Q3"]
}

export interface AnalysisKpiTableRowInput {
  kpiValue: AnalysisKpiValueDto;
  priorPeriodValue: AnalysisKpiValueDto['value'] | null;
  formulaInfo: AnalysisKpiCatalogFormulaInfo | null;
  includedInReport: boolean;
  markedAsModelInput: boolean;
}

export function toAnalysisKpiTableRow(input: AnalysisKpiTableRowInput): TableRow {
  const display = formatFinanceValueForDisplay(input.kpiValue.value);
  const yoy = computeYoyDelta(input.kpiValue.value, input.priorPeriodValue);
  return {
    id: input.kpiValue.kpiValueId,
    kpiCode: input.kpiValue.kpiCode,
    kpiName: input.kpiValue.kpiName,
    category: input.kpiValue.category ?? '—',
    tier: input.kpiValue.tier,
    valueDisplay: display.text,
    valueIsMissingLike: display.isMissingLikeGlyph,
    valueStatus: input.kpiValue.value.status,
    valueReason: financeValueDisplayReasonLabel(input.kpiValue.value.status),
    yoyDelta: yoy,
    formulaDisplay: input.formulaInfo?.formulaDisplay ?? '—',
    interpretationGeneral: input.formulaInfo?.interpretationGeneral ?? '—',
    interpretationSpecific: input.kpiValue.interpretationText ?? '—',
    benchmark: input.kpiValue.benchmark,
    qualityFlag: input.kpiValue.qualityFlag ?? 'OK',
    downstreamUses: input.formulaInfo?.downstreamUses ?? [],
    includedInReport: input.includedInReport,
    markedAsModelInput: input.markedAsModelInput,
    // Zachowaj oryginalne DTO do karty szczegółowej (kebab/row click) —
    // StandardTable nie interpretuje dodatkowych pól, tylko przekazuje `row`.
    __kpiValue: input.kpiValue,
  };
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
    },
    { id: 'benchmark', label: 'Benchmark branżowy', align: 'left' },
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
