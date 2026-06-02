/**
 * KanbanView (Platform) — Kanban board renderer for the Table Platform.
 * Groups records by a singleSelect field, supports HTML5 drag-and-drop
 * between columns, card metadata display, and inline add.
 */
import { GripVertical, Plus } from 'lucide-react';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { ColumnDef, TableNode } from '../tableTypes';
import { SELECT_COLORS } from '../tableTypes';

export interface KanbanViewProps {
  records: TableNode[];
  columns: ColumnDef[];
  groupByFieldId: string;
  visibleFieldIds: string[];
  onRecordUpdate: (recordId: string, fieldId: string, value: unknown) => void;
  onRecordClick: (recordId: string) => void;
  onAddRecord: (defaultValues?: Record<string, unknown>) => void;
}

const KanbanCard = React.memo<{
  record: TableNode;
  displayColumns: ColumnDef[];
  groupColor: string;
  locked: boolean;
  onDragStart: (id: string) => void;
  isDragging: boolean;
  onClick: (id: string) => void;
}>(({ record, displayColumns, groupColor, locked, onDragStart, isDragging, onClick }) => (
  <div
    draggable={!locked}
    onDragStart={(e) => {
      e.dataTransfer.effectAllowed = 'move';
      onDragStart(record.id);
    }}
    onClick={() => onClick(record.id)}
    className={`rounded-xl border bg-white dark:bg-navy-950 p-3 cursor-pointer hover:shadow-md transition-all ${
      isDragging
        ? 'opacity-40 scale-95 border-primary-300 dark:border-primary-500'
        : 'border-slate-200/60 dark:border-navy-700/40'
    }`}
    style={{ borderLeftWidth: 3, borderLeftColor: groupColor }}
  >
    <div className="flex items-start gap-2">
      {!locked && (
        <GripVertical
          size={12}
          className="text-slate-300 dark:text-navy-600 mt-0.5 flex-shrink-0 cursor-grab"
        />
      )}
      <div className="flex-1 min-w-0">
        <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
          {record.data?.label || record.id}
        </div>
        {displayColumns.map((col) => {
          const val = record.data?.[col.key];
          if (val == null || val === '') return null;
          return (
            <div key={col.key} className="flex items-center gap-1 mt-1">
              <span className="text-[9px] text-slate-400 dark:text-slate-500">{col.header}:</span>
              {col.type === 'rating' ? (
                <span className="text-[10px] text-amber-500">{'★'.repeat(Number(val) || 0)}</span>
              ) : col.type === 'progress' ? (
                <div className="flex items-center gap-1">
                  <div className="w-12 h-1.5 rounded-full bg-slate-200 dark:bg-navy-700 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-emerald-500"
                      style={{ width: `${Math.min(Number(val) || 0, 100)}%` }}
                    />
                  </div>
                  <span className="text-[9px] text-slate-400">{val}%</span>
                </div>
              ) : (
                <span className="text-[10px] text-slate-600 dark:text-slate-300 truncate">
                  {String(val)}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  </div>
));

KanbanCard.displayName = 'KanbanCard';

export const KanbanView: React.FC<KanbanViewProps> = ({
  records,
  columns,
  groupByFieldId,
  visibleFieldIds,
  onRecordUpdate,
  onRecordClick,
  onAddRecord,
}) => {
  const { i18n } = useTranslation();
  const isPl = i18n.language?.startsWith('pl');
  const [dragRecordId, setDragRecordId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);

  const groupCol = useMemo(
    () => columns.find((c) => c.key === groupByFieldId),
    [columns, groupByFieldId]
  );

  const displayColumns = useMemo(() => {
    const visible = new Set(visibleFieldIds);
    return columns
      .filter(
        (c) =>
          visible.has(c.key) && c.key !== groupByFieldId && c.key !== 'label' && c.key !== 'type'
      )
      .slice(0, 3);
  }, [columns, groupByFieldId, visibleFieldIds]);

  const lanes = useMemo(() => {
    const options = groupCol?.options || [];
    const groups: Record<string, TableNode[]> = {};
    for (const opt of options) groups[opt] = [];
    const uncategorizedKey = isPl ? 'Bez kategorii' : 'Uncategorized';
    groups[uncategorizedKey] = [];

    for (const record of records) {
      const val = String(record.data?.[groupByFieldId] || '');
      if (val && groups[val]) {
        groups[val].push(record);
      } else {
        groups[uncategorizedKey].push(record);
      }
    }

    if (groups[uncategorizedKey].length === 0) delete groups[uncategorizedKey];
    return groups;
  }, [groupCol, groupByFieldId, records, isPl]);

  const handleDrop = useCallback(
    (laneKey: string) => {
      if (!dragRecordId) return;
      const uncategorizedKey = isPl ? 'Bez kategorii' : 'Uncategorized';
      const newValue = laneKey === uncategorizedKey ? null : laneKey;
      onRecordUpdate(dragRecordId, groupByFieldId, newValue);
      setDragRecordId(null);
      setDropTarget(null);
    },
    [dragRecordId, groupByFieldId, isPl, onRecordUpdate]
  );

  const colors = groupCol?.optionColors || {};

  return (
    <div className="w-full h-full flex gap-3 p-4 overflow-x-auto">
      {Object.entries(lanes).map(([laneKey, laneRecords]) => {
        const bgColor =
          colors[laneKey] ||
          SELECT_COLORS[Object.keys(lanes).indexOf(laneKey) % SELECT_COLORS.length];
        const isDropping = dropTarget === laneKey;

        return (
          <div
            key={laneKey}
            className={`flex-shrink-0 w-[280px] flex flex-col rounded-2xl bg-slate-50/80 dark:bg-navy-900/80 border transition-colors ${
              isDropping
                ? 'border-primary-400 dark:border-primary-500 bg-primary-50/30 dark:bg-primary-500/5'
                : 'border-slate-200/40 dark:border-navy-700/40'
            }`}
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = 'move';
              setDropTarget(laneKey);
            }}
            onDragLeave={() => setDropTarget(null)}
            onDrop={() => handleDrop(laneKey)}
          >
            {/* Column header */}
            <div className="flex items-center gap-2 px-3 py-2.5 border-b border-slate-200/40 dark:border-navy-700/40">
              <span
                className="w-3 h-3 rounded-sm flex-shrink-0"
                style={{ backgroundColor: bgColor }}
              />
              <span className="text-xs font-bold text-slate-700 dark:text-slate-200 flex-1 truncate">
                {laneKey}
              </span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-md font-bold text-slate-400 bg-slate-200/60 dark:bg-navy-700/60">
                {laneRecords.length}
              </span>
            </div>

            {/* Cards */}
            <div className="flex-1 overflow-auto p-2 space-y-1.5">
              {laneRecords.length === 0 && (
                <div className="text-center py-6 text-[10px] text-slate-400 dark:text-slate-500">
                  {isPl ? 'Brak elementów' : 'No items'}
                </div>
              )}
              {laneRecords.map((record) => (
                <KanbanCard
                  key={record.id}
                  record={record}
                  displayColumns={displayColumns}
                  groupColor={bgColor}
                  locked={false}
                  onDragStart={setDragRecordId}
                  isDragging={dragRecordId === record.id}
                  onClick={onRecordClick}
                />
              ))}

              {/* Add card button */}
              <button
                onClick={() => {
                  const uncategorizedKey = isPl ? 'Bez kategorii' : 'Uncategorized';
                  const defaultVal =
                    laneKey === uncategorizedKey ? undefined : { [groupByFieldId]: laneKey };
                  onAddRecord(defaultVal);
                }}
                className="w-full flex items-center justify-center gap-1 py-2 rounded-xl border border-dashed border-slate-300 dark:border-navy-600 text-[10px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:border-slate-400 dark:hover:border-navy-500 transition-colors"
              >
                <Plus size={12} />
                {isPl ? 'Dodaj' : 'Add'}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default KanbanView;
