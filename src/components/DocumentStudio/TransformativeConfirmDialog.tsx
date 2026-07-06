/**
 * B1 — explicit confirmation gate for the "transformative" editor scope
 * (Slice E3.6). Transformative proposals can rewrite every section of a
 * document, so the user must see the blast radius and actively continue
 * before the proposal request is sent to the server.
 *
 * Replaces the previous `window.confirm(...)` call in
 * DocumentStudioEditorPanel with a panel-styled modal that matches the
 * rest of Document Studio (c-* tokens only, no raw `primary`/crimson
 * classes — see VISUAL_STANDARD.md §5.1 and the crimson-CTA cleanup).
 */
import { AlertTriangle } from 'lucide-react';
import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';

import Button from '@/components/ui/primitives/Button';

export interface TransformativeConfirmDialogProps {
  /** Whether the dialog is visible. */
  open: boolean;
  /** Called when the user cancels (backdrop click, Escape, or Cancel button). */
  onCancel: () => void;
  /** Called when the user explicitly confirms the transformative request. */
  onConfirm: () => void;
  /** Disables the confirm button and shows a busy label while submitting. */
  submitting?: boolean;
}

export const TransformativeConfirmDialog: React.FC<TransformativeConfirmDialogProps> = ({
  open,
  onCancel,
  onConfirm,
  submitting = false,
}) => {
  const { t } = useTranslation();
  const dialogRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return undefined;
    // Remember whatever had focus before the dialog opened (the "Create
    // proposal" button) so we can return focus to it on close — otherwise
    // keyboard/screen-reader users land back at the top of the document.
    triggerRef.current = document.activeElement as HTMLElement | null;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onCancel();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    const focusTimer = setTimeout(() => dialogRef.current?.focus(), 0);
    return () => {
      clearTimeout(focusTimer);
      document.removeEventListener('keydown', handleKeyDown);
      triggerRef.current?.focus?.();
    };
  }, [open, onCancel]);

  if (!open || typeof window === 'undefined') return null;

  const consequences = t('documentStudio.editor.transformativeConsequences', {
    returnObjects: true,
    defaultValue: [
      'Every section and block in the document may be rewritten.',
      'The current structure, headings, and wording can all change.',
      'You will still review a before/after diff and can reject the proposal before anything is applied.',
    ],
  });
  const consequenceList = Array.isArray(consequences) ? (consequences as string[]) : [];

  return createPortal(
    <div
      className="fixed inset-0 z-modal flex items-center justify-center bg-black/30 p-4 backdrop-blur-sm dark:bg-black/50"
      onClick={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="transformative-confirm-title"
        aria-describedby="transformative-confirm-description"
        tabIndex={-1}
        className="w-full max-w-md rounded-xl border border-slate-200/60 dark:border-white/[0.03] bg-c-surface p-5 shadow-[0_25px_50px_rgba(0,0,0,0.15),0_12px_24px_rgba(0,0,0,0.1)] outline-none dark:shadow-[0_25px_50px_rgba(0,0,0,0.5),0_12px_24px_rgba(0,0,0,0.4)]"
      >
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-c-warning/15 text-c-warning">
            <AlertTriangle size={18} aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id="transformative-confirm-title" className="text-sm font-semibold text-c-text">
              {t('documentStudio.editor.transformativeConfirmTitle', 'Rebuild the whole document?')}
            </h2>
            <p
              id="transformative-confirm-description"
              className="mt-1 text-sm text-c-text-secondary"
            >
              {t(
                'documentStudio.editor.transformativeConfirm',
                'This can dramatically rebuild the document. Continue?'
              )}
            </p>
          </div>
        </div>

        {consequenceList.length > 0 ? (
          <ul className="mt-3 space-y-1.5 rounded-lg border border-c-border bg-c-surface-raised p-3 text-xs text-c-text-secondary">
            {consequenceList.map((line, index) => (
              <li key={index} className="flex gap-2">
                <span aria-hidden="true">&bull;</span>
                <span>{line}</span>
              </li>
            ))}
          </ul>
        ) : null}

        <div className="mt-4 flex justify-end gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={onCancel}
            disabled={submitting}
          >
            {t('documentStudio.editor.transformativeCancel', 'Cancel')}
          </Button>
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={onConfirm}
            loading={submitting}
            disabled={submitting}
          >
            {t('documentStudio.editor.transformativeContinue', 'Continue')}
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default TransformativeConfirmDialog;
