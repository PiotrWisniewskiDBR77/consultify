/**
 * PortfolioMatrixStep - Simple BCG summary view
 */
import React from 'react';
import { useTranslation } from 'react-i18next';

import { PortfolioPriorityData, ToolSession } from '@/store/useToolStore';

interface PortfolioMatrixStepProps {
  session: ToolSession;
  isPolish: boolean;
}

const CATEGORIES = [
  { id: 'star', label: { en: 'Stars', pl: 'Gwiazdy' } },
  { id: 'cash-cow', label: { en: 'Cash Cows', pl: 'Dojne Krowy' } },
  { id: 'question-mark', label: { en: 'Question Marks', pl: 'Znaki zapytania' } },
  { id: 'dog', label: { en: 'Dogs', pl: 'Psy' } },
];

export const PortfolioMatrixStep: React.FC<PortfolioMatrixStepProps> = ({ session, isPolish }) => {
  const { t } = useTranslation();
  const data = session.inputData as PortfolioPriorityData;
  const lang = isPolish ? 'pl' : 'en';

  const counts = CATEGORIES.reduce<Record<string, number>>((acc, cat) => {
    acc[cat.id] = data.initiatives.filter((item) => item.category === cat.id).length;
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
          {t('discoveryToolsTools.portfolioPriority.matrixStep.title')}
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {t('discoveryToolsTools.portfolioPriority.matrixStep.subtitle')}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {CATEGORIES.map((cat) => (
          <div
            key={cat.id}
            className="p-4 rounded-lg bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700"
          >
            <div className="text-sm text-slate-500">{cat.label[lang]}</div>
            <div className="text-2xl font-semibold text-slate-900 dark:text-white">
              {counts[cat.id] || 0}
            </div>
          </div>
        ))}
      </div>

      {data.initiatives.length > 0 && (
        <div className="p-4 rounded-lg bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700">
          <h3 className="font-medium text-slate-900 dark:text-white mb-3">
            {t('discoveryToolsTools.portfolioPriority.matrixStep.initiativesAndCategories')}
          </h3>
          <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
            {data.initiatives.map((item) => (
              <li key={item.id} className="flex items-center justify-between">
                <span>{item.title}</span>
                <span className="text-xs text-slate-500">{item.category}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default PortfolioMatrixStep;
