/**
 * ReportsAndPresentationsHub — V3 Unified Module
 *
 * Three tabs: Biblioteka wzorców | Raporty | Prezentacje
 * Uses ModuleHub + FilterableTable + GridView + TableWithPreviewLayout (golden standard).
 * Connected to backend: /api/report-builder, /api/presentations
 */

import { BookTemplate, FileText, Presentation } from 'lucide-react';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';

import {
  type FilterChip,
  ModuleHub,
  type ModuleTab,
  type ViewMode,
} from '../shared/ModuleHub';
import { useModuleOpenDocuments } from '../shared/ModuleHub/useModuleOpenDocuments';

import { PresentationsTabContent } from './PresentationsTabContent';
import { ReportsTabContent } from './ReportsTabContent';
import { TemplatesTabContent } from './TemplatesTabContent';
import type { RapTab } from './types';
import { usePresentations, useRapActions, useReports, useTemplates } from './useRapData';

export const ReportsAndPresentationsHub: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();

  const initialTab = useMemo<RapTab>(() => {
    const params = new URLSearchParams(location.search || '');
    const fromQuery = (params.get('tab') || '').toLowerCase();
    if (fromQuery === 'templates' || fromQuery === 'reports' || fromQuery === 'presentations') {
      return fromQuery as RapTab;
    }
    if (location.pathname.startsWith('/presentations')) return 'presentations';
    if (location.pathname.startsWith('/reports')) return 'reports';
    return 'templates';
  }, [location.pathname, location.search]);

  const [activeTab, setActiveTab] = useState<RapTab>(initialTab);
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilters, setActiveFilters] = useState<FilterChip[]>([]);

  const { openDocuments, setOpenDocuments, activeDocumentId, setActiveDocumentId } =
    useModuleOpenDocuments('reports_presentations');

  const { reports, loading: reportsLoading, fetchReports } = useReports();
  const { presentations, loading: presLoading, fetchPresentations } = usePresentations();
  const { templates, loading: templatesLoading } = useTemplates();
  const actions = useRapActions();

  const tabs = useMemo(
    () => [
      {
        id: 'templates' as ModuleTab,
        label: t('rap.tabs.templates', 'Biblioteka wzorców'),
        icon: <BookTemplate size={16} />,
        count: templates.length,
      },
      {
        id: 'reports' as ModuleTab,
        label: t('rap.tabs.reports', 'Raporty'),
        icon: <FileText size={16} />,
        count: reports.length,
      },
      {
        id: 'presentations' as ModuleTab,
        label: t('rap.tabs.presentations', 'Prezentacje'),
        icon: <Presentation size={16} />,
        count: presentations.length,
      },
    ],
    [t, templates.length, reports.length, presentations.length]
  );

  const ctaLabels: Record<RapTab, string> = useMemo(
    () => ({
      templates: `+ ${t('rap.actions.newTemplate', 'Nowy wzorzec')}`,
      reports: `+ ${t('rap.actions.newReport', 'Nowy raport')}`,
      presentations: `+ ${t('rap.actions.newPresentation', 'Nowa prezentacja')}`,
    }),
    [t]
  );

  const handleNewItem = useCallback(() => {
    switch (activeTab) {
      case 'reports':
        navigate('/reports/builder');
        break;
      case 'presentations':
        navigate('/presentations/wizard');
        break;
      case 'templates':
        navigate('/reports/builder?tab=templates');
        break;
    }
  }, [activeTab, navigate]);

  // Keep route-driven entry stable (e.g. /presentations should open "presentations" tab).
  // This also supports direct links like /reports?tab=templates.
  React.useEffect(() => {
    setActiveTab(initialTab);
    setActiveFilters([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialTab]);

  const handleRemoveFilter = useCallback((id: string) => {
    setActiveFilters((prev) => prev.filter((f) => f.id !== id));
  }, []);

  const handleClearFilters = useCallback(() => {
    setActiveFilters([]);
  }, []);

  const handleShowList = useCallback(() => {
    setActiveDocumentId(null);
  }, [setActiveDocumentId]);

  const handleCloseDocument = useCallback(
    (id: string) => {
      setOpenDocuments((prev) => prev.filter((d) => d.id !== id));
      if (activeDocumentId === id) setActiveDocumentId(null);
    },
    [activeDocumentId, setActiveDocumentId, setOpenDocuments]
  );

  const renderTabContent = () => {
    switch (activeTab) {
      case 'templates':
        return (
          <TemplatesTabContent
            viewMode={viewMode}
            searchQuery={searchQuery}
            activeFilters={activeFilters}
            onFilterChange={setActiveFilters}
            templates={templates}
            loading={templatesLoading}
          />
        );
      case 'reports':
        return (
          <ReportsTabContent
            viewMode={viewMode}
            searchQuery={searchQuery}
            activeFilters={activeFilters}
            onFilterChange={setActiveFilters}
            reports={reports}
            loading={reportsLoading}
            onRefresh={fetchReports}
            actions={actions}
          />
        );
      case 'presentations':
        return (
          <PresentationsTabContent
            viewMode={viewMode}
            searchQuery={searchQuery}
            activeFilters={activeFilters}
            onFilterChange={setActiveFilters}
            presentations={presentations}
            loading={presLoading}
            onRefresh={fetchPresentations}
            actions={actions}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="h-full" data-testid="reports-presentations-hub">
      <ModuleHub
        persistViewModeKey="reports_presentations"
        tabs={tabs}
        activeTab={activeTab as ModuleTab}
        onTabChange={(tab) => {
          setActiveTab(tab as RapTab);
          setActiveFilters([]);
        }}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        onSearch={setSearchQuery}
        openDocuments={openDocuments}
        activeDocumentId={activeDocumentId}
        onSelectDocument={setActiveDocumentId}
        onCloseDocument={handleCloseDocument}
        onShowList={handleShowList}
        activeFilters={activeFilters}
        onRemoveFilter={handleRemoveFilter}
        onClearFilters={handleClearFilters}
        onNewItem={handleNewItem}
        newItemLabel={ctaLabels[activeTab]}
        availableViewModes={['table', 'grid']}
      >
        <div className="h-full min-h-0 overflow-hidden">{renderTabContent()}</div>
      </ModuleHub>
    </div>
  );
};

export default ReportsAndPresentationsHub;
