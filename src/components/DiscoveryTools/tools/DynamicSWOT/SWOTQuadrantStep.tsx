/**
 * SWOTQuadrantStep - Step for entering SWOT quadrant items
 *
 * Allows users to add, edit, and remove items for a specific quadrant.
 */

import { Plus, Sparkles, Trash2 } from 'lucide-react';
import React, { useState } from 'react';

import { SWOTData, SWOTItem, ToolSession, useToolStore } from '@/store/useToolStore';

import { InlineAssist } from '../../InlineAssist';

// ==================== TYPES ====================

interface SWOTQuadrantStepProps {
  quadrant: 'strengths' | 'weaknesses' | 'opportunities' | 'threats';
  session: ToolSession;
  isPolish: boolean;
}

// ==================== CONSTANTS ====================

const QUADRANT_CONFIG = {
  strengths: {
    title: { en: 'Strengths', pl: 'Mocne strony' },
    subtitle: { en: 'Internal positive attributes', pl: 'Wewnętrzne pozytywne cechy' },
    placeholder: { en: 'Add a strength...', pl: 'Dodaj mocną stronę...' },
    color: 'emerald',
    icon: 'S',
  },
  weaknesses: {
    title: { en: 'Weaknesses', pl: 'Słabe strony' },
    subtitle: { en: 'Internal areas for improvement', pl: 'Wewnętrzne obszary do poprawy' },
    placeholder: { en: 'Add a weakness...', pl: 'Dodaj słabą stronę...' },
    color: 'red',
    icon: 'W',
  },
  opportunities: {
    title: { en: 'Opportunities', pl: 'Szanse' },
    subtitle: { en: 'External favorable factors', pl: 'Zewnętrzne sprzyjające czynniki' },
    placeholder: { en: 'Add an opportunity...', pl: 'Dodaj szansę...' },
    color: 'blue',
    icon: 'O',
  },
  threats: {
    title: { en: 'Threats', pl: 'Zagrożenia' },
    subtitle: { en: 'External risk factors', pl: 'Zewnętrzne czynniki ryzyka' },
    placeholder: { en: 'Add a threat...', pl: 'Dodaj zagrożenie...' },
    color: 'amber',
    icon: 'T',
  },
};

// ==================== COMPONENT ====================

export const SWOTQuadrantStep: React.FC<SWOTQuadrantStepProps> = ({
  quadrant,
  session,
  isPolish,
}) => {
  const { addSWOTItem, removeSWOTItem, updateSWOTItem } = useToolStore();
  const [newItemText, setNewItemText] = useState('');

  const config = QUADRANT_CONFIG[quadrant];
  const lang = isPolish ? 'pl' : 'en';
  const swotData = session.inputData as SWOTData;
  const items = swotData.items.filter((item) => item.quadrant === quadrant);

  const handleAddItem = () => {
    if (!newItemText.trim()) return;

    addSWOTItem({
      text: newItemText.trim(),
      impact: 'medium',
      quadrant,
      source: 'user',
    });
    setNewItemText('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleAddItem();
    }
  };

  const handleImpactChange = (itemId: string, impact: 'high' | 'medium' | 'low') => {
    updateSWOTItem(itemId, { impact });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div
          className={`w-10 h-10 rounded-lg bg-${config.color}-100 dark:bg-${config.color}-900/30 flex items-center justify-center`}
        >
          <span
            className={`text-lg font-bold text-${config.color}-600 dark:text-${config.color}-400`}
          >
            {config.icon}
          </span>
        </div>
        <div>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
            {config.title[lang]}
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">{config.subtitle[lang]}</p>
        </div>
      </div>

      {/* Add item input */}
      <div className="flex gap-2">
        <input
          type="text"
          value={newItemText}
          onChange={(e) => setNewItemText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={config.placeholder[lang]}
          className="flex-1 px-4 py-3 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-c-focus"
        />
        <button
          onClick={handleAddItem}
          disabled={!newItemText.trim()}
          className={`px-4 py-3 rounded-lg bg-${config.color}-500 text-white hover:bg-${config.color}-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          <Plus className="w-5 h-5" />
        </button>
      </div>
      <InlineAssist
        hint={
          isPolish
            ? 'Dodaj konkretne, mierzalne elementy, nie ogolniki.'
            : 'Add concrete, measurable items, avoid general statements.'
        }
      />

      {/* Items list */}
      <div className="space-y-3">
        {items.length > 0 ? (
          items.map((item) => (
            <div
              key={item.id}
              className={`p-4 rounded-lg bg-${config.color}-50 dark:bg-${config.color}-900/10 border border-${config.color}-200 dark:border-${config.color}-800`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <p className="text-slate-800 dark:text-slate-200">{item.text}</p>
                  {item.source === 'ai' && (
                    <div className="flex items-center gap-1 mt-1 text-xs text-primary-500">
                      <Sparkles className="w-3 h-3" />
                      AI suggested
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {/* Impact selector */}
                  <select
                    value={item.impact}
                    onChange={(e) =>
                      handleImpactChange(item.id, e.target.value as 'high' | 'medium' | 'low')
                    }
                    className="px-2 py-1 text-xs rounded border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-c-focus"
                  >
                    <option value="high">{isPolish ? 'Wysoki wpływ' : 'High impact'}</option>
                    <option value="medium">{isPolish ? 'Średni wpływ' : 'Medium impact'}</option>
                    <option value="low">{isPolish ? 'Niski wpływ' : 'Low impact'}</option>
                  </select>

                  {/* Delete button */}
                  <button
                    onClick={() => removeSWOTItem(item.id)}
                    className="p-1 rounded hover:bg-danger-100 dark:hover:bg-danger-900/30 text-slate-600 hover:text-danger-500 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="p-8 rounded-lg border-2 border-dashed border-slate-200 dark:border-navy-700 text-center">
            <p className="text-slate-500 dark:text-slate-400">
              {isPolish
                ? 'Dodaj elementy lub poproś AI o sugestie'
                : 'Add items or ask AI for suggestions'}
            </p>
          </div>
        )}
      </div>

      {/* Item count */}
      <div className="text-sm text-slate-500 dark:text-slate-400">
        {items.length} {isPolish ? 'elementów' : 'items'} •{' '}
        {items.filter((i) => i.impact === 'high').length}{' '}
        {isPolish ? 'wysokiego wpływu' : 'high impact'}
      </div>
    </div>
  );
};

export default SWOTQuadrantStep;
