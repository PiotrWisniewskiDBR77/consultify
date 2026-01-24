/**
 * ScenariosStep - list scenarios and likelihood
 */
import { Plus, Trash2 } from 'lucide-react';
import React, { useState } from 'react';

import { RiskUncertaintyData, ScenarioItem, ToolSession, useToolStore } from '@/store/useToolStore';

import { InlineAssist } from '../../InlineAssist';

interface ScenariosStepProps {
  session: ToolSession;
  isPolish: boolean;
}

const generateId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

export const ScenariosStep: React.FC<ScenariosStepProps> = ({ session, isPolish }) => {
  const { updateInputData } = useToolStore();
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [likelihood, setLikelihood] = useState(3);

  const data = session.inputData as RiskUncertaintyData;
  const scenarios = data.scenarios;

  const handleAdd = () => {
    if (!title.trim()) return;
    const newItem: ScenarioItem = {
      id: generateId(),
      title: title.trim(),
      notes: notes.trim(),
      likelihood,
    };
    updateInputData({
      scenarios: [...scenarios, newItem],
    });
    setTitle('');
    setNotes('');
    setLikelihood(3);
  };

  const handleRemove = (itemId: string) => {
    updateInputData({
      scenarios: scenarios.filter((item) => item.id !== itemId),
    });
  };

  const handleUpdate = (itemId: string, updates: Partial<ScenarioItem>) => {
    updateInputData({
      scenarios: scenarios.map((item) => (item.id === itemId ? { ...item, ...updates } : item)),
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
          {isPolish ? 'Scenariusze' : 'Scenarios'}
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {isPolish
            ? 'Opisz scenariusze i ocen prawdopodobienstwo.'
            : 'Describe scenarios and assess likelihood.'}
        </p>
      </div>

      <div className="space-y-3">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={isPolish ? 'Tytul scenariusza...' : 'Scenario title...'}
          className="w-full px-4 py-3 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 text-slate-900 dark:text-white"
        />
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={isPolish ? 'Notatki...' : 'Notes...'}
          rows={2}
          className="w-full px-4 py-3 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 text-slate-900 dark:text-white"
        />
        <div className="flex items-center gap-3">
          <label className="text-xs text-slate-500">
            {isPolish ? 'Prawdopodobienstwo' : 'Likelihood'}
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
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50"
          >
            <Plus className="w-4 h-4" />
            {isPolish ? 'Dodaj' : 'Add'}
          </button>
        </div>
        <InlineAssist
          hint={
            isPolish
              ? 'Scenariusze powinny miec opis konsekwencji.'
              : 'Scenarios should include impact notes.'
          }
        />
      </div>

      <div className="space-y-3">
        {scenarios.length === 0 ? (
          <div className="p-8 rounded-lg border-2 border-dashed border-slate-200 dark:border-navy-700 text-center text-slate-400">
            {isPolish ? 'Brak scenariuszy' : 'No scenarios yet'}
          </div>
        ) : (
          scenarios.map((item) => (
            <div
              key={item.id}
              className="p-4 rounded-lg bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-slate-800 dark:text-slate-200">{item.title}</div>
                  {item.notes && <div className="text-xs text-slate-500 mt-1">{item.notes}</div>}
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={item.likelihood}
                    onChange={(e) =>
                      handleUpdate(item.id, { likelihood: Number(e.target.value) })
                    }
                    className="px-2 py-1 text-xs rounded border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 text-slate-700 dark:text-slate-300"
                  >
                    {[1, 2, 3, 4, 5].map((v) => (
                      <option key={v} value={v}>
                        L{v}
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

export default ScenariosStep;
