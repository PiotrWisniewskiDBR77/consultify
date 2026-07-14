/**
 * NotebookExportMenu — dropdown to export the current notebook page as
 * Markdown, PDF, or DOCX (best-effort). Pure presentation over
 * `@/utils/notebookExport`; no network calls.
 *
 * Integration: render in the notebook header/toolbar (see SLOT comments in
 * NotebookContent owned by Agent 4). Pass the active page's title + content.
 */
import { Download, FileText, FileType, Loader2 } from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';

import {
  exportNotebookPage,
  type NotebookExportFormat,
  type NotebookExportPage,
} from '@/utils/notebookExport';

import i18n from '../../../i18n';

interface NotebookExportMenuProps {
  page: NotebookExportPage;
  isPolish?: boolean;
  className?: string;
  /** Optional: disable when the page has no persisted content. */
  disabled?: boolean;
}

const labels = () => ({
  trigger: i18n.t('notebook.exportMenu.label', 'Export'),
  markdown: 'Markdown (.md)',
  pdf: 'PDF (.pdf)',
  docx: i18n.t('notebook.exportMenu.label2', 'Word (.docx) — beta'),
  ariaMenu: i18n.t('notebook.exportMenu.label3', 'Note export options'),
});

export const NotebookExportMenu: React.FC<NotebookExportMenuProps> = ({
  page,
  isPolish = false,
  className = '',
  disabled = false,
}) => {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<NotebookExportFormat | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const exportLabels = labels();

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onEsc);
    };
  }, [open]);

  const run = useCallback(
    async (format: NotebookExportFormat) => {
      setBusy(format);
      try {
        await exportNotebookPage(page, format);
      } catch {
        // Export failures are non-fatal; the menu simply closes.
      } finally {
        setBusy(null);
        setOpen(false);
      }
    },
    [page]
  );

  const itemBase =
    'flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-c-text-secondary transition-colors hover:bg-c-surface-raised disabled:cursor-not-allowed disabled:opacity-60 dark:text-c-text dark:hover:bg-white/[0.06]';

  return (
    <div ref={rootRef} className={`relative inline-block ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 rounded-lg border border-c-border-subtle bg-c-surface px-2.5 py-1.5 text-[13px] font-medium text-c-text-secondary transition-colors hover:bg-c-surface-raised disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:bg-white/[0.04] dark:text-c-text dark:hover:bg-white/[0.08]"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
        <span>{exportLabels.trigger}</span>
      </button>

      {open && (
        <div
          role="menu"
          aria-label={exportLabels.ariaMenu}
          className="absolute right-0 z-50 mt-1 w-52 overflow-hidden rounded-xl border border-slate-200/60 dark:border-white/[0.03] bg-c-surface py-1 shadow-lg dark:border-white/10 dark:bg-navy-900"
        >
          <button
            type="button"
            role="menuitem"
            className={itemBase}
            disabled={busy !== null}
            onClick={() => run('markdown')}
          >
            <FileText className="h-4 w-4 text-c-text-muted" />
            {exportLabels.markdown}
          </button>
          <button
            type="button"
            role="menuitem"
            className={itemBase}
            disabled={busy !== null}
            onClick={() => run('pdf')}
          >
            <FileType className="h-4 w-4 text-c-text-muted" />
            {exportLabels.pdf}
          </button>
          <button
            type="button"
            role="menuitem"
            className={itemBase}
            disabled={busy !== null}
            onClick={() => run('docx')}
          >
            <FileType className="h-4 w-4 text-c-text-muted" />
            {exportLabels.docx}
          </button>
        </div>
      )}
    </div>
  );
};

export default NotebookExportMenu;
