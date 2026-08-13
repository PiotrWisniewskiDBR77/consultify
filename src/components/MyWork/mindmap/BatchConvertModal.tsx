/**
 * BatchConvertModal — Select multiple nodes and convert them to initiatives.
 */
import { CheckSquare, Loader2, Rocket, Square, X } from 'lucide-react';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { useDialogA11y } from '@/components/ui/primitives/useDialogA11y';

interface BatchConvertNode {
  id: string;
  label: string;
  branchKey: string;
  status?: string;
}

interface BatchConvertModalProps {
  open: boolean;
  onClose: () => void;
  nodes: BatchConvertNode[];
  locked: boolean;
  onConvert: (nodeIds: string[], target: 'initiative' | 'decision') => void;
}

export const BatchConvertModal: React.FC<BatchConvertModalProps> = ({
  open,
  onClose,
  nodes,
  locked,
  onConvert,
}) => {
  const { t, i18n } = useTranslation();
  const isPl = i18n.language?.startsWith('pl');

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [converting, setConverting] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialogA11y({ open, onClose, containerRef: dialogRef });

  const eligibleNodes = useMemo(() => {
    return nodes.filter(
      (n) => n.status !== 'converted' && !n.id.startsWith('branch-') && n.id !== 'root'
    );
  }, [nodes]);

  const toggleNode = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    if (selected.size === eligibleNodes.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(eligibleNodes.map((n) => n.id)));
    }
  }, [eligibleNodes, selected.size]);

  const handleConvert = useCallback(
    async (target: 'initiative' | 'decision') => {
      if (selected.size === 0) return;
      setConverting(true);
      try {
        onConvert(Array.from(selected), target);
        toast.success(
          t('ideas.mindmap.convertedNItems', 'Converted {{count}} items', {
            count: selected.size,
          }),
          { duration: 1500 }
        );
        onClose();
      } finally {
        setConverting(false);
      }
    },
    [onClose, onConvert, selected, t]
  );


  if (!open) return null;

  return (
    <div className="fixed inset-0 z-modal flex items-center justify-center p-4 bg-c-bg">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="batch-convert-modal-title"
        tabIndex={-1}
        className="w-full max-w-md rounded-2xl bg-c-surface-raised dark:bg-c-surface backdrop-blur-xl shadow-2xl overflow-hidden outline-none"
      >
        <div className="flex items-start justify-between px-5 py-4 border-b border-c-border-subtle dark:border-c-border-subtle">
          <div>
            <h3 id="batch-convert-modal-title" className="text-sm font-bold text-c-text dark:text-c-text">
              {t('ideas.mindmap.batchConvert', 'Batch Convert')}
            </h3>
            <p className="text-[11px] text-c-text-secondary dark:text-c-text-muted mt-0.5">
              {isPl
                ? `${eligibleNodes.length} elementów do konwersji`
                : `${eligibleNodes.length} items available`}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-c-text-secondary hover:text-c-text-secondary dark:hover:text-c-text hover:bg-c-surface-raised dark:hover:bg-c-surface transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <div className="px-5 py-3 max-h-[50vh] overflow-y-auto">
          <button
            onClick={toggleAll}
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-[11px] font-medium text-c-text-secondary dark:text-c-text-muted hover:bg-c-surface-raised dark:hover:bg-c-surface-raised transition-colors mb-2"
          >
            {selected.size === eligibleNodes.length ? (
              <CheckSquare size={14} className="text-c-warning" />
            ) : (
              <Square size={14} className="text-c-text-secondary" />
            )}
            {t('ideas.mindmap.selectAll', 'Select all')}
          </button>

          <div className="space-y-1">
            {eligibleNodes.map((node) => (
              <label
                key={node.id}
                className="flex items-center gap-2.5 px-2.5 py-2 rounded-xl hover:bg-c-surface-raised dark:hover:bg-c-surface-raised transition-colors cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={selected.has(node.id)}
                  onChange={() => toggleNode(node.id)}
                  className="rounded border-c-border-subtle text-c-warning focus:ring-c-warning"
                />
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] font-medium text-c-text-secondary dark:text-c-text truncate">
                    {node.label}
                  </div>
                  <div className="text-[9px] text-c-text-secondary">{node.branchKey}</div>
                </div>
                {node.status && node.status !== 'idea' && (
                  <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-full bg-c-surface-raised dark:bg-c-surface text-c-text-secondary dark:text-c-text-muted">
                    {node.status.replace(/_/g, ' ')}
                  </span>
                )}
              </label>
            ))}
          </div>
        </div>

        <div className="px-5 py-3 border-t border-c-border-subtle dark:border-c-border-subtle flex items-center gap-2">
          <button
            onClick={() => handleConvert('initiative')}
            disabled={locked || selected.size === 0 || converting}
            className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-bold bg-c-surface-raised text-c-warning dark:text-c-warning border border-c-warning transition-all disabled:opacity-40"
          >
            {converting ? <Loader2 size={12} className="animate-spin" /> : <Rocket size={12} />}
            {isPl
              ? `Konwertuj (${selected.size}) → Inicjatywy`
              : `Convert (${selected.size}) → Initiatives`}
          </button>
        </div>
      </div>
    </div>
  );
};

export default BatchConvertModal;
