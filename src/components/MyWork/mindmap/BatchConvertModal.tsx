/**
 * BatchConvertModal — Select multiple nodes and convert them to initiatives.
 */
import { CheckSquare, Loader2, Rocket, Square, X } from 'lucide-react';
import React, { useCallback, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

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
  const { i18n } = useTranslation();
  const isPl = i18n.language?.startsWith('pl');

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [converting, setConverting] = useState(false);

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
          isPl ? `Konwertowano ${selected.size} elementów` : `Converted ${selected.size} items`,
          { duration: 1500 }
        );
        onClose();
      } finally {
        setConverting(false);
      }
    },
    [isPl, onClose, onConvert, selected]
  );

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-modal flex items-center justify-center p-4 bg-black/40">
      <div className="w-full max-w-md rounded-2xl bg-white/95 dark:bg-navy-900/95 backdrop-blur-xl shadow-2xl overflow-hidden">
        <div className="flex items-start justify-between px-5 py-4 border-b border-slate-200/60 dark:border-navy-700/60">
          <div>
            <h3 className="text-sm font-bold text-slate-800 dark:text-white">
              {isPl ? 'Konwersja zbiorcza' : 'Batch Convert'}
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              {isPl
                ? `${eligibleNodes.length} elementów do konwersji`
                : `${eligibleNodes.length} items available`}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-600 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <div className="px-5 py-3 max-h-[50vh] overflow-y-auto">
          <button
            onClick={toggleAll}
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-[11px] font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100/60 dark:hover:bg-white/[0.04] transition-colors mb-2"
          >
            {selected.size === eligibleNodes.length ? (
              <CheckSquare size={14} className="text-amber-500" />
            ) : (
              <Square size={14} className="text-slate-600" />
            )}
            {isPl ? 'Zaznacz wszystko' : 'Select all'}
          </button>

          <div className="space-y-1">
            {eligibleNodes.map((node) => (
              <label
                key={node.id}
                className="flex items-center gap-2.5 px-2.5 py-2 rounded-xl hover:bg-slate-100/60 dark:hover:bg-white/[0.03] transition-colors cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={selected.has(node.id)}
                  onChange={() => toggleNode(node.id)}
                  className="rounded border-slate-300 text-amber-500 focus:ring-amber-500"
                />
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] font-medium text-slate-700 dark:text-slate-200 truncate">
                    {node.label}
                  </div>
                  <div className="text-[9px] text-slate-600">{node.branchKey}</div>
                </div>
                {node.status && node.status !== 'idea' && (
                  <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-navy-800 text-slate-500 dark:text-slate-400">
                    {node.status.replace(/_/g, ' ')}
                  </span>
                )}
              </label>
            ))}
          </div>
        </div>

        <div className="px-5 py-3 border-t border-slate-200/60 dark:border-navy-700/60 flex items-center gap-2">
          <button
            onClick={() => handleConvert('initiative')}
            disabled={locked || selected.size === 0 || converting}
            className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-bold bg-gradient-to-r from-amber-500/15 to-amber-500/10 text-amber-700 dark:text-amber-300 hover:from-amber-500/25 hover:to-amber-500/15 border border-amber-500/10 transition-all disabled:opacity-40"
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
