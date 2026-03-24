/**
 * InlineAIFill — Magic wand button that appears on empty cells.
 * Single click fills one cell; batch mode fills all selected empty cells.
 */
import { Loader2, Wand2 } from 'lucide-react';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { ColumnDef, TableNode } from './tableTypes';

interface InlineAIFillProps {
  node: TableNode;
  column: ColumnDef;
  ideaId: string;
  onFill: (nodeId: string, colKey: string, value: any) => void;
}

export const InlineAIFill: React.FC<InlineAIFillProps> = ({ node, column, ideaId, onFill }) => {
  const { i18n } = useTranslation();
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
        }
      } catch {
        // silent fail — cell stays empty
      } finally {
        setLoading(false);
      }
    },
    [column, i18n.language, ideaId, loading, node, onFill]
  );

  return (
    <button
      onClick={handleFill}
      disabled={loading}
      className="opacity-0 group-hover/cell:opacity-70 hover:!opacity-100 p-0.5 rounded transition-all flex-shrink-0 text-violet-400 hover:text-violet-500 hover:bg-violet-500/10"
      title={i18n.language?.startsWith('pl') ? 'AI wypełnij' : 'AI fill'}
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
  const { i18n } = useTranslation();
  const isPl = i18n.language?.startsWith('pl');
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
            }
          }
        }
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [columns, emptyCount, i18n.language, ideaId, loading, nodes, onFill, selectedIds]);

  if (emptyCount === 0) return null;

  return (
    <button
      onClick={handleBatchFill}
      disabled={loading}
      className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-medium text-violet-600 dark:text-violet-400 hover:bg-violet-500/10 transition-colors disabled:opacity-50"
      title={
        isPl ? `AI wypełnij ${emptyCount} pustych komórek` : `AI fill ${emptyCount} empty cells`
      }
    >
      {loading ? <Loader2 size={12} className="animate-spin" /> : <Wand2 size={12} />}
      {isPl ? `AI Fill (${emptyCount})` : `AI Fill (${emptyCount})`}
    </button>
  );
};

export default InlineAIFill;
