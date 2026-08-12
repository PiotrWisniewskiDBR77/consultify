/**
 * FinancialCaseDialog — dialog chrome around `FinancialCaseView`, so it can
 * mount from `IdeaTableTool`'s toolbar the same way every other tool dialog
 * in that file does (`IdeaScoringModel`, `IdeaPipeline`, `ExportToPresentation`
 * — fixed-overlay, header + close, no chrome of its own inside the view).
 * Program E / epic E09, master program §7.3.
 *
 * ── MOUNT POINT (read before moving this) ──────────────────────────────────
 * `IdeaTableTool.tsx` is ~4900 lines with live realtime-collaboration state;
 * threading a brand-new `viewLayout` value through its table/kanban/calendar
 * switch (the tab-strip the master program names) would touch that shared
 * state machine. A toolbar-triggered dialog — the exact pattern every
 * existing Table sub-tool already uses — reaches the same "a user can open
 * this for real" bar with a far smaller, additive diff.
 *
 * ── PERSISTENCE (RISK-12, closed by stream S6-E09) ─────────────────────────
 * This header used to read "WHAT DOES NOT PERSIST YET" and state that the
 * case "lives in this dialog's own component state and resets on close/
 * reopen". That is no longer true, and the acceptance doc's verdict (c)
 * ("no save path at all, the UI silently discards the user's work") is
 * superseded — see 10_FINANCIAL_CASE_ACCEPTANCE.md §6.
 *
 * The dialog now owns the I/O and `FinancialCaseView` stays a pure editor:
 *   - `useIdeaFinancialCasePersistence` loads the stored case on open and
 *     saves it through PUT /api/idea-financial-case/:ideaId with optimistic
 *     concurrency (see that hook's header for why EXPLICIT SAVE, not autosave);
 *   - `initialCase` + `onCaseChange` — the two props the old mount site never
 *     passed — are threaded here, keeping `IdeaTableTool`'s diff to one line;
 *   - closing with unsaved work asks first (`confirmClose` below). The whole
 *     point of RISK-12 was silent discard; an explicit, user-chosen discard is
 *     fine, a silent one is not.
 *
 * `ideaId` is optional: without it (harness/preview) the dialog degrades to
 * the old in-memory behaviour and SAYS SO in the header instead of showing a
 * Save button that would quietly do nothing.
 */
import { AlertTriangle, Calculator, Check, Loader2, RefreshCw, X } from 'lucide-react';
import React, { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useDialogA11y } from '@/components/ui/primitives/useDialogA11y';

import { FinancialCaseView } from './FinancialCaseView';
import type { FinancialCaseStatus } from './financialTypes';
import { useIdeaFinancialCasePersistence } from './useIdeaFinancialCasePersistence';

export interface FinancialCaseDialogProps {
  open: boolean;
  onClose: () => void;
  readOnly?: boolean;
  /** Forwarded to `FinancialCaseView` — see its header (epic B4). */
  onStatusChange?: (status: FinancialCaseStatus, lastComputedAt: string | null) => void;
  /**
   * The Idea this case belongs to. Enables persistence; omitted only where
   * there is genuinely no idea context (dev-render harness, preview).
   */
  ideaId?: string;
}

