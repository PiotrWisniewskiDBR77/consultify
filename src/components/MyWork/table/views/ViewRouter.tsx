/**
 * ViewRouter — Renders the correct view component based on the active view type.
 * Central dispatcher for Grid, Kanban, Calendar, and Gallery views.
 */
import React, { useMemo } from 'react';

import type { ColumnDef, TableNode } from '../tableTypes';
import type { CardSize } from './GalleryView';
import type { PlatformViewType, ViewConfigState } from './ViewConfigPanel';

import { CalendarView } from './CalendarView';
import { GalleryView } from './GalleryView';
import { KanbanView } from './KanbanView';

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
  const visibleFieldIds = useMemo(
    () => viewConfig.visibleFieldIds.length > 0
      ? viewConfig.visibleFieldIds
      : columns.filter((c) => c.visible).map((c) => c.key),
    [columns, viewConfig.visibleFieldIds],
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

    case 'grid':
    default:
      return <>{gridFallback}</>;
  }
};

export default ViewRouter;
