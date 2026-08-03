import { ChevronDown, ChevronUp, Database, Pencil, Rows3, Table2 } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { isRecordProvenanceEnabled } from '@/utils/recordProvenanceFlag';

import type { ArtifactPreview } from '../KimiWorkspaceShell';
import {
  readRowProvenance,
  rowsHaveProvenance,
  TabeleProvenanceColumn,
} from './TabeleProvenanceColumn';
import TabeleRationaleSection from './TabeleRationaleSection';
import TabeleRelationChip from './TabeleRelationChip';
import TabeleSchemaBlock from './TabeleSchemaBlock';

interface TabelePreviewLayoutProps {
  preview: ArtifactPreview & { type: 'tabele' };
  onOpenBuilder?: () => void;
  onOpenProposalQueue?: () => void;
}

type PreviewTableData = NonNullable<ArtifactPreview['tableData']>;

function getPreviewTableData(preview: ArtifactPreview): PreviewTableData {
  const sheetData = preview.perSheetData?.[0] ?? preview.tableData;
  return {
    columns: sheetData?.columns ?? [],
    rows: sheetData?.rows ?? [],
  };
}

function SectionHeader({
  id,
  title,
  meta,
  isCollapsed,
  onToggle,
}: {
  id: string;
  title: string;
  meta?: string;
  isCollapsed?: boolean;
  onToggle?: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <div>
        <h2 id={id} className="text-lg font-semibold text-c-text">
          {title}
        </h2>
        {meta && <p className="mt-1 text-xs text-c-text-secondary">{meta}</p>}
      </div>
      {onToggle && (
        <button
          type="button"
          aria-expanded={!isCollapsed}
          aria-controls={`${id}-content`}
          onClick={onToggle}
          className="inline-flex items-center gap-1.5 rounded-hig-full border border-c-border-subtle bg-c-surface-raised px-2.5 py-1 text-xs font-medium text-c-text hover:bg-c-border-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
        >
          {isCollapsed ? (
            <ChevronDown size={14} aria-hidden="true" />
          ) : (
            <ChevronUp size={14} aria-hidden="true" />
          )}
          {isCollapsed
            ? t('kimi.tabele.preview.expandSection', { defaultValue: 'Expand' })
            : t('kimi.tabele.preview.collapseSection', { defaultValue: 'Collapse' })}
        </button>
      )}
    </div>
  );
}

function KpiCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-hig-md border border-c-border-subtle bg-c-surface p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-[0.16em] text-c-text-secondary">
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold text-c-text">{value}</p>
    </div>
  );
}

