/**
 * StickyNoteView — Renders table rows as colored sticky-note cards in a masonry grid.
 * Each card shows key fields with the row's accent color, like Apple Freeform.
 */
import { MessageSquare, Paperclip, Sparkles, Star } from 'lucide-react';
import React, { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { ColumnDef, TableNode } from './tableTypes';
import { ROW_ACCENT_COLORS } from './tableTypes';

interface StickyNoteViewProps {
  nodes: TableNode[];
  columns: ColumnDef[];
  onNodeClick?: (nodeId: string) => void;
  onReorder?: (nodeId: string, targetIdx: number) => void;
  onFieldChange?: (nodeId: string, field: string, value: any) => void;
  groupBy?: string | null;
}

export const StickyNoteView: React.FC<StickyNoteViewProps> = ({
  nodes,
  columns,
  onNodeClick,
  onReorder,
  onFieldChange,
  groupBy,
}) => {
  const { t } = useTranslation();

  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  const displayCols = columns
    .filter((c) => c.visible && c.key !== 'type' && c.key !== 'label')
    .slice(0, 4);

  const getColor = (node: TableNode, idx: number): string =>
    node.data?.color || ROW_ACCENT_COLORS[idx % ROW_ACCENT_COLORS.length];

  const handleDragStart = useCallback((nodeId: string) => setDragId(nodeId), []);
  const handleDragOver = useCallback((e: React.DragEvent, idx: number) => {
    e.preventDefault();
    setDragOverIdx(idx);
  }, []);
  const handleDrop = useCallback(
    (targetIdx: number) => {
      if (dragId && onReorder) onReorder(dragId, targetIdx);
      setDragId(null);
      setDragOverIdx(null);
    },
    [dragId, onReorder]
  );
  const handleDragEnd = useCallback(() => {
    setDragId(null);
    setDragOverIdx(null);
  }, []);

  const grouped = React.useMemo(() => {
    if (!groupBy) return null;
    const groups: Record<string, TableNode[]> = {};
    for (const n of nodes) {
      const key = String(n.data?.[groupBy] || t('ideas.table.other', 'Other'));
      if (!groups[key]) groups[key] = [];
      groups[key].push(n);
    }
    return groups;
  }, [groupBy, nodes, t]);

  const renderCard = (node: TableNode, idx: number) => {
    const color = getColor(node, idx);
    const commentCount = (node.data?.comments || []).length;
    const attachCount = (node.data?.attachments || []).length;

    return (
      <button
        key={node.id}
        onClick={() => onNodeClick?.(node.id)}
        draggable={!!onReorder}
        onDragStart={() => handleDragStart(node.id)}
        onDragEnd={handleDragEnd}
        onDragOver={(e) => handleDragOver(e, idx)}
        onDrop={() => handleDrop(idx)}
        className={`group relative w-full text-left rounded-2xl p-4 shadow-sm hover:shadow-lg transition-all duration-200 hover:-translate-y-0.5 border border-c-border-subtle ${dragId === node.id ? 'opacity-40 scale-95' : ''} ${dragOverIdx === idx && dragId !== node.id ? 'ring-2 ring-c-focus' : ''}`}
        style={{
          backgroundColor: `color-mix(in srgb, ${color} 12%, var(--c-surface))`,
          borderLeftColor: color,
          borderLeftWidth: 4,
        }}
      >
        {/* Icon/emoji */}
        {node.data?.icon && <span className="text-lg mb-1 block">{node.data.icon}</span>}

        {/* Title */}
        <h4 className="text-xs font-bold text-c-text mb-1.5 leading-snug line-clamp-2">
          {node.data?.label || node.id}
        </h4>

        {/* Description snippet */}
        {(node.data?.bodyMarkdown || node.data?.description) && (
          <p className="text-[10px] text-c-text-secondary leading-relaxed line-clamp-3 mb-2">
            {String(node.data.bodyMarkdown || node.data.description).slice(0, 120)}
          </p>
        )}

        {/* Key fields */}
        <div className="space-y-1">
          {displayCols.map((col) => {
            const val = node.data?.[col.key];
            if (!val) return null;
            return (
              <div key={col.key} className="flex items-center gap-1.5">
                <span className="text-[8px] font-bold uppercase tracking-wider text-c-text-muted w-14 truncate">
                  {col.header}
                </span>
                {col.type === 'rating' ? (
                  <span className="flex items-center gap-0.5">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star
                        key={s}
                        size={8}
                        className={
                          s <= Number(val) ? 'text-c-warning fill-c-warning' : 'text-c-text-muted'
                        }
                      />
                    ))}
                  </span>
                ) : col.type === 'progress' ? (
                  <div className="flex items-center gap-1 flex-1">
                    <div className="flex-1 h-1 rounded-full bg-c-border-subtle overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${Number(val)}%`, backgroundColor: color }}
                      />
                    </div>
                    <span className="text-[8px] text-c-text-muted">{val}%</span>
                  </div>
                ) : col.type === 'select' ? (
                  <span
                    className="text-[9px] font-semibold px-1.5 py-0.5 rounded-md"
                    style={{ backgroundColor: `color-mix(in srgb, ${color} 18%, transparent)`, color }}
                  >
                    {String(val)}
                  </span>
                ) : (
                  <span className="text-[9px] text-c-text-secondary truncate">
                    {String(val)}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* Bottom indicators */}
        <div className="flex items-center gap-2 mt-2 pt-2 border-t border-c-border-subtle">
          <span className="text-[8px] font-bold uppercase tracking-wider text-c-text-muted">
            {node.type || 'idea'}
          </span>
          <div className="flex-1" />
          {commentCount > 0 && (
            <span className="flex items-center gap-0.5 text-[9px] text-c-text-muted">
              <MessageSquare size={8} /> {commentCount}
            </span>
          )}
          {attachCount > 0 && (
            <span className="flex items-center gap-0.5 text-[9px] text-c-text-muted">
              <Paperclip size={8} /> {attachCount}
            </span>
          )}
          {node.data?.aiInsights && <Sparkles size={8} className="text-c-accent" />}
        </div>
      </button>
    );
  };

  if (nodes.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <p className="text-sm text-c-text-muted">{t('ideas.table.noStickyNotes', 'No sticky notes')}</p>
      </div>
    );
  }

  return (
    <div className="w-full h-full overflow-auto p-4">
      {grouped ? (
        Object.entries(grouped).map(([groupKey, groupNodes]) => (
          <div key={groupKey} className="mb-6">
            <h3 className="text-[10px] font-bold uppercase tracking-wider text-c-text-muted mb-3 px-1">
              {groupKey} ({groupNodes.length})
            </h3>
            <div className="columns-2 md:columns-3 lg:columns-4 gap-3 [column-fill:_balance]">
              {groupNodes.map((n, i) => (
                <div key={n.id} className="break-inside-avoid mb-3">
                  {renderCard(n, i)}
                </div>
              ))}
            </div>
          </div>
        ))
      ) : (
        <div className="columns-2 md:columns-3 lg:columns-4 gap-3 [column-fill:_balance]">
          {nodes.map((n, i) => (
            <div key={n.id} className="break-inside-avoid mb-3">
              {renderCard(n, i)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default StickyNoteView;
