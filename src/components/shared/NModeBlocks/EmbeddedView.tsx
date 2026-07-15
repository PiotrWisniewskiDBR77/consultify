/**
 * EmbeddedView
 *
 * N-mode building block for embedded lists/tables — linked databases style.
 * Mini toolbar with view type toggle, filter, sort, add/link actions.
 *
 * Used for relationships: Tasks, Decisions, RAID, Attachments within a section.
 *
 * Follows DBR77 Visual Language — quiet UI, operational feel.
 *
 * @see docs/ui-standards/01-shell-layout/presentation-modes.md §2.5.5, §2.5.6
 */

import { ExternalLink, Filter, List, Plus, Search, SortAsc } from 'lucide-react';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

// ── Types ───────────────────────────────────────────────────────────────────

export type EmbeddedViewMode = 'table' | 'list' | 'board';

export interface EmbeddedViewProps {
  /** Section title */
  title: string;
  /** Item count for badge */
  count?: number;
  /** Available view modes (default: ['list', 'table']) */
  viewModes?: EmbeddedViewMode[];
  /** Current view mode */
  activeMode?: EmbeddedViewMode;
  /** Mode change handler */
  onModeChange?: (mode: EmbeddedViewMode) => void;
  /** "Add new" handler (omit to hide) */
  onAdd?: () => void;
  /** "Add new" label override */
  addLabel?: string;
  /** "Link existing" handler (omit to hide) */
  onLink?: () => void;
  /** "Open full" navigation handler (omit to hide) */
  onOpenFull?: () => void;
  /** Search handler (omit to hide search) */
  onSearch?: (query: string) => void;
  /** Filter handler (omit to hide filter) */
  onFilter?: () => void;
  /** Sort handler (omit to hide sort) */
  onSort?: () => void;
  /** Whether view is read-only */
  readOnly?: boolean;
  /** Loading state */
  loading?: boolean;
  /** Content to render (the actual list/table/board) */
  children: React.ReactNode;
  /** Additional CSS classes */
  className?: string;
}

// ── Component ───────────────────────────────────────────────────────────────

export const EmbeddedView: React.FC<EmbeddedViewProps> = ({
  title,
  count,
  viewModes = ['list', 'table'],
  activeMode: controlledMode,
  onModeChange,
  onAdd,
  addLabel,
  onLink,
  onOpenFull,
  onSearch,
  onFilter,
  onSort,
  readOnly = false,
  loading = false,
  children,
  className = '',
}) => {
  const { t } = useTranslation();
  const [internalMode, setInternalMode] = useState<EmbeddedViewMode>(viewModes[0] || 'list');
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const activeViewMode = controlledMode ?? internalMode;

  const handleModeChange = (mode: EmbeddedViewMode) => {
    setInternalMode(mode);
    onModeChange?.(mode);
  };

  const viewModeIcons: Record<EmbeddedViewMode, React.ReactNode> = {
    list: <List size={13} />,
    table: <SortAsc size={13} />,
    board: <Filter size={13} />,
  };

  return (
    <div
      className={`rounded-xl border border-slate-200/50 dark:border-navy-700/50 bg-white/40 dark:bg-navy-900/30 overflow-hidden ${className}`}
    >
      {/* Mini toolbar */}
      <div className="flex items-center gap-1.5 px-3 py-2 border-b border-slate-200/40 dark:border-navy-700/40 bg-slate-50/30 dark:bg-navy-900/20">
        {/* Title + count */}
        <span className="text-xs font-medium text-slate-600 dark:text-slate-300">{title}</span>
        {count !== undefined && (
          <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 dark:bg-navy-800 text-slate-500 dark:text-slate-400">
            {count}
          </span>
        )}

        <div className="flex-1" />

        {/* View mode toggle */}
        {viewModes.length > 1 && (
          <div className="flex items-center gap-0.5 p-0.5 rounded-lg bg-slate-100/60 dark:bg-navy-800/60">
            {viewModes.map((mode) => (
              <button
                key={mode}
                onClick={() => handleModeChange(mode)}
                className={`p-1 rounded-md transition-colors ${
                  activeViewMode === mode
                    ? 'bg-white dark:bg-navy-700 text-slate-700 dark:text-slate-200 shadow-sm'
                    : 'text-slate-600 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'
                }`}
                title={mode}
              >
                {viewModeIcons[mode]}
              </button>
            ))}
          </div>
        )}

        {/* Search toggle */}
        {onSearch && (
          <button
            onClick={() => setSearchOpen(!searchOpen)}
            className={`p-1 rounded-md transition-colors ${
              searchOpen
                ? 'text-primary-500 bg-primary-500/10'
                : 'text-slate-600 dark:text-slate-500 hover:text-slate-600'
            }`}
          >
            <Search size={13} />
          </button>
        )}

        {/* Filter */}
        {onFilter && (
          <button
            onClick={onFilter}
            className="p-1 rounded-md text-slate-600 dark:text-slate-500 hover:text-slate-600 transition-colors"
          >
            <Filter size={13} />
          </button>
        )}

        {/* Sort */}
        {onSort && (
          <button
            onClick={onSort}
            className="p-1 rounded-md text-slate-600 dark:text-slate-500 hover:text-slate-600 transition-colors"
          >
            <SortAsc size={13} />
          </button>
        )}

        {/* Add / Link */}
        {!readOnly && onAdd && (
          <button
            onClick={onAdd}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium text-primary-500 hover:bg-primary-500/10 transition-colors"
          >
            <Plus size={11} />
            {addLabel || t('sharedComponents.embeddedView.add')}
          </button>
        )}
        {!readOnly && onLink && (
          <button
            onClick={onLink}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium text-slate-600 dark:text-slate-500 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors"
          >
            {t('sharedComponents.embeddedView.link')}
          </button>
        )}

        {/* Open full */}
        {onOpenFull && (
          <button
            onClick={onOpenFull}
            className="p-1 rounded-md text-slate-600 dark:text-slate-500 hover:text-slate-600 transition-colors"
            title={t('sharedComponents.embeddedView.openFullView')}
          >
            <ExternalLink size={13} />
          </button>
        )}
      </div>

      {/* Search bar (expandable) */}
      {searchOpen && onSearch && (
        <div className="px-3 py-2 border-b border-slate-200/40 dark:border-navy-700/40">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              onSearch(e.target.value);
            }}
            placeholder={t('sharedComponents.embeddedView.searchPlaceholder')}
            className="w-full text-sm bg-transparent text-slate-700 dark:text-slate-200 focus:outline-none placeholder-slate-400 dark:placeholder-slate-600"
            autoFocus
          />
        </div>
      )}

      {/* Content area */}
      <div className="relative">
        {loading && (
          <div className="absolute inset-0 bg-white/60 dark:bg-navy-900/60 flex items-center justify-center z-10">
            <div className="w-5 h-5 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
          </div>
        )}
        <div className="p-3">{children}</div>
      </div>
    </div>
  );
};

export default EmbeddedView;
