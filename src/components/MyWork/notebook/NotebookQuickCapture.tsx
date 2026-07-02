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
      className={`flex items-center gap-2 rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900/40 px-2.5 py-2 focus-within:border-slate-400 focus-within:ring-2 focus-within:ring-slate-500/15 ${className}`}
    >
      <span className="text-slate-400">
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
        className="min-w-0 flex-1 bg-transparent text-sm text-slate-800 dark:text-slate-100 placeholder:text-slate-400 outline-none"
      />
      <button
        type="button"
        onClick={submit}
        disabled={busy || !value.trim()}
        className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-slate-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-slate-700 disabled:opacity-40"
      >
        {busy ? <Loader2 size={13} className="animate-spin" /> : null}
        {isPl ? 'Wrzuć' : 'Capture'}
      </button>
    </div>
  );
};

export default NotebookQuickCapture;
