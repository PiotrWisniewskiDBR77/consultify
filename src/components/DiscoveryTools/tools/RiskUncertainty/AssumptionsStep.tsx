/**
 * AssumptionsStep - list critical assumptions with confidence
 */
import { Plus, Trash2 } from 'lucide-react';
import React, { useState } from 'react';

import { RiskAssumption, RiskUncertaintyData, ToolSession, useToolStore } from '@/store/useToolStore';

import { InlineAssist } from '../../InlineAssist';

interface AssumptionsStepProps {
  session: ToolSession;
  isPolish: boolean;
}

const generateId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

export const AssumptionsStep: React.FC<AssumptionsStepProps> = ({ session, isPolish }) => {
  const { updateInputData } = useToolStore();
  const data = session.inputData as RiskUncertaintyData;
  const assumptions = data.assumptions || [];

  const [text, setText] = useState('');
  const [confidence, setConfidence] = useState(3);

  const handleAdd = () => {
    if (!text.trim()) return;
    const newItem: RiskAssumption = {
      id: generateId(),
      text: text.trim(),
      confidence,
    };
    updateInputData({ assumptions: [...assumptions, newItem] });
    setText('');
    setConfidence(3);
  };

  const handleRemove = (id: string) => {
    updateInputData({ assumptions: assumptions.filter((a) => a.id !== id) });
  };

  const handleUpdate = (id: string, updates: Partial<RiskAssumption>) => {
    updateInputData({
      assumptions: assumptions.map((a) => (a.id === id ? { ...a, ...updates } : a)),
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
          {isPolish ? 'Założenia krytyczne' : 'Critical assumptions'}
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {isPolish
            ? 'Wypisz kluczowe założenia i oceń pewność (1–5).'
            : 'List key assumptions and rate confidence (1–5).'}
        </p>
      </div>

      <div className="space-y-3">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={isPolish ? 'Treść założenia...' : 'Assumption text...'}
          rows={2}
          className="w-full px-4 py-3 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 text-slate-900 dark:text-white"
        />
        <div className="flex flex-wrap gap-3 items-center">
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
              ? 'Zapisz założenia tak, aby dało się je zweryfikować (dane/warunki).'
              : 'Write assumptions so they can be verified (data/conditions).'
          }
        />
      </div>

      <div className="space-y-3">
        {assumptions.length === 0 ? (
          <div className="p-8 rounded-lg border-2 border-dashed border-slate-200 dark:border-navy-700 text-center text-slate-400">
            {isPolish ? 'Brak założeń' : 'No assumptions yet'}
          </div>
        ) : (
          assumptions.map((a) => (
            <div
              key={a.id}
              className="p-4 rounded-lg bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-slate-800 dark:text-slate-200">{a.text}</div>
                  <div className="text-xs text-slate-500 mt-1">
                    {isPolish ? 'Pewność' : 'Confidence'}: {a.confidence}/5
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={a.confidence}
                    onChange={(e) => handleUpdate(a.id, { confidence: Number(e.target.value) })}
                    className="px-2 py-1 text-xs rounded border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 text-slate-700 dark:text-slate-300"
                  >
                    {[1, 2, 3, 4, 5].map((v) => (
                      <option key={v} value={v}>
                        {v}/5
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => handleRemove(a.id)}
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