export const FinancialCaseDialog: React.FC<FinancialCaseDialogProps> = ({
  open,
  onClose,
  readOnly = false,
  onStatusChange,
  ideaId,
}) => {
  const { t } = useTranslation();
  const dialogRef = useRef<HTMLDivElement>(null);
  const [confirmClose, setConfirmClose] = useState(false);

  const persistence = useIdeaFinancialCasePersistence({ ideaId, open });

  /**
   * Every close route (X, backdrop, Esc) goes through here. With unsaved work
   * it raises the confirmation bar instead of closing — the anti-silent-
   * discard guard. Read-only sessions cannot have unsaved work, so they close
   * straight through.
   */
  const requestClose = useCallback(() => {
    if (!readOnly && persistence.dirty) {
      setConfirmClose(true);
      return;
    }
    setConfirmClose(false);
    onClose();
  }, [onClose, persistence.dirty, readOnly]);

  const discardAndClose = useCallback(() => {
    setConfirmClose(false);
    onClose();
  }, [onClose]);

  const saveAndClose = useCallback(async () => {
    await persistence.save();
    // Only leave if the save actually landed. On conflict/error the dialog
    // stays open with the message visible — closing here would be the same
    // silent data loss in a politer costume.
    if (persistence.dirty) return;
    setConfirmClose(false);
    onClose();
  }, [onClose, persistence]);

  useDialogA11y({ open, onClose: requestClose, containerRef: dialogRef });

  if (!open) return null;

  const s = persistence.status;
  const showSave = persistence.enabled && !readOnly;

  const statusChip = (() => {
    if (!persistence.enabled) {
      return (
        <span className="text-[11px] text-c-text-secondary">
          {t('ideas.financial.persistence.unavailable', 'Not saved — no idea context')}
        </span>
      );
    }
    if (s === 'loading') {
      return (
        <span className="flex items-center gap-1.5 text-[11px] text-c-text-secondary">
          <Loader2 size={12} className="animate-spin" />
          {t('ideas.financial.persistence.loading', 'Loading…')}
        </span>
      );
    }
    if (s === 'saving') {
      return (
        <span className="flex items-center gap-1.5 text-[11px] text-c-text-secondary">
          <Loader2 size={12} className="animate-spin" />
          {t('ideas.financial.persistence.saving', 'Saving…')}
        </span>
      );
    }
    if (s === 'saved') {
      return (
        <span className="flex items-center gap-1.5 text-[11px] text-c-success">
          <Check size={12} />
          {t('ideas.financial.persistence.saved', 'Saved')}
        </span>
      );
    }
    if (s === 'dirty') {
      return (
        <span className="text-[11px] text-c-text-secondary">
          {t('ideas.financial.persistence.unsaved', 'Unsaved changes')}
        </span>
      );
    }
    if (s === 'conflict') {
      return (
        <span className="flex items-center gap-1.5 text-[11px] text-c-warning">
          <AlertTriangle size={12} />
          {t('ideas.financial.persistence.conflict', 'Changed by someone else')}
        </span>
      );
    }
    if (s === 'error') {
      return (
        <span className="flex items-center gap-1.5 text-[11px] text-c-danger">
          <AlertTriangle size={12} />
          {t('ideas.financial.persistence.error', 'Save failed')}
        </span>
      );
    }
    return null;
  })();

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/20 backdrop-blur-[2px]"
      onClick={requestClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="financial-case-dialog-title"
        tabIndex={-1}
        className="w-[1040px] max-w-[95vw] h-[85vh] rounded-2xl border border-slate-200/60 dark:border-white/[0.03] bg-c-surface shadow-2xl overflow-hidden flex flex-col outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 px-5 py-3.5 border-b border-c-border-subtle shrink-0">
          <Calculator size={16} className="text-c-text-secondary" />
          <span id="financial-case-dialog-title" className="text-sm font-bold text-c-text">
            {t('ideas.financial.dialogTitle', 'Financial case')}
          </span>
          <div className="flex-1" />
          <div aria-live="polite" className="flex items-center">
            {statusChip}
          </div>
          {showSave && (
            <button
              type="button"
              onClick={() => void persistence.save()}
              disabled={s === 'saving' || s === 'loading' || !persistence.dirty}
              className="ml-2 px-3 py-1.5 rounded-lg text-xs font-semibold border border-c-border-subtle text-c-text bg-c-surface-raised hover:bg-c-surface disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {t('ideas.financial.persistence.save', 'Save')}
            </button>
          )}
          <button
            onClick={requestClose}
            className="p-1.5 rounded-lg hover:bg-c-surface-raised transition-colors"
            aria-label={t('common.close', 'Close')}
          >
            <X size={14} className="text-c-text-secondary" />
          </button>
        </div>

        {confirmClose && (
          <div
            role="alertdialog"
            aria-label={t('ideas.financial.persistence.confirmTitle', 'Unsaved changes')}
            className="flex items-center gap-2 px-5 py-2.5 border-b border-c-border-subtle bg-c-surface-raised shrink-0"
          >
            <AlertTriangle size={14} className="text-c-warning shrink-0" />
            <span className="text-xs text-c-text">
              {t(
                'ideas.financial.persistence.confirmBody',
                'This financial case has unsaved changes.'
              )}
            </span>
            <div className="flex-1" />
            <button
              type="button"
              onClick={() => setConfirmClose(false)}
              className="px-2.5 py-1 rounded-md text-xs text-c-text-secondary hover:bg-c-surface-raised transition-colors"
            >
              {t('ideas.financial.persistence.keepEditing', 'Keep editing')}
            </button>
            <button
              type="button"
              onClick={discardAndClose}
              className="px-2.5 py-1 rounded-md text-xs text-c-danger hover:bg-c-surface-raised transition-colors"
            >
              {t('ideas.financial.persistence.discard', 'Discard changes')}
            </button>
            <button
              type="button"
              onClick={() => void saveAndClose()}
              className="px-2.5 py-1 rounded-md text-xs font-semibold border border-c-border-subtle text-c-text bg-c-surface hover:bg-c-surface-raised transition-colors"
            >
              {t('ideas.financial.persistence.saveAndClose', 'Save and close')}
            </button>
          </div>
        )}

        {s === 'conflict' && (
          <div className="flex items-center gap-2 px-5 py-2.5 border-b border-c-border-subtle bg-c-surface-raised shrink-0">
            <AlertTriangle size={14} className="text-c-warning shrink-0" />
            <span className="text-xs text-c-text">
              {t(
                'ideas.financial.persistence.conflictBody',
                'Someone else saved this financial case while you were editing. Your changes are still here — reload their version or save again to overwrite.'
              )}
            </span>
            <div className="flex-1" />
            <button
              type="button"
              onClick={() => void persistence.reloadFromServer()}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs border border-c-border-subtle text-c-text bg-c-surface hover:bg-c-surface-raised transition-colors"
            >
              <RefreshCw size={12} />
              {t('ideas.financial.persistence.reload', 'Reload theirs')}
            </button>
          </div>
        )}

        {s === 'error' && persistence.errorMessage && (
          <div className="flex items-center gap-2 px-5 py-2.5 border-b border-c-border-subtle bg-c-surface-raised shrink-0">
            <AlertTriangle size={14} className="text-c-danger shrink-0" />
            <span className="text-xs text-c-text">{persistence.errorMessage}</span>
            <div className="flex-1" />
            {/* A failed SAVE must retry the SAVE. Reloading here would refetch
                the server copy over the user's unsent edits — the same silent
                discard RISK-12 was about, just reached through the error path. */}
            <button
              type="button"
              onClick={() =>
                void (persistence.hasPendingEdits ? persistence.save() : persistence.reload())
              }
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs border border-c-border-subtle text-c-text bg-c-surface hover:bg-c-surface-raised transition-colors"
            >
              <RefreshCw size={12} />
              {persistence.hasPendingEdits
                ? t('ideas.financial.persistence.retrySave', 'Try saving again')
                : t('ideas.financial.persistence.retry', 'Retry')}
            </button>
          </div>
        )}

        <div className="flex-1 min-h-0">
          {s === 'loading' ? (
            <div className="h-full flex items-center justify-center">
              <span className="flex items-center gap-2 text-xs text-c-text-secondary">
                <Loader2 size={14} className="animate-spin" />
                {t('ideas.financial.persistence.loading', 'Loading…')}
              </span>
            </div>
          ) : (
            // `key` forces a genuine re-seed of useFinancialCase's lazily
            // initialized state whenever a (re)load brings different content —
            // see useIdeaFinancialCasePersistence's `loadKey` comment.
            <FinancialCaseView
              key={persistence.loadKey}
              initialCase={persistence.loadedCase}
              onCaseChange={persistence.onCaseChange}
              onResultChange={persistence.onResultChange}
              readOnly={readOnly}
              onStatusChange={onStatusChange}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default FinancialCaseDialog;
