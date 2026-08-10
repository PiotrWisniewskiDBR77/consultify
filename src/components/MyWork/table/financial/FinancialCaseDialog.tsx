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
 * this for real" bar with a far smaller, additive diff. If §7.3's tab-strip
 * placement becomes a hard requirement later, this component's content
 * (just `<FinancialCaseView readOnly={readOnly} />`) can be lifted into a
 * new tab without touching `FinancialCaseView` itself.
 *
 * ── WHAT DOES NOT PERSIST YET (say so, don't fake it) ──────────────────────
 * `FinancialCaseInput` is idea-level, not row-level — unlike `IdeaScoringModel`
 * (which writes into each row's `data` bag through the existing realtime-
 * synced `nodesUndo`), there is no existing idea-level persistence surface
 * this dialog can write into without inventing a new backend/store, which is
 * out of this task's scope. The case therefore lives in this dialog's own
 * component state (`useFinancialCase`'s default `initialCase`) and resets on
 * close/reopen. The calculation itself is real (see `engineAdapter.ts`); only
 * cross-session persistence is the honest, stated gap — never hidden behind
 * a fake "Saved" toast.
 */
import { Calculator, X } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { FinancialCaseView } from './FinancialCaseView';
import type { FinancialCaseStatus } from './financialTypes';

export interface FinancialCaseDialogProps {
  open: boolean;
  onClose: () => void;
  readOnly?: boolean;
  /** Forwarded to `FinancialCaseView` — see its header (epic B4). */
  onStatusChange?: (status: FinancialCaseStatus, lastComputedAt: string | null) => void;
}

export const FinancialCaseDialog: React.FC<FinancialCaseDialogProps> = ({
  open,
  onClose,
  readOnly = false,
  onStatusChange,
}) => {
  const { t } = useTranslation();
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/20 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        className="w-[1040px] max-w-[95vw] h-[85vh] rounded-2xl border border-slate-200/60 dark:border-white/[0.03] bg-c-surface shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 px-5 py-3.5 border-b border-c-border-subtle shrink-0">
          <Calculator size={16} className="text-c-text-secondary" />
          <span className="text-sm font-bold text-c-text">
            {t('ideas.financial.dialogTitle', 'Financial case')}
          </span>
          <div className="flex-1" />
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-c-surface-raised transition-colors"
            aria-label={t('common.close', 'Close')}
          >
            <X size={14} className="text-c-text-secondary" />
          </button>
        </div>
        <div className="flex-1 min-h-0">
          <FinancialCaseView readOnly={readOnly} onStatusChange={onStatusChange} />
        </div>
      </div>
    </div>
  );
};

export default FinancialCaseDialog;
