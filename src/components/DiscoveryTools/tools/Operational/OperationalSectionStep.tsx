/**
 * OperationalSectionStep - Generic list input for operational tools
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

interface OperationalSectionStepProps {
  sectionId: string;
  title: string;
  description: string;
  session: ToolSession;
  isPolish: boolean;
}

const generateId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

export const OperationalSectionStep: React.FC<OperationalSectionStepProps> = ({
  sectionId,
  title,
  description,
  session,
  isPolish,
}) => {
  const { t } = useTranslation();
  const { updateInputData } = useToolStore();
  const [itemTitle, setItemTitle] = useState('');
  const [itemDescription, setItemDescription] = useState('');
  const [impact, setImpact] = useState<'high' | 'medium' | 'low'>('medium');
  const [effort, setEffort] = useState<'high' | 'medium' | 'low'>('medium');

  const data = session.inputData as OperationalToolData;
  const items = data.sections?.[sectionId] || [];

  const handleAdd = () => {
    if (!itemTitle.trim()) return;
    const newItem: OperationalItem = {
      id: generateId(),
      title: itemTitle.trim(),
      description: itemDescription.trim(),
      impact,
      effort,
    };
    updateInputData({
      sections: {
        ...data.sections,
        [sectionId]: [...items, newItem],
      },
    });
    setItemTitle('');
    setItemDescription('');
    setImpact('medium');
    setEffort('medium');
  };

  const handleRemove = (itemId: string) => {
    updateInputData({
      sections: {
        ...data.sections,
        [sectionId]: items.filter((item) => item.id !== itemId),
      },
    });
  };

  const handleUpdate = (itemId: string, updates: Partial<OperationalItem>) => {
    updateInputData({
      sections: {
        ...data.sections,
        [sectionId]: items.map((item) => (item.id === itemId ? { ...item, ...updates } : item)),
      },
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white">{title}</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">{description}</p>
      </div>

      <div className="space-y-3">
        <input
          type="text"
          value={itemTitle}
          onChange={(e) => setItemTitle(e.target.value)}
          placeholder={t('discoveryToolsTools.operational.operationalSectionStep.namePlaceholder')}
          className="w-full px-4 py-3 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 text-slate-900 dark:text-white"
        />
        <textarea
          value={itemDescription}
          onChange={(e) => setItemDescription(e.target.value)}
          placeholder={t('discoveryToolsTools.operational.operationalSectionStep.descPlaceholder')}
          rows={2}
          className="w-full px-4 py-3 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 text-slate-900 dark:text-white resize-none"
        />
        <div className="flex flex-wrap gap-3">
          <select
            value={impact}
            onChange={(e) => setImpact(e.target.value as 'high' | 'medium' | 'low')}
            className="px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 text-slate-700 dark:text-slate-300"
          >
            <option value="high">{t('discoveryToolsTools.growthPaths.step.highImpact')}</option>
            <option value="medium">{t('discoveryToolsTools.growthPaths.step.mediumImpact')}</option>
            <option value="low">{t('discoveryToolsTools.growthPaths.step.lowImpact')}</option>
          </select>
          <select
            value={effort}
            onChange={(e) => setEffort(e.target.value as 'high' | 'medium' | 'low')}
            className="px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 text-slate-700 dark:text-slate-300"
          >
            <option value="high">{t('discoveryToolsTools.growthPaths.step.highEffort')}</option>
            <option value="medium">{t('discoveryToolsTools.growthPaths.step.mediumEffort')}</option>
            <option value="low">{t('discoveryToolsTools.growthPaths.step.lowEffort')}</option>
          </select>
          <button
            onClick={handleAdd}
            disabled={!itemTitle.trim()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-navy-900 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] hover:bg-navy-800 disabled:opacity-50"
          >
            <Plus className="w-4 h-4" />
            {t('discoveryToolsTools.common.add')}
          </button>
        </div>
        <InlineAssist hint={t('discoveryToolsTools.operational.operationalSectionStep.hint')} />
      </div>

      <div className="space-y-3">
        {items.length === 0 ? (
          <div className="p-8 rounded-lg border-2 border-dashed border-slate-200 dark:border-navy-700 text-center text-slate-600">
            {t('discoveryToolsTools.operational.operationalSectionStep.empty')}
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
                  {item.description && (
                    <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                      {item.description}
                    </p>
                  )}
                  <div className="mt-2 text-xs text-slate-500">
                    {t('discoveryToolsTools.common.impact')}: {item.impact} •{' '}
                    {t('discoveryToolsTools.common.effort')}: {item.effort}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={item.impact}
                    onChange={(e) =>
                      handleUpdate(item.id, { impact: e.target.value as 'high' | 'medium' | 'low' })
                    }
                    className="px-2 py-1 text-xs rounded border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 text-slate-700 dark:text-slate-300"
                  >
                    <option value="high">{t('discoveryToolsTools.common.level.high')}</option>
                    <option value="medium">{t('discoveryToolsTools.common.level.medium')}</option>
                    <option value="low">{t('discoveryToolsTools.common.level.low')}</option>
                  </select>
                  <select
                    value={item.effort}
                    onChange={(e) =>
                      handleUpdate(item.id, { effort: e.target.value as 'high' | 'medium' | 'low' })
                    }
                    className="px-2 py-1 text-xs rounded border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 text-slate-700 dark:text-slate-300"
                  >
                    <option value="high">{t('discoveryToolsTools.common.level.high')}</option>
                    <option value="medium">{t('discoveryToolsTools.common.level.medium')}</option>
                    <option value="low">{t('discoveryToolsTools.common.level.low')}</option>
                  </select>
                  <button
                    onClick={() => handleRemove(item.id)}
                    className="p-1 rounded hover:bg-danger-100 dark:hover:bg-danger-900/30 text-slate-600 hover:text-danger-500"
                    aria-label={t('discoveryToolsTools.common.remove')}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default OperationalSectionStep;
