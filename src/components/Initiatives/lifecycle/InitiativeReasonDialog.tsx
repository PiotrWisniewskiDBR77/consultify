/**
 * Okno wymaganego powodu (DEC-424: „wymagany powód" przy zwrocie, odrzuceniu,
 * anulowaniu i wstrzymaniu).
 *
 * Powodu NIE DA SIĘ pominąć: przycisk potwierdzenia jest nieaktywny do czasu
 * wpisania niepustego tekstu, a `Enter` w polu nie zatwierdza formularza.
 */

import { X } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

export interface InitiativeReasonDialogProps {
  open: boolean;
  title: string;
  confirmLabel: string;
  /** `true` dla odrzucenia/anulowania — jedyny przypadek czerwieni. */
  destructive?: boolean;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
}

export const InitiativeReasonDialog: React.FC<InitiativeReasonDialogProps> = ({
  open,
  title,
  confirmLabel,
  destructive = false,
  busy = false,
  onCancel,
  onConfirm,
}) => {
  const { t } = useTranslation();
  const [reason, setReason] = useState('');
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (open) {
      setReason('');
      window.setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onCancel]);

  if (!open) return null;
  const trimmed = reason.trim();

  return (
    <div
      className="fixed inset-0 z-[140] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      data-testid="initiative-reason-dialog"
    >
      <div className="w-full max-w-lg rounded-2xl border border-c-border bg-c-surface-1 shadow-2xl">
        <div className="px-4 py-3 border-b border-c-border flex items-center justify-between">
          <h3 className="text-sm font-semibold text-c-text-primary">{title}</h3>
          <button
            type="button"
            onClick={onCancel}
            aria-label={t('common.close', 'Zamknij')}
            className="p-1.5 rounded-md text-c-text-muted hover:bg-c-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
          >
            <X size={16} />
          </button>
        </div>
        <div className="px-4 py-4 space-y-2">
          <label
            htmlFor="initiative-reason-input"
            className="block text-xs font-medium text-c-text-secondary"
          >
            {t('initiatives.lifecycle.reasonLabel', 'Powód (wymagany)')}
          </label>
          <textarea
            id="initiative-reason-input"
            ref={inputRef}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            rows={4}
            maxLength={500}
            data-testid="initiative-reason-input"
            placeholder={t(
              'initiatives.lifecycle.reasonPlaceholder',
              'Napisz, dlaczego podejmujesz tę decyzję — trafi do historii inicjatywy.'
            )}
            className="w-full rounded-lg border border-c-border bg-c-surface-2 px-3 py-2 text-sm text-c-text-primary placeholder:text-c-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
          />
          <p className="text-[11px] text-c-text-muted">
            {t(
              'initiatives.lifecycle.reasonHint',
              'Bez powodu ta operacja nie zostanie zapisana.'
            )}
          </p>
        </div>
        <div className="px-4 py-3 border-t border-c-border flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex items-center h-9 px-4 rounded-full border border-c-border bg-transparent text-xs font-medium text-c-text-secondary hover:bg-c-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
          >
            {t('common.cancel', 'Anuluj')}
          </button>
          <button
            type="button"
            disabled={!trimmed || busy}
            data-testid="initiative-reason-confirm"
            onClick={() => onConfirm(trimmed)}
            className={[
              'inline-flex items-center h-9 px-4 rounded-full border text-xs font-medium transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus',
              'disabled:opacity-45 disabled:cursor-not-allowed',
              destructive
                ? 'border-danger-300/40 dark:border-danger-500/30 bg-danger-50 dark:bg-danger-500/10 text-danger-700 dark:text-danger-200 hover:bg-danger-100/70'
                : 'border-c-border bg-c-surface-2 text-c-text-primary hover:bg-c-surface-raised',
            ].join(' ')}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export default InitiativeReasonDialog;
