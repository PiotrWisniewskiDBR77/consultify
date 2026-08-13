/**
 * EmptyStateView — shared empty canvas for MyWork table views (grid, kanban, etc.).
 *
 * Design note (VB3 / Artifact Anatomy re-skin): deliberately NOT migrated to the
 * shared `@/components/shared/states` EmptyState. That canonical component exposes
 * only primary + secondary actions, whereas this view carries three first-class,
 * non-hierarchical affordances (Add record / Import CSV / Use AI) that a table's
 * empty state needs to surface equally. Collapsing to two would drop a real path.
 * It is instead fully re-skinned to c-* tokens so light/dark stay automatic.
 */
import { Columns3, Sparkles, Table2, Upload } from 'lucide-react';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

export interface EmptyStateViewProps {
  viewType: string;
  onAddRow: () => void;
  onImportCSV: () => void;
  onUseAI: () => void;
  /**
   * TB-P1-02 — "Add field" entry point. Optional: a caller without schema
   * access (e.g. a locked/read-only mount) can omit it and the button
   * simply doesn't render, rather than pointing at a no-op.
   */
  onAddField?: () => void;
}

export const EmptyStateView: React.FC<EmptyStateViewProps> = ({
  viewType,
  onAddRow,
  onImportCSV,
  onUseAI,
  onAddField,
}) => {
  const { t } = useTranslation();
  const { headline, description } = useMemo(() => {
    const vt = (viewType || 'table').toLowerCase();
    const map: Record<string, { en: string; enDesc: string }> = {
      table: {
        en: 'No records in this view',
        enDesc: 'Create your first row to start tracking work in this table.',
      },
      grid: {
        en: 'This grid is empty',
        enDesc: 'Add a record to populate cells and see your data at a glance.',
      },
      kanban: {
        en: 'No cards on the board',
        enDesc: 'Move work onto the board by adding a record or dragging from the table.',
      },
      calendar: {
        en: 'Nothing scheduled here',
        enDesc: 'Records with dates will appear on the calendar once you add them.',
      },
      timeline: {
        en: 'Timeline has no milestones yet',
        enDesc: 'Add dated records to build a clear sequence of work.',
      },
      gallery: {
        en: 'Gallery is waiting for items',
        enDesc: 'Add records with attachments or cover fields to fill the gallery.',
      },
      form: {
        en: 'No form submissions yet',
        enDesc: 'Share the form or add a record manually to see responses here.',
      },
    };
    const key = vt in map ? vt : 'table';
    const row = map[key];
    return {
      headline: t(`ideas.table.emptyState.${key}.headline`, row.en),
      description: t(`ideas.table.emptyState.${key}.description`, row.enDesc),
    };
  }, [viewType, t]);

  return (
    <div className="flex flex-col items-center justify-center text-center px-6 py-14 max-w-md mx-auto">
      <div
        className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-c-surface-raised ring-1 ring-c-border-subtle shadow-inner"
        aria-hidden
      >
        <Table2 className="h-9 w-9 text-c-text-secondary" strokeWidth={1.5} />
      </div>
      <h3 className="text-base font-semibold text-c-text tracking-tight">{headline}</h3>
      <p className="mt-2 text-sm text-c-text-muted leading-relaxed">{description}</p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-2 w-full">
        <button
          type="button"
          onClick={onAddRow}
          className="inline-flex flex-1 min-w-[8.5rem] items-center justify-center gap-2 rounded-xl bg-c-text px-3 py-2.5 text-xs font-semibold text-c-surface shadow-sm hover:brightness-95 transition-colors"
        >
          <Table2 className="h-3.5 w-3.5 shrink-0" />
          {t('ideas.table.addFirstRecord', 'Add first record')}
        </button>
        {onAddField && (
          <button
            type="button"
            onClick={onAddField}
            data-testid="table-empty-state-add-field"
            className="inline-flex flex-1 min-w-[8.5rem] items-center justify-center gap-2 rounded-xl border border-c-border-subtle bg-c-surface px-3 py-2.5 text-xs font-semibold text-c-text-secondary shadow-sm hover:bg-c-surface-raised transition-colors"
          >
            <Columns3 className="h-3.5 w-3.5 shrink-0" />
            {t('ideas.table.newColumn', 'Add field')}
          </button>
        )}
        <button
          type="button"
          onClick={onImportCSV}
          className="inline-flex flex-1 min-w-[8.5rem] items-center justify-center gap-2 rounded-xl border border-c-border-subtle bg-c-surface px-3 py-2.5 text-xs font-semibold text-c-text-secondary shadow-sm hover:bg-c-surface-raised transition-colors"
        >
          <Upload className="h-3.5 w-3.5 shrink-0" />
          {t('ideas.table.importCsv', 'Import CSV')}
        </button>
        <button
          type="button"
          onClick={onUseAI}
          className="inline-flex flex-1 min-w-[8.5rem] items-center justify-center gap-2 rounded-xl border border-c-border-subtle bg-c-surface px-3 py-2.5 text-xs font-semibold text-c-text-secondary shadow-sm hover:bg-c-surface-raised transition-colors"
        >
          <Sparkles className="h-3.5 w-3.5 shrink-0" />
          {t('ideas.table.useAi', 'Use AI')}
        </button>
      </div>
    </div>
  );
};

export default EmptyStateView;
