/**
 * TemplatesManager
 *
 * Full CRUD management for Report Builder templates.
 * Lista encji Template — kanon TRIADA: StandardModuleBar + StandardTable +
 * StandardPreview (SSOT: docs/ui-standards/03-modules/TABLE_AND_PREVIEW_CANON.md,
 * Harvard/wdrozenie-100/_STANDARD_TRIADA_NOTATKA.md). Moduł deklaruje wyłącznie
 * dane + akcje; chrome (menu/tabela/preview) pochodzi z fasad standard/*.
 * Template Editor pozostaje pełnoekranowym modalem (poza zakresem kanonu list).
 */

import { AnimatePresence, motion } from 'framer-motion';
import { Building2, Calendar, Copy, FileText, Play, Plus, Trash2, User } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import toast from 'react-hot-toast';

import {
  StandardModuleBar,
  StandardPreview,
  type StandardPreviewActions,
  type StandardRowMenu,
  StandardTable,
  type TableColumn,
  type TableRow,
} from '@/components/standard';
import { JedenPrawyPanel } from '@/components/shared/PreviewPane/JedenPrawyPanel';
import { useJedenPanel } from '@/components/shared/PreviewPane/useJedenPanel';

import { Api } from '../../services/api';
import { ReportEditor } from './ReportEditor/ReportEditor';

// ==========================================
// TYPES
// ==========================================

interface TemplateSection {
  key: string;
  type: string;
  title: string;
  required: boolean;
  order: number;
}

interface Template {
  id: string;
  name: string;
  description?: string;
  sourceType: string;
  reportType?: string;
  isSystem: boolean;
  isDefault: boolean;
  isPublic: boolean;
  sections: TemplateSection[];
  createdAt?: string;
  updatedAt?: string;
  // User & Audience
  createdById?: string;
  createdByName?: string;
  audience?: string; // 'executive' | 'manager' | 'analyst' | 'team' | 'external'
}

interface TemplatesManagerProps {
  embedded?: boolean;
  autoOpenNewTemplate?: boolean;
  onUseTemplate?: (templateId: string) => void;
}

// ==========================================
// i18n — prefix reportBuilder.templatesManager
// ==========================================

const NS = 'reportBuilder.templatesManager';

const getTypeLabel = (t: TFunction, isSystem: boolean): string =>
  isSystem ? t(`${NS}.type.app`, 'App') : t(`${NS}.type.org`, 'Org');

const getSourceTypeLabel = (t: TFunction, sourceType: string): string => {
  const key = (sourceType || '').toUpperCase();
  const fallback: Record<string, string> = {
    ASSESSMENT: 'Assessment',
    INTERVIEW: 'Interview',
    TOOL: 'Tool',
    INITIATIVE: 'Initiative',
  };
  if (!key || !fallback[key]) return sourceType || '—';
  return t(`${NS}.sourceType.${key}`, fallback[key]);
};

const getAudienceLabel = (t: TFunction, audience?: string): string => {
  const key = (audience || '').toLowerCase();
  const fallback: Record<string, string> = {
    executive: 'Executive',
    manager: 'Manager',
    analyst: 'Analyst',
    team: 'Team',
    external: 'External',
  };
  if (!key || !fallback[key]) return t(`${NS}.audience.general`, 'General');
  return t(`${NS}.audience.${key}`, fallback[key]);
};

const getFormatLabel = (t: TFunction, format?: string): string => {
  const key = (format || 'vertical').toLowerCase();
  return key === 'horizontal'
    ? t(`${NS}.format.horizontal`, 'Horizontal')
    : t(`${NS}.format.vertical`, 'Vertical');
};

// ==========================================
// FILTER OPTION VALUES (nie tłumaczone — klucze filtra)
// ==========================================

const SOURCE_TYPE_VALUES = ['ASSESSMENT', 'INTERVIEW', 'TOOL', 'INITIATIVE'];
const AUDIENCE_VALUES = ['executive', 'manager', 'analyst', 'team', 'external'];
const FORMAT_VALUES = ['vertical', 'horizontal'];

// ==========================================
// HELPER FUNCTIONS
// ==========================================

// Identity tone (canon §4.0a): leading dot only, neutral chip shell — never colored fill.
const NEUTRAL_CHIP =
  'inline-flex items-center gap-1.5 rounded-full border border-c-border bg-c-surface-raised px-2 py-0.5 text-[11px] font-medium text-c-text-secondary';

