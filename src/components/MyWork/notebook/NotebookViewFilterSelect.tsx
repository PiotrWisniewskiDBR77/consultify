import { Search } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import type { NotebookViewLens } from './notebookViewLensPredicates';

// Re-exported so callers only need one import path for both the component
// and its lens type (`matchesView`'s predicates live in
// `notebookViewLensPredicates.ts` — single source of truth for the union).
export type { NotebookViewLens };

export interface NotebookViewFilterCounts {
  all: number;
  pinned: number;
  recent: number;
  toReview: number;
  fresh: number;
  orphaned: number;
}

export interface NotebookViewFilterSelectProps {
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  value: NotebookViewLens;
  onChange: (value: NotebookViewLens) => void;
  counts: NotebookViewFilterCounts;
}

/**
 * DEC-405b (ZLECENIE 1.1-J2, przejście właściciela 06.09) — the sidebar used
 * to show a 6-chip row above the note list (Wszystkie/Przypięte/Ostatnie/Do
 * przeglądu/Świeże/Osierocone). Owner: "to jest kawałek kramu" — replaced by
 * ONE dropdown with counters next to a persistent "Szukaj w notatkach…"
 * field, one line. Same filtering predicates as before (`matchesView` in
 * `NotebookContent.tsx`) — only the chrome changed, not the logic.
 *
 * Select styling mirrors the vault scope filter (`ClientDocumentsVault.tsx`
 * — "przełącznik zakresu «Mój» w Sejfie"): `h-9 rounded-lg border
 * border-c-border bg-c-surface` tokens, no bespoke chrome.
 * [ODMROZENIE 07_MY_WORK_AGENT DEC-397]
 */
export const NotebookViewFilterSelect: React.FC<NotebookViewFilterSelectProps> = ({
  searchQuery,
  onSearchQueryChange,
  value,
  onChange,
  counts,
}) => {
  const { t } = useTranslation();

  const options: Array<{ key: NotebookViewLens; label: string }> = [
    { key: 'all', label: t('notebook.notebookContent.label31', 'Wszystkie') },
    { key: 'pinned', label: t('notebook.notebookContent.label32', 'Przypięte') },
    { key: 'recent', label: t('notebook.notebookContent.label33', 'Ostatnie') },
    { key: 'toReview', label: t('notebook.notebookContent.label34', 'Do przeglądu') },
    { key: 'fresh', label: t('notebook.notebookContent.label35', 'Świeże') },
    { key: 'orphaned', label: t('notebook.notebookContent.label36', 'Osierocone') },
  ];

  return (
    <div className="flex items-center gap-2">
      <div className="relative min-w-0 flex-1">
        <Search
          size={14}
          className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-c-text-muted"
        />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchQueryChange(e.target.value)}
          placeholder={t(
            'notebook.notebookContent.searchNotesPlaceholder',
            'Szukaj w notatkach…'
          )}
          aria-label={t('notebook.notebookContent.searchNotesPlaceholder', 'Szukaj w notatkach…')}
          className="h-9 w-full rounded-lg border border-c-border bg-c-surface pl-8 pr-3 text-sm text-c-text placeholder:text-c-text-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
        />
      </div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as NotebookViewLens)}
        aria-label={t('notebook.notebookContent.viewFilterLabel', 'Filtr notatek')}
        className="h-9 shrink-0 rounded-lg border border-c-border bg-c-surface px-2 text-sm text-c-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
      >
        {options.map((o) => (
          <option key={o.key} value={o.key}>
            {o.label} ({counts[o.key]})
          </option>
        ))}
      </select>
    </div>
  );
};
