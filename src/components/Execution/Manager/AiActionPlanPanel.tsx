/**
 * AiActionPlanPanel
 *
 * Displays a generated AI action plan inline within a lane.
 * Supports both single-signal and comprehensive (all signals) plans.
 */

import {
  ArrowRight,
  CheckCircle2,
  Clock,
  Loader2,
  Sparkles,
  Target,
  X,
  Zap,
} from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { Callout } from '../../shared/NModeBlocks/Callout';
import type { AiActionPlan, AiActionStep } from './types';

const PRIORITY_CFG: Record<string, { bg: string; text: string; labelPl: string; labelEn: string }> = {
  high: { bg: 'bg-rose-500/10', text: 'text-rose-600 dark:text-rose-400', labelPl: 'Wysoki', labelEn: 'High' },
  medium: { bg: 'bg-amber-500/10', text: 'text-amber-600 dark:text-amber-400', labelPl: 'Średni', labelEn: 'Medium' },
  low: { bg: 'bg-slate-400/10', text: 'text-slate-500 dark:text-slate-400', labelPl: 'Niski', labelEn: 'Low' },
};

const TYPE_CFG: Record<string, { icon: React.ElementType; labelPl: string; labelEn: string; color: string }> = {
  immediate: { icon: Zap, labelPl: 'Natychmiast', labelEn: 'Immediate', color: 'text-rose-500' },
  short_term: { icon: Clock, labelPl: 'Krótkoterminowe', labelEn: 'Short-term', color: 'text-amber-500' },
  strategic: { icon: Target, labelPl: 'Strategiczne', labelEn: 'Strategic', color: 'text-blue-500' },
};

interface AiActionPlanPanelProps {
  plan: AiActionPlan | null;
  loading?: boolean;
  onClose: () => void;
  onAcceptStep?: (step: AiActionStep, index: number) => void;
  onAcceptAll?: () => void;
}

