/**
 * InventoryReplenishmentStep - define replenishment policies
 */
import { Plus, Trash2 } from 'lucide-react';
import React, { useState } from 'react';

import {
  OperationalItem,
  OperationalToolData,
  ToolSession,
  useToolStore,
} from '@/store/useToolStore';

import { InlineAssist } from '../../InlineAssist';

interface InventoryReplenishmentStepProps {
  session: ToolSession;
  isPolish: boolean;
}

const generateId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

export const InventoryReplenishmentStep: React.FC<InventoryReplenishmentStepProps> = ({
  session,
  isPolish,
}) => {
  const { updateInputData } = useToolStore();
  const [policy, setPolicy] = useState('');
  const [threshold, setThreshold] = useState('');
  const [target, setTarget] = useState('');

  const data = session.inputData as OperationalToolData;
  const items = data.sections?.replenishment || [];

  const handleAdd = () => {
    if (!policy.trim()) return;
    const newItem: OperationalItem = {
      id: generateId(),
      title: policy.trim(),
      description: '',
      impact: 'medium',
      effort: 'low',
      threshold: threshold.trim(),
      target: target.trim(),
    };
    updateInputData({
      sections: {
        ...data.sections,
        replenishment: [...items, newItem],
      },
    });
    setPolicy('');
    setThreshold('');
    setTarget('');
  };

  const handleRemove = (itemId: string) => {
    updateInputData({
      sections: {
        ...data.sections,
        replenishment: items.filter((item) => item.id !== itemId),
      },
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
          {isPolish ? 'Polityki uzupełniania' : 'Replenishment policies'}
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {isPolish
            ? 'Zdefiniuj progi i cele polityk uzupełniania.'
            : 'Define thresholds and targets for replenishment.'}
        </p>
      </div>

      <div className="space-y-3">
        <input
          type="text"
          value={policy}
          onChange={(e) => setPolicy(e.target.value)}
          placeholder={isPolish ? 'Polityka...' : 'Policy...'}
          className="w-full px-4 py-3 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 text-slate-900 dark:text-white"
        />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <input
            type="text"
            value={threshold}
            onChange={(e) => setThreshold(e.target.value)}
            placeholder={isPolish ? 'Punkt uzupełnienia...' : 'Reorder point...'}
            className="w-full px-4 py-3 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 text-slate-900 dark:text-white"
          />
          <input
            type="text"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            placeholder={isPolish ? 'Cel / service level...' : 'Target / service level...'}
            className="w-full px-4 py-3 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 text-slate-900 dark:text-white"
          />
        </div>
        <button
          onClick={handleAdd}
          disabled={!policy.trim()}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-navy-900 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] hover:bg-navy-800 disabled:opacity-50"
        >
          <Plus className="w-4 h-4" />
          {isPolish ? 'Dodaj politykę' : 'Add policy'}
        </button>
        <InlineAssist
          hint={
            isPolish
              ? 'Każda polityka powinna mieć próg i cel.'
              : 'Each policy should have threshold and target.'
          }
        />
      </div>

      <div className="space-y-3">
        {items.length === 0 ? (
          <div className="p-8 rounded-lg border-2 border-dashed border-slate-200 dark:border-navy-700 text-center text-slate-600">
            {isPolish ? 'Brak polityk' : 'No policies yet'}
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
                    {item.threshold && `${isPolish ? 'Próg' : 'Threshold'}: ${item.threshold}`}
                    {item.target && ` • ${isPolish ? 'Cel' : 'Target'}: ${item.target}`}
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

export default InventoryReplenishmentStep;
