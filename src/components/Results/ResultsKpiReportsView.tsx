import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import type { FilterChip } from '../shared/ModuleHub/ActiveFilters';
import { FilterableTable, type TableColumn, type TableRow } from '../shared/ModuleHub/FilterableTable';

export interface ResultsKpiReportsViewProps {
  activeFilters: FilterChip[];
  onFilterChange: (filters: FilterChip[]) => void;
}

export const ResultsKpiReportsView: React.FC<ResultsKpiReportsViewProps> = ({
  activeFilters,
  onFilterChange,
}) => {
  const { t } = useTranslation();

  const columns: TableColumn[] = useMemo(
    () => [
      { id: 'type', label: t('common.type', 'Type'), width: '10%' },
      { id: 'name', label: t('common.name', 'Name'), width: '40%' },
      { id: 'period', label: t('common.period', 'Period'), width: '16%' },
      { id: 'status', label: t('common.status', 'Status'), width: '16%' },
      { id: 'updatedAt', label: t('common.updated', 'Updated'), width: '18%' },
    ],
    [t]
  );

  const rows: TableRow[] = useMemo(() => {
    // KPI Reports (R1) — backend contract not implemented yet. Table is ready for real data.
    return [];
  }, []);

  return (
    <FilterableTable
      columns={columns}
      data={rows}
      activeFilters={activeFilters}
      onFilterChange={onFilterChange}
      density="compact"
      canvasClassName="pl-4 pr-1.5 pt-3 pb-4"
      hideRowActions
      emptyMessage={t(
        'results.kpiReports.empty',
        'No KPI reports yet. Create a report to review performance and corrective actions.'
      )}
    />
  );
};

export default ResultsKpiReportsView;

