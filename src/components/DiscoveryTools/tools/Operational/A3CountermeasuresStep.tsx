/**
 * A3CountermeasuresStep - define countermeasures
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

interface A3CountermeasuresStepProps {
  session: ToolSession;
  isPolish: boolean;
}

const generateId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

export const A3CountermeasuresStep: React.FC<A3CountermeasuresStepProps> = ({
  session,
  isPolish,
}) => {
  const { t } = useTranslation();
  const { updateInputData } = useToolStore();
  const [title, setTitle] = useState('');
  const [owner, setOwner] = useState('');
  const [target, setTarget] = useState('');

  const data = session.inputData as OperationalToolData;
  const items = data.sections?.countermeasures || [];

  const handleAdd = () => {
    if (!title.trim()) return;
    const newItem: OperationalItem = {
      id: generateId(),
      title: title.trim(),
      description: target.trim(),
      impact: 'high',
      effort: 'medium',
      owner: owner.trim(),
      target: target.trim(),
    };
    updateInputData({
      sections: {
        ...data.sections,
        countermeasures: [...items, newItem],
      },
    });
    setTitle('');
    setOwner('');
    setTarget('');
  };

  const handleRemove = (itemId: string) => {
    updateInputData({
      sections: {
        ...data.sections,
        countermeasures: items.filter((item) => item.id !== itemId),
      },
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
          {t('discoveryToolsTools.operational.a3CountermeasuresStep.title')}
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {t('discoveryToolsTools.operational.a3CountermeasuresStep.description')}
        </p>
      </div>

      <div className="space-y-3">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t('discoveryToolsTools.operational.a3CountermeasuresStep.actionPlaceholder')}
          className="w-full px-4 py-3 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 text-slate-900 dark:text-white"
        />
        <input
          type="text"
          value={owner}
          onChange={(e) => setOwner(e.target.value)}
          placeholder={t('discoveryToolsTools.operational.a3CountermeasuresStep.ownerPlaceholder')}
          className="w-full px-4 py-3 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 text-slate-900 dark:text-white"
        />
        <input
          type="text"
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          placeholder={t('discoveryToolsTools.operational.a3CountermeasuresStep.targetPlaceholder')}
          className="w-full px-4 py-3 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 text-slate-900 dark:text-white"
        />
        <button
          onClick={handleAdd}
          disabled={!title.trim()}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-navy-900 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] hover:bg-navy-800 disabled:opacity-50"
        >
          <Plus className="w-4 h-4" />
          {t('discoveryToolsTools.common.add')}
        </button>
        <InlineAssist hint={t('discoveryToolsTools.operational.a3CountermeasuresStep.hint')} />
      </div>

      <div className="space-y-3">
        {items.length === 0 ? (
          <div className="p-8 rounded-lg border-2 border-dashed border-slate-200 dark:border-navy-700 text-center text-slate-600">
            {t('discoveryToolsTools.operational.a3CountermeasuresStep.empty')}
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
                  {(item.owner || item.target) && (
                    <div className="text-xs text-slate-500 mt-2">
                      {item.owner &&
                        `${t('discoveryToolsTools.operational.a3CountermeasuresStep.ownerLabel')}: ${item.owner}`}
                      {item.owner && item.target && ' • '}
                      {item.target &&
                        `${t('discoveryToolsTools.operational.a3CountermeasuresStep.targetLabel')}: ${item.target}`}
                    </div>
                  )}
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

export default A3CountermeasuresStep;
