/**
 * ModuleHub
 * Main container component for Assessment and Discovery Tools modules
 * Provides unified layout with 3 tabs, dynamic documents, filters, and table/grid views
 */

import React from 'react';

import { ActiveFilters, FilterChip } from './ActiveFilters';
import { DynamicTabs } from './DynamicTabs';
import { ModuleNavBar, StatusFilter } from './ModuleNavBar';
import { CategoryButton, ModuleTab, OpenDocument, TabConfig, ViewMode } from './types';

interface ModuleHubProps {
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

  // Available view modes (default: table, grid)
  availableViewModes?: ViewMode[];

  // Content
  children: React.ReactNode;
}

export const ModuleHub: React.FC<ModuleHubProps> = ({
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
  availableViewModes,
  children,
}) => {
  return (
    <div className="flex flex-col h-full bg-navy-950">
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
        availableViewModes={availableViewModes}
      />

      {/* Dynamic Tabs (open documents) */}
      <DynamicTabs
        documents={openDocuments}
        activeDocumentId={activeDocumentId}
        onSelectDocument={onSelectDocument}
        onCloseDocument={onCloseDocument}
        onShowList={onShowList}
      />

      {/* Active Filters */}
      <ActiveFilters
        filters={activeFilters}
        onRemoveFilter={onRemoveFilter}
        onClearAll={onClearFilters}
      />

      {/* Main Content Area */}
      <div className="flex-1 overflow-auto">{children}</div>
    </div>
  );
};

export default ModuleHub;
