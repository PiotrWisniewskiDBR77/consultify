/**
 * FinancialImpactSection - P&L impact and benefits realization
 */

import { motion } from 'framer-motion';
import { Loader2, Sparkles, TrendingDown, TrendingUp } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { CardBlockRenderer } from '../cards/CardBlockRenderer';
import { buildBusinessCaseCardSpec } from '../cards/cardSpecBuilders';
import { CollapsibleSection } from './CollapsibleSection';
import { useInitiativeContext } from './InitiativeContext';
import type { InitiativeSectionProps } from './types';

export const FinancialImpactSection: React.FC<InitiativeSectionProps> = ({
  sectionType,
  expanded,
  onToggle,
}) => {
  const { t } = useTranslation();
  const { initiative, isGeneratingAI, handleGenerateAI } = useInitiativeContext();

  // F3 (D11) display layer — declarative read-only preview via the generic
  // CardBlockRenderer. ADDITIVE: rendered below the existing UI, gated on
  // content. Flatten the financial-impact context → business-case shape so the
  // KPI tiles (investment / expectedReturn / payback) read correctly.
  const hasFinancials = !!(
    initiative.revenueImpact ||
    initiative.costSavings ||
    initiative.benefitsRealized
  );
  const businessCaseCardSpec = buildBusinessCaseCardSpec(
    {
      ...(initiative.revenueImpact
        ? { expectedReturn: `+$${initiative.revenueImpact.toLocaleString()}` }
        : {}),
      ...(initiative.costSavings
        ? { investment: `$${initiative.costSavings.toLocaleString()}` }
        : {}),
      ...(initiative.benefitsRealized ? { payback: `${initiative.benefitsRealized}%` } : {}),
    },
    {
      title: t('initiatives.financialImpactSection.financialImpact'),
      expectedReturnLabel: t('initiatives.financialImpactSection.revenue'),
      investmentLabel: t('initiatives.financialImpactSection.costSavings'),
      paybackLabel: t('initiatives.financialImpactSection.benefitsRealization'),
    }
  );

  return (
    <CollapsibleSection
      id="financialImpact"
      title={t('initiatives.financialImpactSection.financialImpact')}
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
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-c-info/50 text-c-info dark:text-c-info hover:bg-c-info/10 text-xs font-medium transition-colors disabled:opacity-50"
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
              {t('initiatives.financialImpactSection.plImpact')}
            </span>
            <span className="text-xs px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-500">
              {t('initiatives.financialImpactSection.forecast')}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="flex items-center gap-1 text-xs text-slate-500 mb-1">
                <TrendingUp size={12} className="text-emerald-500" />
                {t('initiatives.financialImpactSection.revenue')}
              </div>
              <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                {initiative.revenueImpact ? `+$${initiative.revenueImpact.toLocaleString()}` : '-'}
              </div>
            </div>
            <div>
              <div className="flex items-center gap-1 text-xs text-slate-500 mb-1">
                <TrendingDown size={12} className="text-blue-500" />
                {t('initiatives.financialImpactSection.costSavings')}
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
              {t('initiatives.financialImpactSection.benefitsRealization')}
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

        {/* F3 (D11) display layer — generic CardBlockRenderer preview.
            ADDITIVE: a read-only "as it reads" view built from the same data,
            shown only once there is content. Does not replace the UI above. */}
        {hasFinancials && (
          <div className="pt-3 border-t border-slate-200 dark:border-navy-700">
            <div className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-2">
              {t('initiatives.financialImpactSection.financialImpact')}
            </div>
            <CardBlockRenderer spec={businessCaseCardSpec} showTitle={false} />
          </div>
        )}
      </div>
    </CollapsibleSection>
  );
};
