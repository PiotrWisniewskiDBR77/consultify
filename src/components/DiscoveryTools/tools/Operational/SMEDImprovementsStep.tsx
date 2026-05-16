/**
 * SMEDImprovementsStep - list quick wins and investments
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

interface SMEDImprovementsStepProps {
  session: ToolSession;
  isPolish: boolean;
}

const generateId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

export const SMEDImprovementsStep: React.FC<SMEDImprovementsStepProps> = ({
  session,
  isPolish,
}) => {
  const { updateInputData } = useToolStore();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('quick-win');

  const data = session.inputData as OperationalToolData;
  const items = data.sections?.improvements || [];

  const handleAdd = () => {
    if (!title.trim()) return;
    const newItem: OperationalItem = {
      id: generateId(),
      title: title.trim(),
      description: description.trim(),
      impact: 'high',
      effort: category === 'quick-win' ? 'low' : 'high',
      category,
    };
    updateInputData({
      sections: {
        ...data.sections,
        improvements: [...items, newItem],
      },
    });
    setTitle('');
    setDescription('');
    setCategory('quick-win');
  };

  const handleRemove = (itemId: string) => {
    updateInputData({
      sections: {
        ...data.sections,
        improvements: items.filter((item) => item.id !== itemId),
      },
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
          {isPolish ? 'Usprawnienia SMED' : 'SMED improvements'}
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {isPolish ? 'Dodaj quick wins oraz inwestycje.' : 'Add quick wins and investments.'}
        </p>
      </div>

      <div className="space-y-3">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={isPolish ? 'Usprawnienie...' : 'Improvement...'}
          className="w-full px-4 py-3 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 text-slate-900 dark:text-white"
        />
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={isPolish ? 'Opis / ROI...' : 'Description / ROI...'}
          rows={2}
          className="w-full px-4 py-3 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 text-slate-900 dark:text-white resize-none"
        />
        <div className="flex items-center gap-3">
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 text-slate-700 dark:text-slate-300"
          >
            <option value="quick-win">{isPolish ? 'Quick win' : 'Quick win'}</option>
            <option value="investment">{isPolish ? 'Inwestycja' : 'Investment'}</option>
          </select>
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
              ? 'Oznacz czy to quick win czy większa inwestycja.'
              : 'Label quick wins vs investments.'
          }
        />
      </div>

      <div className="space-y-3">
        {items.length === 0 ? (
          <div className="p-8 rounded-lg border-2 border-dashed border-slate-200 dark:border-navy-700 text-center text-slate-400">
            {isPolish ? 'Brak usprawnień' : 'No improvements yet'}
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
                  {item.category && (
                    <div className="text-xs text-slate-500 mt-2">
                      {isPolish ? 'Typ' : 'Type'}: {item.category}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => handleRemove(item.id)}
                  className="p-1 rounded hover:bg-rose-100 dark:hover:bg-rose-900/30 text-slate-400 hover:text-rose-500"
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

export default SMEDImprovementsStep;
