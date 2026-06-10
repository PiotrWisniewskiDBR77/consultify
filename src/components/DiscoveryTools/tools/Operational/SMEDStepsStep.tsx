/**
 * SMEDStepsStep - list internal/external changeover steps
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

interface SMEDStepsStepProps {
  session: ToolSession;
  isPolish: boolean;
}

const generateId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

export const SMEDStepsStep: React.FC<SMEDStepsStepProps> = ({ session, isPolish }) => {
  const { updateInputData } = useToolStore();
  const [title, setTitle] = useState('');
  const [type, setType] = useState<'internal' | 'external'>('internal');
  const [durationMinutes, setDurationMinutes] = useState(5);

  const data = session.inputData as OperationalToolData;
  const items = data.sections?.['changeover-steps'] || [];

  const handleAdd = () => {
    if (!title.trim()) return;
    const newItem: OperationalItem = {
      id: generateId(),
      title: title.trim(),
      description: '',
      impact: 'medium',
      effort: 'medium',
      category: type,
      durationMinutes,
    };
    updateInputData({
      sections: {
        ...data.sections,
        'changeover-steps': [...items, newItem],
      },
    });
    setTitle('');
    setType('internal');
    setDurationMinutes(5);
  };

  const handleRemove = (itemId: string) => {
    updateInputData({
      sections: {
        ...data.sections,
        'changeover-steps': items.filter((item) => item.id !== itemId),
      },
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
          {isPolish ? 'Kroki przezbrojenia' : 'Changeover steps'}
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {isPolish
            ? 'Rozdziel kroki na wewnętrzne i zewnętrzne.'
            : 'Separate internal and external steps.'}
        </p>
      </div>

      <div className="space-y-3">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={isPolish ? 'Krok przezbrojenia...' : 'Changeover step...'}
          className="w-full px-4 py-3 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 text-slate-900 dark:text-white"
        />
        <div className="flex flex-wrap gap-3">
          <select
            value={type}
            onChange={(e) => setType(e.target.value as 'internal' | 'external')}
            className="px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 text-slate-700 dark:text-slate-300"
          >
            <option value="internal">{isPolish ? 'Wewnętrzny' : 'Internal'}</option>
            <option value="external">{isPolish ? 'Zewnętrzny' : 'External'}</option>
          </select>
          <input
            type="number"
            min={1}
            value={durationMinutes}
            onChange={(e) => setDurationMinutes(Number(e.target.value))}
            className="px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 text-slate-700 dark:text-slate-300 w-28"
          />
          <span className="text-sm text-slate-500 self-center">{isPolish ? 'min' : 'min'}</span>
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
              ? 'Oznacz typ i czas trwania każdego kroku.'
              : 'Mark type and duration for each step.'
          }
        />
      </div>

      <div className="space-y-3">
        {items.length === 0 ? (
          <div className="p-8 rounded-lg border-2 border-dashed border-slate-200 dark:border-navy-700 text-center text-slate-600">
            {isPolish ? 'Brak kroków' : 'No steps yet'}
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
                    {isPolish ? 'Typ' : 'Type'}: {item.category} • {isPolish ? 'Czas' : 'Duration'}:{' '}
                    {item.durationMinutes} min
                  </div>
                </div>
                <button
                  onClick={() => handleRemove(item.id)}
                  className="p-1 rounded hover:bg-rose-100 dark:hover:bg-rose-900/30 text-slate-600 hover:text-rose-500"
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

export default SMEDStepsStep;
