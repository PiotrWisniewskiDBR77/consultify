import { Table2 } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import type { FilterChip, ViewMode } from '../shared/ModuleHub';
import { OutputsAggregateTabContent } from './OutputsAggregateTabContent';
import type { UnifiedOutputRow } from './types';
import type { useRapActions } from './useRapData';

interface SheetsTabContentProps {
  viewMode: ViewMode;
  searchQuery: string;
  activeFilters: FilterChip[];
  onFilterChange: (filters: FilterChip[]) => void;
  rows: UnifiedOutputRow[];
  loading: boolean;
  error?: string | null;
  onRefresh: () => void;
  actions: ReturnType<typeof useRapActions>;
  initialArtifactId?: string | null;
}

export const SheetsTabContent: React.FC<SheetsTabContentProps> = ({
  viewMode,
  searchQuery,
  activeFilters,
  onFilterChange,
  rows,
  loading,
  error,
  onRefresh,
  actions,
  initialArtifactId,
}) => {
  const { t } = useTranslation();
  const hasRegistrySheets = rows.length > 0;

  if (
    hasRegistrySheets ||
    loading ||
    error ||
    searchQuery ||
    activeFilters.length > 0 ||
    initialArtifactId
  ) {
    return (
      <OutputsAggregateTabContent
        viewMode={viewMode}
        searchQuery={searchQuery}
        activeFilters={activeFilters}
        onFilterChange={onFilterChange}
        rows={rows}
        loading={loading}
        error={error}
        onRefresh={onRefresh}
        actions={actions}
        initialArtifactId={initialArtifactId}
      />
    );
  }

  return (
    <div className="flex items-center justify-center h-full p-6">
      <div className="w-full max-w-2xl rounded-2xl border border-slate-200/60 dark:border-white/[0.03] bg-c-surface p-8">
        <div className="flex items-start gap-4">
          <div className="mt-0.5 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-300">
            <Table2 size={24} />
          </div>
          <div className="min-w-0 space-y-2">
            <h2 className="text-lg font-semibold text-c-text">
              {t('rap.sheets.emptyTitle', 'Sheets in Outputs Library')}
            </h2>
            <p className="text-sm text-c-text-secondary leading-relaxed">
              {t(
                'rap.sheets.emptyBody',
                'Governed workbooks and exports will appear here through the same canonical artifact registry as documents and presentations. This tab now reflects live sheet artifacts as soon as the registry receives them.'
              )}
            </p>
            <p className="text-xs uppercase tracking-wide text-c-text-muted pt-2">
              {t(
                'rap.sheets.emptyHint',
                'Create or export a governed sheet and it will appear here automatically.'
              )}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
