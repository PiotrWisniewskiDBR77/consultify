/**
 * DMSKPIsStep - define KPIs and thresholds
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

interface DMSKPIsStepProps {
  session: ToolSession;
  isPolish: boolean;
}

const generateId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

export const DMSKPIsStep: React.FC<DMSKPIsStepProps> = ({ session, isPolish }) => {
  const { t } = useTranslation();
  const { updateInputData } = useToolStore();
  const [title, setTitle] = useState('');
  const [target, setTarget] = useState('');
  const [frequency, setFrequency] = useState('');
  const [owner, setOwner] = useState('');

  const data = session.inputData as OperationalToolData;
  const items = data.sections?.kpis || [];

  const handleAdd = () => {
    if (!title.trim()) return;
    const newItem: OperationalItem = {
      id: generateId(),
      title: title.trim(),
      description: '',
      impact: 'high',
      effort: 'low',
      target: target.trim(),
      frequency: frequency.trim(),
      owner: owner.trim(),
    };
    updateInputData({
      sections: {
        ...data.sections,
        kpis: [...items, newItem],
      },
    });
    setTitle('');
    setTarget('');
    setFrequency('');
    setOwner('');
  };

  const handleRemove = (itemId: string) => {
    updateInputData({
      sections: {
        ...data.sections,
        kpis: items.filter((item) => item.id !== itemId),
      },
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
          {t('discoveryToolsTools.operational.dmsKpisStep.title')}
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {t('discoveryToolsTools.operational.dmsKpisStep.description')}
        </p>
      </div>

      <div className="space-y-3">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t('discoveryToolsTools.operational.dmsKpisStep.kpiPlaceholder')}
          className="w-full px-4 py-3 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 text-slate-900 dark:text-white"
        />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <input
            type="text"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            placeholder={t('discoveryToolsTools.operational.dmsKpisStep.targetPlaceholder')}
            className="w-full px-4 py-3 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 text-slate-900 dark:text-white"
          />
          <input
            type="text"
            value={frequency}
            onChange={(e) => setFrequency(e.target.value)}
            placeholder={t('discoveryToolsTools.operational.dmsKpisStep.frequencyPlaceholder')}
            className="w-full px-4 py-3 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 text-slate-900 dark:text-white"
          />
          <input
            type="text"
            value={owner}
            onChange={(e) => setOwner(e.target.value)}
            placeholder={t('discoveryToolsTools.operational.dmsKpisStep.ownerPlaceholder')}
            className="w-full px-4 py-3 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 text-slate-900 dark:text-white"
          />
        </div>
        <button
          onClick={handleAdd}
          disabled={!title.trim()}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-navy-900 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] hover:bg-navy-800 disabled:opacity-50"
        >
          <Plus className="w-4 h-4" />
          {t('discoveryToolsTools.operational.dmsKpisStep.addKpi')}
        </button>
        <InlineAssist hint={t('discoveryToolsTools.operational.dmsKpisStep.hint')} />
      </div>

      <div className="space-y-3">
        {items.length === 0 ? (
          <div className="p-8 rounded-lg border-2 border-dashed border-slate-200 dark:border-navy-700 text-center text-slate-600">
            {t('discoveryToolsTools.operational.dmsKpisStep.empty')}
          </div>
        ) : (
          items.map((item) => (
            <div
              key={item.id}
              className="p-4 rounded-lg bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h4 className="font-medium text-slate-900 dark:text-white">{item.title}</h4>
                  <div className="text-xs text-slate-500 mt-2">
                    {item.target &&
                      `${t('discoveryToolsTools.operational.dmsKpisStep.targetLabel')}: ${item.target}`}
                    {item.frequency &&
                      ` • ${t('discoveryToolsTools.operational.dmsKpisStep.frequencyLabel')}: ${item.frequency}`}
                    {item.owner &&
                      ` • ${t('discoveryToolsTools.operational.dmsKpisStep.ownerLabel')}: ${item.owner}`}
                  </div>
                </div>
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

export default DMSKPIsStep;
