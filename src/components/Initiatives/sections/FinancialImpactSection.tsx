/**
 * FinancialImpactSection - P&L impact and benefits realization
 */

import { motion } from 'framer-motion';
import { Loader2, Sparkles, TrendingDown, TrendingUp } from 'lucide-react';
import React from 'react';

import { CollapsibleSection } from './CollapsibleSection';
import { useInitiativeContext } from './InitiativeContext';
import type { InitiativeSectionProps } from './types';

export const FinancialImpactSection: React.FC<InitiativeSectionProps> = ({
  sectionType,
  expanded,
  onToggle,
}) => {
  const { initiative, isPolish, isGeneratingAI, handleGenerateAI } = useInitiativeContext();

  return (
    <CollapsibleSection
      id="financialImpact"
      title={isPolish ? 'Wpływ na wynik finansowy' : 'Financial Impact'}
      icon={<TrendingUp size={18} className="text-emerald-500 dark:text-emerald-400" />}
      iconBg="bg-gradient-to-br from-emerald-500/10 to-green-500/10 dark:from-emerald-500/20 dark:to-green-500/20"
      expanded={expanded}
      onToggle={onToggle}
      actions={
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleGenerateAI('financialImpact');
          }}
          disabled={isGeneratingAI === 'financialImpact'}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-primary-400/50 text-primary-600 dark:text-primary-400 hover:bg-primary-500/10 text-xs font-medium transition-colors disabled:opacity-50"
        >
          {isGeneratingAI === 'financialImpact' ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Sparkles size={14} />
          )}
          AI
        </button>
      }
    >
      <div className="space-y-4">
        <div className="p-4 rounded-xl bg-emerald-50/40 dark:bg-emerald-500/5 border border-emerald-200/40 dark:border-emerald-500/20">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
              {isPolish ? 'Wpływ na P&L' : 'P&L Impact'}
            </span>
            <span className="text-xs px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-500">
              {isPolish ? 'Prognoza' : 'Forecast'}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="flex items-center gap-1 text-xs text-slate-500 mb-1">
                <TrendingUp size={12} className="text-emerald-500" />
                {isPolish ? 'Przychody' : 'Revenue'}
              </div>
              <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                {initiative.revenueImpact ? `+$${initiative.revenueImpact.toLocaleString()}` : '-'}
              </div>
            </div>
            <div>
              <div className="flex items-center gap-1 text-xs text-slate-500 mb-1">
                <TrendingDown size={12} className="text-blue-500" />
                {isPolish ? 'Oszczędności' : 'Cost Savings'}
              </div>
              <div className="text-lg font-bold text-blue-600 dark:text-blue-400">
                {initiative.costSavings ? `$${initiative.costSavings.toLocaleString()}` : '-'}
              </div>
            </div>
          </div>
        </div>
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-500 uppercase">
              {isPolish ? 'Realizacja korzyści' : 'Benefits Realization'}
            </span>
            <span className="text-xs text-slate-600">{initiative.benefitsRealized || 0}%</span>
          </div>
          <div className="h-2 rounded-full bg-slate-200 dark:bg-navy-700 overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${initiative.benefitsRealized || 0}%` }}
              className="h-full bg-gradient-to-r from-emerald-500 to-blue-500 rounded-full"
            />
          </div>
        </div>
      </div>
    </CollapsibleSection>
  );
};
