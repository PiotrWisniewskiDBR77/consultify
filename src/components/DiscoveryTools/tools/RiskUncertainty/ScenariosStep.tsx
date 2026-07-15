/**
 * ScenariosStep - list plausible scenarios with likelihood
 */
import { Plus, Trash2 } from 'lucide-react';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { RiskUncertaintyData, ScenarioItem, ToolSession, useToolStore } from '@/store/useToolStore';

import { InlineAssist } from '../../InlineAssist';

interface ScenariosStepProps {
  session: ToolSession;
  isPolish: boolean;
}

const generateId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

export const ScenariosStep: React.FC<ScenariosStepProps> = ({ session }) => {
  const { t } = useTranslation();
  const { updateInputData } = useToolStore();
  const data = session.inputData as RiskUncertaintyData;
  const scenarios = data.scenarios || [];

  const [title, setTitle] = useState('');
  const [likelihood, setLikelihood] = useState(3);
  const [notes, setNotes] = useState('');

  const handleAdd = () => {
    if (!title.trim()) return;
    const newItem: ScenarioItem = {
      id: generateId(),
      title: title.trim(),
      likelihood,
      notes: notes.trim(),
    };
    updateInputData({ scenarios: [...scenarios, newItem] });
    setTitle('');
    setLikelihood(3);
    setNotes('');
  };

  const handleRemove = (id: string) => {
    updateInputData({ scenarios: scenarios.filter((s) => s.id !== id) });
  };

  const handleUpdate = (id: string, updates: Partial<ScenarioItem>) => {
    updateInputData({
      scenarios: scenarios.map((s) => (s.id === id ? { ...s, ...updates } : s)),
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
          {t('discoveryToolsTools.riskUncertainty.scenariosStep.title')}
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {t('discoveryToolsTools.riskUncertainty.scenariosStep.subtitle')}
        </p>
      </div>

      <div className="space-y-3">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t('discoveryToolsTools.riskUncertainty.scenariosStep.titlePlaceholder')}
          className="w-full px-4 py-3 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 text-slate-900 dark:text-white"
        />
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={t('discoveryToolsTools.riskUncertainty.scenariosStep.notesPlaceholder')}
          rows={2}
          className="w-full px-4 py-3 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 text-slate-900 dark:text-white"
        />
        <div className="flex flex-wrap gap-3 items-center">
          <label className="text-xs text-slate-500">
            {t('discoveryToolsTools.riskUncertainty.likelihood')}
            <select
              value={likelihood}
              onChange={(e) => setLikelihood(Number(e.target.value))}
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
            disabled={!title.trim()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-navy-900 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] hover:bg-navy-800 disabled:opacity-50"
          >
            <Plus className="w-4 h-4" />
            {t('discoveryToolsTools.common.add')}
          </button>
        </div>
        <InlineAssist hint={t('discoveryToolsTools.riskUncertainty.scenariosStep.hint')} />
      </div>

      <div className="space-y-3">
        {scenarios.length === 0 ? (
          <div className="p-8 rounded-lg border-2 border-dashed border-slate-200 dark:border-navy-700 text-center text-slate-600">
            {t('discoveryToolsTools.riskUncertainty.scenariosStep.empty')}
          </div>
        ) : (
          scenarios.map((s) => (
            <div
              key={s.id}
              className="p-4 rounded-lg bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-slate-800 dark:text-slate-200 font-medium">{s.title}</div>
                  {s.notes ? <div className="text-xs text-slate-500 mt-1">{s.notes}</div> : null}
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={s.likelihood}
                    onChange={(e) => handleUpdate(s.id, { likelihood: Number(e.target.value) })}
                    className="px-2 py-1 text-xs rounded border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 text-slate-700 dark:text-slate-300"
                  >
                    {[1, 2, 3, 4, 5].map((v) => (
                      <option key={v} value={v}>
                        L{v}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => handleRemove(s.id)}
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

export default ScenariosStep;
