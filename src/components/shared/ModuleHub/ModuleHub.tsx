/**
 * ModuleHub
 * Main container for module hubs (Tools, Assessment, Initiatives, etc.)
 * Provides unified layout with tabs, dynamic documents, filters, and table/grid views
 * V3 standard: module-hub-standard.md
 */

import React from 'react';

import { ActiveFilters, FilterChip } from './ActiveFilters';
import { DynamicTabs } from './DynamicTabs';
import { ModuleNavBar, StatusFilter } from './ModuleNavBar';
import { CategoryButton, ModuleTab, OpenDocument, TabConfig, ViewMode } from './types';

interface ModuleHubProps {
  // Optional: key for persisting UI state (ModuleHub currently does not persist internally)
  persistViewModeKey?: string;

  // Tab configuration
  tabs: TabConfig[];
  activeTab: ModuleTab;
  onTabChange: (tab: ModuleTab) => void;

  // View mode
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;

  // Search
  onSearch: (query: string) => void;

  // Dynamic documents
  openDocuments: OpenDocument[];
  activeDocumentId: string | null;
  onSelectDocument: (id: string) => void;
  onCloseDocument: (id: string) => void;
  onShowList: () => void;

  // Filters
  activeFilters: FilterChip[];
  onRemoveFilter: (id: string) => void;
  onClearFilters: () => void;

  // Actions - Assessment style (single button)
  onNewItem?: () => void;
  newItemLabel?: string;

  // Actions - Discovery Tools style (4 category buttons)
  categoryButtons?: CategoryButton[];

  // Status filters (for Initiatives module - left side phase buttons)
  statusFilters?: StatusFilter[];
  activeStatusFilter?: string | null;
  onStatusFilterChange?: (status: string | null) => void;
  // Status dropdown (replaces buttons with a compact dropdown)
  statusDropdownContext?:
    | 'initiatives'
    | 'execution'
    | 'benefits'
    | 'assessment'
    | 'assessment_list'
    | 'assessment_reports'
    | 'tools';
  statusCounts?: Record<string, number>;

  // Available view modes (default: table, grid)
  availableViewModes?: ViewMode[];

  // Extra controls rendered on the right, just before view mode buttons
  rightControls?: React.ReactNode;

  // Optional: module-specific actions shown alongside filters (consumed by some hubs)
  // Note: ModuleHub does not render these directly yet; kept for compatibility.
  filterActions?: any;

  // Content
  children: React.ReactNode;
}

export const ModuleHub: React.FC<ModuleHubProps> = ({
  persistViewModeKey,
  tabs,
  activeTab,
  onTabChange,
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
  onNewItem,
  newItemLabel,
  categoryButtons,
  statusFilters,
  activeStatusFilter,
  onStatusFilterChange,
  statusDropdownContext,
  statusCounts,
  availableViewModes,
  rightControls,
  filterActions,
  children,
}) => {
  // Currently unused, but accepted for compatibility with hubs.
  void persistViewModeKey;
  void filterActions;

  // V3: Single Command Row under the topbar (module-hub-standard.md)
  // Priority: dynamic tabs > active filters. (Search row lives inside ModuleNavBar.)
  const commandRow =
    openDocuments.length > 0 ? (
      <DynamicTabs
        documents={openDocuments}
        activeDocumentId={activeDocumentId}
        onSelectDocument={onSelectDocument}
        onCloseDocument={onCloseDocument}
        onShowList={onShowList}
      />
    ) : activeFilters.length > 0 ? (
      <ActiveFilters
        filters={activeFilters}
        onRemoveFilter={onRemoveFilter}
        onClearAll={onClearFilters}
      />
    ) : null;

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-navy-950 text-slate-900 dark:text-white">
      {/* Navigation Bar */}
      <ModuleNavBar
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={onTabChange}
        viewMode={viewMode}
        onViewModeChange={onViewModeChange}
        onSearch={onSearch}
        onNewItem={onNewItem}
        newItemLabel={newItemLabel}
        categoryButtons={categoryButtons}
        statusFilters={statusFilters}
        activeStatusFilter={activeStatusFilter}
        onStatusFilterChange={onStatusFilterChange}
        statusDropdownContext={statusDropdownContext}
        statusCounts={statusCounts}
        availableViewModes={availableViewModes}
        rightControls={rightControls}
      />

      {/* Command Row (dynamic tabs | active filters) */}
      {commandRow}

      {/* Main Content Area */}
      <div className="flex-1 overflow-auto">{children}</div>
    </div>
  );
};

export default ModuleHub;
