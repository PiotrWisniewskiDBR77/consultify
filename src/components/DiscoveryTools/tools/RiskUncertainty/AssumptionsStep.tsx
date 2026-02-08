/**
 * AssumptionsStep - list key assumptions with confidence
 */
import { Plus, Trash2 } from 'lucide-react';
import React, { useState } from 'react';

import {
  RiskAssumption,
  RiskUncertaintyData,
  ToolSession,
  useToolStore,
} from '@/store/useToolStore';

import { InlineAssist } from '../../InlineAssist';

interface AssumptionsStepProps {
  session: ToolSession;
  isPolish: boolean;
}

const generateId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

export const AssumptionsStep: React.FC<AssumptionsStepProps> = ({ session, isPolish }) => {
  const { updateInputData } = useToolStore();
  const [text, setText] = useState('');
  const [confidence, setConfidence] = useState(3);

  const data = session.inputData as RiskUncertaintyData;
  const assumptions = data.assumptions;

  const handleAdd = () => {
    if (!text.trim()) return;
    const newItem: RiskAssumption = {
      id: generateId(),
      text: text.trim(),
      confidence,
    };
    updateInputData({
      assumptions: [...assumptions, newItem],
    });
    setText('');
    setConfidence(3);
  };

  const handleRemove = (itemId: string) => {
    updateInputData({
      assumptions: assumptions.filter((item) => item.id !== itemId),
    });
  };

  const handleUpdate = (itemId: string, nextConfidence: number) => {
    updateInputData({
      assumptions: assumptions.map((item) =>
        item.id === itemId ? { ...item, confidence: nextConfidence } : item
      ),
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
          {isPolish ? 'Kluczowe założenia' : 'Key assumptions'}
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {isPolish
            ? 'Zapisz kluczowe założenia i ocen ich pewność.'
            : 'List key assumptions and set confidence.'}
        </p>
      </div>

      <div className="space-y-3">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={isPolish ? 'Założenie...' : 'Assumption...'}
          rows={2}
          className="w-full px-4 py-3 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 text-slate-900 dark:text-white"
        />
        <div className="flex items-center gap-3">
          <label className="text-xs text-slate-500">
            {isPolish ? 'Pewność' : 'Confidence'}
            <select
              value={confidence}
              onChange={(e) => setConfidence(Number(e.target.value))}
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
            disabled={!text.trim()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50"
          >
            <Plus className="w-4 h-4" />
            {isPolish ? 'Dodaj' : 'Add'}
          </button>
        </div>
        <InlineAssist
          hint={
            isPolish
              ? 'Założenia powinny być mierzalne i powiązane z ryzykiem.'
              : 'Assumptions should be measurable and tied to risk.'
          }
        />
      </div>

      <div className="space-y-3">
        {assumptions.length === 0 ? (
          <div className="p-8 rounded-lg border-2 border-dashed border-slate-200 dark:border-navy-700 text-center text-slate-400">
            {isPolish ? 'Brak założeń' : 'No assumptions yet'}
          </div>
        ) : (
          assumptions.map((item) => (
            <div
              key={item.id}
              className="p-4 rounded-lg bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="text-slate-800 dark:text-slate-200">{item.text}</div>
                <div className="flex items-center gap-2">
                  <select
                    value={item.confidence}
                    onChange={(e) => handleUpdate(item.id, Number(e.target.value))}
                    className="px-2 py-1 text-xs rounded border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 text-slate-700 dark:text-slate-300"
                  >
                    {[1, 2, 3, 4, 5].map((v) => (
                      <option key={v} value={v}>
                        {v}/5
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => handleRemove(item.id)}
                    className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-slate-400 hover:text-red-500"
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

export default AssumptionsStep;
