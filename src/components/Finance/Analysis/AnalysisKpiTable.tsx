/**
 * Pakiet E — OWN-FIN-014. Tabela wskaźników KPI, WYŁĄCZNIE `StandardTable`
 * (kanon `docs/ui-standards/TRIADA_KANON.md` — zakaz własnych tabel,
 * `scripts/check-list-canon.sh`). Kontroler "Kolumny" (widoczność/kolejność/
 * pin/reset/persystencja) jest wbudowany w `StandardTable` przez `persistKey`
 * — ten komponent tylko dostarcza dane+kolumny z `analysisKpiTable.contract.ts`.
 */
import { BarChart3, FileOutput, ListChecks } from 'lucide-react';
import React, { useMemo } from 'react';

import { StandardTable, type StandardRowMenu, type TableRow } from '../../standard';
import {
  analysisKpiTablePersistKey,
  buildAnalysisKpiColumns,
  groupAnalysisKpiValuesByKpi,
  toAnalysisKpiTableRow,
  type AnalysisKpiCatalogFormulaInfo,
} from './analysisKpiTable.contract';
import type { AnalysisKpiValueDto } from '../../../services/api/financeV2.types';

export interface AnalysisKpiTablePeriodColumn {
  id: string;
  label: string;
}

export interface AnalysisKpiTableProps {
  businessVersionId: string;
  /** Może zawierać wiele wpisów PER (kpiCode, periodId) — tabela grupuje je do jednego wiersza na KPI (`groupAnalysisKpiValuesByKpi`). */
  kpiValues: AnalysisKpiValueDto[];
  formulaInfoByKpiCode: Record<string, AnalysisKpiCatalogFormulaInfo | undefined>;
  /** Kolejność CHRONOLOGICZNA (najstarszy→najnowszy) — steruje, który wpis jest "bieżący" (ostatnia kolumna z danymi) do YoY/kebab. */
  periodColumns: AnalysisKpiTablePeriodColumn[];
  includedInReportByKpiCode: Record<string, boolean>;
  markedAsModelInputByKpiCode: Record<string, boolean>;
  selectedKpiCode: string | null;
  onOpenDetail: (kpiCode: string) => void;
  onToggleIncludedInReport: (kpiCode: string, nextIncluded: boolean) => void;
  /** Brief: akcja wskazuje KONKRETNY artefakt/wersję docelową, nie mutuje Approved analysis w miejscu. */
  onMarkAsModelInput: (kpiCode: string) => void;
  isApproved: boolean;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  /** Brief §4 (ZAKAZ pustej analizy bez wyjścia) — otwiera krok wyboru KPI kreatora, gdy `kpiValues` jest puste. */
  onConfigureKpis: () => void;
}

export function AnalysisKpiTable(props: AnalysisKpiTableProps): React.ReactElement {
  const {
    businessVersionId,
    kpiValues,
    formulaInfoByKpiCode,
    periodColumns,
    includedInReportByKpiCode,
    markedAsModelInputByKpiCode,
    selectedKpiCode,
    onOpenDetail,
    onToggleIncludedInReport,
    onMarkAsModelInput,
    isApproved,
    loading,
    error,
    onRetry,
    onConfigureKpis,
  } = props;

  const columns = useMemo(() => buildAnalysisKpiColumns(periodColumns), [periodColumns]);

  const groups = useMemo(
    () => groupAnalysisKpiValuesByKpi(kpiValues, periodColumns.map((p) => p.id)),
    [kpiValues, periodColumns]
  );

  const data: TableRow[] = useMemo(
    () =>
      groups.map((group) =>
        toAnalysisKpiTableRow({
          group,
          formulaInfo: formulaInfoByKpiCode[group.kpiCode] ?? null,
          includedInReport: includedInReportByKpiCode[group.kpiCode] ?? true,
          markedAsModelInput: markedAsModelInputByKpiCode[group.kpiCode] ?? false,
        })
      ),
    [groups, formulaInfoByKpiCode, includedInReportByKpiCode, markedAsModelInputByKpiCode]
  );

  const rowMenu = (row: TableRow): StandardRowMenu => {
    const included = Boolean(row.includedInReport);
    const markedAsModelInput = Boolean(row.markedAsModelInput);
    return {
      primary: [
        { id: 'open-detail', label: 'Otwórz kartę szczegółową', icon: BarChart3, onClick: () => onOpenDetail(String(row.id)) },
      ],
      statusTransitions: [
        {
          id: 'toggle-report',
          label: included ? 'Wyłącz w raporcie' : 'Włącz w raporcie',
          icon: FileOutput,
          onClick: () => onToggleIncludedInReport(String(row.id), !included),
          // Approved jest niezmienne — kebab NIE może mutować zatwierdzonej wersji (brief, sekcja 4).
          disabled: isApproved,
          note: isApproved ? 'Zatwierdzona wersja jest niezmienna — otwórz nową wersję, aby edytować raport' : undefined,
        },
        {
          id: 'mark-model-input',
          label: markedAsModelInput ? 'Oznaczone jako wejście do modelu' : 'Oznacz jako wejście do modelu',
          icon: ListChecks,
          onClick: () => onMarkAsModelInput(String(row.id)),
          disabled: markedAsModelInput,
          note: markedAsModelInput ? 'Wskazuje konkretny model — zobacz w karcie szczegółowej' : 'Wskaże docelowy artefakt (Model bazowy) do potwierdzenia',
        },
      ],
      universalHandlers: {
        preview: () => onOpenDetail(String(row.id)),
      },
    };
  };

  return (
    <StandardTable
      columns={columns}
      data={data}
      loading={loading}
      error={error ?? null}
      onRetry={onRetry}
      selectedRowId={selectedKpiCode}
      onRowClick={(row) => onOpenDetail(String(row.id))}
      rowMenu={rowMenu}
      persistKey={analysisKpiTablePersistKey(businessVersionId)}
      empty={{
        title: 'Brak skonfigurowanych wskaźników',
        description: 'Ta analiza nie ma jeszcze żadnego wskaźnika KPI. Skonfiguruj wskaźniki, aby zobaczyć wyniki.',
        actionLabel: 'Skonfiguruj wskaźniki',
        onAction: onConfigureKpis,
      }}
    />
  );
}

export default AnalysisKpiTable;
