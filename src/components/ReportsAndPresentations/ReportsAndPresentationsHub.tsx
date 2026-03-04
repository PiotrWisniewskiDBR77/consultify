/**
 * ReportsAndPresentationsHub — V3 Unified Module
 *
 * Three tabs: Biblioteka wzorców | Raporty | Prezentacje
 * Uses ModuleHub + FilterableTable + GridView + TableWithPreviewLayout (golden standard).
 * Connected to backend: /api/report-builder, /api/presentations
 */

import { BookTemplate, FileText, Filter, Presentation, Sparkles } from 'lucide-react';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';

import { useOpenChatWithContext } from '@/hooks/useOpenChatWithContext';
import { useConversationStore } from '@/store/useConversationStore';

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
import type { PresentationSourceType, PresentationStatus, RapTab, ReportStatus, TemplateStatus } from './types';
import { PRESENTATION_STATUS_META, REPORT_STATUS_META, SOURCE_TYPE_META } from './types';
import { usePresentations, useRapActions, useReports, useTemplates } from './useRapData';

export const ReportsAndPresentationsHub: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const openChatWithContext = useOpenChatWithContext();
  const displayMode = useConversationStore((s) => s.displayMode);
  const setDisplayMode = useConversationStore((s) => s.setDisplayMode);

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

  const [filtersOpen, setFiltersOpen] = useState(false);

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

  const handleOpenAI = useCallback(async () => {
    try {
      await openChatWithContext({
        entityType: 'reports_presentations',
        entityId: `rap:${activeTab}`,
        entityName: t('rap.title', 'Reports & Presentations'),
        contextData: { activeTab, searchQuery, activeFilters },
      });
      if (displayMode === 'collapsed') setDisplayMode('split');
    } catch {
      // silent
    }
  }, [activeFilters, activeTab, displayMode, openChatWithContext, searchQuery, setDisplayMode, t]);

  const aiControl = useMemo(
    () => (
      <button
        type="button"
        onClick={handleOpenAI}
        data-testid="rap-ai-button"
        className="h-9 w-9 inline-flex items-center justify-center rounded-full border border-purple-500/30 bg-gradient-to-r from-purple-600 to-fuchsia-600 text-white shadow-lg shadow-purple-500/20 hover:brightness-110 transition-all active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/50 focus-visible:ring-offset-1 ring-offset-white dark:ring-offset-navy-900"
        title={t('common.ai', 'AI')}
      >
        <Sparkles size={18} />
      </button>
    ),
    [handleOpenAI, t]
  );

  const toggleFilter = useCallback(
    (column: string, value: string, label: string, color?: string) => {
      setActiveFilters((prev) => {
        const exists = prev.some((f) => f.column === column && f.value === value);
        if (exists) return prev.filter((f) => !(f.column === column && f.value === value));
        return [...prev, { id: `${column}:${value}`, column, value, label, color }];
      });
    },
    []
  );

  const setSinglePreset = useCallback(
    (column: string, value: string | null, label?: string, color?: string) => {
      setActiveFilters((prev) => {
        const without = prev.filter((f) => f.column !== column);
        if (!value) return without;
        return [...without, { id: `${column}:${value}`, column, value, label: label || value, color }];
      });
    },
    []
  );

  const rightControls = useMemo(() => {
    const chipBase =
      'h-9 inline-flex items-center gap-2 rounded-full px-3 text-sm font-medium border transition-colors';

    const activeCount = activeFilters.length;

    const statusOptions =
      activeTab === 'templates'
        ? ([
            { value: 'active', label: t('rap.filters.status.active', 'Active'), dotColor: 'bg-emerald-400' },
            { value: 'draft', label: t('rap.filters.status.draft', 'Draft'), dotColor: 'bg-slate-400' },
            { value: 'archived', label: t('rap.filters.status.archived', 'Archived'), dotColor: 'bg-slate-500' },
          ] as Array<{ value: TemplateStatus; label: string; dotColor: string }>)
        : activeTab === 'reports'
          ? (Object.entries(REPORT_STATUS_META).map(([value, meta]) => ({
              value: value as ReportStatus,
              label: meta.labelPl || meta.label,
              dotColor: meta.dotColor,
            })) as Array<{ value: ReportStatus; label: string; dotColor: string }>)
          : (Object.entries(PRESENTATION_STATUS_META).map(([value, meta]) => ({
              value: value as PresentationStatus,
              label: meta.labelPl || meta.label,
              dotColor: meta.dotColor,
            })) as Array<{ value: PresentationStatus; label: string; dotColor: string }>);

    const sourceOptions =
      activeTab === 'presentations'
        ? (Object.entries(SOURCE_TYPE_META).map(([value, meta]) => ({
            value: value as PresentationSourceType,
            label: meta.labelPl || meta.label,
            color: meta.color,
          })) as Array<{ value: PresentationSourceType; label: string; color: string }>)
        : [];

    return (
      <div className="relative">
        <button
          type="button"
          onClick={() => setFiltersOpen((v) => !v)}
          className={`${chipBase} ${
            activeCount > 0
              ? 'bg-primary-500/10 text-slate-900 dark:text-slate-100 border-primary-500/40'
              : 'bg-white/70 dark:bg-white/[0.04] text-slate-700 dark:text-slate-200 border-slate-200/70 dark:border-white/[0.08] hover:bg-slate-100/70 dark:hover:bg-white/[0.06]'
          }`}
          title={t('common.filters', 'Filters')}
        >
          <Filter size={16} />
          <span>{t('common.filters', 'Filters')}</span>
          {activeCount > 0 ? (
            <span className="px-1.5 py-0.5 text-[10px] rounded-full bg-primary-500/30 text-primary-600 dark:text-primary-300 font-semibold tabular-nums leading-none">
              {activeCount}
            </span>
          ) : null}
        </button>

        {filtersOpen && (
          <>
            <button
              type="button"
              className="fixed inset-0 z-40 cursor-default"
              onClick={() => setFiltersOpen(false)}
              aria-label={t('common.close', 'Close')}
            />
            <div className="absolute right-0 mt-2 z-50 w-[320px] rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 shadow-xl overflow-hidden">
              <div className="p-3 border-b border-slate-200 dark:border-navy-700">
                <div className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                  {t('common.filters', 'Filters')}
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  {t('rap.filters.hint', 'Pick statuses and (optionally) sources.')}
                </div>
              </div>

              <div className="p-3 space-y-4 max-h-[360px] overflow-y-auto">
                <div>
                  <div className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-2">
                    {t('rap.filters.status', 'Status')}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {statusOptions.map((o) => {
                      const checked = activeFilters.some((f) => f.column === 'status' && f.value === o.value);
                      return (
                        <button
                          key={o.value}
                          type="button"
                          onClick={() => toggleFilter('status', o.value, o.label, o.dotColor)}
                          className={`h-8 rounded-full px-3 text-[11px] font-medium border inline-flex items-center gap-2 transition-colors ${
                            checked
                              ? 'bg-primary-500/10 text-slate-900 dark:text-slate-100 border-primary-500/40'
                              : 'bg-slate-50 dark:bg-navy-950/40 text-slate-600 dark:text-slate-400 border-slate-200/70 dark:border-white/[0.06] hover:bg-slate-100/70 dark:hover:bg-white/[0.05]'
                          }`}
                        >
                          <span className={`w-2 h-2 rounded-full ${o.dotColor}`} />
                          <span className="truncate">{o.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {sourceOptions.length > 0 ? (
                  <div>
                    <div className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-2">
                      {t('rap.filters.source', 'Source')}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {sourceOptions.map((o) => {
                        const checked = activeFilters.some((f) => f.column === 'sourceType' && f.value === o.value);
                        return (
                          <button
                            key={o.value}
                            type="button"
                            onClick={() => toggleFilter('sourceType', o.value, o.label)}
                            className={`h-8 rounded-full px-3 text-[11px] font-medium border inline-flex items-center gap-2 transition-colors ${
                              checked
                                ? 'bg-primary-500/10 text-slate-900 dark:text-slate-100 border-primary-500/40'
                                : 'bg-slate-50 dark:bg-navy-950/40 text-slate-600 dark:text-slate-400 border-slate-200/70 dark:border-white/[0.06] hover:bg-slate-100/70 dark:hover:bg-white/[0.05]'
                            }`}
                          >
                            <span className={`text-[11px] font-semibold ${o.color}`}>{o.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="p-3 border-t border-slate-200 dark:border-navy-700 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setActiveFilters([])}
                  className="text-[11px] text-slate-500 hover:text-primary-400 transition-colors"
                >
                  {t('common.clearAll', 'Clear all')}
                </button>
                <button
                  type="button"
                  onClick={() => setFiltersOpen(false)}
                  className="h-8 px-3 rounded-full text-[11px] font-medium bg-primary-600 text-white hover:bg-primary-700 transition-colors"
                >
                  {t('common.done', 'Done')}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    );
  }, [activeFilters, activeTab, filtersOpen, t, toggleFilter]);

  const commandRowContent = useMemo(() => {
    const chipBase =
      'h-8 inline-flex items-center gap-1.5 rounded-full px-2.5 text-[11px] font-medium border transition-colors whitespace-nowrap';
    const badgeBase =
      'px-1.5 py-0.5 rounded-full text-[10px] font-semibold tabular-nums leading-none';

    const items =
      activeTab === 'templates' ? templates : activeTab === 'reports' ? reports : presentations;

    const statusKey =
      activeTab === 'templates'
        ? ('status' as const)
        : activeTab === 'reports'
          ? ('status' as const)
          : ('status' as const);

    const counts = (items || []).reduce((acc, it: any) => {
      const s = String(it?.[statusKey] ?? '').toLowerCase();
      if (!s) return acc;
      acc[s] = (acc[s] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const statusChips =
      activeTab === 'templates'
        ? ([
            { value: 'active', label: t('rap.filters.status.active', 'Active'), dot: 'bg-emerald-400' },
            { value: 'draft', label: t('rap.filters.status.draft', 'Draft'), dot: 'bg-slate-400' },
            { value: 'archived', label: t('rap.filters.status.archived', 'Archived'), dot: 'bg-slate-500' },
          ] as Array<{ value: string; label: string; dot: string }>)
        : activeTab === 'reports'
          ? (Object.entries(REPORT_STATUS_META).map(([value, meta]) => ({
              value,
              label: meta.labelPl || meta.label,
              dot: meta.dotColor,
            })) as Array<{ value: string; label: string; dot: string }>)
          : (Object.entries(PRESENTATION_STATUS_META).map(([value, meta]) => ({
              value,
              label: meta.labelPl || meta.label,
              dot: meta.dotColor,
            })) as Array<{ value: string; label: string; dot: string }>);

    const isActive = (value: string) =>
      activeFilters.some((f) => f.column === 'status' && String(f.value).toLowerCase() === value);

    return (
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setSinglePreset('status', null)}
          className={`${chipBase} ${
            !activeFilters.some((f) => f.column === 'status')
              ? 'bg-purple-500/10 text-purple-700 dark:text-purple-200 border-purple-500/40'
              : 'bg-slate-100 dark:bg-navy-800 text-slate-600 dark:text-slate-300 border-slate-200/60 dark:border-navy-700/60 hover:bg-white/60 dark:hover:bg-navy-900/50'
          }`}
          title={t('common.all', 'All')}
        >
          <span>{t('common.all', 'All')}</span>
          <span
            className={`${badgeBase} ${
              !activeFilters.some((f) => f.column === 'status')
                ? 'bg-purple-500/30 text-purple-700 dark:text-purple-200'
                : 'bg-slate-200 dark:bg-navy-700 text-slate-600 dark:text-slate-300'
            }`}
          >
            {items.length}
          </span>
        </button>

        {statusChips.map((c) => {
          const active = isActive(String(c.value).toLowerCase());
          const key = String(c.value);
          const count = counts[String(c.value).toLowerCase()] || 0;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setSinglePreset('status', active ? null : key, c.label, c.dot)}
              className={`${chipBase} ${
                active
                  ? 'bg-purple-500/10 text-purple-700 dark:text-purple-200 border-purple-500/40'
                  : 'bg-slate-100 dark:bg-navy-800 text-slate-600 dark:text-slate-300 border-slate-200/60 dark:border-navy-700/60 hover:bg-white/60 dark:hover:bg-navy-900/50'
              }`}
              title={c.label}
            >
              <span className={`w-2 h-2 rounded-full ${c.dot}`} />
              <span>{c.label}</span>
              <span
                className={`${badgeBase} ${
                  active
                    ? 'bg-purple-500/30 text-purple-700 dark:text-purple-200'
                    : 'bg-slate-200 dark:bg-navy-700 text-slate-600 dark:text-slate-300'
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>
    );
  }, [activeFilters, activeTab, presentations, reports, setSinglePreset, t, templates]);

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
          setFiltersOpen(false);
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
        rightControls={rightControls}
        aiControl={aiControl}
        commandRowContent={commandRowContent}
      >
        <div className="h-full min-h-0 overflow-hidden">{renderTabContent()}</div>
      </ModuleHub>
    </div>
  );
};

export default ReportsAndPresentationsHub;
