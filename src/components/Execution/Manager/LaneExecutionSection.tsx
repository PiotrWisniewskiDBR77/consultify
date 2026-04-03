/**
 * LaneExecutionSection
 *
 * Execution plans with task checklists, before/after readback, verification status.
 */

import { CheckCircle2, ClipboardList, Loader2, Play, XCircle } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { Callout } from '../../shared/NModeBlocks/Callout';
import { EmptyStateInline } from '../../shared/NModeBlocks/EmptyStateInline';
import { ToggleBlock } from '../../shared/NModeBlocks/ToggleBlock';
import type { ExecutionPlanItem, VerificationStatus } from './types';

const VERIFICATION_CFG: Record<VerificationStatus, { icon: React.ElementType; text: string; labelEn: string; labelPl: string }> = {
  pending: { icon: ClipboardList, text: 'text-slate-400 dark:text-slate-500', labelEn: 'Pending', labelPl: 'Oczekuje' },
  in_progress: { icon: Loader2, text: 'text-blue-600 dark:text-blue-400', labelEn: 'In Progress', labelPl: 'W trakcie' },
  verified: { icon: CheckCircle2, text: 'text-emerald-600 dark:text-emerald-400', labelEn: 'Verified', labelPl: 'Zweryfikowane' },
  failed: { icon: XCircle, text: 'text-rose-600 dark:text-rose-400', labelEn: 'Failed', labelPl: 'Nie powiodło się' },
};

interface LaneExecutionSectionProps {
  executionPlan: ExecutionPlanItem[];
  defaultOpen?: boolean;
}

export const LaneExecutionSection: React.FC<LaneExecutionSectionProps> = ({
  executionPlan,
  defaultOpen = false,
}) => {
  const { i18n } = useTranslation();
  const isPolish = i18n.language === 'pl';

  return (
    <ToggleBlock
      title={isPolish ? 'Realizacja' : 'Execution'}
      badge={executionPlan.length}
      defaultOpen={defaultOpen}
      icon={<Play size={14} />}
    >
      {executionPlan.length === 0 ? (
        <EmptyStateInline
          icon={ClipboardList}
          message={isPolish ? 'Brak planów realizacji — zatwierdź decyzje powyżej.' : 'No execution plans — approve decisions above to create them.'}
          dashed={false}
        />
      ) : (
        <div className="space-y-4">
          {executionPlan.map((plan) => {
            const vcfg = VERIFICATION_CFG[plan.verificationStatus];
            const VIcon = vcfg.icon;
            const done = plan.tasks.filter((t) => t.status === 'done' || t.status === 'DONE').length;
            const total = plan.tasks.length;
            const pct = total > 0 ? Math.round((done / total) * 100) : 0;

            return (
              <div key={plan.id} className="rounded-xl bg-white/40 dark:bg-navy-900/40 p-3 space-y-3">
                {/* Verification status + progress */}
                <div className="flex items-center gap-2">
                  <VIcon size={14} className={vcfg.text} />
                  <span className={`text-[11px] font-medium ${vcfg.text}`}>
                    {isPolish ? vcfg.labelPl : vcfg.labelEn}
                  </span>
                  <div className="flex-1" />
                  <span className="text-[11px] text-slate-400 dark:text-slate-500 tabular-nums">
                    {done}/{total}
                  </span>
                </div>

                {/* Progress bar */}
                {total > 0 && (
                  <div className="h-1.5 bg-slate-200/60 dark:bg-navy-700/60 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-emerald-500 transition-all duration-300"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                )}

                {/* Tasks */}
                <div className="space-y-1">
                  {plan.tasks.map((task, idx) => {
                    const isDone = task.status === 'done' || task.status === 'DONE';
                    return (
                      <div
                        key={idx}
                        className="flex items-center gap-2 py-1 px-2 rounded-lg text-xs"
                      >
                        <span className={`w-4 h-4 rounded flex items-center justify-center shrink-0 ${
                          isDone ? 'bg-emerald-500/20 text-emerald-500' : 'bg-slate-200/60 dark:bg-navy-700/60'
                        }`}>
                          {isDone && <CheckCircle2 size={10} />}
                        </span>
                        <span className={`flex-1 ${isDone ? 'text-slate-400 dark:text-slate-500 line-through' : 'text-slate-700 dark:text-slate-200'}`}>
                          {task.title}
                        </span>
                        <span className="text-[10px] text-slate-400 dark:text-slate-500 shrink-0">
                          {task.owner}
                        </span>
                        <span className="text-[10px] text-slate-400 dark:text-slate-500 shrink-0">
                          {task.deadline}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Before / After readback */}
                {(plan.beforeState || plan.afterState) && (
                  <div className="grid grid-cols-2 gap-2">
                    {plan.beforeState && (
                      <Callout variant="warning" compact title={isPolish ? 'Przed' : 'Before'}>
                        {plan.beforeState}
                      </Callout>
                    )}
                    {plan.afterState && (
                      <Callout variant="success" compact title={isPolish ? 'Po' : 'After'}>
                        {plan.afterState}
                      </Callout>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </ToggleBlock>
  );
};

export default LaneExecutionSection;
