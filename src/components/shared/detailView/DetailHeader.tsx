/**
 * DetailHeader — canonical top bar for a heavy-artifact detail view.
 *
 * Mirrors the Initiative document header (the gold standard): back · status dot
 * + title · artifact ID chip (copyable) · copy-link · saved indicator · N/C
 * view toggle.
 *
 * The artifact ID (INIT-…, INS-…, TSK-…) is a first-class, addressable handle
 * (owner: "insight ma unikatowy numer indeksowy, który można jako artefakt
 * później podpinać" — #27). Here it's displayed in monospace with one-click
 * copy so it can be referenced from Reports / Decks / Notes / other artifacts.
 */

import { Check, ChevronLeft, Copy, Link2 } from 'lucide-react';
import React, { useCallback, useState } from 'react';

import type { DetailViewMode, MetricTone } from './types';
import { ViewModeToggle } from './ViewModeToggle';

const STATUS_DOT: Record<MetricTone, string> = {
  neutral: 'bg-slate-400',
  info: 'bg-blue-500',
  pending: 'bg-amber-500',
  success: 'bg-emerald-500',
  warning: 'bg-orange-500',
  danger: 'bg-rose-500',
};

export interface DetailHeaderProps {
  title: string;
  /** Semantic tone for the leading status dot. */
  statusTone?: MetricTone;
  /** Addressable artifact ID, e.g. "INS-II_A0552A23" / "INIT-1ADDB472-3DD". */
  artifactId?: string;
  /** Stable URL to copy when the link icon is clicked. Falls back to ID copy. */
  shareUrl?: string;
  /** Saved | Saving… | Unsaved indicator text (already localized by caller). */
  savedLabel?: string;
  saving?: boolean;
  onBack?: () => void;
  /** View mode controls — omit to hide the N/C toggle. */
  viewMode?: DetailViewMode;
  onViewModeChange?: (mode: DetailViewMode) => void;
  viewModePersistKey?: string;
  isPolish?: boolean;
  /** Extra controls rendered between the ID and the view toggle. */
  rightSlot?: React.ReactNode;
  className?: string;
}

export const DetailHeader: React.FC<DetailHeaderProps> = ({
  title,
  statusTone = 'neutral',
  artifactId,
  shareUrl,
  savedLabel,
  saving = false,
  onBack,
  viewMode,
  onViewModeChange,
  viewModePersistKey,
  isPolish = false,
  rightSlot,
  className = '',
}) => {
  const [copiedId, setCopiedId] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const copy = useCallback(async (text: string, mark: (v: boolean) => void) => {
    try {
      await navigator.clipboard.writeText(text);
      mark(true);
      setTimeout(() => mark(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  }, []);

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          aria-label={isPolish ? 'Wstecz' : 'Back'}
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-white/[0.06] dark:hover:text-slate-200"
        >
          <ChevronLeft size={18} />
        </button>
      )}

      <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${STATUS_DOT[statusTone]}`} aria-hidden />

      <h1 className="min-w-0 truncate text-lg font-semibold text-slate-900 dark:text-slate-100">
        {title}
      </h1>

      {artifactId && (
        <button
          type="button"
          onClick={() => copy(artifactId, setCopiedId)}
          title={isPolish ? 'Kopiuj ID artefaktu' : 'Copy artifact ID'}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-slate-200/70 bg-slate-50 px-2 py-1 font-mono text-[11px] text-slate-500 transition-colors hover:bg-slate-100 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-slate-400 dark:hover:bg-white/[0.07]"
        >
          {copiedId ? <Check size={11} className="text-emerald-500" /> : <Copy size={11} />}
          <span>{artifactId}</span>
        </button>
      )}

      <div className="flex-1" />

      {savedLabel && (
        <span
          className={`inline-flex items-center gap-1.5 text-xs ${saving ? 'text-amber-500' : 'text-emerald-500'}`}
        >
          {!saving && <Check size={13} />}
          {savedLabel}
        </span>
      )}

      {(shareUrl || artifactId) && (
        <button
          type="button"
          onClick={() => copy(shareUrl || artifactId || '', setCopiedLink)}
          title={isPolish ? 'Kopiuj link' : 'Copy link'}
          aria-label={isPolish ? 'Kopiuj link' : 'Copy link'}
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-white/[0.06] dark:hover:text-slate-200"
        >
          {copiedLink ? <Check size={15} className="text-emerald-500" /> : <Link2 size={15} />}
        </button>
      )}

      {rightSlot}

      {viewMode && onViewModeChange && (
        <ViewModeToggle
          mode={viewMode}
          onChange={onViewModeChange}
          persistKey={viewModePersistKey}
          isPolish={isPolish}
        />
      )}
    </div>
  );
};

export default DetailHeader;
