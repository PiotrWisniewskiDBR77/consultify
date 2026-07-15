/**
 * SMEDStepsStep - list internal/external changeover steps
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

interface SMEDStepsStepProps {
  session: ToolSession;
  isPolish: boolean;
}

const generateId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

export const SMEDStepsStep: React.FC<SMEDStepsStepProps> = ({ session, isPolish }) => {
  const { t } = useTranslation();
  const { updateInputData } = useToolStore();
  const [title, setTitle] = useState('');
  const [type, setType] = useState<'internal' | 'external'>('internal');
  const [durationMinutes, setDurationMinutes] = useState(5);

  const data = session.inputData as OperationalToolData;
  const items = data.sections?.['changeover-steps'] || [];

  const handleAdd = () => {
    if (!title.trim()) return;
    const newItem: OperationalItem = {
      id: generateId(),
      title: title.trim(),
      description: '',
      impact: 'medium',
      effort: 'medium',
      category: type,
      durationMinutes,
    };
    updateInputData({
      sections: {
        ...data.sections,
        'changeover-steps': [...items, newItem],
      },
    });
    setTitle('');
    setType('internal');
    setDurationMinutes(5);
  };

  const handleRemove = (itemId: string) => {
    updateInputData({
      sections: {
        ...data.sections,
        'changeover-steps': items.filter((item) => item.id !== itemId),
      },
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
          {t('discoveryToolsTools.operational.smedStepsStep.title')}
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {t('discoveryToolsTools.operational.smedStepsStep.description')}
        </p>
      </div>

      <div className="space-y-3">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t('discoveryToolsTools.operational.smedStepsStep.stepPlaceholder')}
          className="w-full px-4 py-3 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 text-slate-900 dark:text-white"
        />
        <div className="flex flex-wrap gap-3">
          <select
            value={type}
            onChange={(e) => setType(e.target.value as 'internal' | 'external')}
            className="px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 text-slate-700 dark:text-slate-300"
          >
            <option value="internal">{t('discoveryToolsTools.operational.smedStepsStep.internal')}</option>
            <option value="external">{t('discoveryToolsTools.operational.smedStepsStep.external')}</option>
          </select>
          <input
            type="number"
            min={1}
            value={durationMinutes}
            onChange={(e) => setDurationMinutes(Number(e.target.value))}
            className="px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 text-slate-700 dark:text-slate-300 w-28"
          />
          <span className="text-sm text-slate-500 self-center">min</span>
          <button
            onClick={handleAdd}
            disabled={!title.trim()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-navy-900 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] hover:bg-navy-800 disabled:opacity-50"
          >
            <Plus className="w-4 h-4" />
            {t('discoveryToolsTools.common.add')}
          </button>
        </div>
        <InlineAssist hint={t('discoveryToolsTools.operational.smedStepsStep.hint')} />
      </div>

      <div className="space-y-3">
        {items.length === 0 ? (
          <div className="p-8 rounded-lg border-2 border-dashed border-slate-200 dark:border-navy-700 text-center text-slate-600">
            {t('discoveryToolsTools.operational.smedStepsStep.empty')}
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
                    {t('discoveryToolsTools.operational.smedStepsStep.typeLabel')}: {item.category}{' '}
                    • {t('discoveryToolsTools.operational.smedStepsStep.durationLabel')}:{' '}
                    {item.durationMinutes} min
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

export default SMEDStepsStep;
