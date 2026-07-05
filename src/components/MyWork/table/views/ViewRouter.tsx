/**
 * ViewRouter — Renders the correct view component based on the active view type.
 * Central dispatcher for Grid, Kanban, Calendar, Gallery, Timeline, Gantt, and Form views.
 */
import React, { useMemo, useState } from 'react';

import { ChartBlock } from '../charts/ChartBlock';
import { type ChartConfig, ChartConfigPanel } from '../charts/ChartConfigPanel';
import type { ColumnDef, TableNode } from '../tableTypes';
import { CalendarView } from './CalendarView';
import { FormView } from './FormView';
import type { CardSize } from './GalleryView';
import { GalleryView } from './GalleryView';
import { GanttView } from './GanttView';
import { KanbanView } from './KanbanView';
import { TimelineView } from './TimelineView';
import type { PlatformViewType, ViewConfigState } from './ViewConfigPanel';

export interface ViewRouterProps {
  viewType: PlatformViewType;
  records: TableNode[];
  columns: ColumnDef[];
  viewConfig: ViewConfigState;
  onRecordUpdate: (recordId: string, fieldId: string, value: unknown) => void;
  onRecordClick: (recordId: string) => void;
  onAddRecord: (defaultValues?: Record<string, unknown>) => void;
  /** Fallback renderer for the grid/table view (rendered by parent) */
  gridFallback?: React.ReactNode;
}

export const ViewRouter: React.FC<ViewRouterProps> = ({
  viewType,
  records,
  columns,
  viewConfig,
  onRecordUpdate,
  onRecordClick,
  onAddRecord,
  gridFallback,
}) => {
  const [chartConfig, setChartConfig] = useState<ChartConfig>({
    chartType: viewConfig.chartType ?? 'bar',
    xFieldId: viewConfig.chartXFieldId ?? '',
    aggregation: viewConfig.chartAggregation ?? 'count',
    yFieldId: viewConfig.chartYFieldId,
  });

  const chartFields = useMemo(
    () => columns.map((c) => ({ id: c.key, name: c.header, type: c.type })),
    [columns]
  );

  const visibleFieldIds = useMemo(
    () =>
      viewConfig.visibleFieldIds.length > 0
        ? viewConfig.visibleFieldIds
        : columns.filter((c) => c.visible).map((c) => c.key),
    [columns, viewConfig.visibleFieldIds]
  );

  const groupByFieldId = useMemo(() => {
    if (viewConfig.groupByFieldId) return viewConfig.groupByFieldId;
    const statusCol = columns.find((c) => c.type === 'status' || c.type === 'select');
    return statusCol?.key || columns[0]?.key || '';
  }, [columns, viewConfig.groupByFieldId]);

  const dateFieldId = useMemo(() => {
    if (viewConfig.dateFieldId) return viewConfig.dateFieldId;
    const dateCol = columns.find((c) => c.type === 'date');
    return dateCol?.key || '';
  }, [columns, viewConfig.dateFieldId]);

  switch (viewType) {
    case 'kanban':
      return (
        <KanbanView
          records={records}
          columns={columns}
          groupByFieldId={groupByFieldId}
          visibleFieldIds={visibleFieldIds}
          onRecordUpdate={onRecordUpdate}
          onRecordClick={onRecordClick}
          onAddRecord={onAddRecord}
        />
      );

    case 'calendar':
      return (
        <CalendarView
          records={records}
          columns={columns}
          dateFieldId={dateFieldId}
          colorByFieldId={viewConfig.colorByFieldId}
          visibleFieldIds={visibleFieldIds}
          onRecordUpdate={onRecordUpdate}
          onRecordClick={onRecordClick}
          onAddRecord={onAddRecord}
        />
      );

    case 'gallery':
      return (
        <GalleryView
          records={records}
          columns={columns}
          visibleFieldIds={visibleFieldIds}
          coverImageFieldId={viewConfig.coverImageFieldId}
          cardSize={viewConfig.galleryCardSize || 'medium'}
          onRecordClick={onRecordClick}
        />
      );

    case 'timeline':
      return (
        <TimelineView
          records={records}
          columns={columns}
          config={{
            startDateFieldId: viewConfig.startDateFieldId || dateFieldId,
            endDateFieldId: viewConfig.endDateFieldId || dateFieldId,
            titleFieldId: viewConfig.titleFieldId || 'label',
            colorFieldId: viewConfig.colorByFieldId,
            zoom: viewConfig.timelineZoom || 'week',
          }}
          onRecordUpdate={(id, data) => {
            for (const [fieldId, value] of Object.entries(data)) {
              onRecordUpdate(id, fieldId, value);
            }
          }}
          onRecordClick={onRecordClick}
        />
      );

    case 'gantt':
      return (
        <GanttView
          records={records}
          columns={columns}
          config={{
            startDateFieldId: viewConfig.startDateFieldId || dateFieldId,
            endDateFieldId: viewConfig.endDateFieldId || dateFieldId,
            titleFieldId: viewConfig.titleFieldId || 'label',
            dependencyFieldId: viewConfig.dependencyFieldId,
            progressFieldId: viewConfig.progressFieldId,
            zoom: viewConfig.ganttZoom || 'week',
          }}
          onRecordUpdate={(id, data) => {
            for (const [fieldId, value] of Object.entries(data)) {
              onRecordUpdate(id, fieldId, value);
            }
          }}
          onRecordClick={onRecordClick}
        />
      );

    case 'form':
      return (
        <FormView
          records={records}
          columns={columns}
          config={{
            visibleFieldIds: visibleFieldIds,
            layout: viewConfig.formLayout || 'single-column',
          }}
          onRecordUpdate={(id, data) => {
            for (const [fieldId, value] of Object.entries(data)) {
              onRecordUpdate(id, fieldId, value);
            }
          }}
          onRecordCreate={(data) => {
            onAddRecord(data);
          }}
        />
      );

    case 'chart':
      return (
        <div className="flex flex-col h-full overflow-hidden">
          <div className="shrink-0 border-b border-c-border p-3 bg-[color-mix(in_srgb,var(--c-surface-raised)_80%25,transparent)] bg-[color-mix(in_srgb,var(--c-surface)_80%25,transparent)]">
            <ChartConfigPanel config={chartConfig} fields={chartFields} onChange={setChartConfig} />
          </div>
          <div className="flex-1 min-h-0">
            <ChartBlock
              tableId=""
              chartType={chartConfig.chartType}
              xFieldId={chartConfig.xFieldId}
              yFieldId={chartConfig.yFieldId}
              aggregation={chartConfig.aggregation}
              title={chartConfig.title}
              records={records.map((r) => ({
                data: r.data as Record<string, unknown> | undefined,
              }))}
              fields={chartFields}
            />
          </div>
        </div>
      );

    case 'grid':
    default:
      return <>{gridFallback}</>;
  }
};

export default ViewRouter;
