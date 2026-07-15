/**
 * A3RootCauseStep - 5 Why analysis
 */
import { Plus, Trash2 } from 'lucide-react';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  OperationalItem,
  OperationalToolData,
  ToolSession,
  useToolStore,
} from '@/store/useToolStore';

import { InlineAssist } from '../../InlineAssist';

interface A3RootCauseStepProps {
  session: ToolSession;
  isPolish: boolean;
}

const generateId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

export const A3RootCauseStep: React.FC<A3RootCauseStepProps> = ({ session, isPolish }) => {
  const { t } = useTranslation();
  const { updateInputData } = useToolStore();
  const [cause, setCause] = useState('');

  const data = session.inputData as OperationalToolData;
  const items = data.sections?.['root-cause'] || [];

  const handleAdd = () => {
    if (!cause.trim()) return;
    const newItem: OperationalItem = {
      id: generateId(),
      title: cause.trim(),
      description: '',
      impact: 'high',
      effort: 'low',
    };
    updateInputData({
      sections: {
        ...data.sections,
        'root-cause': [...items, newItem],
      },
    });
    setCause('');
  };

  const handleRemove = (itemId: string) => {
    updateInputData({
      sections: {
        ...data.sections,
        'root-cause': items.filter((item) => item.id !== itemId),
      },
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
          {t('discoveryToolsTools.operational.a3RootCauseStep.title')}
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {t('discoveryToolsTools.operational.a3RootCauseStep.description')}
        </p>
      </div>

      <div className="space-y-3">
        <input
          type="text"
          value={cause}
          onChange={(e) => setCause(e.target.value)}
          placeholder={t('discoveryToolsTools.operational.a3RootCauseStep.causePlaceholder')}
          className="w-full px-4 py-3 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 text-slate-900 dark:text-white"
        />
        <button
          onClick={handleAdd}
          disabled={!cause.trim()}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-navy-900 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] hover:bg-navy-800 disabled:opacity-50"
        >
          <Plus className="w-4 h-4" />
          {t('discoveryToolsTools.common.add')}
        </button>
        <InlineAssist hint={t('discoveryToolsTools.operational.a3RootCauseStep.hint')} />
      </div>

      <div className="space-y-3">
        {items.length === 0 ? (
          <div className="p-8 rounded-lg border-2 border-dashed border-slate-200 dark:border-navy-700 text-center text-slate-600">
            {t('discoveryToolsTools.operational.a3RootCauseStep.empty')}
          </div>
        ) : (
          items.map((item) => (
            <div
              key={item.id}
              className="p-4 rounded-lg bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="text-slate-800 dark:text-slate-200">{item.title}</div>
                <button
                  onClick={() => handleRemove(item.id)}
                  className="p-1 rounded hover:bg-danger-100 dark:hover:bg-danger-900/30 text-slate-600 hover:text-danger-500"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default A3RootCauseStep;
