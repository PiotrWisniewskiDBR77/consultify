/**
 * ReportsAndPresentationsHub — V8.1 Outputs Library (route alias /presentations)
 *
 * Taxonomy: All | Mine | Needs review | Documents | Presentations | Sheets | Templates
 * Uses ModuleHub + registry-backed lists (GET /api/artifacts, view=mine|review).
 */

import {
  BookTemplate,
  ChevronDown,
  ChevronUp,
  Database,
  FileText,
  Filter,
  Inbox,
  LayoutGrid,
  MessageSquare,
  Package2,
  Plus,
  Presentation,
  Table2,
  User,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';

import { useOpenChatWithContext } from '@/hooks/useOpenChatWithContext';
import { isDeliverablesLightEnabled } from '@/services/deliverablesGeneration';
import { useConversationStore } from '@/store/useConversationStore';
import { shouldHideNonCoreModulesInPublicProduction } from '@/utils/publicProduction';

import { type FilterChip, ModuleHub, type ModuleTab, type ViewMode } from '../shared/ModuleHub';
import { getMenu3AiButtonClass } from '../shared/ModuleHub/menu3ActionButtonStyles';
import { useModuleOpenDocuments } from '../shared/ModuleHub/useModuleOpenDocuments';
import {
  MENU_3_ALL_DOT_CLASS,
  MENU_3_BADGE_ACTIVE,
  MENU_3_BADGE_INACTIVE,
  MENU_3_CHIP_ACTIVE,
  MENU_3_CHIP_INACTIVE,
  MENU_3_INNER_CLASS,
  MENU_3_LEFT_CLASS,
  MENU_3_RIGHT_CLASS,
} from '../shared/ModuleMenu3';
import { OutputsAggregateTabContent } from './OutputsAggregateTabContent';
import { deliverableKickoffSeed, deliverableTypeLabel } from './deliverableKickoff';
import { BundleHistoryPanel } from './BundleHistoryPanel';
import { type LauncherSelection, OutputsLauncherModal } from './OutputsLauncherModal';
import { DataSourcesTabContent } from './DataSourcesTabContent';
import { parseRapTabFromQuery, RAP_TAB_TO_QUERY } from './outputsLibraryTabQuery';
import { PresentationsTabContent } from './PresentationsTabContent';
import { ReportsTabContent } from './ReportsTabContent';
import { SheetsTabContent } from './SheetsTabContent';
import { TemplatesTabContent } from './TemplatesTabContent';
import type {
  PresentationSourceType,
  PresentationStatus,
  RapTab,
  ReportStatus,
  TemplateStatus,
} from './types';
import { PRESENTATION_STATUS_META, REPORT_STATUS_META, SOURCE_TYPE_META } from './types';
import {
  useArtifactOutputsList,
  usePresentations,
  useRapActions,
  useReports,
  useSheetOutputs,
  useTemplates,
} from './useRapData';

export const ReportsAndPresentationsHub: React.FC = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const openChatWithContext = useOpenChatWithContext();
  const isPolish = i18n.language?.startsWith('pl');

  const { initialTab, initialArtifactId } = useMemo(() => {
    const params = new URLSearchParams(location.search || '');
    const fromQuery = parseRapTabFromQuery(params.get('tab'));
    let tab: RapTab;
    if (fromQuery) tab = fromQuery;
    else if (location.pathname.startsWith('/reports')) tab = 'outputs_documents';
    else if (location.pathname.startsWith('/presentations')) tab = 'presentations';
    else tab = 'outputs_all';
    return {
      initialTab: tab,
      // Keep backward compatibility with older deep links using ?deck=<id>.
      initialArtifactId: params.get('artifactId') || params.get('deck') || null,
    };
  }, [location.pathname, location.search]);

  const [activeTab, setActiveTab] = useState<RapTab>(initialTab);
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilters, setActiveFilters] = useState<FilterChip[]>([]);
  // M17 junk filter (S6.3): OFF by default so the hub shows only real/final
  // outputs (server excludes drafts + dedupes). Toggle surfaces the "Robocze" set.
  const [showDrafts, setShowDrafts] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(location.search || '');
    const artifactId = params.get('artifactId');
    const deck = params.get('deck');
    if (!artifactId && deck) {
      params.set('artifactId', deck);
      params.delete('deck');
      navigate(`${location.pathname}?${params.toString()}`, { replace: true });
    }
  }, [location.pathname, location.search, navigate]);

  const { openDocuments, setOpenDocuments, activeDocumentId, setActiveDocumentId } =
    useModuleOpenDocuments('reports_presentations');

  const { reports, loading: reportsLoading, error: reportsError, fetchReports } = useReports();
  const {
    presentations,
    loading: presLoading,
    error: presentationsError,
    fetchPresentations,
  } = usePresentations();
  const {
    templates,
    loading: templatesLoading,
    error: templatesError,
    fetchTemplates,
  } = useTemplates();
  const actions = useRapActions();

  const libraryView =
    activeTab === 'outputs_all'
      ? 'all'
      : activeTab === 'outputs_mine'
        ? 'mine'
        : activeTab === 'outputs_review'
          ? 'review'
          : null;
  const {
    rows: artifactOutputRows,
    loading: artifactOutputsLoading,
    error: artifactOutputsError,
    moduleDisabled: artifactOutputsModuleDisabled,
    refetch: refetchArtifactOutputs,
  } = useArtifactOutputsList(libraryView);
  const {
    rows: sheetRows,
    loading: sheetsLoading,
    error: sheetsError,
    fetchSheets,
  } = useSheetOutputs();

  const [filtersOpen, setFiltersOpen] = useState(false);
  const [bundleHistoryOpen, setBundleHistoryOpen] = useState(false);
  // Licznik zwiększany po udanej generacji Kompletu AI → wymusza refetch historii.
  const [bundleRefresh, setBundleRefresh] = useState(0);

  // Re-pull the active list whenever the "Pokaż robocze" toggle flips. Each
  // fetcher accepts includeDrafts and appends ?include=drafts server-side.
  useEffect(() => {
    void refetchArtifactOutputs(showDrafts);
    void fetchReports(showDrafts);
    void fetchPresentations(showDrafts);
    void fetchSheets(showDrafts);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showDrafts]);

  const tabs = useMemo(
    () => [
      {
        id: 'outputs_all' as ModuleTab,
        label: t('rap.outputs.tabs.all', 'All'),
        icon: <LayoutGrid size={16} />,
      },
      {
        id: 'outputs_mine' as ModuleTab,
        label: t('rap.outputs.tabs.mine', 'Mine'),
        icon: <User size={16} />,
      },
      {
        id: 'outputs_review' as ModuleTab,
        label: t('rap.outputs.tabs.review', 'Needs review'),
        icon: <Inbox size={16} />,
      },
      {
        id: 'outputs_documents' as ModuleTab,
        label: t('rap.outputs.tabs.documents', 'Documents'),
        icon: <FileText size={16} />,
      },
      {
        id: 'presentations' as ModuleTab,
        label: t('rap.tabs.presentations', 'Presentations'),
        icon: <Presentation size={16} />,
      },
      {
        id: 'outputs_sheets' as ModuleTab,
        label: t('rap.outputs.tabs.sheets', 'Sheets'),
        icon: <Table2 size={16} />,
      },
      {
        id: 'outputs_data' as ModuleTab,
        label: t('rap.outputs.tabs.data', 'Dane'),
        icon: <Database size={16} />,
      },
      {
        id: 'templates' as ModuleTab,
        label: t('rap.tabs.templates', 'Template Library'),
        icon: <BookTemplate size={16} />,
      },
    ],
    [t]
  );

  const ctaLabels: Record<RapTab, string> = useMemo(
    () => ({
      outputs_all: t('rap.outputs.cta.new', 'New output'),
      outputs_mine: t('rap.outputs.cta.new', 'New output'),
      outputs_review: t('rap.outputs.cta.new', 'New output'),
      outputs_documents: t('rap.actions.newReport', 'New report'),
      presentations: t('rap.actions.newPresentation', 'New presentation'),
      outputs_sheets: '',
      outputs_data: '',
      templates: t('rap.actions.newTemplate', 'New template'),
    }),
    [t]
  );

  const [launcherOpen, setLauncherOpen] = useState(false);

  // E1: wspólne wejście routuje per typ do istniejącego kreatora.
  // Spięcie z silnikiem generacji + „paczką kontekstu" = sub-moduł E3.
  const handleLauncherSelect = useCallback(
    ({ type, templateId }: LauncherSelection) => {
      // E3: „Nowy → uruchamia Teresę". Otwieramy czat z pre-wypełnionym openerem
      // (pendingPrompt) dopasowanym do detektora intencji danego typu — Teresa od razu
      // wie, jaki deliverable wygenerować; użytkownik dopisuje temat i wysyła (Tryb B).
      // Konsumpcja templateId (szkielet) = seria T (rozszerzenie plan*Generation).
      const lang: 'pl' | 'en' = i18n.language === 'pl' ? 'pl' : 'en';
      void openChatWithContext({
        entityType: 'deliverable_launch',
        entityId: `${type}-${templateId}`,
        entityName: deliverableTypeLabel(type, lang),
        contextData: {
          teresaPrompt: deliverableKickoffSeed(type, lang),
          deliverableType: type,
          templateId,
        },
      });
    },
    [i18n, openChatWithContext]
  );

  const handleNewItem = useCallback(() => {
    switch (activeTab) {
      case 'outputs_documents':
        navigate('/reports/builder');
        break;
      case 'presentations':
        navigate('/presentations/wizard');
        break;
      case 'templates':
        navigate('/reports/builder?tab=templates');
        break;
      case 'outputs_all':
      case 'outputs_mine':
      case 'outputs_review':
        // Wspólny launcher za flagą; OFF ⇒ stare zachowanie (fail-safe).
        if (isDeliverablesLightEnabled()) {
          setLauncherOpen(true);
        } else {
          navigate('/presentations?tab=templates');
        }
        break;
      default:
        break;
    }
  }, [activeTab, navigate]);

  // Keep route-driven entry stable (e.g. /presentations should open "presentations" tab).
  // This also supports direct links like /reports?tab=templates.
  React.useEffect(() => {
    setActiveTab(initialTab);
    setActiveFilters([]);
  }, [initialTab]);

  const setWorkspaceContext = useConversationStore((s) => s.setWorkspaceContext);
  React.useEffect(() => {
    if (activeTab === 'templates') {
      setWorkspaceContext({
        type: 'templates' as any,
        view: 'PRESENTATIONS_TEMPLATES',
        entityData: { tab: 'templates' },
      } as any);
    }
  }, [activeTab, setWorkspaceContext]);

  const handleRemoveFilter = useCallback((id: string) => {
    setActiveFilters((prev) => prev.filter((f) => f.id !== id));
  }, []);

  const handleClearFilters = useCallback(() => {
    setActiveFilters([]);
  }, []);

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
        return [
          ...without,
          { id: `${column}:${value}`, column, value, label: label || value, color },
        ];
      });
    },
    []
  );

  const rightControls = useMemo(() => {
    const chipBase =
      'h-9 inline-flex items-center gap-2 rounded-full px-3 text-sm font-medium border transition-colors';

    const activeCount = activeFilters.length;

    const draftsToggle = (
      <button
        type="button"
        onClick={() => setShowDrafts((v) => !v)}
        className={`${chipBase} ${
          showDrafts
            ? 'bg-primary-500/10 text-slate-900 dark:text-slate-100 border-primary-500/40'
            : 'bg-white/70 dark:bg-white/[0.04] text-slate-700 dark:text-slate-200 border-slate-200/70 dark:border-white/[0.08] hover:bg-slate-100/70 dark:hover:bg-white/[0.06]'
        }`}
        title={t('rap.filters.showDrafts', 'Pokaż robocze')}
        aria-pressed={showDrafts}
      >
        <span>{t('rap.filters.showDrafts', 'Pokaż robocze')}</span>
      </button>
    );

    if (activeTab === 'outputs_sheets') {
      return <div className="relative flex items-center gap-2">{draftsToggle}</div>;
    }

    const isAggregateTab =
      activeTab === 'outputs_all' || activeTab === 'outputs_mine' || activeTab === 'outputs_review';

    const statusOptions =
      activeTab === 'templates'
        ? ([
            {
              value: 'active',
              label: t('rap.filters.status.active', 'Active'),
              dotColor: 'bg-emerald-400',
            },
            {
              value: 'draft',
              label: t('rap.filters.status.draft', 'Draft'),
              dotColor: 'bg-slate-400',
            },
            {
              value: 'archived',
              label: t('rap.filters.status.archived', 'Archived'),
              dotColor: 'bg-slate-500',
            },
          ] as Array<{ value: TemplateStatus; label: string; dotColor: string }>)
        : activeTab === 'outputs_documents'
          ? (Object.entries(REPORT_STATUS_META).map(([value, meta]) => ({
              value: value as ReportStatus,
              label: meta.labelPl || meta.label,
              dotColor: meta.dotColor,
            })) as Array<{ value: ReportStatus; label: string; dotColor: string }>)
          : activeTab === 'presentations'
            ? (Object.entries(PRESENTATION_STATUS_META).map(([value, meta]) => ({
                value: value as PresentationStatus,
                label: meta.labelPl || meta.label,
                dotColor: meta.dotColor,
              })) as Array<{ value: PresentationStatus; label: string; dotColor: string }>)
            : isAggregateTab
              ? ([
                  {
                    value: 'draft',
                    label: t('rap.filters.status.draft', 'Draft'),
                    dotColor: 'bg-slate-400',
                  },
                  {
                    value: 'generated',
                    label: t('rap.filters.status.generated', 'Generated'),
                    dotColor: 'bg-blue-400',
                  },
                  {
                    value: 'editing',
                    label: t('rap.filters.status.editing', 'Editing'),
                    dotColor: 'bg-amber-400',
                  },
                  {
                    value: 'ready',
                    label: REPORT_STATUS_META.ready.labelPl || REPORT_STATUS_META.ready.label,
                    dotColor: 'bg-emerald-400',
                  },
                  {
                    value: 'exported',
                    label: t('rap.filters.status.exported', 'Exported'),
                    dotColor: 'bg-blue-400',
                  },
                  {
                    value: 'shared',
                    label: t('rap.filters.status.shared', 'Shared'),
                    dotColor: 'bg-blue-400',
                  },
                  {
                    value: 'archived',
                    label: t('rap.filters.status.archived', 'Archived'),
                    dotColor: 'bg-slate-500',
                  },
                ] as Array<{ value: string; label: string; dotColor: string }>)
              : [];

    const sourceOptions =
      activeTab === 'presentations'
        ? (Object.entries(SOURCE_TYPE_META).map(([value, meta]) => ({
            value: value as PresentationSourceType,
            label: meta.labelPl || meta.label,
            color: meta.color,
          })) as Array<{ value: PresentationSourceType; label: string; color: string }>)
        : [];

    const kindOptions = isAggregateTab
      ? ([
          {
            value: 'document',
            label: t('rap.outputs.kind.document', 'Document'),
            color: 'text-blue-400',
          },
          {
            value: 'presentation',
            label: t('rap.outputs.kind.presentation', 'Presentation'),
            color: 'text-blue-400',
          },
          {
            value: 'sheet',
            label: t('rap.outputs.kind.sheet', 'Sheet'),
            color: 'text-emerald-400',
          },
        ] as Array<{ value: string; label: string; color: string }>)
      : [];

    const visibilityOptions = isAggregateTab
      ? ([
          {
            value: 'private',
            label: t('rap.outputs.visibility.private', 'Private'),
          },
          {
            value: 'review_shared',
            label: t('rap.outputs.visibility.reviewShared', 'Review shared'),
          },
          {
            value: 'project',
            label: t('rap.outputs.visibility.project', 'Project'),
          },
          {
            value: 'organization',
            label: t('rap.outputs.visibility.organization', 'Organization'),
          },
          {
            value: 'demo',
            label: t('rap.outputs.visibility.demo', 'Demo'),
          },
        ] as Array<{ value: string; label: string }>)
      : [];

    const reviewStateOptions = isAggregateTab
      ? ([
          {
            value: 'private_draft',
            label: t('rap.outputs.review.privateDraft', 'Private draft'),
          },
          {
            value: 'reviewable_share',
            label: t('rap.outputs.review.reviewableShare', 'Reviewable share'),
          },
          {
            value: 'in_review',
            label: t('rap.outputs.review.inReview', 'In review'),
          },
          {
            value: 'approved',
            label: t('rap.outputs.review.approved', 'Approved'),
          },
          {
            value: 'published',
            label: t('rap.outputs.review.published', 'Published'),
          },
          {
            value: 'archived',
            label: t('rap.outputs.review.archived', 'Archived'),
          },
        ] as Array<{ value: string; label: string }>)
      : [];

    const reportCanon =
      activeTab === 'outputs_documents' ? (
        <div className="mr-2 hidden xl:flex items-center gap-2">
          {[
            ['R1', t('rap.reportCanon.r1', 'Weekly Execution')],
            ['R2', t('rap.reportCanon.r2', 'Steering Committee')],
            ['R3', t('rap.reportCanon.r3', 'Benefits Tracking')],
            ['R4', t('rap.reportCanon.r4', 'Portfolio Overview')],
          ].map(([code, label]) => {
            const checked = activeFilters.some(
              (f) => f.column === 'reportType' && f.value === code
            );
            return (
              <button
                key={code}
                type="button"
                onClick={() =>
                  setSinglePreset(
                    'reportType',
                    checked ? null : code,
                    `${code} · ${label}`,
                    'bg-slate-400'
                  )
                }
                className={`h-8 rounded-full px-3 text-[11px] font-medium border inline-flex items-center gap-2 transition-colors ${
                  checked
                    ? 'bg-c-accent-soft text-c-text border-primary-500/40'
                    : 'bg-c-surface text-c-text-secondary border-c-border-subtle hover:bg-c-surface-raised'
                }`}
                title={label}
              >
                <span className="font-semibold">{code}</span>
                <span className="truncate max-w-[120px]">{label}</span>
              </button>
            );
          })}
        </div>
      ) : null;

    return (
      <div className="relative flex items-center gap-2">
        {draftsToggle}
        {reportCanon}
        <button
          type="button"
          onClick={() => setFiltersOpen((v) => !v)}
          className={`${chipBase} ${
            activeCount > 0
              ? 'bg-c-accent-soft text-c-text border-primary-500/40'
              : 'bg-c-surface text-c-text-secondary border-c-border-subtle hover:bg-c-surface-raised'
          }`}
          title={t('common.filters', 'Filters')}
        >
          <Filter size={16} />
          <span>{t('common.filters', 'Filters')}</span>
          {activeCount > 0 ? (
            <span className={MENU_3_BADGE_ACTIVE}>{activeCount}</span>
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
            <div className="absolute right-0 mt-2 z-50 w-[320px] rounded-xl border border-c-border bg-c-surface shadow-xl overflow-hidden">
              <div className="p-3 border-b border-c-border-subtle">
                <div className="text-xs font-semibold text-c-text">
                  {t('common.filters', 'Filters')}
                </div>
                <div className="text-[11px] text-c-text-muted mt-0.5">
                  {t('rap.filters.hint', 'Pick statuses and (optionally) sources.')}
                </div>
              </div>

              <div className="p-3 space-y-4 max-h-[360px] overflow-y-auto">
                {statusOptions.length > 0 ? (
                  <div>
                    <div className="text-[11px] font-semibold text-c-text-secondary mb-2">
                      {t('rap.filters.status', 'Status')}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {statusOptions.map((o) => {
                        const checked = activeFilters.some(
                          (f) => f.column === 'status' && f.value === o.value
                        );
                        return (
                          <button
                            key={o.value}
                            type="button"
                            onClick={() => toggleFilter('status', o.value, o.label, o.dotColor)}
                            className={`h-8 rounded-full px-3 text-[11px] font-medium border inline-flex items-center gap-2 transition-colors ${
                              checked
                                ? 'bg-c-accent-soft text-c-text border-primary-500/40'
                                : 'bg-c-surface text-c-text-secondary border-c-border-subtle hover:bg-c-surface-raised'
                            }`}
                          >
                            <span className={`w-2 h-2 rounded-full ${o.dotColor}`} />
                            <span className="truncate">{o.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : null}

                {kindOptions.length > 0 ? (
                  <div>
                    <div className="text-[11px] font-semibold text-c-text-secondary mb-2">
                      {t('rap.outputs.filters.kind', 'Output type')}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {kindOptions.map((o) => (
                        <button
                          key={o.value}
                          type="button"
                          onClick={() => toggleFilter('outputKind', o.value, o.label)}
                          className={`h-8 rounded-full px-3 text-[11px] font-medium border inline-flex items-center gap-2 transition-colors ${
                            activeFilters.some(
                              (f) => f.column === 'outputKind' && f.value === o.value
                            )
                              ? 'bg-c-accent-soft text-c-text border-primary-500/40'
                              : 'bg-c-surface text-c-text-secondary border-c-border-subtle hover:bg-c-surface-raised'
                          }`}
                        >
                          <span className={`text-[11px] font-semibold ${o.color}`}>{o.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}

                {visibilityOptions.length > 0 ? (
                  <div>
                    <div className="text-[11px] font-semibold text-c-text-secondary mb-2">
                      {t('rap.outputs.columns.visibility', 'Visibility')}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {visibilityOptions.map((o) => {
                        const checked = activeFilters.some(
                          (f) => f.column === 'visibilityScope' && f.value === o.value
                        );
                        return (
                          <button
                            key={o.value}
                            type="button"
                            onClick={() =>
                              toggleFilter('visibilityScope', o.value, o.label, 'bg-slate-400')
                            }
                            className={`h-8 rounded-full px-3 text-[11px] font-medium border inline-flex items-center gap-2 transition-colors ${
                              checked
                                ? 'bg-c-accent-soft text-c-text border-primary-500/40'
                                : 'bg-c-surface text-c-text-secondary border-c-border-subtle hover:bg-c-surface-raised'
                            }`}
                          >
                            <span className="truncate">{o.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : null}

                {reviewStateOptions.length > 0 ? (
                  <div>
                    <div className="text-[11px] font-semibold text-c-text-secondary mb-2">
                      {t('rap.outputs.columns.review', 'Review')}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {reviewStateOptions.map((o) => {
                        const checked = activeFilters.some(
                          (f) => f.column === 'publishState' && f.value === o.value
                        );
                        return (
                          <button
                            key={o.value}
                            type="button"
                            onClick={() =>
                              toggleFilter('publishState', o.value, o.label, 'bg-blue-400')
                            }
                            className={`h-8 rounded-full px-3 text-[11px] font-medium border inline-flex items-center gap-2 transition-colors ${
                              checked
                                ? 'bg-c-accent-soft text-c-text border-primary-500/40'
                                : 'bg-c-surface text-c-text-secondary border-c-border-subtle hover:bg-c-surface-raised'
                            }`}
                          >
                            <span className="truncate">{o.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : null}

                {sourceOptions.length > 0 ? (
                  <div>
                    <div className="text-[11px] font-semibold text-c-text-secondary mb-2">
                      {t('rap.filters.source', 'Source')}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {sourceOptions.map((o) => {
                        const checked = activeFilters.some(
                          (f) => f.column === 'sourceType' && f.value === o.value
                        );
                        return (
                          <button
                            key={o.value}
                            type="button"
                            onClick={() => toggleFilter('sourceType', o.value, o.label)}
                            className={`h-8 rounded-full px-3 text-[11px] font-medium border inline-flex items-center gap-2 transition-colors ${
                              checked
                                ? 'bg-c-accent-soft text-c-text border-primary-500/40'
                                : 'bg-c-surface text-c-text-secondary border-c-border-subtle hover:bg-c-surface-raised'
                            }`}
                          >
                            <span className={`text-[11px] font-semibold ${o.color}`}>
                              {o.label}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="p-3 border-t border-c-border-subtle flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setActiveFilters([])}
                  className="text-[11px] text-c-text-muted hover:text-c-text transition-colors"
                >
                  {t('common.clearAll', 'Clear all')}
                </button>
                <button
                  type="button"
                  onClick={() => setFiltersOpen(false)}
                  className="h-8 px-3 rounded-full text-[11px] font-medium bg-c-text text-c-surface hover:opacity-90 transition-opacity"
                >
                  {t('common.done', 'Done')}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    );
  }, [activeFilters, activeTab, filtersOpen, setSinglePreset, showDrafts, t, toggleFilter]);

  const commandRowLeftSlot = useMemo(() => {
    const chipBase = '';
    const chipActive = MENU_3_CHIP_ACTIVE;
    const chipInactive = MENU_3_CHIP_INACTIVE;
    const badgeBase = '';
    const badgeActive = MENU_3_BADGE_ACTIVE;
    const badgeInactive = MENU_3_BADGE_INACTIVE;

    if (
      activeTab === 'outputs_all' ||
      activeTab === 'outputs_mine' ||
      activeTab === 'outputs_review'
    ) {
      const kindCounts = artifactOutputRows.reduce(
        (acc, r) => {
          acc[r.kind] = (acc[r.kind] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>
      );
      const kindChips = [
        {
          value: 'document',
          label: t('rap.outputs.kind.document', 'Document'),
          dot: 'bg-blue-400',
        },
        {
          value: 'presentation',
          label: t('rap.outputs.kind.presentation', 'Presentation'),
          dot: 'bg-blue-400',
        },
        {
          value: 'sheet',
          label: t('rap.outputs.kind.sheet', 'Sheet'),
          dot: 'bg-emerald-400',
        },
      ];
      const kindActive = (v: string) =>
        activeFilters.some((f) => f.column === 'outputKind' && f.value === v);

      return (
        <div className={MENU_3_LEFT_CLASS}>
          <button
            type="button"
            onClick={() => setSinglePreset('outputKind', null)}
            className={`${chipBase} ${
              !activeFilters.some((f) => f.column === 'outputKind') ? chipActive : chipInactive
            }`}
            title={t('common.all', 'All')}
          >
            <span className={MENU_3_ALL_DOT_CLASS} />
            <span>{t('common.all', 'All')}</span>
            <span
              className={`${badgeBase} ${
                !activeFilters.some((f) => f.column === 'outputKind') ? badgeActive : badgeInactive
              }`}
            >
              {artifactOutputRows.length}
            </span>
          </button>
          {kindChips.map((c) => {
            const active = kindActive(c.value);
            const count = kindCounts[c.value] || 0;
            return (
              <button
                key={c.value}
                type="button"
                onClick={() =>
                  setSinglePreset('outputKind', active ? null : c.value, c.label, c.dot)
                }
                className={`${chipBase} ${active ? chipActive : chipInactive}`}
                title={c.label}
              >
                <span className={`w-2 h-2 rounded-full ${c.dot}`} />
                <span>{c.label}</span>
                <span className={`${badgeBase} ${active ? badgeActive : badgeInactive}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      );
    }

    if (activeTab === 'outputs_sheets') {
      return (
        <div className={MENU_3_LEFT_CLASS}>
          <span className={MENU_3_CHIP_ACTIVE}>
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span>{t('rap.outputs.kind.sheet', 'Sheets')}</span>
            <span className={MENU_3_BADGE_ACTIVE}>{sheetRows.length}</span>
          </span>
        </div>
      );
    }

    const items =
      activeTab === 'templates'
        ? templates
        : activeTab === 'outputs_documents'
          ? reports
          : presentations;

    const statusKey = 'status' as const;

    const counts = (items || []).reduce(
      (acc, it: any) => {
        const s = String(it?.[statusKey] ?? '').toLowerCase();
        if (!s) return acc;
        acc[s] = (acc[s] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    const statusChips =
      activeTab === 'templates'
        ? ([
            {
              value: 'active',
              label: t('rap.filters.status.active', 'Active'),
              dot: 'bg-emerald-400',
            },
            { value: 'draft', label: t('rap.filters.status.draft', 'Draft'), dot: 'bg-slate-400' },
            {
              value: 'deprecated',
              label: t('rap.filters.status.deprecated', 'Deprecated'),
              dot: 'bg-amber-500',
            },
            {
              value: 'archived',
              label: t('rap.filters.status.archived', 'Archived'),
              dot: 'bg-slate-500',
            },
          ] as Array<{ value: string; label: string; dot: string }>)
        : activeTab === 'outputs_documents'
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
      <div className={MENU_3_LEFT_CLASS}>
        <button
          type="button"
          onClick={() => setSinglePreset('status', null)}
          className={`${chipBase} ${
            !activeFilters.some((f) => f.column === 'status') ? chipActive : chipInactive
          }`}
          title={t('common.all', 'All')}
        >
          <span className={MENU_3_ALL_DOT_CLASS} />
          <span>{t('common.all', 'All')}</span>
          <span
            className={`${badgeBase} ${
              !activeFilters.some((f) => f.column === 'status') ? badgeActive : badgeInactive
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
              className={`${chipBase} ${active ? chipActive : chipInactive}`}
              title={c.label}
            >
              <span className={`w-2 h-2 rounded-full ${c.dot}`} />
              <span>{c.label}</span>
              <span className={`${badgeBase} ${active ? badgeActive : badgeInactive}`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>
    );
  }, [
    activeFilters,
    activeTab,
    artifactOutputRows,
    presentations,
    reports,
    setSinglePreset,
    t,
    templates,
  ]);

  // Document Studio is a Wave-2 format-lane. On public production where non-core
  // modules are hidden, do NOT surface its entry point (avoids leading the paid
  // path to a blocked module view — no "coming soon" in the hub).
  const documentStudioAvailable = useMemo(() => !shouldHideNonCoreModulesInPublicProduction(), []);

  const commandRowRightSlot = useMemo(
    () => (
      <>
        {documentStudioAvailable ? (
          <button
            type="button"
            onClick={() => navigate('/document-studio')}
            className={`${getMenu3AiButtonClass(false)} !border-sky-300/60 !bg-sky-500/10 !text-sky-800 dark:!border-sky-400/30 dark:!bg-sky-500/20 dark:!text-sky-200`}
            title={t('rap.actions.newDocumentStudio', 'New AI document (Document Studio)')}
          >
            <Plus size={12} />
            <span>{t('rap.actions.newDocumentStudio', 'New AI document')}</span>
          </button>
        ) : null}
        <button
          type="button"
          onClick={() =>
            openChatWithContext({
              entityType: 'outputs_module',
              entityId: activeTab,
              entityName: t('rap.hub.entityName', 'Reports & Presentations'),
              contextData: {
                activeTab,
                viewMode,
                activeFiltersCount: activeFilters.length,
                openDocumentsCount: openDocuments.length,
              },
            })
          }
          className={getMenu3AiButtonClass(false)}
          title={t('rap.actions.discuss', 'Discuss')}
        >
          <MessageSquare size={12} />
          <span>{t('rap.actions.discuss', 'Discuss')}</span>
        </button>
      </>
    ),
    [
      activeFilters.length,
      activeTab,
      documentStudioAvailable,
      navigate,
      openChatWithContext,
      openDocuments.length,
      t,
      viewMode,
    ]
  );

  // Canonical Menu 3: one flex row (MENU_3_INNER_CLASS = flex items-center justify-between).
  // ModuleNavBar voids commandRowRightContent; merge both sides into commandRowContent.
  const commandRowContent = useMemo(
    () => (
      <div className={MENU_3_INNER_CLASS}>
        {commandRowLeftSlot}
        <div className={MENU_3_RIGHT_CLASS}>{commandRowRightSlot}</div>
      </div>
    ),
    [commandRowLeftSlot, commandRowRightSlot]
  );

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
      case 'outputs_all':
      case 'outputs_mine':
      case 'outputs_review':
        return (
          <OutputsAggregateTabContent
            viewMode={viewMode}
            searchQuery={searchQuery}
            activeFilters={activeFilters}
            onFilterChange={setActiveFilters}
            rows={artifactOutputRows}
            loading={artifactOutputsLoading}
            error={artifactOutputsError}
            moduleDisabled={artifactOutputsModuleDisabled}
            onRefresh={refetchArtifactOutputs}
            actions={actions}
            initialArtifactId={initialArtifactId}
          />
        );
      case 'templates':
        return (
          <TemplatesTabContent
            viewMode={viewMode}
            searchQuery={searchQuery}
            activeFilters={activeFilters}
            onFilterChange={setActiveFilters}
            templates={templates}
            loading={templatesLoading}
            error={templatesError}
            onRefresh={fetchTemplates}
            actions={{ startArtifactReview: actions.startArtifactReview }}
            initialArtifactId={initialArtifactId}
          />
        );
      case 'outputs_documents':
        return (
          <ReportsTabContent
            viewMode={viewMode}
            searchQuery={searchQuery}
            activeFilters={activeFilters}
            onFilterChange={setActiveFilters}
            reports={reports}
            loading={reportsLoading}
            error={reportsError}
            onRefresh={fetchReports}
            actions={actions}
            initialArtifactId={initialArtifactId}
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
            error={presentationsError}
            onRefresh={fetchPresentations}
            actions={actions}
            initialArtifactId={initialArtifactId}
          />
        );
      case 'outputs_sheets':
        return (
          <SheetsTabContent
            viewMode={viewMode}
            searchQuery={searchQuery}
            activeFilters={activeFilters}
            onFilterChange={setActiveFilters}
            rows={sheetRows}
            loading={sheetsLoading}
            error={sheetsError}
            onRefresh={fetchSheets}
            actions={actions}
            initialArtifactId={initialArtifactId}
          />
        );
      case 'outputs_data':
        return <DataSourcesTabContent />;
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
          const next = tab as RapTab;
          setActiveTab(next);
          setActiveFilters([]);
          setFiltersOpen(false);
          const q = RAP_TAB_TO_QUERY[next];
          const params = new URLSearchParams(location.search || '');
          params.set('tab', q);
          navigate(`${location.pathname}?${params.toString()}`, { replace: true });
        }}
        showTabCounts={false}
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
        onNewItem={
          activeTab === 'outputs_sheets' || activeTab === 'outputs_data'
            ? undefined
            : handleNewItem
        }
        newItemLabel={ctaLabels[activeTab]}
        newItemTestId="outputs-new-btn"
        availableViewModes={['table', 'grid']}
        rightControls={rightControls}
        commandRowContent={commandRowContent}
      >
        <div className="h-full min-h-0 overflow-hidden">{renderTabContent()}</div>
      </ModuleHub>
      <OutputsLauncherModal
        open={launcherOpen}
        onClose={() => setLauncherOpen(false)}
        onSelect={handleLauncherSelect}
        onBundleGenerated={() => {
          setBundleRefresh((n) => n + 1);
          setBundleHistoryOpen(true); // rozwiń historię, żeby świeży bundle był widoczny
        }}
      />

      {/* W3.8 / W4.4 — Komplet AI bundle history (only when deliverables premium is enabled) */}
      {isDeliverablesLightEnabled() && (
        <div className="mx-4 mb-4 mt-2">
          {/* Section header with collapse toggle */}
          <button
            onClick={() => setBundleHistoryOpen((v) => !v)}
            className="flex w-full items-center gap-2 rounded-lg px-1 py-2 text-left text-sm font-semibold text-slate-700 transition-colors hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
            aria-expanded={bundleHistoryOpen}
            data-testid="bundle-history-toggle"
          >
            <Package2 className="h-4 w-4 shrink-0 text-blue-500" />
            <span className="flex-1">
              {t('rap.bundles.sectionTitle', 'Komplet AI — historia generacji')}
            </span>
            {bundleHistoryOpen ? (
              <ChevronUp className="h-4 w-4 text-slate-400" />
            ) : (
              <ChevronDown className="h-4 w-4 text-slate-400" />
            )}
          </button>

          {bundleHistoryOpen && (
            <div className="mt-2">
              <BundleHistoryPanel refreshSignal={bundleRefresh} />
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ReportsAndPresentationsHub;
