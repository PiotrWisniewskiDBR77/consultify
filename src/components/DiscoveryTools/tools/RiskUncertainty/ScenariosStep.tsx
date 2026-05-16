/**
 * ScenariosStep - list plausible scenarios with likelihood
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
          {isPolish ? 'Scenariusze' : 'Scenarios'}
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {isPolish
            ? 'Opisz możliwe scenariusze i oceń prawdopodobieństwo (1–5).'
            : 'Describe plausible scenarios and rate likelihood (1–5).'}
        </p>
      </div>

      <div className="space-y-3">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={isPolish ? 'Tytuł scenariusza...' : 'Scenario title...'}
          className="w-full px-4 py-3 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 text-slate-900 dark:text-white"
        />
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={isPolish ? 'Notatki / implikacje...' : 'Notes / implications...'}
          rows={2}
          className="w-full px-4 py-3 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 text-slate-900 dark:text-white"
        />
        <div className="flex flex-wrap gap-3 items-center">
          <label className="text-xs text-slate-500">
            {isPolish ? 'Prawdopodobieństwo' : 'Likelihood'}
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
              ? 'Scenariusze powinny być rozłączne i obejmować istotne niepewności (np. popyt, koszty, regulacje).'
              : 'Scenarios should be distinct and cover key uncertainties (e.g. demand, costs, regulation).'
          }
        />
      </div>

      <div className="space-y-3">
        {scenarios.length === 0 ? (
          <div className="p-8 rounded-lg border-2 border-dashed border-slate-200 dark:border-navy-700 text-center text-slate-400">
            {isPolish ? 'Brak scenariuszy' : 'No scenarios yet'}
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
                    className="p-1 rounded hover:bg-rose-100 dark:hover:bg-rose-900/30 text-slate-400 hover:text-rose-500"
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
