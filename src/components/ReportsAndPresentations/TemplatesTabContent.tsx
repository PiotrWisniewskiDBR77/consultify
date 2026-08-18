/**
 * TemplatesTabContent — "Biblioteka wzorców" tab
 * Triada standard (docs/ui-standards/TRIADA_KANON.md A4-A7): table view →
 * StandardTable + StandardPreview, 1:1 with the Assessment 'list' / Interview
 * Inbox / Results KPI catalog adopters. Grid view (GridView) is untouched —
 * same as ResultsHub, which keeps its own grid branch alongside the triada
 * table branch.
 * Canonical source: /api/artifacts?artifactFamily=template (P24 Outputs artifacts)
 *
 * Galeria (N4, noc 2026-07-27/28): behind `ff_galeria_szablonow` (default
 * OFF, `src/utils/templatesGalleryFlag.ts`), the TABLE branch (not the
 * separate `viewMode === 'grid'` branch above, which stays untouched) grows
 * a Galeria ↔ Tabela toggle. OFF → byte-identical to before this change:
 * same JSX tree, `StandardTable` only, no toggle, no chip toolbar. ON →
 * the toggle appears and "Galeria" renders `TemplatesGalleryView` (kafle z
 * miniaturami niosącymi strukturę wzorca, port 1:1 z zaakceptowanego
 * prototypu `proto/galeria-szablonow`); "Tabela" stays the exact same
 * `StandardTable`+`StandardPreview` pair used today.
 */

