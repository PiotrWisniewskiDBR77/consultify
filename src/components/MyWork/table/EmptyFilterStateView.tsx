/**
 * EmptyFilterStateView — shown instead of `EmptyStateView` when a table has
 * real records, but the *active filter(s)* narrow the result set to zero rows.
 *
 * Fala 8 (parytet Airtable) — before this, `ViewRouter` picked `EmptyStateView`
 * ("Add first record") purely on `processedRows.length === 0`, with no regard
 * for *why* it was zero. A filter matching nothing looked identical to a truly
 * empty table, which is misleading: there is nothing to "add first record" to
 * when nine records already exist behind the filter. This view names the real
 * cause and offers the one action that actually resolves it — clear filters.
 */
import { FilterX, SearchX } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

export interface EmptyFilterStateViewProps {
  onClearFilters: () => void;
}

export const EmptyFilterStateView: React.FC<EmptyFilterStateViewProps> = ({ onClearFilters }) => {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col items-center justify-center text-center px-6 py-14 max-w-md mx-auto">
      <div
        className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-c-surface-raised ring-1 ring-c-border-subtle shadow-inner"
        aria-hidden
      >
        <SearchX className="h-9 w-9 text-c-text-secondary" strokeWidth={1.5} />
      </div>
      <h3 className="text-base font-semibold text-c-text tracking-tight">
        {t('ideas.table.emptyFilterState.headline', 'Brak wyników dla filtra')}
      </h3>
      <p className="mt-2 text-sm text-c-text-muted leading-relaxed">
        {t(
          'ideas.table.emptyFilterState.description',
          'Żaden rekord nie pasuje do aktywnych filtrów. Wyczyść filtry, aby zobaczyć wszystkie rekordy.'
        )}
      </p>
      <div className="mt-8">
        <button
          type="button"
          onClick={onClearFilters}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-c-text px-4 py-2.5 text-xs font-semibold text-c-surface shadow-sm hover:brightness-95 transition-colors"
        >
          <FilterX className="h-3.5 w-3.5 shrink-0" />
          {t('ideas.table.emptyFilterState.clearFilters', 'Wyczyść filtry')}
        </button>
      </div>
    </div>
  );
};

export default EmptyFilterStateView;