const getTypeBadgeConfig = (t: TFunction, isSystem: boolean) => {
  if (isSystem) {
    return { label: getTypeLabel(t, true), icon: Building2, dot: 'bg-blue-400' };
  }
  return { label: getTypeLabel(t, false), icon: Building2, dot: 'bg-c-text-muted' };
};

const getSourceTypeBadgeConfig = (sourceType: string) => {
  switch (sourceType?.toUpperCase()) {
    case 'ASSESSMENT':
      return { dot: 'bg-blue-400' };
    case 'INTERVIEW':
      return { dot: 'bg-emerald-400' };
    case 'TOOL':
      return { dot: 'bg-amber-400' };
    case 'INITIATIVE':
      return { dot: 'bg-pink-400' };
    default:
      return { dot: 'bg-c-text-muted' };
  }
};

const getAudienceBadgeConfig = (t: TFunction, audience?: string) => {
  switch (audience?.toLowerCase()) {
    case 'executive':
      return { dot: 'bg-c-text-muted', label: getAudienceLabel(t, 'executive') };
    case 'manager':
      return { dot: 'bg-blue-400', label: getAudienceLabel(t, 'manager') };
    case 'analyst':
      return { dot: 'bg-emerald-400', label: getAudienceLabel(t, 'analyst') };
    case 'team':
      return { dot: 'bg-amber-400', label: getAudienceLabel(t, 'team') };
    case 'external':
      return { dot: 'bg-danger-400', label: getAudienceLabel(t, 'external') };
    default:
      return { dot: 'bg-c-text-muted', label: getAudienceLabel(t, undefined) };
  }
};

const TagChip: React.FC<{ label: string; dot?: string }> = ({ label, dot }) => (
  <span className={`${NEUTRAL_CHIP}`}>
    {dot ? (
      <span aria-hidden="true" className={`h-1.5 w-1.5 shrink-0 rounded-full ${dot}`} />
    ) : null}
    {label}
  </span>
);

