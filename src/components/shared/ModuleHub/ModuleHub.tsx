/**
 * ModuleHub
 * Main container for module hubs (Tools, Assessment, Initiatives, etc.)
 * Provides unified layout with tabs, dynamic documents, filters, and table/grid views
 * V3 standard: module-hub-standard.md
 */

import React from 'react';

import { FilterChip } from './ActiveFilters';
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
  searchValue?: string;

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
  // Optional stable test id for the primary "New item" CTA button.
  newItemTestId?: string;
  // Optional: custom Primary CTA node (keeps canonical slot in topbar)
  primaryCta?: React.ReactNode;

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

  // Optional “Tool” control (3rd from the right in the right cluster)
  toolControl?: React.ReactNode;

  // Optional AI control (rightmost in the topbar cluster)
  aiControl?: React.ReactNode;

  // Command Row content (V3: one line under module topbar)
  // Used for status counters / bulk actions / dynamic chips when search & docs tabs are not active.
  commandRowContent?: React.ReactNode;
  // Right-side Command Row content. Canonical place for contextual AI/actions in open documents.
  commandRowRightContent?: React.ReactNode;

  /**
   * If true, `commandRowContent` overrides Search/DynamicTabs (used for multi-select bulk mode).
   * KANON v3: bulk actions row is the highest priority mode of Command Row.
   */
  forceCommandRow?: boolean;

  /** Default: false (KANON v3: no counts on main tabs) */
  showTabCounts?: boolean;

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
  searchValue,
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
  newItemTestId,
  primaryCta,
  categoryButtons,
  statusFilters,
  activeStatusFilter,
  onStatusFilterChange,
  statusDropdownContext,
  statusCounts,
  availableViewModes,
  rightControls,
  toolControl,
  aiControl,
  commandRowContent,
  commandRowRightContent,
  forceCommandRow,
  showTabCounts,
  filterActions,
  children,
}) => {
  // Currently unused, but accepted for compatibility with hubs.
  void persistViewModeKey;
  void filterActions;

  return (
    <div className="flex flex-col h-full bg-c-bg text-c-text">
      {/* Navigation Bar */}
      <ModuleNavBar
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={onTabChange}
        showTabCounts={showTabCounts}
        viewMode={viewMode}
        onViewModeChange={onViewModeChange}
        onSearch={onSearch}
        searchValue={searchValue}
        openDocuments={openDocuments}
        activeDocumentId={activeDocumentId}
        onSelectDocument={onSelectDocument}
        onCloseDocument={onCloseDocument}
        onShowList={onShowList}
        activeFilters={activeFilters}
        onRemoveFilter={onRemoveFilter}
        onClearFilters={onClearFilters}
        onNewItem={onNewItem}
        newItemLabel={newItemLabel}
        newItemTestId={newItemTestId}
        primaryCta={primaryCta}
        categoryButtons={categoryButtons}
        statusFilters={statusFilters}
        activeStatusFilter={activeStatusFilter}
        onStatusFilterChange={onStatusFilterChange}
        statusDropdownContext={statusDropdownContext}
        statusCounts={statusCounts}
        availableViewModes={availableViewModes}
        rightControls={rightControls}
        toolControl={toolControl}
        aiControl={aiControl}
        commandRowContent={commandRowContent}
        commandRowRightContent={commandRowRightContent}
        forceCommandRow={forceCommandRow}
      />

      {/* Main Content Area */}
      <div className="flex-1 min-h-0 overflow-auto">{children}</div>
    </div>
  );
};

export default ModuleHub;
