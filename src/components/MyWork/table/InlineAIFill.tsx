/**
 * InlineAIFill — Magic wand button that appears on empty cells.
 * Single click fills one cell; batch mode fills all selected empty cells.
 */
import { Loader2, Wand2 } from 'lucide-react';
import React, { useCallback, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import type { ColumnDef, TableNode } from './tableTypes';

interface InlineAIFillProps {
  node: TableNode;
  column: ColumnDef;
  ideaId: string;
  onFill: (nodeId: string, colKey: string, value: any) => void;
}

export const InlineAIFill: React.FC<InlineAIFillProps> = ({ node, column, ideaId, onFill }) => {
  const { t, i18n } = useTranslation();
  const [loading, setLoading] = useState(false);

  const handleFill = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      if (loading) return;
      setLoading(true);
      try {
        const { Api } = await import('@/services/api');
        const prompt =
          column.aiPrompt ||
          `Generate a value for "${column.header}" based on the row context: ${node.data?.label || ''}`;
        const result = await Api.getIdeaAIFill(ideaId, {
          prompt,
          rows: [{ id: node.id, data: node.data || {} }],
          language: i18n.language,
        });
        const filled = result?.[0]?.value;
        if (filled != null) {
          onFill(node.id, column.key, filled);
        } else {
          // AI returned nothing — surface it instead of leaving the cell silently empty (Z-06).
          toast(t('myWorkTable.inlineAIFill.returnedNoValue'), { icon: '🤔' });
        }
      } catch {
        toast.error(t('myWorkTable.inlineAIFill.failedToFillCell'));
      } finally {
        setLoading(false);
      }
    },
    [column, i18n.language, ideaId, loading, node, onFill, t]
  );

  return (
    <button
      onClick={handleFill}
      disabled={loading}
      className="opacity-0 group-hover/cell:opacity-70 hover:!opacity-100 p-0.5 rounded transition-all flex-shrink-0 text-c-text-secondary hover:text-c-text hover:bg-c-surface-raised"
      title={t('myWorkTable.inlineAIFill.aiFillTitle')}
    >
      {loading ? <Loader2 size={9} className="animate-spin" /> : <Wand2 size={9} />}
    </button>
  );
};

interface BatchAIFillButtonProps {
  nodes: TableNode[];
  columns: ColumnDef[];
  ideaId: string;
  onFill: (nodeId: string, colKey: string, value: any) => void;
  selectedIds: Set<string>;
}

export const BatchAIFillButton: React.FC<BatchAIFillButtonProps> = ({
  nodes,
  columns,
  ideaId,
  onFill,
  selectedIds,
}) => {
  const { t, i18n } = useTranslation();
  const [loading, setLoading] = useState(false);

  const emptyCount = React.useMemo(() => {
    let count = 0;
    const targetNodes = selectedIds.size > 0 ? nodes.filter((n) => selectedIds.has(n.id)) : nodes;
    for (const n of targetNodes) {
      for (const col of columns) {
        if (!col.visible || col.key === 'type') continue;
        if (n.data?.[col.key] == null || n.data[col.key] === '') count++;
      }
    }
    return count;
  }, [columns, nodes, selectedIds]);

  const handleBatchFill = useCallback(async () => {
    if (loading || emptyCount === 0) return;
    setLoading(true);
    let filledCount = 0;
    try {
      const { Api } = await import('@/services/api');
      const targetNodes = selectedIds.size > 0 ? nodes.filter((n) => selectedIds.has(n.id)) : nodes;

      for (const col of columns) {
        if (!col.visible || col.key === 'type' || col.key === 'label') continue;
        const emptyRows = targetNodes.filter(
          (n) => n.data?.[col.key] == null || n.data[col.key] === ''
        );
        if (emptyRows.length === 0) continue;

        const prompt =
          col.aiPrompt || `Generate a value for "${col.header}" for each row based on context`;
        const result = await Api.getIdeaAIFill(ideaId, {
          prompt,
          rows: emptyRows.map((n) => ({ id: n.id, data: n.data || {} })),
          language: i18n.language,
        });
        if (Array.isArray(result)) {
          for (const item of result) {
            if (item?.rowId && item?.value != null) {
              onFill(item.rowId, col.key, item.value);
              filledCount++;
            }
          }
        }
      }
      // Summarise the batch instead of failing silently (Z-06).
      if (filledCount > 0) {
        toast.success(t('myWorkTable.inlineAIFill.filledCells', { count: filledCount }));
      } else {
        toast(t('myWorkTable.inlineAIFill.returnedNoValues'), { icon: '🤔' });
      }
    } catch {
      toast.error(
        filledCount > 0
          ? t('myWorkTable.inlineAIFill.fillFailedWithCount', { count: filledCount })
          : t('myWorkTable.inlineAIFill.fillFailed')
      );
    } finally {
      setLoading(false);
    }
  }, [columns, emptyCount, i18n.language, ideaId, t, loading, nodes, onFill, selectedIds]);

  if (emptyCount === 0) return null;

  return (
    <button
      onClick={handleBatchFill}
      disabled={loading}
      className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-medium text-c-text-secondary hover:bg-c-surface-raised hover:text-c-text transition-colors disabled:opacity-50"
      title={t('myWorkTable.inlineAIFill.batchTitle', { count: emptyCount })}
    >
      {loading ? <Loader2 size={12} className="animate-spin" /> : <Wand2 size={12} />}
      {t('myWorkTable.inlineAIFill.aiFillButton', { count: emptyCount })}
    </button>
  );
};

export default InlineAIFill;
