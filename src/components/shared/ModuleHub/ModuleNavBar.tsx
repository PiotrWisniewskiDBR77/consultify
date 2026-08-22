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
import { useTranslation } from 'react-i18next';

import { MENU_2_TAB_ACTIVE, MENU_2_TAB_INACTIVE } from '../ModuleMenu3';
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
  searchValue?: string;
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
  // Optional right-side command row slot for contextual AI/actions.
  commandRowRightContent?: React.ReactNode;
  // For Assessment: single "New Assessment" button
  onNewItem?: () => void;
  newItemLabel?: string;
  // Optional stable test id for the primary "New item" CTA button.
  newItemTestId?: string;
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
 * Menu 2 (ModuleTabs) — PILL pattern (decyzja Piotra 2026-07-02: „ramki
 * półokrągłe jak w My Work, tak ma być"). Zastępuje wcześniejszy underline
 * (VISUAL_STANDARD §5.5) — spójne z My Work MENU_2_TAB_* i ARTIFACT_ANATOMY §9.2③.
 * active = wypełniony pill z ramką (neutral, NIE crimson); inactive = przezroczysty,
 * hover rozjaśnia tło. Zgodne z red-budget (zero crimson).
 */
/*
 * NOTATKA-PRAWO (Piotr, 2026-07-04): pigułki Menu 2 = zaokrąglone, Z WIDOCZNĄ
 * RAMKĄ, aktywna = neutralne wypełnienie. SSOT klas = MENU_2_TAB_* w
 * ModuleMenu3 (identyczne z żywym MyWorkHub) — wcześniejsze lokalne TAB_*
 * (border-transparent w stanie inactive) były odstępstwem od wzorca.
 */
const TAB_INACTIVE = MENU_2_TAB_INACTIVE;
const TAB_ACTIVE = MENU_2_TAB_ACTIVE;

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
  bg-slate-900/[0.07] text-slate-900 dark:bg-white/10 dark:text-slate-100
`;

export const ModuleNavBar: React.FC<ModuleNavBarProps> = ({
  tabs,
  activeTab,
  onTabChange,
  showTabCounts = false,
  viewMode,
  onViewModeChange,
  onSearch,
  searchValue,
  openDocuments,
  activeDocumentId,
  onSelectDocument,
  onCloseDocument,
  onShowList,
  activeFilters,
  onRemoveFilter,
  onClearFilters,
  commandRowContent,
  commandRowRightContent,
  onNewItem,
  newItemLabel = 'New Item',
  newItemTestId,
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
  const { t } = useTranslation();
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (searchValue !== undefined) {
      setSearchQuery(searchValue);
    }
  }, [searchValue]);

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
    table: { icon: <List size={16} />, label: t('moduleHub.viewModes.table', 'Table') },
    kanban: { icon: <Kanban size={16} />, label: t('moduleHub.viewModes.kanban', 'Kanban') },
    timeline: { icon: <Calendar size={16} />, label: t('moduleHub.viewModes.timeline', 'Timeline') },
    calendar: { icon: <CalendarDays size={16} />, label: t('moduleHub.viewModes.calendar', 'Calendar') },
    matrix: { icon: <LayoutGrid size={16} />, label: t('moduleHub.viewModes.matrix', 'Matrix') },
    grid: { icon: <Grid3X3 size={16} />, label: t('moduleHub.viewModes.grid', 'Grid') },
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
              id="modulehub-command-search"
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={handleSearchChange}
              placeholder={t('moduleHub.search.placeholder', 'Search...')}
              aria-label={t('moduleHub.search.label', 'Search')}
              className="
                w-full pl-10 pr-10 py-2 rounded-lg
                bg-slate-50 dark:bg-navy-800 border border-slate-300 dark:border-navy-600
                text-slate-900 dark:text-white placeholder-slate-500
                focus:outline-none focus:border-c-focus-solid focus:ring-1 focus:ring-c-focus
                transition-all
              "
            />
            {searchQuery && (
              <button
                type="button"
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

    if (!commandRowContent && !commandRowRightContent && activeFilters.length === 0) return null;

    return (
      <div className="px-4 pb-3">
        <div className="flex items-center justify-between gap-2 overflow-x-auto no-scrollbar">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            {commandRowContent ? <div className="min-w-0">{commandRowContent}</div> : null}
            {activeFilters.length > 0 ? (
              <ActiveFilters
                filters={activeFilters}
                onRemoveFilter={onRemoveFilter}
                onClearAll={onClearFilters}
              />
            ) : null}
          </div>
          {commandRowRightContent ? (
            <div className="flex items-center gap-2 shrink-0">{commandRowRightContent}</div>
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
          type="button"
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

  // ★ ODSTĘP MENU 2 (2026-07-26, uwaga Piotra na żywym demo — Vault i Run
  // agent, "analogiczne uwagi"): gdy `tabs` jest puste (DZIŚ zawsze — żaden
  // z 17 konsumentów StandardModuleBar nie przekazuje realnych zakładek),
  // `justify-between` rozciągał lupę i prawy klaster (filtry/CTA) na całą
  // szerokość ekranu, zostawiając wielką martwą przestrzeń pośrodku. Gdy
  // `tabs` jest puste, oba klastry idą razem do prawej krawędzi zamiast się
  // rozjeżdżać — bezpieczne, bo dotyczy WSZYSTKICH ekranów jednakowo (nikt
  // dziś nie polega na starym rozciągnięciu). Gdy ktoś w przyszłości doda
  // realne zakładki, wraca poprzednie zachowanie (lupa+taby z lewej, reszta
  // z prawej).
  const hasTabs = tabs.length > 0;

  return (
    <div className="bg-white dark:bg-navy-900 border-b border-slate-200/60 dark:border-white/5">
      {/* Main Navigation Row */}
      <div
        className={`flex items-center px-4 py-3 gap-3 ${hasTabs ? 'justify-between' : 'justify-end'}`}
      >
        {/* Left: Search + Tabs + Status Filters */}
        <div className="flex items-center gap-3">
          {/* Search Toggle */}
          <button
            type="button"
            onClick={() => {
              if (forceCommandRow) return;
              setShowSearch(!showSearch);
            }}
            className={`h-9 w-9 inline-flex items-center justify-center rounded-full transition-colors duration-150 border ${
              showSearch
                ? 'bg-white/70 dark:bg-white/[0.06] text-slate-900 dark:text-slate-100 border-slate-300 dark:border-white/25'
                : 'text-slate-500 dark:text-slate-400 border-slate-200/70 dark:border-white/[0.06] hover:bg-slate-100/70 dark:hover:bg-white/[0.05]'
            }`}
            title={
              forceCommandRow
                ? t('moduleHub.search.bulkModeActive', 'Bulk mode active')
                : t('moduleHub.search.label', 'Search')
            }
            aria-label={t('moduleHub.search.label', 'Search')}
            aria-disabled={forceCommandRow}
            aria-expanded={showSearch}
            aria-controls={showSearch ? 'modulehub-command-search' : undefined}
          >
            <Search size={18} />
          </button>

          {/* Main Tabs — V3-A03: Level A pill (rounded-full) */}
          <div
            className="flex items-center gap-1.5"
            role="tablist"
            aria-label={t('moduleHub.sections', 'Module sections')}
          >
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  type="button"
                  key={tab.id}
                  onClick={() => onTabChange(tab.id)}
                  className={isActive ? TAB_ACTIVE : TAB_INACTIVE}
                  role="tab"
                  aria-selected={isActive}
                >
                  {tab.icon}
                  <span>{tab.label}</span>
                  {showTabCounts && tab.count !== undefined && (
                    <span
                      className={`
                      px-1.5 py-0.5 text-[11px] rounded-full
                      ${
                        isActive
                          ? 'bg-navy-900/10 dark:bg-white/10 text-c-text'
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
        </div>

        {/* Right cluster (KANON v3, left→right): Filters → View → Tool → Add → Area */}
        <div className={`flex items-center gap-3 justify-end ${hasTabs ? 'ml-auto' : ''}`}>
          {/* Filters / compact controls (leftmost in the right cluster) */}
          {rightControls}

          {/* Status Filter Dropdown */}
          {statusDropdownContext && onStatusFilterChange && (
            <StatusDropdown
              context={statusDropdownContext}
              value={activeStatusFilter || 'all'}
              onChange={(status) => onStatusFilterChange(status === 'all' ? null : status)}
              counts={statusCounts}
              size="sm"
            />
          )}

          {/* Legacy: Status Filter Buttons (fallback when no dropdown context) */}
          {!statusDropdownContext && statusFilters && statusFilters.length > 0 && (
            <div className="flex items-center gap-1.5">
              {statusFilters.map((filter) => {
                const isActive =
                  activeStatusFilter === filter.id || (filter.id === 'all' && !activeStatusFilter);
                return (
                  <button
                    type="button"
                    key={filter.id}
                    onClick={() => onStatusFilterChange?.(filter.id === 'all' ? null : filter.id)}
                    data-testid={`status-filter-${filter.id}`}
                    className={`
                      inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-sm font-medium
                      transition-colors duration-150
                      ${
                        isActive
                          ? 'bg-slate-900/[0.07] text-slate-900 dark:bg-white/10 dark:text-slate-100'
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
          )}

          {/* View Mode Toggle — V3-A03: canonical order */}
          {orderedViewModes.length > 1 && (
            <div className="flex items-center bg-slate-50 dark:bg-navy-950/70 border border-slate-200/60 dark:border-white/5 rounded-full p-1 h-9">
              {orderedViewModes.map((mode) => {
                const config = viewModeConfig[mode];
                const isActive = viewMode === mode;
                return (
                  <button
                    type="button"
                    key={mode}
                    onClick={() => onViewModeChange(mode)}
                    data-testid={`view-mode-${mode}`}
                    className={`p-1.5 rounded transition-colors ${
                      isActive
                        ? 'bg-white/70 dark:bg-white/[0.06] text-slate-900 dark:text-slate-100'
                        : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100/70 dark:hover:bg-white/[0.05]'
                    }`}
                    title={config.label}
                    aria-label={config.label}
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
              type="button"
              onClick={onNewItem}
              data-testid={newItemTestId}
              className="
                inline-flex items-center gap-2 h-9 px-4 rounded-lg text-sm font-medium
                bg-navy-900 text-white hover:bg-navy-800
                dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF]
                transition-colors duration-150
              "
            >
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
