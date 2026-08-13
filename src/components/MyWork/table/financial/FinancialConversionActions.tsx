/**
 * FinancialConversionActions — "Convert to Financial Model" and "Convert to
 * Budget" entry points required by doc 09 §7.3/§7.4.
 *
 * Building the actual conversion pipeline (preview → governed downstream
 * artifact → append-only backlink) is epic E11 territory and explicitly out
 * of scope for this task. Per Z3 (zero placeholders — a disabled action must
 * say why, never a dead button), both buttons render honestly disabled with
 * a stated reason instead of doing nothing or faking success:
 *
 *   - case not fresh  → "recompute first" (this task's own stale/recompute
 *     contract: doc 11 E09 DoD forbids converting a stale/invalid case);
 *   - case fresh       → "conversion pipeline not built yet in this build"
 *     (the honest E11 boundary).
 *
 * Deliberately NOT registered in `src/actions/ideaActionRegistry.ts`: a
 * disabled button that performs no mutation and that Teresa cannot execute
 * has nothing to register (no `mutates`/`destructive` behavior to declare).
 * When E11 wires the real pipeline, THAT work registers the action.
 */
import { ArrowUpRight } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import type { FinancialCaseStatus } from './financialTypes';

export interface FinancialConversionActionsProps {
  status: FinancialCaseStatus;
}

export const FinancialConversionActions: React.FC<FinancialConversionActionsProps> = ({
  status,
}) => {
  const { t } = useTranslation();
  const notFresh = status !== 'fresh';

  const reason = notFresh
    ? t(
        'ideas.financial.convert.reasonStale',
        'Recompute the case first — a stale case cannot be converted.'
      )
    : t(
        'ideas.financial.convert.reasonNotBuilt',
        'Conversion to a governed downstream artifact is not built yet in this release (epic E11).'
      );

  const Button = ({ labelKey, labelEn }: { labelKey: string; labelEn: string }) => (
    <button
      type="button"
      disabled
      aria-disabled="true"
      title={reason}
      className="inline-flex items-center gap-1.5 text-xs font-medium text-c-text-muted bg-c-surface-raised border border-c-border rounded-md px-2.5 py-1.5 cursor-not-allowed opacity-70"
    >
      <ArrowUpRight size={13} />
      {t(labelKey, labelEn)}
    </button>
  );

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap gap-2">
        <Button labelKey="ideas.financial.convert.toModel" labelEn="Convert to Financial Model" />
        <Button labelKey="ideas.financial.convert.toBudget" labelEn="Convert to Budget" />
      </div>
      <p className="text-[10px] text-c-text-muted">{reason}</p>
    </div>
  );
};
