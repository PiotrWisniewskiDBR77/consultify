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
import { Sparkles, Table2, Upload } from 'lucide-react';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

export interface EmptyStateViewProps {
  viewType: string;
  onAddRow: () => void;
  onImportCSV: () => void;
  onUseAI: () => void;
}

export const EmptyStateView: React.FC<EmptyStateViewProps> = ({
  viewType,
  onAddRow,
  onImportCSV,
  onUseAI,
}) => {
  const { i18n } = useTranslation();
  const isPl = i18n.language?.startsWith('pl');
  const { headline, description } = useMemo(() => {
    const vt = (viewType || 'table').toLowerCase();
    const map: Record<string, { en: string; pl: string; enDesc: string; plDesc: string }> = {
      table: {
        en: 'No records in this view',
        pl: 'Brak rekordów w tym widoku',
        enDesc: 'Create your first row to start tracking work in this table.',
        plDesc: 'Dodaj pierwszy wiersz, aby zacząć pracę w tej tabeli.',
      },
      grid: {
        en: 'This grid is empty',
        pl: 'Siatka jest pusta',
        enDesc: 'Add a record to populate cells and see your data at a glance.',
        plDesc: 'Dodaj rekord, aby wypełnić komórki i zobaczyć dane w skrócie.',
      },
      kanban: {
        en: 'No cards on the board',
        pl: 'Brak kart na tablicy',
        enDesc: 'Move work onto the board by adding a record or dragging from the table.',
        plDesc: 'Dodaj rekord lub przeciągnij z tabeli, aby zobaczyć karty.',
      },
      calendar: {
        en: 'Nothing scheduled here',
        pl: 'Nic tu nie zaplanowano',
        enDesc: 'Records with dates will appear on the calendar once you add them.',
        plDesc: 'Rekordy z datami pojawią się po ich dodaniu.',
      },
      timeline: {
        en: 'Timeline has no milestones yet',
        pl: 'Oś czasu nie ma jeszcze kamieni milowych',
        enDesc: 'Add dated records to build a clear sequence of work.',
        plDesc: 'Dodaj rekordy z datami, aby zbudować przebieg prac.',
      },
      gallery: {
        en: 'Gallery is waiting for items',
        pl: 'Galeria czeka na elementy',
        enDesc: 'Add records with attachments or cover fields to fill the gallery.',
        plDesc: 'Dodaj rekordy z załącznikami lub okładką, aby wypełnić galerię.',
      },
      form: {
        en: 'No form submissions yet',
        pl: 'Brak zgłoszeń z formularza',
        enDesc: 'Share the form or add a record manually to see responses here.',
        plDesc: 'Udostępnij formularz lub dodaj rekord ręcznie.',
      },
      chart: {
        en: 'Nothing to chart yet',
        pl: 'Brak danych do wykresu',
        enDesc: 'Add records to this table, then pick fields in the chart config to visualize them.',
        plDesc: 'Dodaj rekordy do tabeli, a następnie wybierz pola w konfiguracji wykresu.',
      },
    };
    const row = map[vt] ?? map.table;
    return {
      headline: isPl ? row.pl : row.en,
      description: isPl ? row.plDesc : row.enDesc,
    };
  }, [viewType, isPl]);

  return (
    <div className="flex flex-col items-center justify-center text-center px-6 py-14 max-w-md mx-auto">
      <div
        className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-c-surface-raised ring-1 ring-c-border-subtle shadow-inner"
        aria-hidden
      >
        <Table2 className="h-9 w-9 text-c-text-secondary" strokeWidth={1.5} />
      </div>
      <h3 className="text-base font-semibold text-c-text tracking-tight">
        {headline}
      </h3>
      <p className="mt-2 text-sm text-c-text-muted leading-relaxed">
        {description}
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-2 w-full sm:flex-nowrap">
        <button
          type="button"
          onClick={onAddRow}
          className="inline-flex flex-1 min-w-[8.5rem] items-center justify-center gap-2 rounded-xl bg-c-accent px-3 py-2.5 text-xs font-semibold text-white shadow-sm hover:brightness-95 transition-colors"
        >
          <Table2 className="h-3.5 w-3.5 shrink-0" />
          {isPl ? 'Dodaj pierwszy rekord' : 'Add first record'}
        </button>
        <button
          type="button"
          onClick={onImportCSV}
          className="inline-flex flex-1 min-w-[8.5rem] items-center justify-center gap-2 rounded-xl border border-c-border bg-c-surface px-3 py-2.5 text-xs font-semibold text-c-text-secondary shadow-sm hover:bg-c-surface-raised transition-colors"
        >
          <Upload className="h-3.5 w-3.5 shrink-0" />
          {isPl ? 'Importuj CSV' : 'Import CSV'}
        </button>
        <button
          type="button"
          onClick={onUseAI}
          className="inline-flex flex-1 min-w-[8.5rem] items-center justify-center gap-2 rounded-xl border border-c-accent bg-c-accent-soft px-3 py-2.5 text-xs font-semibold text-c-accent shadow-sm hover:brightness-95 transition-colors"
        >
          <Sparkles className="h-3.5 w-3.5 shrink-0" />
          {isPl ? 'Użyj AI' : 'Use AI'}
        </button>
      </div>
    </div>
  );
};

export default EmptyStateView;
