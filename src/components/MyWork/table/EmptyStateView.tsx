/**
 * EmptyStateView — shared empty canvas for MyWork table views (grid, kanban, etc.).
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
        className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-primary-500/20 via-crimson-500/15 to-slate-200/40 dark:from-primary-500/25 dark:via-crimson-500/20 dark:to-navy-800/80 ring-1 ring-slate-200/80 dark:ring-navy-600/50 shadow-inner"
        aria-hidden
      >
        <Table2 className="h-9 w-9 text-primary-600 dark:text-primary-300" strokeWidth={1.5} />
      </div>
      <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100 tracking-tight">
        {headline}
      </h3>
      <p className="mt-2 text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
        {description}
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-2 w-full sm:flex-nowrap">
        <button
          type="button"
          onClick={onAddRow}
          className="inline-flex flex-1 min-w-[8.5rem] items-center justify-center gap-2 rounded-xl bg-slate-900 px-3 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-slate-800 dark:bg-slate-100 dark:text-navy-950 dark:hover:bg-white transition-colors"
        >
          <Table2 className="h-3.5 w-3.5 shrink-0" />
          {isPl ? 'Dodaj pierwszy rekord' : 'Add first record'}
        </button>
        <button
          type="button"
          onClick={onImportCSV}
          className="inline-flex flex-1 min-w-[8.5rem] items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 dark:border-navy-600 dark:bg-navy-900 dark:text-slate-200 dark:hover:bg-navy-800 transition-colors"
        >
          <Upload className="h-3.5 w-3.5 shrink-0" />
          {isPl ? 'Importuj CSV' : 'Import CSV'}
        </button>
        <button
          type="button"
          onClick={onUseAI}
          className="inline-flex flex-1 min-w-[8.5rem] items-center justify-center gap-2 rounded-xl border border-primary-200 bg-primary-50/80 px-3 py-2.5 text-xs font-semibold text-primary-800 shadow-sm hover:bg-primary-100 dark:border-primary-500/30 dark:bg-primary-500/10 dark:text-primary-200 dark:hover:bg-primary-500/20 transition-colors"
        >
          <Sparkles className="h-3.5 w-3.5 shrink-0" />
          {isPl ? 'Użyj AI' : 'Use AI'}
        </button>
      </div>
    </div>
  );
};

export default EmptyStateView;