export function TabelePreviewLayout({
  preview,
  onOpenBuilder,
  onOpenProposalQueue,
}: TabelePreviewLayoutProps) {
  const { t } = useTranslation();
  const tableData = useMemo(() => getPreviewTableData(preview), [preview]);
  const schemaFields = preview.tabeleSchemaFields ?? [];
  const relations = preview.tabeleRelations ?? [];
  const [isSchemaCollapsed, setIsSchemaCollapsed] = useState(schemaFields.length <= 3);
  const [isRelationsCollapsed, setIsRelationsCollapsed] = useState(relations.length === 0);
  const visibleRows = tableData.rows.slice(0, 25);
  // Block B / B-S5b — Word-canvas provenance column. Renders only when:
  // (1) the feature flag is ON, and (2) at least one visible row carries a
  // signal (B-P5: don't bloat tables that have no provenance metadata).
  const showProvenanceColumn = useMemo(
    () => isRecordProvenanceEnabled() && rowsHaveProvenance(visibleRows),
    [visibleRows]
  );
  const provenanceHeaderLabel = t('kimi.preview.provenance.header', 'Provenance');
  const formatLabel =
    preview.tableId || preview.tabeleRelations || preview.tabeleSchemaFields
      ? t('kimi.tabele.preview.formatOperational', { defaultValue: 'Operational' })
      : t('kimi.tabele.preview.formatDraft', { defaultValue: 'Draft' });

  const statusLabel = preview.tabeleRationale?.proposalStatus
    ? t('kimi.tabele.preview.statusGoverned', { defaultValue: 'Governed' })
    : t('kimi.tabele.preview.statusPreview', { defaultValue: 'Preview' });

  const kpiItems = [
    {
      label: t('kimi.tabele.preview.rowsKpi', { defaultValue: 'Rows' }),
      value: String(tableData.rows.length),
    },
    {
      label: t('kimi.tabele.preview.columnsKpi', { defaultValue: 'Columns' }),
      value: String(tableData.columns.length || schemaFields.length),
    },
    {
      label: t('kimi.tabele.preview.statusKpi', { defaultValue: 'Status' }),
      value: statusLabel,
    },
    {
      label: t('kimi.tabele.preview.formatKpi', { defaultValue: 'Format' }),
      value: formatLabel,
    },
  ];

  return (
    <article
      aria-label={t('kimi.tabele.preview.documentLabel', {
        defaultValue: 'Tabele operational table preview',
      })}
      className="mx-auto max-w-5xl rounded-hig-xl border border-c-border-subtle bg-c-surface-raised p-4 shadow-sm"
    >
      <div className="rounded-hig-lg border border-c-border-subtle bg-c-surface px-6 py-7 shadow-sm sm:px-8">
        <header className="border-b border-c-border-subtle pb-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="mb-3 inline-flex items-center gap-2 rounded-hig-full border border-c-border-subtle bg-c-surface-raised px-3 py-1 text-xs font-medium text-c-text/[0.11]/[0.075]">
                <Table2 size={14} aria-hidden="true" />
                {t('kimi.tabele.preview.subtitle', { defaultValue: 'Operational Table' })}
              </div>
              <h1 className="font-mono text-3xl font-semibold tracking-tight text-c-text">
                {preview.title ||
                  t('kimi.tabele.preview.untitled', { defaultValue: 'Untitled table' })}
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-c-text-secondary">
                {preview.summary ||
                  t('kimi.tabele.preview.coverDescription', {
                    defaultValue:
                      'A Word-style document canvas for reviewing schema, sample records, relations, and governance rationale before opening the Table Builder.',
                  })}
              </p>
            </div>
            <div className="flex flex-col items-start gap-2 sm:items-end">
              <div className="flex items-center gap-2 rounded-hig-full border border-c-border-subtle bg-c-surface-raised px-3 py-1.5 text-xs font-medium text-c-text/[0.11]/[0.075]">
                <span className="h-2 w-2 rounded-hig-full bg-emerald-500" aria-hidden="true" />
                {t('kimi.tabele.preview.livePreview', { defaultValue: 'Live preview' })}
              </div>
              {onOpenBuilder && preview.tableId && (
                <button
                  type="button"
                  onClick={onOpenBuilder}
                  data-testid="tabele-preview-open-grid"
                  className="inline-flex items-center gap-2 rounded-hig-full bg-sky-600 px-4 py-1.5 text-xs font-semibold text-c-text shadow-sm transition-colors hover:bg-sky-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus dark:bg-sky-500 dark:hover:bg-sky-400"
                >
                  <Pencil size={14} aria-hidden="true" />
                  {t('kimi.tabele.preview.openGrid', { defaultValue: 'Open grid editor' })}
                </button>
              )}
            </div>
          </div>
        </header>

        <section aria-labelledby="tabele-preview-kpis-heading" className="py-6">
          <h2 id="tabele-preview-kpis-heading" className="sr-only">
            {t('kimi.tabele.preview.kpiSection', { defaultValue: 'Table metrics' })}
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {kpiItems.map((item) => (
              <KpiCard key={item.label} label={item.label} value={item.value} />
            ))}
          </div>
        </section>

        <section
          aria-labelledby="tabele-preview-schema-heading"
          className="border-t border-c-border-subtle py-6"
        >
          <SectionHeader
            id="tabele-preview-schema-heading"
            title={t('kimi.tabele.preview.schemaTitle', { defaultValue: 'Schema' })}
            meta={t('kimi.tabele.preview.schemaMeta', {
              defaultValue: '{{count}} fields in the preview schema',
              count: schemaFields.length,
            })}
            isCollapsed={isSchemaCollapsed}
            onToggle={() => setIsSchemaCollapsed((value) => !value)}
          />
          {!isSchemaCollapsed ? (
            <div id="tabele-preview-schema-heading-content" className="space-y-3">
              {schemaFields.length > 0 ? (
                schemaFields.map((field) => (
                  <TabeleSchemaBlock key={field.fieldId || field.name} field={field} />
                ))
              ) : (
                <p className="rounded-hig-md border border-dashed border-c-border-subtle p-4 text-sm text-c-text-secondary">
                  {t('kimi.tabele.preview.emptySchema', {
                    defaultValue: 'No schema fields are available in this preview yet.',
                  })}
                </p>
              )}
            </div>
          ) : (
            <p
              id="tabele-preview-schema-heading-content"
              className="rounded-hig-md border border-dashed border-c-border-subtle p-4 text-sm text-c-text-secondary"
            >
              {t('kimi.tabele.preview.schemaCollapsed', {
                defaultValue: 'Schema is collapsed for compact review.',
              })}
            </p>
          )}
        </section>

        <section
          aria-labelledby="tabele-preview-records-heading"
          className="border-t border-c-border-subtle py-6"
        >
          <SectionHeader
            id="tabele-preview-records-heading"
            title={t('kimi.tabele.preview.recordsTitle', { defaultValue: 'Records' })}
            meta={t('kimi.tabele.preview.recordsMeta', {
              defaultValue: 'Showing sample records from the generated table',
            })}
          />
          {tableData.columns.length > 0 ? (
            <div className="overflow-hidden rounded-hig-lg border border-c-border-subtle bg-c-surface">
              <div className="overflow-x-auto">
                <table
                  /* §27-exempt: edytor komorkowy/workspace, edycja cell-by-cell */ className="w-full text-left text-xs"
                >
                  <thead className="bg-c-surface-raised">
                    <tr>
                      {tableData.columns.map((column) => (
                        <th
                          key={column}
                          scope="col"
                          className="border-b border-c-border-subtle px-3 py-2 font-semibold text-c-text-secondary/[0.10]"
                        >
                          {column}
                        </th>
                      ))}
                      {showProvenanceColumn && (
                        <th
                          scope="col"
                          data-testid="tabele-preview-provenance-header"
                          className="border-b border-c-border-subtle px-3 py-2 font-semibold text-c-text-secondary/[0.10]"
                        >
                          {provenanceHeaderLabel}
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {visibleRows.map((row, rowIndex) => {
                      const provenance = showProvenanceColumn ? readRowProvenance(row) : null;
                      return (
                        <tr
                          key={rowIndex}
                          className="border-b border-c-border-subtle last:border-b-0 hover:bg-c-surface-raised/[0.085]/[0.04]"
                        >
                          {tableData.columns.map((column) => (
                            <td
                              key={column}
                              className="max-w-[220px] truncate px-3 py-2 text-c-text"
                            >
                              {String(row[column] ?? '')}
                            </td>
                          ))}
                          {provenance && (
                            <td className="px-3 py-2 align-middle">
                              <TabeleProvenanceColumn
                                confidenceScore={provenance.confidenceScore}
                                validationStatus={provenance.validationStatus}
                              />
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {tableData.rows.length > 25 && (
                <div className="border-t border-c-border-subtle px-3 py-2 text-center text-xs text-c-text-secondary">
                  {t('kimi.tabele.preview.showingRows', {
                    defaultValue: 'Showing 25 of {{total}} rows',
                    total: tableData.rows.length,
                  })}
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-hig-lg border border-dashed border-c-border-subtle p-6 text-center">
              <Rows3 size={28} className="mx-auto text-c-text-secondary" aria-hidden="true" />
              <p className="mt-3 text-sm text-c-text-secondary">
                {t('kimi.tabele.preview.emptyRecords', {
                  defaultValue: 'No record sample is available in this preview yet.',
                })}
              </p>
              {onOpenBuilder && preview.tableId && (
                <button
                  type="button"
                  onClick={onOpenBuilder}
                  data-testid="tabele-preview-open-grid-empty"
                  className="mt-4 inline-flex items-center gap-2 rounded-hig-full bg-sky-600 px-4 py-1.5 text-xs font-semibold text-c-text shadow-sm transition-colors hover:bg-sky-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus dark:bg-sky-500 dark:hover:bg-sky-400"
                >
                  <Pencil size={14} aria-hidden="true" />
                  {t('kimi.tabele.preview.openGridEmpty', {
                    defaultValue: 'Open grid editor to add records',
                  })}
                </button>
              )}
            </div>
          )}
        </section>

        <section
          aria-labelledby="tabele-preview-relations-heading"
          className="border-t border-c-border-subtle py-6"
        >
          <SectionHeader
            id="tabele-preview-relations-heading"
            title={t('kimi.tabele.preview.relationsTitle', { defaultValue: 'Relations' })}
            meta={t('kimi.tabele.preview.relationsMeta', {
              defaultValue: '{{count}} relation chips available',
              count: relations.length,
            })}
            isCollapsed={isRelationsCollapsed}
            onToggle={() => setIsRelationsCollapsed((value) => !value)}
          />
          {!isRelationsCollapsed ? (
            <div id="tabele-preview-relations-heading-content" className="flex flex-wrap gap-2">
              {relations.length > 0 ? (
                relations.map((relation) => (
                  <TabeleRelationChip
                    key={`${relation.fieldId}-${relation.targetTableId}`}
                    relation={relation}
                  />
                ))
              ) : (
                <p className="rounded-hig-md border border-dashed border-c-border-subtle p-4 text-sm text-c-text-secondary">
                  {t('kimi.tabele.preview.emptyRelations', {
                    defaultValue: 'No table relations are available in this preview yet.',
                  })}
                </p>
              )}
            </div>
          ) : (
            <p
              id="tabele-preview-relations-heading-content"
              className="rounded-hig-md border border-dashed border-c-border-subtle p-4 text-sm text-c-text-secondary"
            >
              {relations.length === 0
                ? t('kimi.tabele.preview.noRelationsCollapsed', {
                    defaultValue: 'Relations are collapsed because no relations are available.',
                  })
                : t('kimi.tabele.preview.relationsCollapsed', {
                    defaultValue: 'Relations are collapsed for compact review.',
                  })}
            </p>
          )}
        </section>

        <section
          aria-labelledby="tabele-preview-rationale-heading"
          className="border-t border-c-border-subtle pt-6"
        >
          <div className="mb-4 flex items-center gap-2">
            <Database size={18} className="text-c-text-secondary" aria-hidden="true" />
            <h2 id="tabele-preview-rationale-heading" className="text-lg font-semibold text-c-text">
              {t('kimi.tabele.preview.rationaleTitle', { defaultValue: 'AI Rationale' })}
            </h2>
          </div>
          {preview.tabeleRationale ? (
            <TabeleRationaleSection
              rationale={preview.tabeleRationale}
              onOpenProposalQueue={onOpenProposalQueue}
            />
          ) : (
            <div className="rounded-hig-lg border border-dashed border-c-border-subtle p-5 text-sm text-c-text-secondary">
              {t('kimi.tabele.preview.emptyRationale', {
                defaultValue: 'No AI rationale has been attached to this preview yet.',
              })}
            </div>
          )}
        </section>
      </div>
    </article>
  );
}

export default TabelePreviewLayout;
