/**
 * TemplatesTabContent — "Biblioteka wzorców" tab
 * Golden standard: FilterableTable (6 columns) + GridView cards + Preview pane
 * Connected to /api/report-builder/templates + /api/presentations/templates
 */

import { BookTemplate, Copy, Edit, FileText, Loader2, Play, Presentation } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

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
import { TemplatePreviewBody, TemplatePreviewFooter } from './previews/TemplatePreview';
import { TEMPLATE_TYPE_META, type TemplateItem } from './types';

interface TemplatesTabContentProps {
  viewMode: ViewMode;
  searchQuery: string;
  activeFilters: FilterChip[];
  onFilterChange: (filters: FilterChip[]) => void;
  templates: TemplateItem[];
  loading: boolean;
}

export const TemplatesTabContent: React.FC<TemplatesTabContentProps> = ({
  viewMode,
  searchQuery,
  activeFilters,
  onFilterChange,
  templates,
  loading,
}) => {
  const { t, i18n } = useTranslation();
  const isPolish = i18n.language?.startsWith('pl');
  const navigate = useNavigate();
  const [selectedId, setSelectedId] = useState<string | null>(null);

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
              <FileText size={14} className="text-blue-400 shrink-0" />
            ) : (
              <Presentation size={14} className="text-purple-400 shrink-0" />
            )}
            <span className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">
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
          { value: 'report', label: isPolish ? 'Raport' : 'Report', color: 'bg-blue-400' },
          {
            value: 'presentation',
            label: isPolish ? 'Prezentacja' : 'Presentation',
            color: 'bg-purple-400',
          },
        ],
        render: (row: TemplateItem) => {
          const meta = TEMPLATE_TYPE_META[row.type];
          return (
            <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-slate-500/10">
              <span className={`w-2 h-2 rounded-full ${meta.dotColor}`} />
              <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
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
          { value: 'R2', label: 'R2 — Steering', color: 'bg-purple-400' },
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
          <span className="text-sm text-slate-600 dark:text-slate-300">{row.category}</span>
        ),
      },
      {
        id: 'scope',
        label: t('rap.columns.scope', 'Zakres'),
        width: '140px',
        filterable: true,
        filterOptions: [
          { value: 'application', label: isPolish ? 'System' : 'Application' },
          { value: 'organization', label: isPolish ? 'Organizacja' : 'Organization' },
        ],
        render: (row: TemplateItem) => (
          <span className="text-sm text-slate-600 dark:text-slate-300">
            {row.scope === 'application'
              ? isPolish
                ? 'System'
                : 'Application'
              : isPolish
                ? 'Organizacja'
                : 'Organization'}
          </span>
        ),
      },
      {
        id: 'status',
        label: t('rap.columns.status', 'Status'),
        width: '120px',
        filterable: true,
        filterOptions: [
          { value: 'active', label: isPolish ? 'Aktywny' : 'Active', color: 'bg-emerald-400' },
          { value: 'draft', label: isPolish ? 'Szkic' : 'Draft', color: 'bg-slate-400' },
          {
            value: 'archived',
            label: isPolish ? 'Zarchiwizowany' : 'Archived',
            color: 'bg-slate-500',
          },
        ],
      },
      {
        id: 'updatedAt',
        label: t('rap.columns.updatedAt', 'Ostatnia zmiana'),
        width: '150px',
        sortable: true,
        render: (row: TemplateItem) => {
          const d = new Date(row.updatedAt);
          return (
            <span className="text-sm text-slate-500 dark:text-slate-400">
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
    {
      id: 'use',
      label: t('rap.actions.useTemplate', 'Użyj wzorca'),
      icon: Play,
      variant: 'primary',
      onClick: () => {
        if (row.type === 'report') {
          navigate(`/reports/builder?templateId=${row.id}`);
        } else {
          navigate(`/presentations/wizard?templateId=${row.id}`);
        }
      },
    },
    {
      id: 'clone',
      label: t('rap.actions.clone', 'Klonuj'),
      icon: Copy,
      onClick: () => {
        if (row.type === 'presentation') {
          navigate(`/presentations/wizard?cloneTemplateId=${row.id}`);
        }
      },
    },
    {
      id: 'edit',
      label: t('rap.actions.edit', 'Edytuj'),
      icon: Edit,
      onClick: () => {
        if (row.type === 'report') {
          navigate(`/reports/builder?templateId=${row.id}&edit=true`);
        }
      },
    },
  ];

  const selectedItem = selectedId ? filteredData.find((i) => i.id === selectedId) || null : null;
  const previewItem = selectedItem ? { ...selectedItem, title: selectedItem.title } : null;
  const itemIds = filteredData.map((i) => i.id);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={24} className="animate-spin text-slate-400" />
      </div>
    );
  }

  if (viewMode === 'grid') {
    const gridItems: GridItem[] = filteredData.map((item) => ({
      id: item.id,
      name: item.title,
      type: item.type,
      typeColor: item.type === 'report' ? 'operational' : 'digital',
      status: item.status.toUpperCase(),
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
