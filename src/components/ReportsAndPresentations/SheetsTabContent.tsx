import { Database, Table2 } from 'lucide-react';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { FilterChip, ViewMode } from '../shared/ModuleHub';
import { DataSourcesTabContent } from './DataSourcesTabContent';
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

// #83a: "Data" no longer a standalone Menu 2 tab — Piotr's call is that data
// sources belong under Sheets. This local pill switch keeps both surfaces
// (governed sheet artifacts + connector/form data sources) reachable without
// losing any capability from the retired outputs_data tab.
type SheetsSubView = 'list' | 'data';

const SUB_TAB_BASE =
  'h-8 inline-flex items-center gap-1.5 rounded-full px-3 text-xs font-medium border transition-colors';
const SUB_TAB_ACTIVE = 'bg-c-accent-soft text-c-text border-c-border';
const SUB_TAB_INACTIVE =
  'bg-c-surface text-c-text-secondary border-c-border-subtle hover:bg-c-surface-raised';

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
  const [subView, setSubView] = useState<SheetsSubView>('list');
  const hasRegistrySheets = rows.length > 0;

  const subTabs = (
    <div
      className="flex items-center gap-2 px-4 pt-3 pb-1"
      role="tablist"
      aria-label={t('rap.sheets.subtabs.label', 'Sheets sections')}
      data-testid="rap-sheets-subtabs"
    >
      <button
        type="button"
        role="tab"
        aria-selected={subView === 'list'}
        onClick={() => setSubView('list')}
        data-testid="rap-sheets-subtab-list"
        className={`${SUB_TAB_BASE} ${subView === 'list' ? SUB_TAB_ACTIVE : SUB_TAB_INACTIVE}`}
      >
        <Table2 size={13} />
        <span>{t('rap.outputs.tabs.sheets', 'Sheets')}</span>
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={subView === 'data'}
        onClick={() => setSubView('data')}
        data-testid="rap-sheets-subtab-data"
        className={`${SUB_TAB_BASE} ${subView === 'data' ? SUB_TAB_ACTIVE : SUB_TAB_INACTIVE}`}
      >
        <Database size={13} />
        <span>{t('rap.sheets.subtabs.data', 'Data sources')}</span>
      </button>
    </div>
  );

  if (subView === 'data') {
    return (
      <div className="h-full min-h-0 flex flex-col" data-testid="rap-sheets-tab">
        {subTabs}
        <div className="flex-1 min-h-0">
          <DataSourcesTabContent />
        </div>
      </div>
    );
  }

  if (
    hasRegistrySheets ||
    loading ||
    error ||
    searchQuery ||
    activeFilters.length > 0 ||
    initialArtifactId
  ) {
    return (
      <div className="h-full min-h-0 flex flex-col" data-testid="rap-sheets-tab">
        {subTabs}
        <div className="flex-1 min-h-0">
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
        </div>
      </div>
    );
  }

  return (
    <div className="h-full min-h-0 flex flex-col" data-testid="rap-sheets-tab">
      {subTabs}
      <div className="flex items-center justify-center flex-1 p-6">
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
    </div>
  );
};
