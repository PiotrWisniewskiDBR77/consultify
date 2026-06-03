/**
 * AIFillDialog — Propose→accept for AI fill
 *
 * Shows field label, proposed value, confidence, source, reasoning.
 * Actions: Accept, Reject, Edit. Bulk: per-item accept/reject + Accept All.
 * DBR77: Layer-3 overlay, rounded-xl.
 *
 * @see V3-K01: N-mode required sections/fields + completeness + AI assist
 */

import { Check, Pencil, Sparkles, X } from 'lucide-react';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

import type { AIFillProposal } from './types';

interface AIFillDialogProps {
  open: boolean;
  onClose: () => void;
  proposals: AIFillProposal[];
  onAccept: (fieldId: string, value: unknown) => void;
  onReject: (fieldId: string) => void;
  onAcceptAll?: (accepted: Array<{ fieldId: string; value: unknown }>) => void;
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (Array.isArray(value)) return value.map(String).join(', ');
  return JSON.stringify(value);
}

export const AIFillDialog: React.FC<AIFillDialogProps> = ({
  open,
  onClose,
  proposals,
  onAccept,
  onReject,
  onAcceptAll,
}) => {
  const { t } = useTranslation();
  const [rejected, setRejected] = useState<Set<string>>(new Set());
  const [editedValues, setEditedValues] = useState<Record<string, string>>({});
  const [editingId, setEditingId] = useState<string | null>(null);

  const pending = proposals.filter((p) => !rejected.has(p.fieldId));
  const canAcceptAll = onAcceptAll && pending.length > 1;

  const handleAccept = (p: AIFillProposal) => {
    const value = editedValues[p.fieldId] ?? p.proposedValue;
    const finalValue =
      typeof value === 'string' && p.type === 'number'
        ? Number(value)
        : typeof value === 'string' && p.type === 'date'
          ? value
          : value;
    onAccept(p.fieldId, finalValue);
    setEditingId(null);
    setEditedValues((prev) => {
      const next = { ...prev };
      delete next[p.fieldId];
      return next;
    });
  };

  const handleReject = (fieldId: string) => {
    setRejected((prev) => new Set(prev).add(fieldId));
    onReject(fieldId);
  };

  const handleAcceptAllClick = () => {
    if (!onAcceptAll) return;
    const accepted = pending.map((p) => {
      const value = editedValues[p.fieldId] ?? p.proposedValue;
      return { fieldId: p.fieldId, value };
    });
    onAcceptAll(accepted);
    setRejected(new Set());
    setEditedValues({});
    setEditingId(null);
    onClose();
  };

  const handleClose = () => {
    setRejected(new Set());
    setEditedValues({});
    setEditingId(null);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-lg rounded-xl shadow-hig-xl border-slate-200/60 dark:border-navy-600/40 bg-white dark:bg-navy-900">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-semibold">
            <Sparkles size={20} className="text-primary-500" />
            {proposals.length === 1
              ? t('nmodeCompleteness.aiFillTitle')
              : t('nmodeCompleteness.aiFillBulkTitle')}
          </DialogTitle>
        </DialogHeader>

        <div className="max-h-[320px] overflow-y-auto space-y-4 py-2">
          {proposals.map((p) => {
            if (rejected.has(p.fieldId)) return null;
            const isEditing = editingId === p.fieldId;
            const displayValue = editedValues[p.fieldId] ?? formatValue(p.proposedValue);

            return (
              <div
                key={p.fieldId}
                className="rounded-xl bg-slate-50/80 dark:bg-navy-800/50 p-4 space-y-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="text-sm font-medium text-slate-800 dark:text-slate-100">
                    {p.fieldLabel ?? p.fieldPath.split('.').pop() ?? p.fieldId}
                  </span>
                  <span
                    className={`shrink-0 px-2 py-0.5 rounded text-[10px] font-medium ${
                      p.confidence >= 0.8
                        ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                        : p.confidence >= 0.5
                          ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400'
                          : 'bg-slate-500/20 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    {Math.round(p.confidence * 100)}%
                  </span>
                </div>
                {isEditing ? (
                  <textarea
                    value={editedValues[p.fieldId] ?? formatValue(p.proposedValue)}
                    onChange={(e) =>
                      setEditedValues((prev) => ({
                        ...prev,
                        [p.fieldId]: e.target.value,
                      }))
                    }
                    className="w-full min-h-[80px] px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-navy-600 bg-white dark:bg-navy-900"
                    autoFocus
                  />
                ) : (
                  <p className="text-sm text-slate-600 dark:text-slate-300">{displayValue}</p>
                )}
                {p.reasoning && (
                  <p className="text-xs text-slate-500 dark:text-slate-400">{p.reasoning}</p>
                )}
                {p.source && (
                  <p className="text-[10px] text-slate-600 dark:text-slate-500">
                    {t('nmodeCompleteness.source')}: {p.source}
                  </p>
                )}
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => handleAccept(p)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/30 transition-colors"
                  >
                    <Check size={14} />
                    {t('nmodeCompleteness.accept')}
                  </button>
                  <button
                    type="button"
                    onClick={() => (isEditing ? setEditingId(null) : setEditingId(p.fieldId))}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-navy-700/60 transition-colors"
                  >
                    <Pencil size={14} />
                    {isEditing ? t('nmodeCompleteness.cancelEdit') : t('nmodeCompleteness.edit')}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleReject(p.fieldId)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 transition-colors"
                  >
                    <X size={14} />
                    {t('nmodeCompleteness.reject')}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <DialogFooter className="flex flex-row justify-between sm:justify-between gap-2">
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors"
          >
            {t('nmodeCompleteness.close')}
          </button>
          {canAcceptAll && (
            <button
              type="button"
              onClick={handleAcceptAllClick}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-primary-500/20 text-primary-600 dark:text-primary-400 hover:bg-primary-500/30 transition-colors"
            >
              <Check size={16} />
              {t('nmodeCompleteness.acceptAll')}
            </button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AIFillDialog;