export const AiActionPlanPanel: React.FC<AiActionPlanPanelProps> = ({
  plan,
  loading = false,
  onClose,
  onAcceptStep,
  onAcceptAll,
}) => {
  const { i18n } = useTranslation();
  const isPolish = i18n.language === 'pl';

  if (loading) {
    return (
      <div className="rounded-xl border border-purple-500/30 bg-gradient-to-br from-purple-500/5 via-transparent to-indigo-500/5 dark:from-purple-500/10 dark:to-indigo-500/10 p-5 animate-in fade-in slide-in-from-top-2 duration-300">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
            <Loader2 size={16} className="text-purple-500 animate-spin" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
              {isPolish ? 'AI analizuje sytuację...' : 'AI is analyzing the situation...'}
            </p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
              {isPolish ? 'Przygotowywanie planu zarządzania' : 'Preparing management plan'}
            </p>
          </div>
        </div>
        <div className="mt-4 space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-10 rounded-lg bg-slate-200/40 dark:bg-navy-800/40 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!plan) return null;

  const immediateSteps = plan.steps.filter((s) => s.type === 'immediate');
  const shortTermSteps = plan.steps.filter((s) => s.type === 'short_term');
  const strategicSteps = plan.steps.filter((s) => s.type === 'strategic');
  const groupedSteps = [
    { type: 'immediate' as const, steps: immediateSteps },
    { type: 'short_term' as const, steps: shortTermSteps },
    { type: 'strategic' as const, steps: strategicSteps },
  ].filter((g) => g.steps.length > 0);

  return (
    <div className="rounded-xl border border-purple-500/30 bg-gradient-to-br from-purple-500/5 via-transparent to-indigo-500/5 dark:from-purple-500/10 dark:to-indigo-500/10 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-300">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 pt-4 pb-3">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500/20 to-indigo-500/20 flex items-center justify-center">
          <Sparkles size={16} className="text-purple-500" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
            {plan.scope === 'comprehensive'
              ? (isPolish ? 'Plan zarządzania — kompleksowy' : 'Management Plan — Comprehensive')
              : (isPolish ? 'Plan zarządzania' : 'Management Plan')}
          </h3>
          <p className="text-[11px] text-slate-400 dark:text-slate-500">
            {isPolish ? 'Wygenerowano' : 'Generated'} {new Date(plan.generatedAt).toLocaleString()}
          </p>
        </div>
        {onAcceptAll && (
          <button
            type="button"
            onClick={onAcceptAll}
            className="px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-purple-600 hover:bg-purple-700 transition-colors"
          >
            {isPolish ? 'Akceptuj plan' : 'Accept plan'}
          </button>
        )}
        <button
          type="button"
          onClick={onClose}
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors"
        >
          <X size={14} />
        </button>
      </div>

      {/* Diagnosis */}
      <div className="px-5 pb-3">
        <Callout variant="info" compact>
          <div>
            <p className="text-xs font-medium mb-0.5">{isPolish ? 'Diagnoza' : 'Diagnosis'}</p>
            <p className="text-xs">{plan.diagnosis}</p>
          </div>
        </Callout>
      </div>

      {/* Risk Assessment */}
      {plan.riskAssessment && (
        <div className="px-5 pb-3">
          <Callout variant="warning" compact>
            <div>
              <p className="text-xs font-medium mb-0.5">{isPolish ? 'Ocena ryzyka' : 'Risk Assessment'}</p>
              <p className="text-xs">{plan.riskAssessment}</p>
            </div>
          </Callout>
        </div>
      )}

      {/* Steps grouped by type */}
      <div className="px-5 pb-4 space-y-4">
        {groupedSteps.map(({ type, steps }) => {
          const cfg = TYPE_CFG[type];
          const TypeIcon = cfg.icon;
          return (
            <div key={type}>
              <div className="flex items-center gap-2 mb-2">
                <TypeIcon size={13} className={cfg.color} />
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                  {isPolish ? cfg.labelPl : cfg.labelEn}
                </span>
                <span className="text-[10px] text-slate-400">{steps.length}</span>
              </div>
              <div className="space-y-2">
                {steps.map((step, idx) => {
                  const pcfg = PRIORITY_CFG[step.priority];
                  const globalIdx = plan.steps.indexOf(step);
                  return (
                    <div
                      key={idx}
                      className="flex items-start gap-3 py-2.5 px-3 rounded-lg bg-white/60 dark:bg-navy-900/40 group"
                    >
                      <div className="mt-0.5 shrink-0 w-5 h-5 rounded-full border-2 border-slate-200 dark:border-navy-700 flex items-center justify-center text-[10px] font-bold text-slate-400 dark:text-slate-500">
                        {globalIdx + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                          {step.title}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          {step.description}
                        </p>
                        <div className="flex flex-wrap items-center gap-2 mt-1.5">
                          <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${pcfg.bg} ${pcfg.text}`}>
                            {isPolish ? pcfg.labelPl : pcfg.labelEn}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            <ArrowRight size={9} className="inline mr-0.5" />
                            {step.owner}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            ⏱ {step.deadline}
                          </span>
                        </div>
                      </div>
                      {onAcceptStep && (
                        <button
                          type="button"
                          onClick={() => onAcceptStep(step, globalIdx)}
                          className="shrink-0 opacity-0 group-hover:opacity-100 p-1.5 rounded-md text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 transition-all"
                          title={isPolish ? 'Akceptuj krok' : 'Accept step'}
                        >
                          <CheckCircle2 size={14} />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Expected Outcome + Timeline */}
      <div className="px-5 pb-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div className="rounded-lg bg-emerald-500/5 dark:bg-emerald-500/10 px-3 py-2.5">
            <p className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mb-0.5">
              {isPolish ? 'Oczekiwany rezultat' : 'Expected Outcome'}
            </p>
            <p className="text-xs text-slate-600 dark:text-slate-300">{plan.expectedOutcome}</p>
          </div>
          <div className="rounded-lg bg-blue-500/5 dark:bg-blue-500/10 px-3 py-2.5">
            <p className="text-[10px] font-medium text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-0.5">
              {isPolish ? 'Szacowany czas' : 'Estimated Timeline'}
            </p>
            <p className="text-xs text-slate-600 dark:text-slate-300">{plan.estimatedTimeline}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AiActionPlanPanel;
