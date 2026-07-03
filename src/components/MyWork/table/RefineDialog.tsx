/**
 * RefineDialog — modal for refining a Chat-to-Schema proposal.
 * Shows current proposal summary, text input for refinement instructions,
 * loading state, and version history.
 */
import { Edit3, History, Loader2, Sparkles, X } from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

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
  const { i18n } = useTranslation();
  const isPl = i18n.language?.startsWith('pl');

  const [message, setMessage] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

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

  const suggestions = isPl
    ? [
        'Dodaj pole priorytet',
        'Zmień opcje statusu na: Nowy, Aktywny, Zamknięty',
        'Dodaj tabelę powiązaną',
        'Usuń niepotrzebne pola',
      ]
    : [
        'Add a priority field',
        'Change status options to: New, Active, Closed',
        'Add a related table',
        'Remove unnecessary fields',
      ];

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      className="fixed inset-0 z-overlay flex items-center justify-center bg-black/40 dark:bg-black/60 backdrop-blur-sm transition-opacity duration-200"
    >
      <div className="w-full max-w-lg mx-4 rounded-2xl border border-primary-500/30 bg-white dark:bg-zinc-900 dark:border-zinc-700 shadow-2xl overflow-hidden transition-all duration-200 animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="flex items-center justify-between gap-2 px-5 py-4 border-b border-slate-200/60 dark:border-zinc-700/60">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-sky-500/15 flex items-center justify-center">
              <Edit3 size={16} className="text-sky-600 dark:text-sky-400" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-800 dark:text-zinc-100">
                {isPl ? 'Doprecyzuj propozycję' : 'Refine Proposal'}
              </h3>
              <p className="text-[10px] text-slate-600 dark:text-zinc-500">
                {isPl ? `Wersja ${currentVersion}` : `Version ${currentVersion}`} ·{' '}
                {proposalIntent.replace(/_/g, ' ')}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-600 hover:text-slate-600 dark:hover:text-zinc-300 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Current proposal summary */}
        <div className="px-5 py-3 bg-slate-50/50 dark:bg-zinc-800/30 border-b border-slate-200/40 dark:border-zinc-700/40">
          <p className="text-[11px] font-medium text-slate-500 dark:text-zinc-400 uppercase tracking-wider mb-1">
            {isPl ? 'Aktualna propozycja' : 'Current proposal'}
          </p>
          <p className="text-xs text-slate-700 dark:text-zinc-200 leading-relaxed line-clamp-3">
            {proposalSummary}
          </p>
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
              placeholder={
                isPl
                  ? 'Opisz zmiany, np. "Dodaj pole priorytet", "Zmień opcje statusu"…'
                  : 'Describe changes, e.g., "Add a priority field", "Change status options"…'
              }
              disabled={loading}
              rows={3}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-sm text-slate-800 dark:text-zinc-200 placeholder-slate-400 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none resize-none transition-colors disabled:opacity-50"
            />
            <div className="absolute bottom-2 right-2 flex items-center gap-1">
              <span className="text-[9px] text-slate-600 dark:text-zinc-600">
                {isPl ? '⌘+Enter wyślij' : '⌘+Enter to send'}
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
                className="text-[10px] px-2.5 py-1 rounded-lg border border-slate-200 dark:border-zinc-700 text-slate-500 dark:text-zinc-400 hover:border-primary-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors disabled:opacity-50"
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Version history */}
        {refinementHistory.length > 0 && (
          <div className="px-5 border-t border-slate-200/40 dark:border-zinc-700/40">
            <button
              onClick={() => setShowHistory((v) => !v)}
              className="flex items-center gap-1.5 py-2 text-[10px] font-medium text-slate-600 dark:text-zinc-500 hover:text-slate-600 dark:hover:text-zinc-300 transition-colors w-full"
            >
              <History size={12} />
              {isPl ? 'Historia doprecyzowań' : 'Refinement history'} ({refinementHistory.length})
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
                    className="flex items-start gap-2 text-[10px] text-slate-500 dark:text-zinc-400"
                  >
                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-slate-100 dark:bg-zinc-800 flex items-center justify-center text-[9px] font-bold text-slate-500 dark:text-zinc-400">
                      v{entry.version}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate">{entry.message}</p>
                      <p className="text-[9px] text-slate-600 dark:text-zinc-600">
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
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-slate-200/60 dark:border-zinc-700/60 bg-slate-50/50 dark:bg-zinc-800/30">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 rounded-xl text-xs font-medium text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50"
          >
            {isPl ? 'Anuluj' : 'Cancel'}
          </button>
          <button
            onClick={handleSubmit}
            disabled={!message.trim() || loading}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-navy-900 text-white dark:bg-slate-50 dark:text-navy-950 dark:hover:bg-slate-200 hover:bg-navy-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
          >
            {loading ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                {isPl ? 'Przetwarzanie…' : 'Processing…'}
              </>
            ) : (
              <>
                <Sparkles size={14} />
                {isPl ? 'Doprecyzuj' : 'Refine'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default RefineDialog;
