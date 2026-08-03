/**
 * B4 — inline confirmation banner shown after a successful export.
 *
 * Complements the transient `toast.success` with a persistent, dismissible
 * note that carries the "share it" affordance: the ExecutiveModuleShell does
 * not expose programmatic right-rail control, so the affordance is a textual
 * shortcut pointing the user at the existing "Share links" rail tool rather
 * than a new share system.
 *
 * Zero crimson: only neutral `c-*` tokens + the green success accent,
 * matching the panel's existing inline banners (see the amber warnings chip).
 */

import { CheckCircle2, Share2, X } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

export const DocumentExportSuccessNote: React.FC<{
  format: 'markdown' | 'docx' | 'pdf';
  onDismiss: () => void;
}> = ({ format, onDismiss }) => {
  const { t } = useTranslation();
  return (
    <div
      role="status"
      data-testid="document-export-success-note"
      className="flex items-start justify-between gap-3 rounded-md border border-c-success/40 bg-c-success/10 px-3 py-2 text-xs text-c-text"
    >
      <div className="flex flex-col gap-1">
        <span className="flex items-center gap-1.5 font-medium text-c-text">
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-c-success" aria-hidden />
          {t('documentStudio.panel.exportSuccess', {
            defaultValue: '{{format}} exported — the download has started.',
            format: format.toUpperCase(),
          })}
        </span>
        <span className="flex items-center gap-1.5 text-c-text-secondary">
          <Share2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
          {t(
            'documentStudio.panel.exportShareHint',
            'Want to share it? Open “Share links” in the right-hand panel.'
          )}
        </span>
      </div>
      <button
        type="button"
        onClick={onDismiss}
        aria-label={t('documentStudio.panel.dismiss', 'Dismiss')}
        className="shrink-0 rounded p-0.5 text-c-text-muted transition-colors hover:text-c-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
      >
        <X className="h-3.5 w-3.5" aria-hidden />
      </button>
    </div>
  );
};

export default DocumentExportSuccessNote;
