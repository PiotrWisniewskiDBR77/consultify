/**
 * A3ProblemStep - Problem statement
 */
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { OperationalToolData, ToolSession, useToolStore } from '@/store/useToolStore';

import { InlineAssist } from '../../InlineAssist';

interface A3ProblemStepProps {
  session: ToolSession;
  isPolish: boolean;
}

export const A3ProblemStep: React.FC<A3ProblemStepProps> = ({ session, isPolish }) => {
  const { t } = useTranslation();
  const { updateInputData } = useToolStore();
  const [problem, setProblem] = useState('');
  const [impact, setImpact] = useState('');
  const [scope, setScope] = useState('');

  const data = session.inputData as OperationalToolData;

  const handleSave = () => {
    updateInputData({
      sections: {
        ...data.sections,
        problem: [
          {
            id: 'problem',
            title: problem.trim(),
            description: impact.trim(),
            impact: 'high',
            effort: 'medium',
            category: scope.trim(),
          },
        ],
      },
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
          {t('discoveryToolsTools.operational.a3ProblemStep.title')}
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {t('discoveryToolsTools.operational.a3ProblemStep.description')}
        </p>
      </div>

      <div className="space-y-3">
        <textarea
          value={problem}
          onChange={(e) => setProblem(e.target.value)}
          placeholder={t('discoveryToolsTools.operational.a3ProblemStep.problemPlaceholder')}
          rows={3}
          className="w-full px-4 py-3 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 text-slate-900 dark:text-white"
        />
        <textarea
          value={impact}
          onChange={(e) => setImpact(e.target.value)}
          placeholder={t('discoveryToolsTools.operational.a3ProblemStep.impactPlaceholder')}
          rows={2}
          className="w-full px-4 py-3 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 text-slate-900 dark:text-white"
        />
        <input
          type="text"
          value={scope}
          onChange={(e) => setScope(e.target.value)}
          placeholder={t('discoveryToolsTools.operational.a3ProblemStep.scopePlaceholder')}
          className="w-full px-4 py-3 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 text-slate-900 dark:text-white"
        />
        <button
          onClick={handleSave}
          disabled={!problem.trim()}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-navy-900 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] hover:bg-navy-800 disabled:opacity-50"
        >
          {t('discoveryToolsTools.common.save')}
        </button>
        <InlineAssist hint={t('discoveryToolsTools.operational.a3ProblemStep.hint')} />
      </div>
    </div>
  );
};

export default A3ProblemStep;
