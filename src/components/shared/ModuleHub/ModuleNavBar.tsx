/**
 * ModuleNavBar
 * Top navigation bar with tabs, search, view toggle, and action buttons
 *
 * Tech Sexy v2.0:
 * - monochromatic chrome (color only for semantic data + single CTA)
 * - invisible borders (prefer bg/spacing; borders only as subtle dividers)
 * - hover = background shift only (no border/text color flips)
 * - shadow only on floating elements (no button shadows by default)
 */

import {
  Calendar,
  CalendarDays,
  Grid3X3,
  Kanban,
  LayoutGrid,
  List,
  Plus,
  Search,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';

import { ActiveFilters, type FilterChip } from './ActiveFilters';
import { DynamicTabs } from './DynamicTabs';
import { StatusDropdown } from './StatusDropdown';
import { CategoryButton, ModuleTab, type OpenDocument, TabConfig, ViewMode } from './types';

// Debounce hook for search
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}

// Status filter configuration
export interface StatusFilter {
  id: string;
  label: string;
  color: string;
  count?: number;
}

interface ModuleNavBarProps {
  tabs: TabConfig[];
  activeTab: ModuleTab;
  onTabChange: (tab: ModuleTab) => void;
  /** Default: false (KANON v3: no counts on main tabs; counters live in Command Row) */
  showTabCounts?: boolean;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  onSearch: (query: string) => void;
  // Command Row inputs (V3: one row; modes swap in place)
  openDocuments: OpenDocument[];
  activeDocumentId: string | null;
  onSelectDocument: (id: string) => void;
  onCloseDocument: (id: string) => void;
  onShowList: () => void;
  activeFilters: FilterChip[];
  onRemoveFilter: (id: string) => void;
  onClearFilters: () => void;
  // Optional: module-provided "counters / chips / bulk bar" for the command row
  commandRowContent?: React.ReactNode;
  // For Assessment: single "New Assessment" button
  onNewItem?: () => void;
  newItemLabel?: string;
  // Optional: custom Primary CTA node (keeps canonical slot in topbar)
  primaryCta?: React.ReactNode;
  // For Discovery Tools: 4 category buttons
  categoryButtons?: CategoryButton[];
  // Status filters (left side) - for Initiatives module
  statusFilters?: StatusFilter[];
  activeStatusFilter?: string | null;
  onStatusFilterChange?: (status: string | null) => void;
  // Status dropdown (replaces buttons) - context for StatusDropdown component
  statusDropdownContext?:
    | 'initiatives'
    | 'execution'
    | 'benefits'
    | 'assessment'
    | 'assessment_list'
    | 'assessment_reports'
    | 'tools';
  statusCounts?: Record<string, number>;
  // View modes to show (default: table, grid)
  availableViewModes?: ViewMode[];
  // Extra controls rendered on the right, just before view mode buttons
  rightControls?: React.ReactNode;
  // Optional “Tool” control (3rd from the right in the right cluster)
  toolControl?: React.ReactNode;
  // Optional AI control (rightmost in the topbar cluster)
  aiControl?: React.ReactNode;
  /**
   * If true, `commandRowContent` overrides Search/DynamicTabs (used for multi-select bulk mode).
   * KANON v3: bulk actions row is the highest priority mode of Command Row.
   */
  forceCommandRow?: boolean;
}

/**
 * V3-A03: 3-level button system (visual-language.md 8.3)
 * Level A — Pill / Outline + Surface: main tabs, important chips
 * Level B — Pill / Soft: helper actions, view toggles
 * Level C — Ghost / Text: link-like, per-row actions
 */
const TAB_BASE = `
  inline-flex items-center gap-2 h-9 px-3.5 rounded-full text-sm font-medium
  transition-colors duration-150
`;

const TAB_INACTIVE = `
  ${TAB_BASE}
  border border-slate-200 dark:border-navy-700
  text-slate-700 dark:text-slate-300
  hover:bg-slate-100/70 dark:hover:bg-white/[0.05]
`;

const TAB_ACTIVE = `
  ${TAB_BASE}
  border border-primary-500/40
  bg-primary-500/10 text-slate-900 dark:text-slate-100
`;

const BUTTON_BASE = `
  inline-flex items-center gap-2 h-9 px-3 rounded-full text-sm font-medium
  transition-colors duration-150
`;

const BUTTON_INACTIVE = `
  ${BUTTON_BASE}
  text-slate-700 dark:text-slate-300
  hover:bg-slate-100/70 dark:hover:bg-white/[0.05]
`;

const BUTTON_ACTIVE = `
  ${BUTTON_BASE}
  bg-primary-500/10 text-slate-900 dark:text-slate-100
`;

