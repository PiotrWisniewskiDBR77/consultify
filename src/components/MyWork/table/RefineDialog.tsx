/**
 * RefineDialog — modal for refining a Chat-to-Schema proposal.
 * Shows current proposal summary, text input for refinement instructions,
 * loading state, and version history.
 */
import { Edit3, History, Loader2, Sparkles, X } from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useDialogA11y } from '@/components/ui/primitives/useDialogA11y';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RefinementHistoryEntry {
  version: number;
  message: string;
  timestamp: string;
}

export interface RefineDialogProps {
  proposalSummary: string;
  proposalIntent: string;
  currentVersion: number;
  refinementHistory: RefinementHistoryEntry[];
  onRefine: (message: string) => Promise<void>;
  onClose: () => void;
  loading?: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const RefineDialog: React.FC<RefineDialogProps> = ({
  proposalSummary,
  proposalIntent,
  currentVersion,
  refinementHistory,
  onRefine,
  onClose,
  loading = false,
}) => {
  const { t } = useTranslation();

  const [message, setMessage] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialogA11y({ open: true, onClose, containerRef: dialogRef, initialFocusRef: textareaRef });

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const handleOverlayClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === overlayRef.current) onClose();
    },
    [onClose]
  );

  const handleSubmit = useCallback(async () => {
    const msg = message.trim();
    if (!msg || loading) return;
    await onRefine(msg);
    setMessage('');
  }, [message, loading, onRefine]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        handleSubmit();
      }
      if (e.key === 'Escape') {
        onClose();
      }
    },
    [handleSubmit, onClose]
  );

  const autoResize = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, []);

  const suggestions = [
    t('ideas.table.refineDialog.suggestionAddPriority', 'Add a priority field'),
    t(
      'ideas.table.refineDialog.suggestionChangeStatus',
      'Change status options to: New, Active, Closed'
    ),
    t('ideas.table.refineDialog.suggestionAddRelatedTable', 'Add a related table'),
    t('ideas.table.refineDialog.suggestionRemoveFields', 'Remove unnecessary fields'),
  ];

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      className="fixed inset-0 z-overlay flex items-center justify-center bg-black/40 dark:bg-black/60 backdrop-blur-sm transition-opacity duration-200"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="refine-dialog-title"
        tabIndex={-1}
        className="w-full max-w-lg mx-4 rounded-2xl border border-c-border bg-c-surface shadow-2xl overflow-hidden transition-all duration-200 animate-in fade-in zoom-in-95 outline-none"
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-2 px-5 py-4 border-b border-c-border-subtle">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-sky-500/15 flex items-center justify-center">
              <Edit3 size={16} className="text-sky-600 dark:text-sky-400" />
            </div>
            <div>
              <h3 id="refine-dialog-title" className="text-sm font-semibold text-c-text">
                {t('ideas.table.refineDialog.refineProposal', 'Refine Proposal')}
              </h3>
              <p className="text-[10px] text-c-text-secondary">
                {t('ideas.table.refineDialog.versionN', 'Version {{n}}', { n: currentVersion })} ·{' '}
                {proposalIntent.replace(/_/g, ' ')}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-c-surface-raised text-c-text-secondary hover:text-c-text-secondary transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Current proposal summary */}
        <div className="px-5 py-3 bg-c-surface-raised border-b border-c-border-subtle">
          <p className="text-[11px] font-medium text-c-text-muted uppercase tracking-wider mb-1">
            {t('ideas.table.refineDialog.currentProposal', 'Current proposal')}
          </p>
          <p className="text-xs text-c-text leading-relaxed line-clamp-3">{proposalSummary}</p>
        </div>

        {/* Refinement input */}
        <div className="px-5 py-4">
          <div className="relative">
            <textarea
              ref={textareaRef}
              value={message}
              onChange={(e) => {
                setMessage(e.target.value);
                autoResize();
              }}
              onKeyDown={handleKeyDown}
              placeholder={t(
                'ideas.table.refineDialog.describeChangesPlaceholder',
                'Describe changes, e.g., "Add a priority field", "Change status options"…'
              )}
              disabled={loading}
              rows={3}
              className="w-full px-4 py-3 rounded-xl border border-slate-200/60 dark:border-white/[0.03] bg-c-surface text-sm text-c-text placeholder-c-text-muted focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none resize-none transition-colors disabled:opacity-50"
            />
            <div className="absolute bottom-2 right-2 flex items-center gap-1">
              <span className="text-[9px] text-c-text-secondary">
                {t('ideas.table.refineDialog.cmdEnterToSend', '⌘+Enter to send')}
              </span>
            </div>
          </div>

          {/* Quick suggestions */}
          <div className="mt-3 flex flex-wrap gap-1.5">
            {suggestions.map((s) => (
              <button
                key={s}
                onClick={() => setMessage(s)}
                disabled={loading}
                className="text-[10px] px-2.5 py-1 rounded-lg border border-c-border-subtle text-c-text-muted hover:border-c-border hover:text-c-text transition-colors disabled:opacity-50"
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Version history */}
        {refinementHistory.length > 0 && (
          <div className="px-5 border-t border-c-border-subtle">
            <button
              onClick={() => setShowHistory((v) => !v)}
              className="flex items-center gap-1.5 py-2 text-[10px] font-medium text-c-text-secondary hover:text-c-text-secondary transition-colors w-full"
            >
              <History size={12} />
              {t('ideas.table.refineDialog.refinementHistory', 'Refinement history')} (
              {refinementHistory.length})
            </button>
            <div
              className={`overflow-hidden transition-all duration-200 ${
                showHistory ? 'max-h-40 opacity-100 pb-3' : 'max-h-0 opacity-0'
              }`}
            >
              <div className="space-y-1.5 max-h-32 overflow-y-auto">
                {refinementHistory.map((entry) => (
                  <div
                    key={entry.version}
                    className="flex items-start gap-2 text-[10px] text-c-text-muted"
                  >
                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-c-surface-raised flex items-center justify-center text-[9px] font-bold text-c-text-muted">
                      v{entry.version}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate">{entry.message}</p>
                      <p className="text-[9px] text-c-text-secondary">
                        {new Date(entry.timestamp).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Footer actions */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-c-border-subtle bg-c-surface-raised">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 rounded-xl text-xs font-medium text-c-text-secondary hover:bg-c-surface-raised transition-colors disabled:opacity-50"
          >
            {t('ideas.table.cancel', 'Cancel')}
          </button>
          <button
            onClick={handleSubmit}
            disabled={!message.trim() || loading}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-c-text text-c-bg hover:bg-c-text-secondary disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
          >
            {loading ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                {t('ideas.table.refineDialog.processing', 'Processing…')}
              </>
            ) : (
              <>
                <Sparkles size={14} />
                {t('ideas.table.refineDialog.refine', 'Refine')}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default RefineDialog;