import {
  AlertTriangle,
  BookTemplate,
  Copy,
  FileSpreadsheet,
  FileText,
  LayoutGrid,
  MessageSquare,
  Play,
  Presentation,
  Table2,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { EmptyState } from '@/components/shared/states';
import {
  type MetaPill,
  StandardPreview,
  type StandardPreviewActions,
  standardPreviewShortcuts,
  type StandardRowMenu,
  StandardTable,
  type TableColumn as StandardTableColumn,
} from '@/components/standard';
import { LoadingState, StatusChip } from '@/components/ui/primitives';
import { isTemplatesGalleryEnabled } from '@/utils/templatesGalleryFlag';

import { useOpenChatWithContext } from '../../hooks/useOpenChatWithContext';
import { type FilterChip, type GridItem, GridView, type ViewMode } from '../shared/ModuleHub';
import {
  resolveTemplateClonePath,
  resolveTemplateEditPath,
  resolveTemplateUsePath,
} from './artifactNavigation';
import { TemplatesGalleryView } from './TemplatesGalleryView';
import { TEMPLATE_STATUS_META, TEMPLATE_TYPE_META, type TemplateItem } from './types';

interface TemplatesTabContentProps {
  viewMode: ViewMode;
  searchQuery: string;
  activeFilters: FilterChip[];
  onFilterChange: (filters: FilterChip[]) => void;
  templates: TemplateItem[];
  loading: boolean;
  error?: string | null;
  onRefresh?: () => void;
  actions?: {
    startArtifactReview?: (artifactId: string) => Promise<boolean>;
  };
  initialArtifactId?: string | null;
}

export const TemplatesTabContent: React.FC<TemplatesTabContentProps> = ({
  viewMode,
  searchQuery,
  activeFilters,
  onFilterChange,
  templates,
  loading,
  error,
  onRefresh,
  actions,
  initialArtifactId,
}) => {
  const { t, i18n } = useTranslation();
  const isPolish = i18n.language?.startsWith('pl');
  const navigate = useNavigate();
  const openChat = useOpenChatWithContext();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [submitBusyId, setSubmitBusyId] = useState<string | null>(null);
  // Triada standard (canon A4/#13): checkbox selection state for the table's
  // left-hand checkbox column. This tab is a leaf under ReportsAndPresentationsHub
  // (which owns Menu 1/2/3) — there is no bulk-mode command-row slot exposed to
  // tab content today, so selection drives the checkbox affordance only; a
  // future wave can lift this into the hub's Menu 3 bulk bar (see self-audit).
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const deepLinkConsumed = useRef(false);

  // N4 (2026-07-27/28): reveal flag for the Galeria ↔ Tabela toggle. Read
  // once per render (flag readers are cheap sync checks over
  // query/localStorage/env — see templatesGalleryFlag.ts); OFF is the
  // untouched path below.
  const galleryEnabled = isTemplatesGalleryEnabled();
  const [innerView, setInnerView] = useState<'gallery' | 'table'>('gallery');

  // Search-only filtered set — powers the gallery's faceted filter-chip
  // counters (how many templates WOULD match each format/scope), kept
  // independent from `activeFilters` so a chip's own count isn't distorted
  // by the very filter it represents.
  const searchFilteredTemplates = useMemo(() => {
    if (!searchQuery) return templates;
    const q = searchQuery.toLowerCase();
    return templates.filter(
      (item) =>
        item.title.toLowerCase().includes(q) || (item.description || '').toLowerCase().includes(q)
    );
  }, [templates, searchQuery]);

  const filteredData = useMemo(() => {
    let data = searchFilteredTemplates;
    for (const f of activeFilters) {
      if (f.column === 'type') data = data.filter((item) => item.type === f.value);
      if (f.column === 'category') data = data.filter((item) => item.category === f.value);
      if (f.column === 'scope') data = data.filter((item) => item.scope === f.value);
      if (f.column === 'status') data = data.filter((item) => item.status === f.value);
    }
    return data;
  }, [searchFilteredTemplates, activeFilters]);

  // Etykieta zakresu wg kanonu materials.ts (system|organization|personal|unknown).
  // Legacy 'application' zostaje obsłużone dla wpisów sprzed migracji.
  const scopeLabel = useCallback(
    (scope: TemplateItem['scope']): string => {
      if (scope === 'personal') return t('reports.personal');
      if (scope === 'system' || scope === 'application') return t('reports.application');
      if (scope === 'organization') return t('reports.organization');
      return t('rap.templates.scopeUnknown', 'Nieznany');
    },
    [t]
  );

  // ★ Jedno miejsce, w którym wiersz biblioteki zamienia się w trasę użycia —
  // z JAWNYM rozdziałem id indeksu i kanonicznego id szablonu. `null` = wzorca
  // nie da się uczciwie użyć (sierota / brak kanonicznego rekordu dokumentu).
  const resolveUsePath = useCallback(
    (row: TemplateItem): string | null =>
      resolveTemplateUsePath({
        artifactIndexId: row.artifactIndexId ?? row.id,
        templateType: row.type,
        canonicalTemplateId: row.canonicalTemplateId,
        originRuntime: row.originRuntime,
        orphaned: row.orphaned,
      }),
    []
  );

  const columns: StandardTableColumn[] = useMemo(
    () => [
      {
        id: 'title',
        label: t('rap.columns.name', 'Nazwa'),
        width: '280px',
        render: (row: TemplateItem) => (
          <div className="flex items-center gap-2 min-w-0">
            {row.type === 'report' ? (
              <FileText size={14} className="text-c-text-muted shrink-0" />
            ) : row.type === 'sheet' ? (
              <FileSpreadsheet size={14} className="text-c-text-muted shrink-0" />
            ) : (
              <Presentation size={14} className="text-c-text-muted shrink-0" />
            )}
            <span
              className={`text-sm font-medium truncate ${
                row.orphaned ? 'text-c-text-muted' : 'text-c-text'
              }`}
            >
              {row.title}
            </span>
            {/* Legacy (report_builder_templates) — dyskretne, neutralne oznaczenie:
                wzorzec zostaje widoczny i użyteczny, ale jawnie opisany. Zero crimson. */}
            {row.source === 'legacy' || row.legacy ? (
              <span
                data-testid="template-legacy-badge"
                title={t(
                  'rap.templates.legacyHint',
                  'Wzorzec ze starszego rejestru wzorców — generacja działa bez zmian.'
                )}
                className="shrink-0 rounded border border-c-border px-1.5 py-px text-[10px] font-medium uppercase tracking-wide text-c-text-muted"
              >
                {t('rap.templates.legacyBadge', 'Legacy')}
              </span>
            ) : null}
            {/* Osierocony wpis: kanoniczny rekord szablonu nie istnieje — mówimy to
                wprost zamiast oferować akcję, która i tak nie zadziała. */}
            {row.orphaned ? (
              <span
                data-testid="template-orphaned-badge"
                title={t(
                  'rap.templates.orphanedHint',
                  'Brak kanonicznego rekordu wzorca — nie można go użyć do generacji.'
                )}
                className="inline-flex shrink-0 items-center gap-1 rounded border border-c-border bg-c-surface-raised px-1.5 py-px text-[10px] font-medium text-c-text-muted"
              >
                <AlertTriangle size={10} />
                {t('rap.templates.orphanedBadge', 'Brak źródła')}
              </span>
            ) : null}
          </div>
        ),
      },
      {
        id: 'type',
        label: t('rap.columns.type', 'Typ'),
        width: '130px',
        filterable: true,
        filterOptions: [
          { value: 'report', label: t('reports.report'), color: 'bg-blue-400' },
          { value: 'sheet', label: t('reports.sheet'), color: 'bg-emerald-400' },
          {
            value: 'presentation',
            label: t('reports.presentation'),
            color: 'bg-blue-400',
          },
        ],
        render: (row: TemplateItem) => {
          const meta = TEMPLATE_TYPE_META[row.type];
          return (
            <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-c-surface-raised">
              <span className={`w-2 h-2 rounded-full ${meta.dotColor}`} />
              <span className="text-xs font-medium text-c-text-secondary">
                {isPolish ? meta.labelPl : meta.label}
              </span>
            </div>
          );
        },
      },
      {
        id: 'category',
        label: t('rap.columns.category', 'Kategoria'),
        width: '160px',
        filterable: true,
        filterOptions: [
          { value: 'R1', label: 'R1 — Weekly', color: 'bg-blue-400' },
          { value: 'R2', label: 'R2 — Steering', color: 'bg-blue-400' },
          { value: 'R3', label: 'R3 — Benefits', color: 'bg-emerald-400' },
          { value: 'R4', label: 'R4 — Portfolio', color: 'bg-amber-400' },
          { value: 'executive_update', label: 'Executive Update' },
          { value: 'assessment_results', label: 'Assessment Results' },
          { value: 'project_kickoff', label: 'Project Kickoff' },
          { value: 'financial_review', label: 'Financial Review' },
          { value: 'initiative_review', label: 'Initiative Review' },
          { value: 'custom', label: 'Custom' },
        ],
        render: (row: TemplateItem) => (
          <span className="text-sm text-c-text-secondary">{row.category}</span>
        ),
      },
      {
        id: 'scope',
        label: t('rap.columns.scope', 'Zakres'),
        width: '140px',
        filterable: true,
        filterOptions: [
          { value: 'personal', label: t('reports.personal') },
          { value: 'system', label: t('reports.application') },
          { value: 'organization', label: t('reports.organization') },
          { value: 'unknown', label: t('rap.templates.scopeUnknown', 'Nieznany') },
        ],
        render: (row: TemplateItem) => (
          <span className="text-sm text-c-text-secondary">{scopeLabel(row.scope)}</span>
        ),
      },
      {
        id: 'status',
        label: t('rap.columns.status', 'Status'),
        width: '120px',
        filterable: true,
        filterOptions: [
          {
            value: 'approved',
            label: t('rap.templates.statusApproved', 'Zatwierdzony'),
            color: 'bg-emerald-400',
          },
          {
            value: 'published',
            label: t('rap.templates.statusPublished', 'Opublikowany'),
            color: 'bg-emerald-400',
          },
          { value: 'draft', label: t('reports.draft'), color: 'bg-slate-400' },
          {
            value: 'deprecated',
            label: t('reports.deprecated'),
            color: 'bg-amber-500',
          },
          {
            value: 'unknown',
            label: t('rap.templates.statusUnknown', 'Nieznany'),
            color: 'bg-slate-500',
          },
        ],
        render: (row: TemplateItem) => {
          const meta = TEMPLATE_STATUS_META[row.status] || TEMPLATE_STATUS_META.unknown;
          return <StatusChip label={isPolish ? meta.labelPl : meta.label} tone={meta.tone} />;
        },
      },
      {
        id: 'updatedAt',
        label: t('rap.columns.updatedAt', 'Ostatnia zmiana'),
        width: '150px',
        sortable: true,
        sortAccessor: (row: Record<string, unknown>) => {
          const raw = (row as unknown as TemplateItem).updatedAt;
          return raw ? new Date(raw).getTime() : 0;
        },
        render: (row: TemplateItem) => {
          // Brak daty pokazujemy wprost („—"), zamiast malować dzisiejszą datę.
          if (!row.updatedAt) {
            return <span className="text-sm text-c-text-muted">—</span>;
          }
          const d = new Date(row.updatedAt);
          if (Number.isNaN(d.getTime())) {
            return <span className="text-sm text-c-text-muted">—</span>;
          }
          return (
            <span className="text-sm text-c-text-muted">
              {d.toLocaleDateString(isPolish ? 'pl-PL' : 'en-US', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })}
            </span>
          );
        },
      },
    ],
    [t, isPolish, scopeLabel]
  );

  // Triada standard (canon A6 / ANEKS #4): moduł deklaruje TYLKO bloki 1-3;
  // StandardTable sam dokłada blok 4 (Open preview · Edit · Archive) i blok 5
  // (Delete — brak API kasowania wzorca, więc disabled z notą "Coming soon
  // (backend)", automatycznie przez StandardTable, NIE ukryte).
  const buildRowMenu = (row: TemplateItem): StandardRowMenu => ({
    primary: [
      // ★ Wpis osierocony / bez kanonicznego rekordu NIE jest oferowany jako
      // gotowy do użycia — pozycja disabled z jawnym powodem, zamiast trasy,
      // która po kliknięciu i tak nie miałaby czego wygenerować.
      (() => {
        const usePath = resolveUsePath(row);
        const isDeprecated = String(row.status).toLowerCase() === 'deprecated';
        return {
          id: 'use',
          label: t('rap.actions.useTemplate', 'Użyj wzorca'),
          icon: Play,
          disabled: !usePath || isDeprecated,
          note: isDeprecated
            ? t('rap.templates.deprecatedUseBlocked', 'Wycofany wzorzec nie może być użyty.')
            : usePath
              ? undefined
              : t(
                  'rap.templates.useBlocked',
                  'Brak kanonicznego rekordu wzorca — nie ma czego użyć.'
                ),
          onClick: usePath && !isDeprecated ? () => navigate(usePath) : undefined,
        };
      })(),
      {
        id: 'clone',
        label: t('rap.actions.clone', 'Klonuj'),
        icon: Copy,
        onClick: () => navigate(resolveTemplateClonePath(row.id, row.type)),
      },
      {
        id: 'ask_ai',
        label: t('rap.actions.askAI', 'Zapytaj AI'),
        icon: MessageSquare,
        onClick: () => {
          openChat({
            entityType: 'template',
            entityId: row.id,
            entityName: row.title,
            contextData: {
              templateType: row.type,
              category: row.category,
              scope: row.scope,
              status: row.status,
              description: row.description,
            },
          });
        },
      },
      ...(row.status === 'draft' && row.scope === 'organization'
        ? [
            {
              id: 'submit_review',
              label: t('rap.actions.submitTemplateReview', 'Submit for review'),
              icon: BookTemplate,
              disabled: submitBusyId === row.id,
              onClick: () => {
                setSubmitBusyId(row.id);
                void (async () => {
                  try {
                    if (actions?.startArtifactReview) {
                      await actions.startArtifactReview(row.id);
                    }
                    onRefresh?.();
                  } finally {
                    setSubmitBusyId(null);
                  }
                })();
              },
            },
          ]
        : []),
    ],
    universalHandlers: {
      preview: () => setSelectedId(row.id),
      edit: () => navigate(resolveTemplateEditPath(row.id, row.type, row.canonicalTemplateId)),
      // Brak API archiwizacji wzorca — pozycja disabled z notą (StandardTable dokłada ją sama).
    },
    // Brak API kasowania wzorca — blok 5 disabled z notą (StandardTable dokłada ją sama).
  });

  useEffect(() => {
    if (!initialArtifactId || deepLinkConsumed.current || filteredData.length === 0) return;
    // ★ Deep-link celuje w id WIERSZA INDEKSU. Poprzednio porównywano do
    // `r.artifactId` — pola, którego mapper nigdy nie ustawia (przechodziło przez
    // indeks sygnaturowy TemplateItem), więc deep-link nigdy nie trafiał.
    const match = filteredData.find(
      (r) => (r.artifactIndexId ?? r.id) === initialArtifactId || r.artifactId === initialArtifactId
    );
    if (match) {
      setSelectedId(match.id);
      deepLinkConsumed.current = true;
    }
  }, [initialArtifactId, filteredData]);

  const selectedItem = selectedId ? filteredData.find((i) => i.id === selectedId) || null : null;

  // Triada standard (canon A7/A8): StandardPreview action grid — row 1
  // rozstrzygnięcia (none — templates have no approve/reject step), row 2
  // informacyjne (Open/Use · Clone · Ask AI).
  const previewActions: StandardPreviewActions | undefined = useMemo(
    () =>
      selectedItem
        ? {
            informational: [
              {
                id: 'use',
                variant: 'neutral',
                label: t('rap.actions.useTemplate', 'Użyj wzorca'),
                icon: Play,
                shortcut: 'O',
                // Sierota → akcja wyłączona (bez cichego fallbacku).
                disabled:
                  !resolveUsePath(selectedItem) ||
                  String(selectedItem.status).toLowerCase() === 'deprecated',
                onClick: () => {
                  const usePath = resolveUsePath(selectedItem);
                  if (usePath) navigate(usePath);
                },
              },
              {
                id: 'clone',
                variant: 'neutral',
                label: t('rap.actions.clone', 'Klonuj'),
                icon: Copy,
                onClick: () =>
                  navigate(resolveTemplateClonePath(selectedItem.id, selectedItem.type)),
              },
              {
                id: 'ask_ai',
                variant: 'neutral',
                label: t('rap.actions.askAI', 'Zapytaj AI'),
                icon: MessageSquare,
                onClick: () => {
                  openChat({
                    entityType: 'template',
                    entityId: selectedItem.id,
                    entityName: selectedItem.title,
                    contextData: {
                      templateType: selectedItem.type,
                      category: selectedItem.category,
                      scope: selectedItem.scope,
                      status: selectedItem.status,
                      description: selectedItem.description,
                    },
                  });
                },
              },
            ],
          }
        : undefined,
    [selectedItem, t, navigate, openChat, resolveUsePath]
  );

  // Esc closes preview; single-key shortcut (O) active while preview open (kanon B.24/B.31).
  useEffect(() => {
    if (viewMode !== 'table' || !selectedId) return;
    const shortcuts = standardPreviewShortcuts(previewActions);
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isTyping =
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
      if (isTyping) return;
      if (e.key === 'Escape') {
        setSelectedId(null);
        return;
      }
      const handlerFn = shortcuts[e.key.toUpperCase()];
      if (handlerFn) {
        e.preventDefault();
        handlerFn();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectedId, previewActions]);

  if (loading) {
    return <LoadingState variant="spinner" className="h-64" />;
  }

  if (error && templates.length === 0 && !searchQuery && activeFilters.length === 0) {
    // Canonical failed-load state — shared `EmptyState variant="error"` owns the
    // icon, the assertive live region and the "Try again" affordance
    // (docs/ui-standards/02-components/empty-loading-states.md §2). The former
    // bespoke amber card had no retry control at all despite its own copy
    // telling the user to retry. Message + operator hint are preserved verbatim.
    return (
      <EmptyState
        variant="error"
        title={t('rap.errors.realTemplatesTitle', 'Real templates source needs attention')}
        description={[
          error,
          t(
            'rap.errors.realSourceHint',
            'No synthetic demo fallback was injected. Verify active DB, organization scope, and data-context before retrying.'
          ),
        ]
          .filter(Boolean)
          .join(' ')}
        // `onRefresh` is optional on this tab; when it is absent `onRetry` is
        // undefined and `EmptyState` renders no button — never a no-op control.
        onRetry={onRefresh}
      />
    );
  }

  if (!error && templates.length === 0 && !searchQuery && activeFilters.length === 0) {
    const families = [
      {
        key: 'executive_steering',
        title: t('reports.executiveSteering'),
        desc: t('reports.governanceReportsAndSteeringCommitteePre'),
        categories: ['R2', 'executive_update'],
      },
      {
        key: 'transformation_status',
        title: t('reports.transformationStatus'),
        desc: t('reports.weeklyStatusReportsAndProgressReviews'),
        categories: ['R1', 'R4'],
      },
      {
        key: 'diagnostic_assessment',
        title: t('reports.diagnosticAssessment'),
        desc: t('reports.diagnosticReportsAuditFindingsAndMaturit'),
        categories: ['R3', 'assessment_results'],
      },
    ];

    return (
      <div className="flex flex-col items-center justify-center h-full p-8 max-w-2xl mx-auto">
        <BookTemplate size={40} className="text-c-text-muted mb-4" />
        <h3 className="text-lg font-semibold text-c-text mb-1">
          {t('rap.empty.templatesOnboarding', 'Biblioteka wzorców')}
        </h3>
        <p className="text-sm text-c-text-muted text-center mb-6">
          {t(
            'rap.empty.templatesOnboardingDesc',
            'Wzorce (templates) definiują strukturę i standard raportów oraz prezentacji. Zacznij od jednej z kanonicznych rodzin lub utwórz własny wzorzec.'
          )}
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full">
          {families.map((f) => (
            <div
              key={f.key}
              className="rounded-xl border border-slate-200/60 dark:border-white/[0.03] bg-c-surface p-4"
            >
              <h4 className="text-sm font-semibold text-c-text">{f.title}</h4>
              <p className="text-xs text-c-text-muted mt-1">{f.desc}</p>
              <div className="flex gap-1 mt-2">
                {f.categories.map((c) => (
                  <span
                    key={c}
                    className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-c-surface-raised text-c-text-secondary"
                  >
                    {c}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (viewMode === 'grid') {
    const gridStatusMap: Record<string, string> = {
      approved: 'READY',
      published: 'READY',
      active: 'READY',
      draft: 'DRAFT',
      deprecated: 'ARCHIVED',
      archived: 'ARCHIVED',
      unknown: 'DRAFT',
    };

    const gridItems: GridItem[] = filteredData.map((item) => ({
      id: item.id,
      name: item.title,
      type: isPolish ? TEMPLATE_TYPE_META[item.type].labelPl : TEMPLATE_TYPE_META[item.type].label,
      typeColor:
        item.type === 'report' ? 'operational' : item.type === 'sheet' ? 'financial' : 'digital',
      status: gridStatusMap[item.status] || 'DRAFT',
      progress: 0,
      updatedAt: item.updatedAt ?? '',
      description: item.description,
      category: item.category,
      scope: item.scope,
    }));

    return (
      <GridView
        items={gridItems}
        selectedItemId={selectedId}
        onItemClick={(item) => setSelectedId(item.id)}
        onItemAction={(actionId, item) => {
          const tpl = filteredData.find((t) => t.id === item.id);
          if (!tpl) return;
          if (actionId === 'open') {
            const usePath = resolveUsePath(tpl);
            if (usePath) navigate(usePath);
          }
          if (actionId === 'duplicate') navigate(resolveTemplateClonePath(tpl.id, tpl.type));
          if (actionId === 'edit')
            navigate(resolveTemplateEditPath(tpl.id, tpl.type, tpl.canonicalTemplateId));
        }}
        emptyMessage={t('rap.empty.templates', 'Brak wzorców')}
        newItemLabel={t('rap.actions.newTemplate', 'Nowy wzorzec')}
      />
    );
  }

  // Triada standard (docs/ui-standards/TRIADA_KANON.md A4-A7): templates
  // table view → StandardTable + StandardPreview, 1:1 with the Assessment
  // 'list' / Interview Inbox / Results KPI catalog adopters.
  const typeMeta = selectedItem ? TEMPLATE_TYPE_META[selectedItem.type] : null;
  const statusMeta = selectedItem
    ? TEMPLATE_STATUS_META[selectedItem.status] || TEMPLATE_STATUS_META.unknown
    : null;

  // ★ N4: factored so the flag-OFF path below stays a byte-identical
  // `<StandardTable>` — the only thing an ON flag does is choose between
  // this same element and the gallery inside an extra toggle wrapper.
  const tableView = (
    <StandardTable
      columns={columns}
      data={filteredData as unknown as Array<Record<string, unknown> & { id: string }>}
      selectedRowId={selectedId}
      onRowClick={(row) => setSelectedId(String((row as unknown as TemplateItem).id))}
      onRowDoubleClick={(row) => {
        const item = row as unknown as TemplateItem;
        const usePath = resolveUsePath(item);
        if (usePath) navigate(usePath);
      }}
      rowDescription={(row) => (row as unknown as TemplateItem).description ?? null}
      defaultSort={{ columnId: 'updatedAt', direction: 'desc' }}
      persistKey="rap.templates.list"
      selection={{ selectedIds, onChange: setSelectedIds }}
      empty={{
        icon: BookTemplate,
        title: t('rap.empty.templates', 'Brak wzorców'),
        description: t(
          'rap.empty.templatesOnboardingDesc',
          'Wzorce (templates) definiują strukturę i standard raportów oraz prezentacji. Zacznij od jednej z kanonicznych rodzin lub utwórz własny wzorzec.'
        ),
      }}
      rowMenu={(row) => buildRowMenu(row as unknown as TemplateItem)}
    />
  );

  const galleryView = (
    <TemplatesGalleryView
      templates={filteredData}
      searchFilteredTemplates={searchFilteredTemplates}
      activeFilters={activeFilters}
      onFilterChange={onFilterChange}
      scopeLabel={scopeLabel}
      resolveUsePath={resolveUsePath}
      onUse={(item) => {
        const usePath = resolveUsePath(item);
        if (usePath) navigate(usePath);
      }}
      onPreview={(item) => setSelectedId(item.id)}
    />
  );

  const previewAside = selectedItem ? (
    <aside className="w-[400px] shrink-0 bg-slate-50 dark:bg-navy-950 p-3 overflow-hidden">
      <StandardPreview
        title={selectedItem.title}
        onClose={() => setSelectedId(null)}
        onOpenFull={() => {
          const usePath = resolveUsePath(selectedItem);
          if (usePath) navigate(usePath);
        }}
        openLabel={t('rap.actions.useTemplate', 'Użyj wzorca')}
        meta={{
          pills: [
            ...(typeMeta
              ? [
                  {
                    label: isPolish ? typeMeta.labelPl : typeMeta.label,
                    tone: 'neutral' as const,
                  },
                ]
              : []),
            ...(statusMeta
              ? [
                  {
                    label: isPolish ? statusMeta.labelPl : statusMeta.label,
                    tone: statusMeta.tone,
                  },
                ]
              : []),
          ] as MetaPill[],
          trailing: (
            <span className="text-[11px] font-semibold text-c-text-secondary">
              {selectedItem.updatedAt && !Number.isNaN(new Date(selectedItem.updatedAt).getTime())
                ? new Date(selectedItem.updatedAt).toLocaleDateString(
                    isPolish ? 'pl-PL' : 'en-US',
                    {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    }
                  )
                : '—'}
            </span>
          ),
        }}
        details={{
          text: [
            `${t('rap.preview.scope', 'Zakres')}: ${scopeLabel(selectedItem.scope)}`,
            // FALA 1 / „surowe identyfikatory w UI" (2026-07-27): tu wisiała
            // NAZWA TABELI BAZY DANYCH („Legacy (report_builder_templates)").
            // Użytkownik ma wiedzieć, co to dla niego znaczy — nie gdzie
            // rekord leży w bazie.
            ...(selectedItem.source === 'legacy' || selectedItem.legacy
              ? [
                  `${t('rap.preview.source', 'Źródło')}: ${t(
                    'rap.templates.legacySourceLine',
                    'Starszy rejestr wzorców — działa bez zmian'
                  )}`,
                ]
              : []),
            ...(selectedItem.orphaned
              ? [
                  t(
                    'rap.templates.orphanedHint',
                    'Brak kanonicznego rekordu wzorca — nie można go użyć do generacji.'
                  ),
                ]
              : []),
            `${t('rap.preview.category', 'Kategoria')}: ${selectedItem.category}`,
            ...(selectedItem.sectionCount != null
              ? [`${t('rap.preview.sections', 'Sekcje')}: ${selectedItem.sectionCount}`]
              : []),
            ...(selectedItem.slideCount != null
              ? [`${t('rap.preview.slides', 'Slajdy')}: ${selectedItem.slideCount}`]
              : []),
            '',
            selectedItem.description?.trim() || t('common.noDescription', 'No description'),
          ].join('\n'),
          onCopy: () => {
            void navigator.clipboard?.writeText(
              `${selectedItem.title} — ${selectedItem.category} (${selectedItem.status})`
            );
          },
        }}
        ai={{
          hints: [
            t('rap.preview.ai.improve', 'Suggest improvements'),
            t('rap.preview.ai.summary', 'Summarize sections'),
          ],
          disabled: true,
          disabledTooltip: t('common.comingSoon', 'Coming soon'),
        }}
        relations={
          selectedItem.replacedByArtifactId
            ? [
                {
                  label: `${t('rap.preview.replacedBy', 'Nowy wzorzec')}: ${selectedItem.replacedByArtifactId.slice(0, 8)}…`,
                },
              ]
            : []
        }
        actions={previewActions}
      />
    </aside>
  ) : null;

  // ── Galeria ↔ Tabela (flag ON only) ──────────────────────────────────
  if (galleryEnabled) {
    return (
      <div className="h-full flex flex-col overflow-hidden">
        <div
          data-testid="templates-gallery-toolbar"
          className="shrink-0 flex flex-wrap items-center justify-end gap-2 border-b border-c-border-subtle bg-c-surface px-4 py-2"
        >
          <div
            data-testid="templates-gallery-view-toggle"
            className="flex shrink-0 items-center gap-1 rounded-token-sm border border-c-border bg-c-surface p-0.5"
          >
            {(
              [
                ['gallery', LayoutGrid, t('rap.templates.viewGallery', 'Galeria')],
                ['table', Table2, t('rap.templates.viewTable', 'Tabela')],
              ] as const
            ).map(([id, Icon, label]) => (
              <button
                key={id}
                type="button"
                data-testid={`templates-gallery-view-toggle-${id}`}
                onClick={() => setInnerView(id)}
                aria-pressed={innerView === id}
                className={`inline-flex h-7 items-center gap-1.5 rounded-token-xs px-2.5 text-[11px] font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus ${
                  innerView === id
                    ? 'bg-c-surface-raised text-c-text shadow-token-card'
                    : 'text-c-text-muted hover:text-c-text'
                }`}
              >
                <Icon size={13} />
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex-1 min-w-0 flex overflow-hidden">
          <div className="flex-1 min-w-0 overflow-auto pl-4 pr-1.5 pt-3 pb-4">
            {innerView === 'gallery' ? galleryView : tableView}
          </div>
          {previewAside}
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex overflow-hidden">
      <div className="flex-1 min-w-0 overflow-auto pl-4 pr-1.5 pt-3 pb-4">{tableView}</div>
      {previewAside}
    </div>
  );
};
