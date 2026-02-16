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

import { StatusDropdown } from './StatusDropdown';
import { CategoryButton, ModuleTab, TabConfig, ViewMode } from './types';

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
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  onSearch: (query: string) => void;
  // For Assessment: single "New Assessment" button
  onNewItem?: () => void;
  newItemLabel?: string;
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
}

// Shared button styles for consistency
const BUTTON_BASE = `
  inline-flex items-center gap-2 h-9 px-3 rounded-lg text-sm font-medium
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
  viewMode,
  onViewModeChange,
  onSearch,
  onNewItem,
  newItemLabel = 'New Item',
  categoryButtons,
  statusFilters,
  activeStatusFilter,
  onStatusFilterChange,
  statusDropdownContext,
  statusCounts,
  availableViewModes = ['table', 'grid'],
  rightControls,
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

  // View mode icons and labels
  const viewModeConfig: Record<ViewMode, { icon: React.ReactNode; label: string }> = {
    table: { icon: <List size={16} />, label: 'Table' },
    grid: { icon: <Grid3X3 size={16} />, label: 'Grid' },
    kanban: { icon: <Kanban size={16} />, label: 'Kanban' },
    timeline: { icon: <Calendar size={16} />, label: 'Timeline' },
    calendar: { icon: <CalendarDays size={16} />, label: 'Calendar' },
    matrix: { icon: <LayoutGrid size={16} />, label: 'Matrix' },
  };

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    // Note: onSearch is called via debounced effect, not here
  }, []);

  const handleCloseSearch = useCallback(() => {
    setShowSearch(false);
    setSearchQuery('');
    // onSearch('') will be called via debounced effect
  }, []);

  return (
    <div className="bg-white dark:bg-navy-900 border-b border-slate-200/60 dark:border-white/5">
      {/* Main Navigation Row */}
      <div className="flex items-center justify-between px-4 py-3">
        {/* Left: Search + Tabs + Status Filters */}
        <div className="flex items-center gap-3">
          {/* Search Toggle */}
          <button
            onClick={() => setShowSearch(!showSearch)}
            className={`h-9 w-9 inline-flex items-center justify-center rounded-lg transition-colors duration-150 ${
              showSearch
                ? 'bg-white/70 dark:bg-white/[0.06] text-slate-900 dark:text-slate-100'
                : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100/70 dark:hover:bg-white/[0.05]'
            }`}
            title="Search"
          >
            <Search size={18} />
          </button>

          {/* Main Tabs - bordered style like category buttons */}
          <div className="flex items-center gap-2">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => onTabChange(tab.id)}
                  className={isActive ? BUTTON_ACTIVE : BUTTON_INACTIVE}
                >
                  {tab.icon}
                  <span>{tab.label}</span>
                  {tab.count !== undefined && (
                    <span
                      className={`
                      px-1.5 py-0.5 text-xs rounded-full
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

        {/* Right: View Toggle + Actions */}
        <div className="flex items-center gap-3">
          {rightControls}
          {/* View Mode Toggle - supports 2-5 modes */}
          <div className="flex items-center bg-slate-50 dark:bg-navy-950/70 border border-slate-200/60 dark:border-white/5 rounded-lg p-1 h-9">
            {availableViewModes.map((mode) => {
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

          {/* Action Buttons */}
          {categoryButtons && categoryButtons.length > 0 ? (
            // Discovery Tools: 4 category buttons - same style as tabs
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
          ) : onNewItem ? (
            // Assessment: Single "New" button - gradient style
            <button
              onClick={onNewItem}
              className="
                inline-flex items-center gap-2 h-9 px-4 rounded-xl text-sm font-medium
                bg-hig-primary text-white
                hover:bg-hig-primary-hover
                transition-colors duration-150
              "
            >
              <Plus size={16} />
              <span>{newItemLabel}</span>
            </button>
          ) : null}
        </div>
      </div>

      {/* Search Bar (expandable) */}
      {showSearch && (
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
      )}
    </div>
  );
};

export default ModuleNavBar;
