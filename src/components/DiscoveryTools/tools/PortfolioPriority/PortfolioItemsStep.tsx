/**
 * PortfolioItemsStep - BCG portfolio input
 */
import { Plus, Trash2 } from 'lucide-react';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  PortfolioItem,
  PortfolioPriorityData,
  ToolSession,
  useToolStore,
} from '@/store/useToolStore';

import { InlineAssist } from '../../InlineAssist';

interface PortfolioItemsStepProps {
  session: ToolSession;
  isPolish: boolean;
}

const generateId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

const getCategory = (growth: number, share: number): PortfolioItem['category'] => {
  if (growth >= 4 && share >= 4) return 'star';
  if (growth >= 4 && share < 4) return 'question-mark';
  if (growth < 4 && share >= 4) return 'cash-cow';
  return 'dog';
};

export const PortfolioItemsStep: React.FC<PortfolioItemsStepProps> = ({ session }) => {
  const { t } = useTranslation();
  const { updateInputData } = useToolStore();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [marketGrowth, setMarketGrowth] = useState(3);
  const [marketShare, setMarketShare] = useState(3);
  const [investmentLevel, setInvestmentLevel] = useState(3);

  const data = session.inputData as PortfolioPriorityData;
  const items = data.initiatives;

  const handleAdd = () => {
    if (!title.trim()) return;
    const category = getCategory(marketGrowth, marketShare);
    const newItem: PortfolioItem = {
      id: generateId(),
      title: title.trim(),
      description: description.trim(),
      marketGrowth,
      marketShare,
      investmentLevel,
      category,
    };

    updateInputData({
      initiatives: [...items, newItem],
    });
    setTitle('');
    setDescription('');
    setMarketGrowth(3);
    setMarketShare(3);
    setInvestmentLevel(3);
  };

  const handleRemove = (itemId: string) => {
    updateInputData({
      initiatives: items.filter((item) => item.id !== itemId),
    });
  };

  const handleUpdate = (itemId: string, updates: Partial<PortfolioItem>) => {
    updateInputData({
      initiatives: items.map((item) => {
        if (item.id !== itemId) return item;
        const next = { ...item, ...updates };
        return { ...next, category: getCategory(next.marketGrowth, next.marketShare) };
      }),
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
          {t('discoveryToolsTools.portfolioPriority.itemsStep.title')}
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {t('discoveryToolsTools.portfolioPriority.itemsStep.subtitle')}
        </p>
      </div>

      <div className="space-y-3">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t('discoveryToolsTools.portfolioPriority.itemsStep.namePlaceholder')}
          className="w-full px-4 py-3 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 text-slate-900 dark:text-white placeholder-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
        />
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={t('discoveryToolsTools.portfolioPriority.itemsStep.descPlaceholder')}
          rows={2}
          className="w-full px-4 py-3 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 text-slate-900 dark:text-white placeholder-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus resize-none"
        />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <label className="text-xs text-slate-500">
            {t('discoveryToolsTools.portfolioPriority.itemsStep.marketGrowth')}
            <select
              value={marketGrowth}
              onChange={(e) => setMarketGrowth(Number(e.target.value))}
              className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 text-slate-700 dark:text-slate-300"
            >
              {[1, 2, 3, 4, 5].map((v) => (
                <option key={v} value={v}>
                  {v}/5
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-slate-500">
            {t('discoveryToolsTools.portfolioPriority.itemsStep.marketShare')}
            <select
              value={marketShare}
              onChange={(e) => setMarketShare(Number(e.target.value))}
              className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 text-slate-700 dark:text-slate-300"
            >
              {[1, 2, 3, 4, 5].map((v) => (
                <option key={v} value={v}>
                  {v}/5
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-slate-500">
            {t('discoveryToolsTools.portfolioPriority.itemsStep.investmentLevel')}
            <select
              value={investmentLevel}
              onChange={(e) => setInvestmentLevel(Number(e.target.value))}
              className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 text-slate-700 dark:text-slate-300"
            >
              {[1, 2, 3, 4, 5].map((v) => (
                <option key={v} value={v}>
                  {v}/5
                </option>
              ))}
            </select>
          </label>
        </div>
        <button
          onClick={handleAdd}
          disabled={!title.trim()}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-navy-900 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] hover:bg-navy-800 disabled:opacity-50"
        >
          <Plus className="w-4 h-4" />
          {t('discoveryToolsTools.common.add')}
        </button>
        <InlineAssist hint={t('discoveryToolsTools.portfolioPriority.itemsStep.hint')} />
      </div>

      <div className="space-y-3">
        {items.length === 0 ? (
          <div className="p-8 rounded-lg border-2 border-dashed border-slate-200 dark:border-navy-700 text-center text-slate-600">
            {t('discoveryToolsTools.portfolioPriority.itemsStep.empty')}
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
                    {t('discoveryToolsTools.common.category')}: {item.category}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={item.marketGrowth}
                    onChange={(e) =>
                      handleUpdate(item.id, { marketGrowth: Number(e.target.value) })
                    }
                    className="px-2 py-1 text-xs rounded border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 text-slate-700 dark:text-slate-300"
                  >
                    {[1, 2, 3, 4, 5].map((v) => (
                      <option key={v} value={v}>
                        G{v}
                      </option>
                    ))}
                  </select>
                  <select
                    value={item.marketShare}
                    onChange={(e) => handleUpdate(item.id, { marketShare: Number(e.target.value) })}
                    className="px-2 py-1 text-xs rounded border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 text-slate-700 dark:text-slate-300"
                  >
                    {[1, 2, 3, 4, 5].map((v) => (
                      <option key={v} value={v}>
                        S{v}
                      </option>
                    ))}
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

export default PortfolioItemsStep;
