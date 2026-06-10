import {
  AlertTriangle,
  ChevronRight,
  GitBranch,
  Loader2,
  Merge,
  Play,
  Split,
  Square,
} from 'lucide-react';
import React from 'react';

import { Button } from '@/components/ui/Button';

export interface ReadbackStep {
  type: 'step' | 'decision' | 'parallel_split' | 'parallel_join' | 'start' | 'end';
  label: string;
  object_id: string;
  branches?: ReadbackStep[][];
}

export interface ReadbackResult {
  paths: ReadbackStep[];
  warnings: string[];
}

export interface ReadbackPanelProps {
  result: ReadbackResult | null;
  isLoading: boolean;
  isPl: boolean;
  onFetchReadback: () => void;
  onClickStep: (objectId: string) => void;
}

const panelShell =
  'rounded-xl border border-slate-200/70 dark:border-navy-700 bg-white/70 dark:bg-navy-900/50 p-3';

function stepIcon(type: ReadbackStep['type']) {
  switch (type) {
    case 'start':
      return { Icon: Play, className: 'text-emerald-600 dark:text-emerald-400' };
    case 'end':
      return { Icon: Square, className: 'text-rose-600 dark:text-rose-400' };
    case 'decision':
      return { Icon: GitBranch, className: 'text-amber-600 dark:text-amber-400' };
    case 'parallel_split':
      return { Icon: Split, className: 'text-primary-600 dark:text-primary-400' };
    case 'parallel_join':
      return { Icon: Merge, className: 'text-primary-600 dark:text-primary-400' };
    case 'step':
    default:
      return { Icon: ChevronRight, className: 'text-slate-500 dark:text-slate-400' };
  }
}

const ReadbackStepRow: React.FC<{
  step: ReadbackStep;
  onClickStep: (objectId: string) => void;
}> = ({ step, onClickStep }) => {
  const { Icon, className } = stepIcon(step.type);

  return (
    <div>
      <button
        type="button"
        onClick={() => onClickStep(step.object_id)}
        className="mb-1 flex w-full max-w-full items-center gap-2 rounded-lg border border-transparent px-1.5 py-1 text-left text-[11px] text-slate-800 transition-colors hover:border-slate-200/80 hover:bg-slate-50 dark:text-slate-100 dark:hover:border-white/[0.06] dark:hover:bg-navy-900/50"
      >
        <Icon size={14} className={`shrink-0 ${className}`} />
        <span className="min-w-0 flex-1 truncate font-medium">{step.label}</span>
        <span className="shrink-0 font-mono text-[9px] text-slate-600 dark:text-slate-500">
          {step.object_id}
        </span>
      </button>

      {step.branches && step.branches.length > 0 ? (
        <div className="border-l border-slate-200/80 pl-4 dark:border-white/[0.08]">
          {step.branches.map((branch, bi) => (
            <div key={bi} className="mb-2 last:mb-0">
              {branch.map((child, ci) => (
                <ReadbackStepRow
                  key={`${child.object_id}-${bi}-${ci}`}
                  step={child}
                  onClickStep={onClickStep}
                />
              ))}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
};

export const ReadbackPanel: React.FC<ReadbackPanelProps> = ({
  result,
  isLoading,
  isPl,
  onFetchReadback,
  onClickStep,
}) => {
  const t = {
    title: isPl ? 'Odczyt semantyczny' : 'Semantic Readback',
    cta: isPl ? 'Generuj odczyt' : 'Generate readback',
    empty: isPl
      ? 'Uruchom odczyt, aby zobaczyć przejście przepływu procesu'
      : 'Run readback to see the process flow traversal',
    warnings: isPl ? 'Ostrzeżenia' : 'Warnings',
  };

  const hasPaths = Boolean(result?.paths?.length);

  return (
    <div className={`flex flex-col gap-3 ${panelShell}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
            {t.title}
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={onFetchReadback}
          disabled={isLoading}
          icon={isLoading ? <Loader2 size={14} className="animate-spin" /> : undefined}
        >
          {t.cta}
        </Button>
      </div>

      {isLoading && !hasPaths ? (
        <div className="flex items-center justify-center gap-2 py-10 text-slate-500 dark:text-slate-400">
          <Loader2 size={20} className="animate-spin text-primary-600 dark:text-primary-400" />
        </div>
      ) : null}

      {!isLoading && !hasPaths ? (
        <p className="py-6 text-center text-xs text-slate-500 dark:text-slate-400">{t.empty}</p>
      ) : null}

      {hasPaths ? (
        <div className="max-h-[min(420px,55vh)] overflow-y-auto rounded-lg border border-slate-200/60 bg-slate-50/50 p-2 dark:border-navy-700 dark:bg-navy-950/30">
          {result!.paths.map((step, i) => (
            <ReadbackStepRow
              key={`${step.object_id}-root-${i}`}
              step={step}
              onClickStep={onClickStep}
            />
          ))}
        </div>
      ) : null}

      {result?.warnings && result.warnings.length > 0 ? (
        <div className="rounded-lg border border-amber-200/70 bg-amber-50/60 p-2.5 dark:border-amber-500/25 dark:bg-amber-950/20">
          <div className="mb-1.5 flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.12em] text-amber-800 dark:text-amber-200">
            <AlertTriangle size={12} />
            {t.warnings}
          </div>
          <ul className="flex flex-col gap-1">
            {result.warnings.map((w, i) => (
              <li
                key={i}
                className="flex items-start gap-1.5 text-[11px] text-amber-900 dark:text-amber-100/90"
              >
                <AlertTriangle size={12} className="mt-0.5 shrink-0 opacity-70" />
                <span>{w}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
};

export default ReadbackPanel;
