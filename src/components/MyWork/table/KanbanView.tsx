/**
 * KanbanView — Kanban board from the same table data.
 * Groups nodes by a select column with drag-and-drop between lanes,
 * WIP limits, card priority indicators, and person avatars.
 */
import { AlertTriangle, GripVertical, Plus } from 'lucide-react';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { ColumnDef, TableNode } from './tableTypes';
import { SELECT_COLORS } from './tableTypes';

interface KanbanViewProps {
  nodes: TableNode[];
  groupByColumn: ColumnDef;
  columns: ColumnDef[];
  locked?: boolean;
  wipLimits?: Record<string, number>;
  onFieldChange: (nodeId: string, field: string, value: any) => void;
  onAddRow?: () => void;
  onNodeClick?: (nodeId: string) => void;
}

export const KanbanView: React.FC<KanbanViewProps> = ({
  nodes,
  groupByColumn,
  columns,
  locked = false,
  wipLimits = {},
  onFieldChange,
  onAddRow,
  onNodeClick,
}) => {
  const { i18n } = useTranslation();
  const isPl = i18n.language?.startsWith('pl');
  const [dragNodeId, setDragNodeId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);

  const lanes = useMemo(() => {
    const options = groupByColumn.options || [];
    const groups: Record<string, TableNode[]> = {};
    for (const opt of options) groups[opt] = [];
    groups['—'] = [];

    for (const node of nodes) {
      const val = String(node.data?.[groupByColumn.key] || '');
      if (groups[val]) {
        groups[val].push(node);
      } else {
        groups['—'].push(node);
      }
    }

    if (groups['—'].length === 0) delete groups['—'];
    return groups;
  }, [groupByColumn, nodes]);

  const handleDragStart = useCallback(
    (nodeId: string) => {
      if (locked) return;
      setDragNodeId(nodeId);
    },
    [locked]
  );

  const handleDrop = useCallback(
    (laneKey: string) => {
      if (!dragNodeId || locked) return;
      onFieldChange(dragNodeId, groupByColumn.key, laneKey === '—' ? null : laneKey);
      setDragNodeId(null);
      setDropTarget(null);
    },
    [dragNodeId, groupByColumn.key, locked, onFieldChange]
  );

  const colors = groupByColumn.optionColors || {};

  const personCol = columns.find((c) => c.type === 'person' && c.visible);
  const priorityCol = columns.find(
    (c) => (c.type === 'select' || c.type === 'rating') && c.key.toLowerCase().includes('prior')
  );
  const displayColumns = columns
    .filter(
      (c) =>
        c.visible &&
        c.key !== groupByColumn.key &&
        c.key !== 'type' &&
        c.key !== 'label' &&
        c.key !== personCol?.key &&
        c.key !== priorityCol?.key
    )
    .slice(0, 2);

  return (
    <div className="w-full h-full flex gap-3 p-4 overflow-x-auto">
      {Object.entries(lanes).map(([laneKey, laneNodes]) => {
        const bgColor = colors[laneKey] || SELECT_COLORS[0];
        const wipLimit = wipLimits[laneKey];
        const isOverWip = wipLimit != null && laneNodes.length > wipLimit;

        return (
          <div
            key={laneKey}
            className={`flex-shrink-0 w-[280px] flex flex-col rounded-2xl bg-slate-50/80 dark:bg-navy-900/80 border transition-colors ${
              dropTarget === laneKey
                ? 'border-primary-400 dark:border-primary-500 bg-primary-50/30 dark:bg-primary-500/5'
                : isOverWip
                  ? 'border-amber-300/60 dark:border-amber-500/30'
                  : 'border-slate-200/40 dark:border-navy-700/40'
            }`}
            onDragOver={(e) => {
              e.preventDefault();
              setDropTarget(laneKey);
            }}
            onDragLeave={() => setDropTarget(null)}
            onDrop={() => handleDrop(laneKey)}
          >
            {/* Lane header */}
            <div className="flex items-center gap-2 px-3 py-2.5 border-b border-slate-200/40 dark:border-navy-700/40">
              <span
                className="w-3 h-3 rounded-sm flex-shrink-0"
                style={{ backgroundColor: bgColor }}
              />
              <span className="text-xs font-bold text-slate-700 dark:text-slate-200 flex-1 truncate">
                {laneKey}
              </span>
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded-md font-bold ${
                  isOverWip
                    ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400'
                    : 'text-slate-600 bg-slate-200/60 dark:bg-navy-700/60'
                }`}
              >
                {laneNodes.length}
                {wipLimit != null && `/${wipLimit}`}
              </span>
              {isOverWip && <AlertTriangle size={12} className="text-amber-500 flex-shrink-0" />}
            </div>

            {/* Cards */}
            <div className="flex-1 overflow-auto p-2 space-y-1.5">
              {laneNodes.map((node) => {
                const person = personCol ? node.data?.[personCol.key] : null;
                return (
                  <div
                    key={node.id}
                    draggable={!locked}
                    onDragStart={() => handleDragStart(node.id)}
                    onClick={() => onNodeClick?.(node.id)}
                    className={`rounded-xl border bg-white dark:bg-navy-950 p-3 cursor-pointer hover:shadow-md transition-all ${
                      dragNodeId === node.id
                        ? 'opacity-40 scale-95 border-primary-300'
                        : 'border-slate-200/60 dark:border-navy-700/40'
                    }`}
                    style={
                      node.data?.color
                        ? { borderLeftWidth: 3, borderLeftColor: node.data.color }
                        : undefined
                    }
                  >
                    <div className="flex items-start gap-2">
                      {!locked && (
                        <GripVertical
                          size={12}
                          className="text-slate-600 dark:text-navy-600 mt-0.5 flex-shrink-0 cursor-grab"
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                          {node.data?.label || node.id}
                        </div>
                        {displayColumns.map((col) => {
                          const val = node.data?.[col.key];
                          if (!val) return null;
                          return (
                            <div key={col.key} className="flex items-center gap-1 mt-1">
                              <span className="text-[9px] text-slate-600">{col.header}:</span>
                              {col.type === 'rating' ? (
                                <span className="text-[10px] text-amber-500">
                                  {'★'.repeat(Number(val) || 0)}
                                </span>
                              ) : col.type === 'progress' ? (
                                <div className="flex items-center gap-1">
                                  <div className="w-12 h-1.5 rounded-full bg-slate-200 dark:bg-navy-700 overflow-hidden">
                                    <div
                                      className="h-full rounded-full bg-emerald-500"
                                      style={{ width: `${Number(val) || 0}%` }}
                                    />
                                  </div>
                                  <span className="text-[9px] text-slate-600">{val}%</span>
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

                    {/* Card footer: person + priority */}
                    {(person || priorityCol) && (
                      <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-slate-200 dark:border-navy-800">
                        {person ? (
                          <div className="flex items-center gap-1">
                            <div className="w-4 h-4 rounded-full bg-gradient-to-br from-primary-400 to-indigo-500 flex items-center justify-center text-[7px] font-bold text-white">
                              {String(person).charAt(0).toUpperCase()}
                            </div>
                            <span className="text-[9px] text-slate-500 truncate max-w-[80px]">
                              {String(person)}
                            </span>
                          </div>
                        ) : (
                          <div />
                        )}
                        {priorityCol && node.data?.[priorityCol.key] && (
                          <span className="text-[8px] font-bold text-slate-500 bg-slate-100 dark:bg-navy-800 px-1 py-0.5 rounded">
                            {String(node.data[priorityCol.key])}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}

              {!locked && (
                <button
                  onClick={onAddRow}
                  className="w-full flex items-center justify-center gap-1 py-2 rounded-xl border border-dashed border-slate-300 dark:border-navy-600 text-[10px] text-slate-600 hover:text-slate-600 dark:hover:text-slate-300 hover:border-slate-400 dark:hover:border-navy-500 transition-colors"
                >
                  <Plus size={12} />
                  {isPl ? 'Dodaj' : 'Add'}
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default KanbanView;