const formatDate = (t: TFunction, lang: string, dateStr?: string): string => {
  if (!dateStr) return '—';
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return '—';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dateOnly = new Date(date);
  dateOnly.setHours(0, 0, 0, 0);

  const diffDays = Math.ceil((dateOnly.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return t(`${NS}.date.today`, 'Today');
  if (diffDays === -1) return t(`${NS}.date.yesterday`, 'Yesterday');
  if (diffDays > -7 && diffDays < 0)
    return t(`${NS}.date.daysAgo`, '{{count}}d ago', { count: Math.abs(diffDays) });

  const locale = lang?.startsWith('pl') ? 'pl-PL' : 'en-US';
  return date.toLocaleDateString(locale, { month: 'short', day: 'numeric' });
};

// ==========================================
// MAIN COMPONENT
// ==========================================

export const TemplatesManager: React.FC<TemplatesManagerProps> = ({
  autoOpenNewTemplate,
  onUseTemplate,
}) => {
  const { t, i18n } = useTranslation();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showEditor, setShowEditor] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [filter, setFilter] = useState<'all' | 'app' | 'org'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  // DEC-397b (1.1-K6): klik wiersza / kebab „Podgląd" po zamknięciu panelu
  // (X) mają go ponownie otworzyć — patrz InboxContent.tsx (K5, 2f5161f3b4).
  const jedenPanel = useJedenPanel();
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [activeFilters, setActiveFilters] = useState<
    { id: string; column: string; value: string; label: string }[]
  >([]);

  const TYPE_FILTER_OPTIONS = useMemo(
    () => [
      { value: 'app', label: getTypeLabel(t, true) },
      { value: 'org', label: getTypeLabel(t, false) },
    ],
    [t]
  );

  const SOURCE_TYPE_FILTER_OPTIONS = useMemo(
    () => SOURCE_TYPE_VALUES.map((v) => ({ value: v, label: getSourceTypeLabel(t, v) })),
    [t]
  );

  const AUDIENCE_FILTER_OPTIONS = useMemo(
    () => AUDIENCE_VALUES.map((v) => ({ value: v, label: getAudienceLabel(t, v) })),
    [t]
  );

  const FORMAT_FILTER_OPTIONS = useMemo(
    () => FORMAT_VALUES.map((v) => ({ value: v, label: getFormatLabel(t, v) })),
    [t]
  );

  // Fetch templates
  const fetchTemplates = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await Api.get('/report-builder/templates');
      const allTemplates = response?.templates || [];

      const parsed = allTemplates.map((t: any) => {
        // Normalize backend payload (SQLite rows often return snake_case fields)
        const normalized = {
          sourceType: t.sourceType ?? t.source_type,
          reportType: t.reportType ?? t.report_type,
          isSystem: Boolean(t.isSystem ?? t.is_system),
          isDefault: Boolean(t.isDefault ?? t.is_default),
          isPublic: Boolean(t.isPublic ?? t.is_public),
          createdAt: t.createdAt ?? t.created_at,
          updatedAt: t.updatedAt ?? t.updated_at,
          createdById: t.createdById ?? t.created_by ?? t.createdBy,
          createdByName: t.createdByName ?? t.created_by_name ?? t.creatorName,
        };

        const rawSections = Array.isArray(t.sections)
          ? t.sections
          : typeof t.sections === 'string'
            ? t.sections
            : typeof t.sectionsJson === 'string'
              ? t.sectionsJson
              : typeof t.sections_json === 'string'
                ? t.sections_json
                : null;

        let sections: any[] = [];
        if (Array.isArray(rawSections)) {
          sections = rawSections;
        } else if (typeof rawSections === 'string' && rawSections.trim()) {
          try {
            sections = JSON.parse(rawSections);
          } catch {
            sections = [];
          }
        }

        // Prefer normalized fields for UI logic (filters, counts, rendering)
        return { ...t, ...normalized, sections };
      });

      setTemplates(parsed);
    } catch (err) {
      console.error('[TemplatesManager] Error fetching templates:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  useEffect(() => {
    if (autoOpenNewTemplate) {
      setEditingTemplate(null);
      setShowEditor(true);
    }
  }, [autoOpenNewTemplate]);

  // ── Filtrowanie: chip App/Org (Menu 3) + lupa (Menu 2) ───────────────────
  // Kolumnowe filtry (Module/Audience/Format/Type) sa aplikowane przez
  // StandardTable/FilterableTable automatycznie na polach wiersza.
  const filteredTemplates = useMemo(() => {
    let result = templates;

    if (filter === 'app') result = result.filter((t) => t.isSystem);
    else if (filter === 'org') result = result.filter((t) => !t.isSystem);

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (t) =>
          t.name.toLowerCase().includes(query) ||
          t.description?.toLowerCase().includes(query) ||
          (t.sourceType || '').toLowerCase().includes(query)
      );
    }

    return result;
  }, [templates, filter, searchQuery]);

  const appCount = templates.filter((t) => t.isSystem).length;
  const orgCount = templates.filter((t) => !t.isSystem).length;

  // ── Wiersze StandardTable (pochodne pola do filtrow/sortu kolumnowego) ───
  const rows = useMemo<TableRow[]>(
    () =>
      filteredTemplates.map((t) => ({
        ...t,
        id: t.id,
        type: t.isSystem ? 'app' : 'org',
        sourceType: t.sourceType || '',
        audience: t.audience || 'general',
        format: (t.reportType || 'vertical').toLowerCase(),
        description: t.description || null,
      })),
    [filteredTemplates]
  );

  const previewTemplate = previewId ? (templates.find((t) => t.id === previewId) ?? null) : null;

  // Handlers
  const handleDelete = useCallback(
    async (templateId: string) => {
      if (!confirm(t(`${NS}.toast.confirmDelete`, 'Are you sure you want to delete this template?')))
        return;

      try {
        await Api.delete(`/report-builder/templates/${templateId}`);
        toast.success(t(`${NS}.toast.deleted`, 'Template deleted'));
        setPreviewId((prev) => (prev === templateId ? null : prev));
        await fetchTemplates();
      } catch (err: any) {
        toast.error(err?.error || t(`${NS}.toast.deleteFailed`, 'Failed to delete'));
      }
    },
    [fetchTemplates, t]
  );

  const handleDuplicate = useCallback(
    async (template: Template) => {
      try {
        await Api.post(`/report-builder/templates/${template.id}/duplicate`, {
          name: `${template.name} (${t(`${NS}.copySuffix`, 'Copy')})`,
        });
        toast.success(t(`${NS}.toast.duplicated`, 'Template duplicated'));
        await fetchTemplates();
      } catch (err: any) {
        toast.error(err?.error || t(`${NS}.toast.duplicateFailed`, 'Failed to duplicate'));
      }
    },
    [fetchTemplates, t]
  );

  const openEditor = useCallback((template?: Template) => {
    setEditingTemplate(template || null);
    setShowEditor(true);
  }, []);

  // ── Kolumny StandardTable ─────────────────────────────────────────────────
  const columns = useMemo<TableColumn[]>(
    () => [
      {
        id: 'type',
        label: t(`${NS}.columns.type`, 'Type'),
        width: '110px',
        sortable: true,
        filterable: true,
        filterOptions: TYPE_FILTER_OPTIONS,
        render: (row: TableRow) => {
          const isSystem = row.type === 'app';
          const config = getTypeBadgeConfig(t, isSystem);
          return <TagChip label={config.label} dot={config.dot} />;
        },
      },
      {
        id: 'name',
        label: t(`${NS}.columns.template`, 'Template'),
        width: '190px',
        sortable: true,
        render: (row: TableRow) => (
          <div className="flex flex-col">
            <span className="text-sm font-medium text-c-text">{row.name as string}</span>
            {row.description ? (
              <span className="text-xs text-c-text-secondary mt-0.5 line-clamp-1">
                {row.description as string}
              </span>
            ) : null}
          </div>
        ),
      },
      {
        id: 'sourceType',
        label: t(`${NS}.columns.module`, 'Module'),
        width: '130px',
        sortable: true,
        filterable: true,
        filterOptions: SOURCE_TYPE_FILTER_OPTIONS,
        render: (row: TableRow) => (
          <TagChip
            label={
              row.sourceType ? getSourceTypeLabel(t, row.sourceType as string) : '—'
            }
            dot={getSourceTypeBadgeConfig(row.sourceType as string).dot}
          />
        ),
      },
      {
        id: 'audience',
        label: t(`${NS}.columns.audience`, 'Audience'),
        width: '145px',
        sortable: true,
        filterable: true,
        filterOptions: AUDIENCE_FILTER_OPTIONS,
        render: (row: TableRow) => {
          const config = getAudienceBadgeConfig(t, row.audience as string);
          return <TagChip label={config.label} dot={config.dot} />;
        },
      },
      {
        id: 'format',
        label: t(`${NS}.columns.format`, 'Format'),
        width: '130px',
        sortable: true,
        filterable: true,
        filterOptions: FORMAT_FILTER_OPTIONS,
        render: (row: TableRow) => (
          <span className="text-sm text-c-text-secondary">
            {getFormatLabel(t, row.format as string)}
          </span>
        ),
      },
      {
        id: 'createdBy',
        label: t(`${NS}.columns.user`, 'User'),
        width: '120px',
        render: (row: TableRow) => (
          <div className="flex items-center gap-1.5 text-sm text-c-text-secondary">
            <User size={13} className="text-c-text-secondary" />
            <span className="truncate">
              {(row.createdByName as string) ||
                (row.isSystem ? t(`${NS}.systemAuthor`, 'System') : '—')}
            </span>
          </div>
        ),
      },
      {
        id: 'sections',
        label: t(`${NS}.columns.sections`, 'Sections'),
        width: '90px',
        align: 'right',
        sortAccessor: (row: TableRow) =>
          (row.sections as TemplateSection[] | undefined)?.length ?? 0,
        render: (row: TableRow) => {
          const count = (row.sections as TemplateSection[] | undefined)?.length || 0;
          if (count === 0) {
            return (
              <span className="text-xs text-c-text-muted">
                {t(`${NS}.noSections`, 'No sections')}
              </span>
            );
          }
          return <span className="text-sm tabular-nums text-c-text">{count}</span>;
        },
      },
      {
        id: 'updatedAt',
        label: t(`${NS}.columns.updated`, 'Updated'),
        width: '170px',
        sortable: true,
        sortAccessor: (row: TableRow) => String(row.updatedAt || row.createdAt || ''),
        render: (row: TableRow) => (
          <div className="flex items-center gap-1.5 text-sm text-c-text-secondary">
            <Calendar size={12} className="text-c-text-secondary" />
            {formatDate(t, i18n.language, (row.updatedAt as string) || (row.createdAt as string))}
          </div>
        ),
      },
    ],
    [
      t,
      i18n.language,
      TYPE_FILTER_OPTIONS,
      SOURCE_TYPE_FILTER_OPTIONS,
      AUDIENCE_FILTER_OPTIONS,
      FORMAT_FILTER_OPTIONS,
    ]
  );

  // ── Kebab — kontrakt 5 blokow (modul deklaruje TYLKO bloki 1-3) ──────────
  const rowMenu = useCallback(
    (row: TableRow): StandardRowMenu => {
      const template = row as unknown as Template;
      const primary = template.isSystem
        ? [
            {
              id: 'duplicate',
              label: t(`${NS}.rowMenu.duplicateToOrg`, 'Duplicate to organization'),
              icon: Copy,
              onClick: () => handleDuplicate(template),
            },
          ]
        : [
            ...(onUseTemplate
              ? [
                  {
                    id: 'use',
                    label: t(`${NS}.rowMenu.useTemplate`, 'Use template'),
                    icon: Play,
                    onClick: () => onUseTemplate(template.id),
                  },
                ]
              : []),
            {
              id: 'duplicate',
              label: t(`${NS}.rowMenu.duplicate`, 'Duplicate'),
              icon: Copy,
              onClick: () => handleDuplicate(template),
            },
          ];

      return {
        primary,
        universalHandlers: {
          preview: () => {
            jedenPanel.otworz();
            setPreviewId(template.id);
          },
          edit: template.isSystem ? undefined : () => openEditor(template),
          editNote: template.isSystem ? t(`${NS}.rowMenu.systemTemplate`, 'System template') : undefined,
        },
        destructive: template.isSystem
          ? { note: t(`${NS}.rowMenu.systemCannotDelete`, 'System templates cannot be deleted') }
          : {
              label: t(`${NS}.rowMenu.delete`, 'Delete'),
              icon: Trash2,
              onClick: () => handleDelete(template.id),
            },
      };
    },
    [handleDuplicate, handleDelete, openEditor, onUseTemplate, t, jedenPanel]
  );

  // ── Preview actions (StandardPreview) ────────────────────────────────────
  const previewActions: StandardPreviewActions | undefined = previewTemplate
    ? {
        resolutions: [
          ...(previewTemplate.isSystem
            ? [
                {
                  id: 'duplicate',
                  variant: 'positive' as const,
                  label: t(`${NS}.rowMenu.duplicateToOrg`, 'Duplicate to organization'),
                  icon: Copy,
                  onClick: () => handleDuplicate(previewTemplate),
                },
              ]
            : [
                ...(onUseTemplate
                  ? [
                      {
                        id: 'use',
                        variant: 'positive' as const,
                        label: t(`${NS}.rowMenu.useTemplate`, 'Use template'),
                        icon: Play,
                        shortcut: 'U',
                        onClick: () => onUseTemplate(previewTemplate.id),
                      },
                    ]
                  : []),
                {
                  id: 'duplicate',
                  variant: 'neutral' as const,
                  label: t(`${NS}.rowMenu.duplicate`, 'Duplicate'),
                  icon: Copy,
                  onClick: () => handleDuplicate(previewTemplate),
                },
              ]),
          ...(!previewTemplate.isSystem
            ? [
                {
                  id: 'delete',
                  variant: 'destructive' as const,
                  label: t(`${NS}.rowMenu.delete`, 'Delete'),
                  icon: Trash2,
                  onClick: () => handleDelete(previewTemplate.id),
                },
              ]
            : []),
        ],
      }
    : undefined;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 rounded-full border-2 border-c-info border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-c-surface-raised">
      {/* MENU 2/3 — wylacznie przez fasade (embedded: bez Menu 1 breadcrumb) */}
      <StandardModuleBar
        onSearch={setSearchQuery}
        searchValue={searchQuery}
        primaryCta={{
          label: t(`${NS}.moduleBar.newTemplate`, 'New Template'),
          icon: Plus,
          onClick: () => openEditor(),
        }}
        chips={[
          { id: 'all', label: t(`${NS}.moduleBar.all`, 'All'), count: templates.length },
          { id: 'app', label: getTypeLabel(t, true), count: appCount },
          { id: 'org', label: getTypeLabel(t, false), count: orgCount },
        ]}
        activeChip={filter}
        onChipChange={(id) => setFilter(id as typeof filter)}
        bulk={
          selectedIds.size > 0
            ? {
                count: selectedIds.size,
                selectedLabel: t(`${NS}.moduleBar.selected`, '{{count}} selected', {
                  count: selectedIds.size,
                }),
                onSelectAll: () => setSelectedIds(new Set(rows.map((r) => String(r.id)))),
                selectAllLabel: t(`${NS}.moduleBar.selectAll`, 'Select all'),
                onClear: () => setSelectedIds(new Set()),
                clearLabel: t(`${NS}.moduleBar.clear`, 'Clear'),
                actions: [],
              }
            : null
        }
        activeFilters={activeFilters}
        onRemoveFilter={(id) => setActiveFilters((prev) => prev.filter((f) => f.id !== id))}
        onClearFilters={() => setActiveFilters([])}
      />

      {/* TABELA + PREVIEW */}
      <div className="flex-1 min-h-0 flex overflow-hidden">
        <div className="flex-1 min-w-0 overflow-auto">
          <StandardTable
            columns={columns}
            data={rows}
            empty={{
              icon: FileText,
              title: searchQuery
                ? t(`${NS}.empty.noMatchTitle`, 'No templates match your search')
                : t(`${NS}.empty.noneTitle`, 'No templates found'),
              description: searchQuery
                ? t(`${NS}.empty.tryAdjusting`, 'Try adjusting your search terms')
                : t(`${NS}.empty.createToStart`, 'Create a new template to get started'),
              actionLabel: searchQuery ? undefined : t(`${NS}.moduleBar.newTemplate`, 'New Template'),
              onAction: searchQuery ? undefined : () => openEditor(),
            }}
            selectedRowId={previewId}
            onRowClick={(row) => {
              jedenPanel.otworz();
              setPreviewId(String(row.id));
            }}
            onRowDoubleClick={(row) => {
              const template = row as unknown as Template;
              if (!template.isSystem) openEditor(template);
            }}
            rowMenu={rowMenu}
            activeFilters={activeFilters}
            onFilterChange={setActiveFilters}
            persistKey="reportBuilder.templates"
            selection={{ selectedIds, onChange: setSelectedIds }}
          />
        </div>

        <JedenPrawyPanel rekord={previewTemplate ? (
            <StandardPreview
              title={previewTemplate.name}
              onClose={() => setPreviewId(null)}
              onOpenFull={previewTemplate.isSystem ? undefined : () => openEditor(previewTemplate)}
              meta={{
                pills: [
                  {
                    label: getTypeBadgeConfig(t, previewTemplate.isSystem).label,
                    tone: 'neutral',
                  },
                  {
                    label: previewTemplate.sourceType
                      ? getSourceTypeLabel(t, previewTemplate.sourceType)
                      : '—',
                    tone: 'neutral',
                  },
                  {
                    label: getAudienceBadgeConfig(t, previewTemplate.audience).label,
                    tone: 'neutral',
                  },
                ],
                trailing: (
                  <span className="text-[11px] font-semibold text-c-text-secondary">
                    {formatDate(t, i18n.language, previewTemplate.updatedAt || previewTemplate.createdAt)}
                  </span>
                ),
              }}
              details={{
                text: [
                  previewTemplate.description || '',
                  previewTemplate.sections?.length
                    ? t(`${NS}.preview.sections`, 'Sections: {{count}}', {
                        count: previewTemplate.sections.length,
                      })
                    : t(`${NS}.preview.noSections`, 'Sections: none'),
                  t(`${NS}.preview.createdBy`, 'Created by: {{name}}', {
                    name:
                      previewTemplate.createdByName ||
                      (previewTemplate.isSystem ? t(`${NS}.systemAuthor`, 'System') : '—'),
                  }),
                ]
                  .filter(Boolean)
                  .join('\n\n'),
                onCopy: () => {
                  void navigator.clipboard?.writeText(previewTemplate.name);
                },
              }}
              actions={previewActions}
            />
        ) : null} />
      </div>

      {/* Template Editor Modal — poza zakresem kanonu list (edytor pelnoekranowy) */}
      <AnimatePresence>
        {showEditor && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] bg-c-surface-raised"
          >
            <ReportEditor
              mode="template"
              templateId={editingTemplate?.id}
              templateMeta={{
                name: editingTemplate?.name || '',
                description: editingTemplate?.description || '',
                sourceType: (editingTemplate?.sourceType as any) || 'ASSESSMENT',
                reportType: editingTemplate?.reportType || '',
              }}
              onTemplateSaved={() => {
                setShowEditor(false);
                setEditingTemplate(null);
                fetchTemplates();
              }}
              onClose={() => {
                setShowEditor(false);
                setEditingTemplate(null);
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default TemplatesManager;
