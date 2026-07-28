import { Table2 } from 'lucide-react';
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
  /**
   * D-06: wybór zbioru danych (arkusze vs źródła) należy do Menu 2 hosta.
   * Gdy host go poda, ten komponent NIE rysuje własnego paska.
   */
  subView?: SheetsSubView;
}

// #83a: "Data" no longer a standalone Menu 2 tab — Piotr's call is that data
// sources belong under Sheets.
export type SheetsSubView = 'list' | 'data';

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
  subView: subViewProp,
}) => {
  /**
   * D-06 (Piotr, P-28, 2026-07-27): „Mamy przycisk Sheets albo Data sources.
   * Wrzuciłbym wybór — czy oglądamy arkusze, czy źródła danych — do drugiego
   * menu po prawej stronie. Dzięki temu podniesiemy całą tabelę."
   *
   * Pasek pigułek, który tu stał, był CZWARTĄ warstwą nagłówkową (Menu 1 +
   * Menu 2 + Menu 3 + on) i spychał tabelę o ~44px w dół. Przełącznik żyje
   * teraz w `rightControls` hosta, czyli po prawej stronie Menu 2; ten
   * komponent tylko czyta wybór.
   *
   * Fallback na stan lokalny zostaje dla wywołań bez hosta (harness dev-render,
   * testy) — bez niego komponent nie dałby się zamontować samodzielnie.
   */
  const { t } = useTranslation();
  const [subViewLokalny] = useState<SheetsSubView>('list');
  const subView = subViewProp ?? subViewLokalny;
  const hasRegistrySheets = rows.length > 0;

  if (subView === 'data') {
    return (
      <div className="h-full min-h-0 flex flex-col" data-testid="rap-sheets-tab">
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
