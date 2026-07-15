/**
 * RisksStep - list risks with probability/impact
 */
import { Plus, Trash2 } from 'lucide-react';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { RiskItem, RiskUncertaintyData, ToolSession, useToolStore } from '@/store/useToolStore';

import { InlineAssist } from '../../InlineAssist';

interface RisksStepProps {
  session: ToolSession;
  isPolish: boolean;
}

const generateId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

export const RisksStep: React.FC<RisksStepProps> = ({ session }) => {
  const { t } = useTranslation();
  const { updateInputData } = useToolStore();
  const [description, setDescription] = useState('');
  const [probability, setProbability] = useState(3);
  const [impact, setImpact] = useState(3);
  const [mitigation, setMitigation] = useState('');

  const data = session.inputData as RiskUncertaintyData;
  const risks = data.risks;

  const handleAdd = () => {
    if (!description.trim()) return;
    const newItem: RiskItem = {
      id: generateId(),
      description: description.trim(),
      probability,
      impact,
      mitigation: mitigation.trim(),
    };
    updateInputData({
      risks: [...risks, newItem],
    });
    setDescription('');
    setProbability(3);
    setImpact(3);
    setMitigation('');
  };

  const handleRemove = (itemId: string) => {
    updateInputData({
      risks: risks.filter((item) => item.id !== itemId),
    });
  };

  const handleUpdate = (itemId: string, updates: Partial<RiskItem>) => {
    updateInputData({
      risks: risks.map((item) => (item.id === itemId ? { ...item, ...updates } : item)),
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
          {t('discoveryToolsTools.riskUncertainty.risksStep.title')}
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {t('discoveryToolsTools.riskUncertainty.risksStep.subtitle')}
        </p>
      </div>

      <div className="space-y-3">
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={t('discoveryToolsTools.riskUncertainty.risksStep.descPlaceholder')}
          rows={2}
          className="w-full px-4 py-3 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 text-slate-900 dark:text-white"
        />
        <textarea
          value={mitigation}
          onChange={(e) => setMitigation(e.target.value)}
          placeholder={t('discoveryToolsTools.riskUncertainty.risksStep.mitigationPlaceholder')}
          rows={2}
          className="w-full px-4 py-3 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 text-slate-900 dark:text-white"
        />
        <div className="flex flex-wrap gap-3">
          <label className="text-xs text-slate-500">
            {t('discoveryToolsTools.common.probability')}
            <select
              value={probability}
              onChange={(e) => setProbability(Number(e.target.value))}
              className="ml-2 px-2 py-1 rounded border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 text-slate-700 dark:text-slate-300"
            >
              {[1, 2, 3, 4, 5].map((v) => (
                <option key={v} value={v}>
                  {v}/5
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-slate-500">
            {t('discoveryToolsTools.common.impact')}
            <select
              value={impact}
              onChange={(e) => setImpact(Number(e.target.value))}
              className="ml-2 px-2 py-1 rounded border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 text-slate-700 dark:text-slate-300"
            >
              {[1, 2, 3, 4, 5].map((v) => (
                <option key={v} value={v}>
                  {v}/5
                </option>
              ))}
            </select>
          </label>
          <button
            onClick={handleAdd}
            disabled={!description.trim()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-navy-900 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] hover:bg-navy-800 disabled:opacity-50"
          >
            <Plus className="w-4 h-4" />
            {t('discoveryToolsTools.common.add')}
          </button>
        </div>
        <InlineAssist hint={t('discoveryToolsTools.riskUncertainty.risksStep.hint')} />
      </div>

      <div className="space-y-3">
        {risks.length === 0 ? (
          <div className="p-8 rounded-lg border-2 border-dashed border-slate-200 dark:border-navy-700 text-center text-slate-600">
            {t('discoveryToolsTools.riskUncertainty.risksStep.empty')}
          </div>
        ) : (
          risks.map((item) => (
            <div
              key={item.id}
              className="p-4 rounded-lg bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-slate-800 dark:text-slate-200">{item.description}</div>
                  {item.mitigation && (
                    <div className="text-xs text-slate-500 mt-1">{item.mitigation}</div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={item.probability}
                    onChange={(e) => handleUpdate(item.id, { probability: Number(e.target.value) })}
                    className="px-2 py-1 text-xs rounded border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 text-slate-700 dark:text-slate-300"
                  >
                    {[1, 2, 3, 4, 5].map((v) => (
                      <option key={v} value={v}>
                        P{v}
                      </option>
                    ))}
                  </select>
                  <select
                    value={item.impact}
                    onChange={(e) => handleUpdate(item.id, { impact: Number(e.target.value) })}
                    className="px-2 py-1 text-xs rounded border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 text-slate-700 dark:text-slate-300"
                  >
                    {[1, 2, 3, 4, 5].map((v) => (
                      <option key={v} value={v}>
                        I{v}
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

export default RisksStep;
