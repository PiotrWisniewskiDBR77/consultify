/**
 * TemplatesTabContent — "Biblioteka wzorców" tab
 * Golden standard: FilterableTable (6 columns) + GridView cards + Preview pane
 * Canonical source: /api/artifacts?artifactFamily=template (P24 Outputs artifacts)
 */

import {
  Archive,
  BookTemplate,
  ChevronRight,
  Copy,
  Edit,
  FileSpreadsheet,
  FileText,
  MessageSquare,
  Play,
  Presentation,
} from 'lucide-react';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { LoadingState, StatusChip } from '@/components/ui/primitives';

import { useOpenChatWithContext } from '../../hooks/useOpenChatWithContext';
import {
  FilterableTable,
  type FilterChip,
  type GridItem,
  GridView,
  type TableColumn,
  type ViewMode,
} from '../shared/ModuleHub';
import type { RowAction } from '../shared/RowActionsMenu';
import { TableWithPreviewLayout } from '../shared/TableWithPreviewLayout';
import {
  resolveTemplateClonePath,
  resolveTemplateEditPath,
  resolveTemplateUsePath,
} from './artifactNavigation';
import { TemplatePreviewBody, TemplatePreviewFooter } from './previews/TemplatePreview';
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
  const deepLinkConsumed = useRef(false);

  const filteredData = useMemo(() => {
    let data = templates;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      data = data.filter(
        (item) =>
          item.title.toLowerCase().includes(q) || (item.description || '').toLowerCase().includes(q)
      );
    }
    for (const f of activeFilters) {
      if (f.column === 'type') data = data.filter((item) => item.type === f.value);
      if (f.column === 'category') data = data.filter((item) => item.category === f.value);
      if (f.column === 'scope') data = data.filter((item) => item.scope === f.value);
      if (f.column === 'status') data = data.filter((item) => item.status === f.value);
    }
    return data;
  }, [templates, searchQuery, activeFilters]);

  const columns: TableColumn[] = useMemo(
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
            <span className="text-sm font-medium text-c-text truncate">
              {row.title}
            </span>
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
          { value: 'application', label: t('reports.application') },
          { value: 'organization', label: t('reports.organization') },
        ],
        render: (row: TemplateItem) => (
          <span className="text-sm text-c-text-secondary">
            {row.scope === 'application'
              ? t('reports.application')
              : row.scope === 'personal'
                ? t('reports.personal')
                : t('reports.organization')}
          </span>
        ),
      },
      {
        id: 'status',
        label: t('rap.columns.status', 'Status'),
        width: '120px',
        filterable: true,
        filterOptions: [
          { value: 'active', label: t('reports.active'), color: 'bg-emerald-400' },
          { value: 'draft', label: t('reports.draft'), color: 'bg-slate-400' },
          {
            value: 'deprecated',
            label: t('reports.deprecated'),
            color: 'bg-amber-500',
          },
          {
            value: 'archived',
            label: t('reports.archived'),
            color: 'bg-slate-500',
          },
        ],
        render: (row: TemplateItem) => {
          const meta = TEMPLATE_STATUS_META[row.status] || TEMPLATE_STATUS_META.active;
          return <StatusChip label={isPolish ? meta.labelPl : meta.label} tone={meta.tone} />;
        },
      },
      {
        id: 'updatedAt',
        label: t('rap.columns.updatedAt', 'Ostatnia zmiana'),
        width: '150px',
        sortable: true,
        render: (row: TemplateItem) => {
          const d = new Date(row.updatedAt);
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
    [t, isPolish]
  );

  const getRowActions = (row: TemplateItem): RowAction[] => [
    // canon §9.2 FIXED BOTTOM MANIFEST position 1
    {
      id: 'open_preview',
      label: t('rap.actions.openPreview', 'Otwórz podgląd'),
      icon: ChevronRight,
      onClick: () => setSelectedId(row.id),
    },
    {
      id: 'use',
      label: t('rap.actions.useTemplate', 'Użyj wzorca'),
      icon: Play,
      variant: 'primary',
      onClick: () => navigate(resolveTemplateUsePath(row.id, row.type)),
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
      ? ([
          {
            id: 'submit_review',
            label: t('rap.actions.submitTemplateReview', 'Submit for review'),
            icon: BookTemplate,
            variant: 'primary',
            disabled: submitBusyId === row.id,
            onClick: async () => {
              setSubmitBusyId(row.id);
              try {
                if (actions?.startArtifactReview) {
                  await actions.startArtifactReview(row.id);
                }
                onRefresh?.();
              } finally {
                setSubmitBusyId(null);
              }
            },
          } as RowAction,
        ] as RowAction[])
      : []),
    {
      id: 'clone',
      label: t('rap.actions.clone', 'Klonuj'),
      icon: Copy,
      onClick: () => navigate(resolveTemplateClonePath(row.id, row.type)),
    },
    {
      id: 'edit',
      label: t('rap.actions.edit', 'Edytuj'),
      icon: Edit,
      onClick: () => navigate(resolveTemplateEditPath(row.id, row.type)),
    },
    {
      // canon §14 + §9.2: Archive slot — soft-delete placeholder (backend TBD)
      id: 'archive',
      label: t('rap.actions.archive', 'Archiwizuj'),
      icon: Archive,
      divider: true,
      disabled: true,
      description: 'Wkrótce',
      onClick: () => {},
    },
  ];

  useEffect(() => {
    if (!initialArtifactId || deepLinkConsumed.current || filteredData.length === 0) return;
    const match = filteredData.find((r) => r.artifactId === initialArtifactId);
    if (match) {
      setSelectedId(match.id);
      deepLinkConsumed.current = true;
    }
  }, [initialArtifactId, filteredData]);

  const selectedItem = selectedId ? filteredData.find((i) => i.id === selectedId) || null : null;
  const previewItem = selectedItem ? { ...selectedItem, title: selectedItem.title } : null;
  const itemIds = filteredData.map((i) => i.id);

  if (loading) {
    return <LoadingState variant="spinner" className="h-64" />;
  }

  if (error && templates.length === 0 && !searchQuery && activeFilters.length === 0) {
    return (
      <div className="flex items-center justify-center h-full p-6">
        <div className="w-full max-w-3xl rounded-2xl border border-amber-200/70 dark:border-amber-400/20 bg-amber-50/80 dark:bg-amber-500/10 p-6">
          <div className="text-lg font-semibold text-c-text">
            {t('rap.errors.realTemplatesTitle', 'Real templates source needs attention')}
          </div>
          <div className="mt-2 text-sm text-c-text-secondary">{error}</div>
          <div className="mt-4 text-xs uppercase tracking-wide text-c-text-muted">
            {t(
              'rap.errors.realSourceHint',
              'No synthetic demo fallback was injected. Verify active DB, organization scope, and data-context before retrying.'
            )}
          </div>
        </div>
      </div>
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
              className="rounded-xl border border-c-border-subtle bg-c-surface p-4"
            >
              <h4 className="text-sm font-semibold text-c-text">
                {f.title}
              </h4>
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
      active: 'READY',
      draft: 'DRAFT',
      deprecated: 'ARCHIVED',
      archived: 'ARCHIVED',
    };

    const gridItems: GridItem[] = filteredData.map((item) => ({
      id: item.id,
      name: item.title,
      type: isPolish ? TEMPLATE_TYPE_META[item.type].labelPl : TEMPLATE_TYPE_META[item.type].label,
      typeColor:
        item.type === 'report' ? 'operational' : item.type === 'sheet' ? 'financial' : 'digital',
      status: gridStatusMap[item.status] || 'DRAFT',
      progress: 0,
      updatedAt: item.updatedAt,
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
          if (actionId === 'open') navigate(resolveTemplateUsePath(tpl.id, tpl.type));
          if (actionId === 'duplicate') navigate(resolveTemplateClonePath(tpl.id, tpl.type));
          if (actionId === 'edit') navigate(resolveTemplateEditPath(tpl.id, tpl.type));
        }}
        emptyMessage={t('rap.empty.templates', 'Brak wzorców')}
        newItemLabel={t('rap.actions.newTemplate', 'Nowy wzorzec')}
      />
    );
  }

  return (
    <div className="h-full overflow-hidden">
      <TableWithPreviewLayout<TemplateItem & { title: string }>
        selectedId={selectedId}
        selectedItem={previewItem}
        onSelect={setSelectedId}
        onOpenFull={(id) => {
          const row = filteredData.find((x) => x.id === id);
          if (row) navigate(resolveTemplateUsePath(row.id, row.type));
        }}
        itemIds={itemIds}
        getItemById={(id) => filteredData.find((x) => x.id === id) ?? null}
        renderPreview={(item) => <TemplatePreviewBody template={item} />}
        renderPreviewFooter={(item) => <TemplatePreviewFooter template={item} />}
      >
        <FilterableTable
          columns={columns}
          data={filteredData}
          selectedRowId={selectedId}
          onRowClick={(row) => setSelectedId(row.id)}
          onRowDoubleClick={(row) => {
            const item = row as unknown as TemplateItem;
            navigate(resolveTemplateUsePath(item.id, item.type));
          }}
          getRowActions={(row) => getRowActions(row as unknown as TemplateItem)}
          activeFilters={activeFilters}
          onFilterChange={onFilterChange}
          emptyMessage={t('rap.empty.templates', 'Brak wzorców')}
          canvasClassName="pl-4 pr-1.5 pt-3 pb-4"
        />
      </TableWithPreviewLayout>
    </div>
  );
};
