/**
 * FinancialAnalysisSection - Cost-benefit analysis and ROI
 */

import { motion } from 'framer-motion';
import { BarChart3, DollarSign, Loader2, Sparkles } from 'lucide-react';
import React from 'react';

import { CollapsibleSection } from './CollapsibleSection';
import { useInitiativeContext } from './InitiativeContext';
import type { InitiativeSectionProps } from './types';

export const FinancialAnalysisSection: React.FC<InitiativeSectionProps> = ({
  sectionType,
  expanded,
  onToggle,
}) => {
  const { initiative, isPolish, isGeneratingAI, handleGenerateAI } = useInitiativeContext();

  return (
    <CollapsibleSection
      id="financialAnalysis"
      title={isPolish ? 'Analiza finansowa' : 'Financial Analysis'}
      icon={<BarChart3 size={18} className="text-cyan-500 dark:text-cyan-400" />}
      iconBg="bg-gradient-to-br from-cyan-500/10 to-blue-500/10 dark:from-cyan-500/20 dark:to-blue-500/20"
      expanded={expanded}
      onToggle={onToggle}
      actions={
        <motion.button
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={(e) => {
            e.stopPropagation();
            handleGenerateAI('financial');
          }}
          disabled={isGeneratingAI === 'financial'}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-violet-400/50 text-violet-600 dark:text-violet-400 hover:bg-violet-500/10 text-xs font-medium transition-colors disabled:opacity-50"
        >
          {isGeneratingAI === 'financial' ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Sparkles size={14} />
          )}
          <span>AI</span>
        </motion.button>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 rounded-xl bg-slate-50/70 dark:bg-navy-800/70 border border-slate-200/60 dark:border-navy-700/60">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign size={14} className="text-blue-500" />
              <span className="text-xs font-medium text-slate-500 uppercase">CAPEX</span>
            </div>
            <div className="text-2xl font-bold text-slate-700 dark:text-white">
              {initiative.costCapex || initiative.cost_capex
                ? `$${(initiative.costCapex || initiative.cost_capex).toLocaleString()}`
                : '-'}
            </div>
            <p className="text-xs text-slate-400 mt-1">
              {isPolish ? 'Nakłady inwestycyjne' : 'Capital expenditure'}
            </p>
          </div>
          <div className="p-4 rounded-xl bg-slate-50/70 dark:bg-navy-800/70 border border-slate-200/60 dark:border-navy-700/60">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign size={14} className="text-orange-500" />
              <span className="text-xs font-medium text-slate-500 uppercase">OPEX</span>
            </div>
            <div className="text-2xl font-bold text-slate-700 dark:text-white">
              {initiative.costOpex || initiative.cost_opex
                ? `$${(initiative.costOpex || initiative.cost_opex).toLocaleString()}`
                : '-'}
            </div>
            <p className="text-xs text-slate-400 mt-1">
              {isPolish ? 'Koszty operacyjne' : 'Operating expenditure'}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div className="p-3 rounded-xl bg-emerald-50/50 dark:bg-emerald-500/5 border border-emerald-200/40 dark:border-emerald-500/20 text-center">
            <div className="text-xs font-medium text-emerald-600 dark:text-emerald-400 uppercase mb-1">
              ROI
            </div>
            <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
              {initiative.expectedRoi || initiative.expected_roi
                ? `${(initiative.expectedRoi || initiative.expected_roi).toFixed(1)}x`
                : '-'}
            </div>
          </div>
          <div className="p-3 rounded-xl bg-blue-50/50 dark:bg-blue-500/5 border border-blue-200/40 dark:border-blue-500/20 text-center">
            <div className="text-xs font-medium text-blue-600 dark:text-blue-400 uppercase mb-1">
              NPV
            </div>
            <div className="text-xl font-bold text-blue-600 dark:text-blue-400">
              {initiative.npv ? `$${initiative.npv.toLocaleString()}` : '-'}
            </div>
          </div>
          <div className="p-3 rounded-xl bg-purple-50/50 dark:bg-purple-500/5 border border-purple-200/40 dark:border-purple-500/20 text-center">
            <div className="text-xs font-medium text-purple-600 dark:text-purple-400 uppercase mb-1">
              {isPolish ? 'Zwrot' : 'Payback'}
            </div>
            <div className="text-xl font-bold text-purple-600 dark:text-purple-400">
              {initiative.paybackMonths ? `${initiative.paybackMonths}m` : '-'}
            </div>
          </div>
        </div>
      </div>
    </CollapsibleSection>
  );
};
