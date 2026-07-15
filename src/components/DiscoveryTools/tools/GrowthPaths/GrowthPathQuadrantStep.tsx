/**
 * GrowthPathQuadrantStep - Ansoff Matrix quadrant input
 */
import { Plus, Trash2 } from 'lucide-react';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { GrowthPathItem, GrowthPathsData, ToolSession, useToolStore } from '@/store/useToolStore';

import { InlineAssist } from '../../InlineAssist';

interface GrowthPathQuadrantStepProps {
  quadrant: 'market-penetration' | 'market-development' | 'product-development' | 'diversification';
  session: ToolSession;
  isPolish: boolean;
}

const QUADRANT_LABELS: Record<
  keyof GrowthPathsData['quadrants'],
  { title: { en: string; pl: string }; subtitle: { en: string; pl: string } }
> = {
  marketPenetration: {
    title: { en: 'Market Penetration', pl: 'Penetracja Rynku' },
    subtitle: {
      en: 'Current products, current markets',
      pl: 'Obecne produkty, obecne rynki',
    },
  },
  marketDevelopment: {
    title: { en: 'Market Development', pl: 'Rozwój Rynku' },
    subtitle: {
      en: 'Current products, new markets',
      pl: 'Obecne produkty, nowe rynki',
    },
  },
  productDevelopment: {
    title: { en: 'Product Development', pl: 'Rozwój Produktu' },
    subtitle: {
      en: 'New products, current markets',
      pl: 'Nowe produkty, obecne rynki',
    },
  },
  diversification: {
    title: { en: 'Diversification', pl: 'Dywersyfikacja' },
    subtitle: {
      en: 'New products, new markets',
      pl: 'Nowe produkty, nowe rynki',
    },
  },
};

const QUADRANT_KEY_MAP: Record<
  GrowthPathQuadrantStepProps['quadrant'],
  keyof GrowthPathsData['quadrants']
> = {
  'market-penetration': 'marketPenetration',
  'market-development': 'marketDevelopment',
  'product-development': 'productDevelopment',
  diversification: 'diversification',
};

const generateId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

export const GrowthPathQuadrantStep: React.FC<GrowthPathQuadrantStepProps> = ({
  quadrant,
  session,
  isPolish,
}) => {
  const { t } = useTranslation();
  const { updateInputData } = useToolStore();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [impact, setImpact] = useState<'high' | 'medium' | 'low'>('medium');
  const [effort, setEffort] = useState<'high' | 'medium' | 'low'>('medium');

  const lang = isPolish ? 'pl' : 'en';
  const data = session.inputData as GrowthPathsData;
  const quadrantKey = QUADRANT_KEY_MAP[quadrant];
  const items = data.quadrants[quadrantKey];
  const labels = QUADRANT_LABELS[quadrantKey];

  const handleAdd = () => {
    if (!title.trim()) return;
    const newItem: GrowthPathItem = {
      id: generateId(),
      title: title.trim(),
      description: description.trim(),
      impact,
      effort,
    };

    updateInputData({
      quadrants: {
        ...data.quadrants,
        [quadrantKey]: [...items, newItem],
      },
    });
    setTitle('');
    setDescription('');
    setImpact('medium');
    setEffort('medium');
  };

  const handleRemove = (itemId: string) => {
    updateInputData({
      quadrants: {
        ...data.quadrants,
        [quadrantKey]: items.filter((item) => item.id !== itemId),
      },
    });
  };

  const handleUpdate = (itemId: string, updates: Partial<GrowthPathItem>) => {
    updateInputData({
      quadrants: {
        ...data.quadrants,
        [quadrantKey]: items.map((item) => (item.id === itemId ? { ...item, ...updates } : item)),
      },
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
          {labels.title[lang]}
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">{labels.subtitle[lang]}</p>
      </div>

      <div className="space-y-3">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t('discoveryToolsTools.growthPaths.step.titlePlaceholder')}
          className="w-full px-4 py-3 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={t('discoveryToolsTools.growthPaths.step.descPlaceholder')}
          rows={2}
          className="w-full px-4 py-3 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
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
            disabled={!title.trim()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-navy-900 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] hover:bg-navy-800 disabled:opacity-50"
          >
            <Plus className="w-4 h-4" />
            {t('discoveryToolsTools.common.add')}
          </button>
        </div>
        <InlineAssist hint={t('discoveryToolsTools.growthPaths.step.hint')} />
      </div>

      <div className="space-y-3">
        {items.length === 0 ? (
          <div className="p-8 rounded-lg border-2 border-dashed border-slate-200 dark:border-navy-700 text-center text-slate-600">
            {t('discoveryToolsTools.growthPaths.step.empty')}
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
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                  <select
                    value={item.effort}
                    onChange={(e) =>
                      handleUpdate(item.id, { effort: e.target.value as 'high' | 'medium' | 'low' })
                    }
                    className="px-2 py-1 text-xs rounded border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 text-slate-700 dark:text-slate-300"
                  >
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                  <button
                    onClick={() => handleRemove(item.id)}
                    className="p-1 rounded hover:bg-danger-100 dark:hover:bg-danger-900/30 text-slate-600 hover:text-danger-500"
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

export default GrowthPathQuadrantStep;
