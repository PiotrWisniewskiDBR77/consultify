/**
 * SWOTMatrix - Interactive SWOT visualization
 *
 * Displays a 4-quadrant matrix with strengths, weaknesses,
 * opportunities, and threats.
 */

import React from 'react';
import { SWOTData, SWOTItem } from '@/store/useToolStore';

// ==================== TYPES ====================

interface SWOTMatrixProps {
  data: SWOTData;
  isPolish: boolean;
  onItemClick?: (item: SWOTItem) => void;
}

// ==================== CONSTANTS ====================

const QUADRANT_CONFIG = {
  strengths: {
    label: { en: 'Strengths', pl: 'Mocne strony' },
    color: 'emerald',
    bgClass: 'bg-emerald-50 dark:bg-emerald-900/20',
    borderClass: 'border-emerald-200 dark:border-emerald-800',
    textClass: 'text-emerald-700 dark:text-emerald-300',
    icon: 'S',
  },
  weaknesses: {
    label: { en: 'Weaknesses', pl: 'Słabe strony' },
    color: 'red',
    bgClass: 'bg-red-50 dark:bg-red-900/20',
    borderClass: 'border-red-200 dark:border-red-800',
    textClass: 'text-red-700 dark:text-red-300',
    icon: 'W',
  },
  opportunities: {
    label: { en: 'Opportunities', pl: 'Szanse' },
    color: 'blue',
    bgClass: 'bg-blue-50 dark:bg-blue-900/20',
    borderClass: 'border-blue-200 dark:border-blue-800',
    textClass: 'text-blue-700 dark:text-blue-300',
    icon: 'O',
  },
  threats: {
    label: { en: 'Threats', pl: 'Zagrożenia' },
    color: 'amber',
    bgClass: 'bg-amber-50 dark:bg-amber-900/20',
    borderClass: 'border-amber-200 dark:border-amber-800',
    textClass: 'text-amber-700 dark:text-amber-300',
    icon: 'T',
  },
};

// ==================== COMPONENT ====================

export const SWOTMatrix: React.FC<SWOTMatrixProps> = ({
  data,
  isPolish,
  onItemClick,
}) => {
  const lang = isPolish ? 'pl' : 'en';

  const getQuadrantItems = (quadrant: keyof typeof QUADRANT_CONFIG) => {
    return data.items.filter((item) => item.quadrant === quadrant);
  };

  const renderQuadrant = (quadrant: keyof typeof QUADRANT_CONFIG) => {
    const config = QUADRANT_CONFIG[quadrant];
    const items = getQuadrantItems(quadrant);

    return (
      <div
        className={`p-4 ${config.bgClass} border ${config.borderClass} rounded-lg`}
      >
        {/* Quadrant header */}
        <div className="flex items-center gap-2 mb-3">
          <span className={`w-6 h-6 rounded flex items-center justify-center text-xs font-bold ${config.textClass} bg-white dark:bg-navy-800`}>
            {config.icon}
          </span>
          <h4 className={`font-medium ${config.textClass}`}>
            {config.label[lang]}
          </h4>
          <span className="text-xs text-slate-400">({items.length})</span>
        </div>

        {/* Items */}
        <div className="space-y-2">
          {items.length > 0 ? (
            items.map((item) => (
              <div
                key={item.id}
                onClick={() => onItemClick?.(item)}
                className={`
                  p-2 rounded bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700
                  text-sm text-slate-700 dark:text-slate-300
                  ${onItemClick ? 'cursor-pointer hover:border-slate-300 dark:hover:border-navy-600' : ''}
                `}
              >
                <div className="flex items-start justify-between gap-2">
                  <span>{item.text}</span>
                  <span className={`
                    px-1.5 py-0.5 text-xs rounded
                    ${item.impact === 'high' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' :
                      item.impact === 'medium' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' :
                      'bg-slate-100 text-slate-600 dark:bg-navy-700 dark:text-slate-400'}
                  `}>
                    {item.impact}
                  </span>
                </div>
                {item.source === 'ai' && (
                  <span className="text-xs text-primary-500 mt-1 inline-block">AI</span>
                )}
              </div>
            ))
          ) : (
            <div className="text-sm text-slate-400 italic">
              {isPolish ? 'Brak elementów' : 'No items'}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="grid grid-cols-2 gap-4">
      {/* Internal factors (top row) */}
      <div className="col-span-2 text-center text-xs text-slate-400 uppercase tracking-wide">
        {isPolish ? 'Czynniki wewnętrzne' : 'Internal Factors'}
      </div>
      {renderQuadrant('strengths')}
      {renderQuadrant('weaknesses')}

      {/* External factors (bottom row) */}
      <div className="col-span-2 text-center text-xs text-slate-400 uppercase tracking-wide mt-2">
        {isPolish ? 'Czynniki zewnętrzne' : 'External Factors'}
      </div>
      {renderQuadrant('opportunities')}
      {renderQuadrant('threats')}
    </div>
  );
};

export default SWOTMatrix;
