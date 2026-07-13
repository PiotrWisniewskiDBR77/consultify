/**
 * NotebookQuickCapture — drop a thought or a link into the notebook from anywhere.
 *
 * Single text/URL input + a button. On submit it creates a notebook page via the
 * existing POST /api/my-work/notebook/pages (reused through Api.createNotebookPage)
 * with capture_source='quick' and visibility='private', then toasts and calls
 * onCreated(page) so the host (e.g. NotebookTodayView) can refresh.
 *
 * URLs are detected and stored as the body so they survive as a fresh capture.
 * Inline i18n (isPolish) to match neighbouring notebook components.
 *
 * Owned by AGENT 2. Host wiring: see report (Today capture slot).
 */
import { Link2, Loader2, Plus } from 'lucide-react';
import React, { useCallback, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { Api } from '@/services/api';

interface NotebookQuickCaptureProps {
  /** Called with the freshly created page after a successful capture. */
  onCreated?: (page: any) => void;
  /** Optional notebook container to drop the capture into. */
  notebookId?: string | null;
  className?: string;
}

const URL_RE = /^https?:\/\/\S+$/i;

function deriveTitle(raw: string, isPl: boolean): string {
  const text = raw.trim();
  if (!text) return isPl ? 'Szybka notatka' : 'Quick note';
  if (URL_RE.test(text)) {
    try {
      const u = new URL(text);
      return u.hostname.replace(/^www\./, '') + u.pathname.replace(/\/$/, '');
    } catch {
      return text.slice(0, 80);
    }
  }
  // First line / first ~80 chars as the title.
  const firstLine = text.split('\n')[0].trim();
  return firstLine.length > 80 ? `${firstLine.slice(0, 77)}…` : firstLine;
}

export const NotebookQuickCapture: React.FC<NotebookQuickCaptureProps> = ({
  onCreated,
  notebookId = null,
  className = '',
}) => {
  const { i18n } = useTranslation();
  const isPl = i18n.language === 'pl';

  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);

  const isUrl = URL_RE.test(value.trim());

  const submit = useCallback(async () => {
    const raw = value.trim();
    if (!raw || busy) return;
    setBusy(true);
    try {
      const title = deriveTitle(raw, isPl);
      const page = await Api.createNotebookPage({
        title,
        contentText: raw,
        contentJson: {
          type: 'doc',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: raw }] }],
        },
        visibility: 'private',
        notebookId: notebookId ?? undefined,
        // capture_source marks this as a fresh capture for the Today cockpit.
        captureSource: 'quick',
      } as any);
      setValue('');
      toast.success(isPl ? 'Wrzucono do notatnika' : 'Captured to notebook');
      onCreated?.(page);
    } catch (err: any) {
      toast.error(
        err?.message || (isPl ? 'Nie udało się wrzucić' : 'Capture failed')
      );
    } finally {
      setBusy(false);
    }
  }, [value, busy, isPl, notebookId, onCreated]);

  return (
    <div
      className={`flex items-center gap-2 rounded-xl border border-slate-200/60 dark:border-white/[0.03] bg-c-surface/40 px-2.5 py-2 focus-within:border-c-border-strong focus-within:ring-2 focus-within:ring-[var(--c-focus)] ${className}`}
    >
      <span className="text-c-text-muted">
        {isUrl ? <Link2 size={15} /> : <Plus size={15} />}
      </span>
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            submit();
          }
        }}
        disabled={busy}
        placeholder={
          isPl ? 'Wrzuć myśl lub link…' : 'Drop a thought or a link…'
        }
        className="min-w-0 flex-1 bg-transparent text-sm text-c-text placeholder:text-c-text-muted outline-none"
      />
      <button
        type="button"
        onClick={submit}
        disabled={busy || !value.trim()}
        // #12a — "Capture" alone didn't explain what it does; add a tooltip/aria-label
        // spelling out that it drops this into a new quick note in the notebook.
        title={
          isPl
            ? 'Zapisz jako nową szybką notatkę w notatniku'
            : 'Save as a new quick note in the notebook'
        }
        aria-label={
          isPl
            ? 'Zapisz jako nową szybką notatkę w notatniku'
            : 'Save as a new quick note in the notebook'
        }
        // #12a follow-up — bg-c-accent is the SOLE brand crimson token (index.css);
        // a full-fill CTA violates CLAUDE.md UI-rule #3 (crimson = critical semantics
        // only, CTAs must be neutral). bg-c-text/text-c-surface self-invert per theme
        // (light: #0f172a ink on white; dark: #f4f7fb near-white on navy-900 — see
        // index.css c-text/c-surface tokens) which already matches the canon "primary
        // CTA = ciemny wypełniony, w dark jasny inwers" (docs/ui-standards/TRIADA_KANON.md,
        // MENU_1_PRIMARY_CTA in ModuleMenu3.tsx) — no extra dark: override needed.
        className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-c-text px-3 py-1.5 text-xs font-medium text-c-surface transition-colors hover:brightness-110 disabled:opacity-40"
      >
        {busy ? <Loader2 size={13} className="animate-spin" /> : null}
        {isPl ? 'Wrzuć' : 'Capture'}
      </button>
    </div>
  );
};

export default NotebookQuickCapture;
