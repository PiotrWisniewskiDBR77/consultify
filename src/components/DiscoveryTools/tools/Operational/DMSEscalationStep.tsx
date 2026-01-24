/**
 * DMSEscalationStep - define escalation rules
 */
import { Plus, Trash2 } from 'lucide-react';
import React, { useState } from 'react';

import { OperationalItem, OperationalToolData, ToolSession, useToolStore } from '@/store/useToolStore';

import { InlineAssist } from '../../InlineAssist';

interface DMSEscalationStepProps {
  session: ToolSession;
  isPolish: boolean;
}

const generateId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

export const DMSEscalationStep: React.FC<DMSEscalationStepProps> = ({ session, isPolish }) => {
  const { updateInputData } = useToolStore();
  const [rule, setRule] = useState('');
  const [threshold, setThreshold] = useState('');
  const [owner, setOwner] = useState('');

  const data = session.inputData as OperationalToolData;
  const items = data.sections?.escalation || [];

  const handleAdd = () => {
    if (!rule.trim()) return;
    const newItem: OperationalItem = {
      id: generateId(),
      title: rule.trim(),
      description: '',
      impact: 'high',
      effort: 'low',
      threshold: threshold.trim(),
      owner: owner.trim(),
    };
    updateInputData({
      sections: {
        ...data.sections,
        escalation: [...items, newItem],
      },
    });
    setRule('');
    setThreshold('');
    setOwner('');
  };

  const handleRemove = (itemId: string) => {
    updateInputData({
      sections: {
        ...data.sections,
        escalation: items.filter((item) => item.id !== itemId),
      },
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
          {isPolish ? 'Reguły eskalacji' : 'Escalation rules'}
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {isPolish
            ? 'Zdefiniuj progi i właścicieli eskalacji.'
            : 'Define thresholds and escalation owners.'}
        </p>
      </div>

      <div className="space-y-3">
        <input
          type="text"
          value={rule}
          onChange={(e) => setRule(e.target.value)}
          placeholder={isPolish ? 'Reguła...' : 'Rule...'}
          className="w-full px-4 py-3 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 text-slate-900 dark:text-white"
        />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <input
            type="text"
            value={threshold}
            onChange={(e) => setThreshold(e.target.value)}
            placeholder={isPolish ? 'Próg...' : 'Threshold...'}
            className="w-full px-4 py-3 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 text-slate-900 dark:text-white"
          />
          <input
            type="text"
            value={owner}
            onChange={(e) => setOwner(e.target.value)}
            placeholder={isPolish ? 'Owner...' : 'Owner...'}
            className="w-full px-4 py-3 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 text-slate-900 dark:text-white"
          />
        </div>
        <button
          onClick={handleAdd}
          disabled={!rule.trim()}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50"
        >
          <Plus className="w-4 h-4" />
          {isPolish ? 'Dodaj regułę' : 'Add rule'}
        </button>
        <InlineAssist
          hint={
            isPolish
              ? 'Reguły powinny mieć próg i właściciela eskalacji.'
              : 'Rules should have thresholds and owners.'
          }
        />
      </div>

      <div className="space-y-3">
        {items.length === 0 ? (
          <div className="p-8 rounded-lg border-2 border-dashed border-slate-200 dark:border-navy-700 text-center text-slate-400">
            {isPolish ? 'Brak reguł' : 'No rules yet'}
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
                    {item.owner && ` • ${isPolish ? 'Owner' : 'Owner'}: ${item.owner}`}
                  </div>
                </div>
                <button
                  onClick={() => handleRemove(item.id)}
                  className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-slate-400 hover:text-red-500"
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

export default DMSEscalationStep;
