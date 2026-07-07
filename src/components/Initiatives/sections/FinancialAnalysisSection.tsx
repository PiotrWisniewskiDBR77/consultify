/**
 * FinancialAnalysisSection - Cost-benefit analysis and ROI
 */

import { motion } from 'framer-motion';
import { BarChart3, DollarSign, Loader2, Sparkles } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { CollapsibleSection } from './CollapsibleSection';
import { useInitiativeContext } from './InitiativeContext';
import type { InitiativeSectionProps } from './types';

export const FinancialAnalysisSection: React.FC<InitiativeSectionProps> = ({
  sectionType,
  expanded,
  onToggle,
}) => {
  const { t } = useTranslation();
  const { initiative, isGeneratingAI, handleGenerateAI } = useInitiativeContext();

  return (
    <CollapsibleSection
      id="financialAnalysis"
      title={t('initiatives.financialAnalysisSection.financialAnalysis')}
      icon={<BarChart3 size={18} className="text-blue-500 dark:text-blue-400" />}
      iconBg="bg-gradient-to-br from-blue-500/10 to-blue-500/10 dark:from-blue-500/20 dark:to-blue-500/20"
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
            handleGenerateAI('financialAnalysis');
          }}
          disabled={isGeneratingAI === 'financialAnalysis'}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-c-info/50 text-c-info dark:text-c-info hover:bg-c-info/10 text-xs font-medium transition-colors disabled:opacity-50"
        >
          {isGeneratingAI === 'financialAnalysis' ? (
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
            <p className="text-xs text-slate-600 mt-1">
              {t('initiatives.financialAnalysisSection.capitalExpenditure')}
            </p>
          </div>
          <div className="p-4 rounded-xl bg-slate-50/70 dark:bg-navy-800/70 border border-slate-200/60 dark:border-navy-700/60">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign size={14} className="text-amber-500" />
              <span className="text-xs font-medium text-slate-500 uppercase">OPEX</span>
            </div>
            <div className="text-2xl font-bold text-slate-700 dark:text-white">
              {initiative.costOpex || initiative.cost_opex
                ? `$${(initiative.costOpex || initiative.cost_opex).toLocaleString()}`
                : '-'}
            </div>
            <p className="text-xs text-slate-600 mt-1">
              {t('initiatives.financialAnalysisSection.operatingExpenditure')}
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
          <div className="p-3 rounded-xl bg-c-info/50 dark:bg-c-info/5 border border-c-info/40 dark:border-c-info/20 text-center">
            <div className="text-xs font-medium text-c-info dark:text-c-info uppercase mb-1">
              {t('initiatives.financialAnalysisSection.payback')}
            </div>
            <div className="text-xl font-bold text-c-info dark:text-c-info">
              {initiative.paybackMonths ? `${initiative.paybackMonths}m` : '-'}
            </div>
          </div>
        </div>
      </div>
    </CollapsibleSection>
  );
};