export const ModuleNavBar: React.FC<ModuleNavBarProps> = ({
  tabs,
  activeTab,
  onTabChange,
  showTabCounts = false,
  viewMode,
  onViewModeChange,
  onSearch,
  openDocuments,
  activeDocumentId,
  onSelectDocument,
  onCloseDocument,
  onShowList,
  activeFilters,
  onRemoveFilter,
  onClearFilters,
  commandRowContent,
  onNewItem,
  newItemLabel = 'New Item',
  primaryCta,
  categoryButtons,
  statusFilters,
  activeStatusFilter,
  onStatusFilterChange,
  statusDropdownContext,
  statusCounts,
  availableViewModes = ['table', 'grid'],
  rightControls,
  toolControl,
  aiControl,
  forceCommandRow = false,
}) => {
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Debounce search query (300ms)
  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  // Call onSearch when debounced value changes
  useEffect(() => {
    onSearch(debouncedSearchQuery);
  }, [debouncedSearchQuery, onSearch]);

  // Focus search input when opened
  useEffect(() => {
    if (showSearch && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [showSearch]);

  // KANON v3: bulk mode overrides Search/DynamicTabs; keep UI consistent by closing search.
  useEffect(() => {
    if (forceCommandRow && showSearch) setShowSearch(false);
  }, [forceCommandRow, showSearch]);

  /**
   * V3-A03: Canonical view-mode order (MUST):
   * table → kanban → timeline → calendar → matrix → grid
   */
  const VIEW_MODE_ORDER: ViewMode[] = ['table', 'kanban', 'timeline', 'calendar', 'matrix', 'grid'];

  const viewModeConfig: Record<ViewMode, { icon: React.ReactNode; label: string }> = {
    table: { icon: <List size={16} />, label: 'Table' },
    kanban: { icon: <Kanban size={16} />, label: 'Kanban' },
    timeline: { icon: <Calendar size={16} />, label: 'Timeline' },
    calendar: { icon: <CalendarDays size={16} />, label: 'Calendar' },
    matrix: { icon: <LayoutGrid size={16} />, label: 'Matrix' },
    grid: { icon: <Grid3X3 size={16} />, label: 'Grid' },
  };

  const orderedViewModes = VIEW_MODE_ORDER.filter((m) => availableViewModes.includes(m));

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    // Note: onSearch is called via debounced effect, not here
  }, []);

  const handleCloseSearch = useCallback(() => {
    setShowSearch(false);
    setSearchQuery('');
    // onSearch('') will be called via debounced effect
  }, []);

  // V3: Single Command Row under the topbar (module-hub-standard.md)
  // Modes swap in place: search ↔ dynamic tabs ↔ counters/bulk ↔ other contextual chips.
  // MUST: the command row must not disappear when it's used for counters/status chips.
  const commandRow = (() => {
    // 0) Bulk / forced row — overrides search and tabs
    if (forceCommandRow && commandRowContent) {
      return <div className="shrink-0">{commandRowContent}</div>;
    }

    if (showSearch) {
      return (
        <div className="px-4 pb-3">
          <div className="relative">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400"
            />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={handleSearchChange}
              placeholder="Search..."
              className="
                w-full pl-10 pr-10 py-2 rounded-lg
                bg-slate-50 dark:bg-navy-800 border border-slate-300 dark:border-navy-600
                text-slate-900 dark:text-white placeholder-slate-500
                focus:border-primary-500 focus:ring-1 focus:ring-primary-500/50
                transition-all
              "
            />
            {searchQuery && (
              <button
                onClick={handleCloseSearch}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              >
                <X size={16} />
              </button>
            )}
          </div>
        </div>
      );
    }

    if (openDocuments.length > 0) {
      return (
        <DynamicTabs
          documents={openDocuments}
          activeDocumentId={activeDocumentId}
          onSelectDocument={onSelectDocument}
          onCloseDocument={onCloseDocument}
          onShowList={onShowList}
        />
      );
    }

    if (!commandRowContent && activeFilters.length === 0) return null;

    return (
      <div className="px-4 pb-3">
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
          {commandRowContent ? <div className="shrink-0">{commandRowContent}</div> : null}
          {activeFilters.length > 0 ? (
            <ActiveFilters
              filters={activeFilters}
              onRemoveFilter={onRemoveFilter}
              onClearAll={onClearFilters}
            />
          ) : null}
        </div>
      </div>
    );
  })();

  const computedToolControl = toolControl ? (
    toolControl
  ) : categoryButtons && categoryButtons.length > 0 ? (
    // Discovery Tools: category buttons are “Tool” controls (not Primary CTA)
    <div className="flex items-center gap-2">
      {categoryButtons.map((btn) => (
        <button
          key={btn.id}
          onClick={btn.onClick}
          data-testid={`category-button-${btn.id}`}
          className={BUTTON_INACTIVE}
        >
          {btn.icon}
          <span>{btn.label}</span>
          <span className="px-1.5 py-0.5 text-xs rounded-full bg-slate-200 dark:bg-navy-700 text-slate-600 dark:text-slate-400">
            {btn.count}
          </span>
        </button>
      ))}
    </div>
  ) : null;

  return (
    <div className="bg-white dark:bg-navy-900 border-b border-slate-200/60 dark:border-white/5">
      {/* Main Navigation Row */}
      <div className="flex items-center justify-between px-4 py-3">
        {/* Left: Search + Tabs + Status Filters */}
        <div className="flex items-center gap-3">
          {/* Search Toggle */}
          <button
            onClick={() => {
              if (forceCommandRow) return;
              setShowSearch(!showSearch);
            }}
            className={`h-9 w-9 inline-flex items-center justify-center rounded-full transition-colors duration-150 border ${
              showSearch
                ? 'bg-white/70 dark:bg-white/[0.06] text-slate-900 dark:text-slate-100 border-primary-500/40'
                : 'text-slate-500 dark:text-slate-400 border-slate-200/70 dark:border-white/[0.06] hover:bg-slate-100/70 dark:hover:bg-white/[0.05]'
            }`}
            title={forceCommandRow ? 'Bulk mode active' : 'Search'}
            aria-disabled={forceCommandRow}
          >
            <Search size={18} />
          </button>

          {/* Main Tabs — V3-A03: Level A pill (rounded-full) */}
          <div className="flex items-center gap-1.5">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => onTabChange(tab.id)}
                  className={isActive ? TAB_ACTIVE : TAB_INACTIVE}
                >
                  {tab.icon}
                  <span>{tab.label}</span>
                  {showTabCounts && tab.count !== undefined && (
                    <span
                      className={`
                      px-1.5 py-0.5 text-[11px] rounded-full
                      ${
                        isActive
                          ? 'bg-primary-500/30 text-primary-600 dark:text-primary-300'
                          : 'bg-slate-200 dark:bg-navy-700 text-slate-600 dark:text-slate-400'
                      }
                    `}
                    >
                      {tab.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Status Filter Dropdown (replaces button row) */}
          {statusDropdownContext && onStatusFilterChange && (
            <>
              <div className="w-px h-6 bg-slate-200 dark:bg-white/5" />
              <StatusDropdown
                context={statusDropdownContext}
                value={activeStatusFilter || 'all'}
                onChange={(status) => onStatusFilterChange(status === 'all' ? null : status)}
                counts={statusCounts}
                size="sm"
              />
            </>
          )}

          {/* Legacy: Status Filter Buttons (fallback when no dropdown context) */}
          {!statusDropdownContext && statusFilters && statusFilters.length > 0 && (
            <>
              <div className="w-px h-6 bg-slate-200 dark:bg-white/5" />
              <div className="flex items-center gap-1.5">
                {statusFilters.map((filter) => {
                  const isActive =
                    activeStatusFilter === filter.id ||
                    (filter.id === 'all' && !activeStatusFilter);
                  return (
                    <button
                      key={filter.id}
                      onClick={() => onStatusFilterChange?.(filter.id === 'all' ? null : filter.id)}
                      data-testid={`status-filter-${filter.id}`}
                      className={`
                        inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-sm font-medium
                        transition-colors duration-150
                        ${
                          isActive
                            ? 'bg-primary-500/10 text-slate-900 dark:text-slate-100'
                            : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100/70 dark:hover:bg-white/[0.05]'
                        }
                      `}
                    >
                      <span className={`w-2 h-2 rounded-full ${filter.color}`} />
                      <span>{filter.label}</span>
                      {filter.count !== undefined && (
                        <span className="text-slate-500 dark:text-slate-400">{filter.count}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Right cluster (KANON v3, left→right): Filters → View → Tool → Add → Area */}
        <div className="flex items-center gap-3 ml-auto justify-end">
          {/* Filters / compact controls (leftmost in the right cluster) */}
          {rightControls}

          {/* View Mode Toggle — V3-A03: canonical order */}
          {orderedViewModes.length > 1 && (
            <div className="flex items-center bg-slate-50 dark:bg-navy-950/70 border border-slate-200/60 dark:border-white/5 rounded-full p-1 h-9">
              {orderedViewModes.map((mode) => {
                const config = viewModeConfig[mode];
                const isActive = viewMode === mode;
                return (
                  <button
                    key={mode}
                    onClick={() => onViewModeChange(mode)}
                    data-testid={`view-mode-${mode}`}
                    className={`p-1.5 rounded transition-colors ${
                      isActive
                        ? 'bg-white/70 dark:bg-white/[0.06] text-slate-900 dark:text-slate-100'
                        : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100/70 dark:hover:bg-white/[0.05]'
                    }`}
                    title={config.label}
                  >
                    {config.icon}
                  </button>
                );
              })}
            </div>
          )}

          {/* Tool control (optional) */}
          {computedToolControl}

          {/* Primary CTA (Add) */}
          {primaryCta ? (
            primaryCta
          ) : onNewItem ? (
            <button
              onClick={onNewItem}
              className="
                inline-flex items-center gap-2 h-9 px-4 rounded-full text-sm font-medium
                bg-hig-primary text-white
                hover:bg-hig-primary-hover
                transition-colors duration-150
              "
            >
              <Plus size={16} />
              <span>{newItemLabel}</span>
            </button>
          ) : null}

          {/* Area / AI control (rightmost) */}
          {aiControl}
        </div>
      </div>

      {/* Command Row (ONE LINE; modes swap in place) */}
      {commandRow}
    </div>
  );
};

export default ModuleNavBar;
