/**
 * SWOTCorrelationsStep - Displays AI-generated correlations
 *
 * Shows strategic connections between SWOT elements.
 */

import { ArrowRight, Lightbulb, Link2 } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { SWOTCorrelation, SWOTData, ToolSession } from '@/store/useToolStore';

// ==================== TYPES ====================

interface SWOTCorrelationsStepProps {
  session: ToolSession;
  isPolish: boolean;
}

// ==================== CONSTANTS ====================

const CORRELATION_CONFIG = {
  SO: {
    label: { en: 'Strength + Opportunity', pl: 'Mocna strona + Szansa' },
    description: { en: 'Offensive strategies', pl: 'Strategie ofensywne' },
    color: 'emerald',
  },
  WO: {
    label: { en: 'Weakness + Opportunity', pl: 'Słaba strona + Szansa' },
    description: { en: 'Reorientation strategies', pl: 'Strategie reorientacji' },
    color: 'blue',
  },
  ST: {
    label: { en: 'Strength + Threat', pl: 'Mocna strona + Zagrożenie' },
    description: { en: 'Defensive strategies', pl: 'Strategie defensywne' },
    color: 'amber',
  },
  WT: {
    label: { en: 'Weakness + Threat', pl: 'Słaba strona + Zagrożenie' },
    description: { en: 'Survival strategies', pl: 'Strategie przetrwania' },
    color: 'red',
  },
};

// ==================== COMPONENT ====================

export const SWOTCorrelationsStep: React.FC<SWOTCorrelationsStepProps> = ({
  session,
  isPolish,
}) => {
  const { t } = useTranslation();
  const lang = isPolish ? 'pl' : 'en';
  const swotData = session.inputData as SWOTData;
  const correlations = swotData.correlations || [];
  const tensions = swotData.tensions || [];

  // Group correlations by type
  const groupedCorrelations = correlations.reduce(
    (acc, corr) => {
      if (!acc[corr.type]) acc[corr.type] = [];
      acc[corr.type].push(corr);
      return acc;
    },
    {} as Record<string, SWOTCorrelation[]>
  );

  // Get item text by ID
  const getItemText = (itemId: string): string => {
    const item = swotData.items.find((i) => i.id === itemId);
    return item?.text || itemId;
  };

  const renderCorrelationGroup = (type: keyof typeof CORRELATION_CONFIG) => {
    const config = CORRELATION_CONFIG[type];
    const typeCorrelations = groupedCorrelations[type] || [];

    if (typeCorrelations.length === 0) return null;

    return (
      <div key={type} className="space-y-3">
        <div className="flex items-center gap-2">
          <span
            className={`w-8 h-8 rounded-lg bg-${config.color}-100 dark:bg-${config.color}-900/30 flex items-center justify-center text-xs font-bold text-${config.color}-600 dark:text-${config.color}-400`}
          >
            {type}
          </span>
          <div>
            <h4 className={`font-medium text-${config.color}-700 dark:text-${config.color}-300`}>
              {type === 'SO'
                ? isPolish
                  ? 'Attack'
                  : 'Attack'
                : type === 'WO'
                  ? isPolish
                    ? 'Repair'
                    : 'Repair'
                  : type === 'ST'
                    ? isPolish
                      ? 'Defend'
                      : 'Defend'
                    : isPolish
                      ? 'Protect'
                      : 'Protect'}{' '}
              · {config.label[lang]}
            </h4>
            <p className="text-xs text-slate-600">{config.description[lang]}</p>
          </div>
        </div>

        {typeCorrelations.map((corr) => (
          <div
            key={corr.id}
            className={`p-4 rounded-lg bg-${config.color}-50 dark:bg-${config.color}-900/10 border border-${config.color}-200 dark:border-${config.color}-800`}
          >
            {/* Linked items */}
            <div className="flex items-center gap-2 text-sm mb-2">
              <Link2 className={`w-4 h-4 text-${config.color}-500`} />
              <span className="text-slate-600 dark:text-slate-400">
                {corr.items.map((id, idx) => (
                  <React.Fragment key={id}>
                    {idx > 0 && <ArrowRight className="w-3 h-3 inline mx-1" />}
                    <span className="font-medium text-slate-800 dark:text-slate-200">
                      {getItemText(id).substring(0, 50)}
                      {getItemText(id).length > 50 ? '...' : ''}
                    </span>
                  </React.Fragment>
                ))}
              </span>
            </div>

            {/* Insight */}
            <p className="text-slate-700 dark:text-slate-300 mb-3">{corr.insight}</p>

            {/* Initiative proposal */}
            {corr.initiativeProposal && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700">
                <Lightbulb className="w-4 h-4 text-amber-500 mt-0.5" />
                <div>
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                    {t('discoveryToolsTools.dynamicSwot.correlationsStep.proposedInitiative')}
                  </p>
                  <p className="text-sm text-slate-800 dark:text-slate-200">
                    {corr.initiativeProposal}
                  </p>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-primary-100 dark:bg-primary-900/30">
          <Link2 className="w-5 h-5 text-primary-600 dark:text-primary-400" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
            {t('discoveryToolsTools.dynamicSwot.correlationsStep.title')}
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {t('discoveryToolsTools.dynamicSwot.correlationsStep.subtitle')}
          </p>
        </div>
      </div>

      {tensions.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {tensions.map((tension) => (
            <div
              key={tension.id}
              className="p-4 rounded-lg bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700"
            >
              <div className="text-xs uppercase tracking-wide text-primary-500 mb-1">
                {tension.type}
              </div>
              <div className="text-sm font-medium text-slate-900 dark:text-white">
                {tension.title}
              </div>
              <div className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                {tension.insight}
              </div>
              {tension.whyNow && (
                <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                  {t('discoveryToolsTools.dynamicSwot.correlationsStep.whyNow')} {tension.whyNow}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Correlations by type */}
      {correlations.length > 0 ? (
        <div className="space-y-6">
          {renderCorrelationGroup('SO')}
          {renderCorrelationGroup('WO')}
          {renderCorrelationGroup('ST')}
          {renderCorrelationGroup('WT')}
        </div>
      ) : (
        <div className="p-8 rounded-lg border-2 border-dashed border-slate-200 dark:border-navy-700 text-center">
          <Link2 className="w-8 h-8 text-slate-600 dark:text-slate-400 mx-auto mb-3" />
          <p className="text-slate-500 dark:text-slate-400 mb-2">
            {t('discoveryToolsTools.dynamicSwot.correlationsStep.empty')}
          </p>
          <p className="text-sm text-slate-600">
            {t('discoveryToolsTools.dynamicSwot.correlationsStep.emptyHint')}
          </p>
        </div>
      )}

      {/* Stats */}
      {correlations.length > 0 && (
        <div className="flex items-center gap-4 text-sm text-slate-500 dark:text-slate-400">
          <span>
            {correlations.length} {t('discoveryToolsTools.dynamicSwot.correlationsStep.correlations')}
          </span>
          <span>•</span>
          <span>
            {correlations.filter((c) => c.initiativeProposal).length}{' '}
            {t('discoveryToolsTools.dynamicSwot.correlationsStep.initiativeProposals')}
          </span>
        </div>
      )}
    </div>
  );
};

export default SWOTCorrelationsStep;
