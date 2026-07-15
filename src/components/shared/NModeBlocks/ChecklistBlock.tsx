/**
 * ChecklistBlock
 *
 * N-mode building block for interactive checklists with progress tracking.
 * Supports adding/removing items, AI generation, and completion toggles.
 *
 * Follows DBR77 Visual Language — quiet UI, minimal chrome.
 *
 * @see docs/ui-standards/01-shell-layout/presentation-modes.md §2.5.5
 */

import { Check, Loader2, Plus, Sparkles, Trash2 } from 'lucide-react';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

// ── Types ───────────────────────────────────────────────────────────────────

export interface ChecklistItem {
  id: string;
  text: string;
  completed: boolean;
}

export interface ChecklistBlockProps {
  /** Checklist items */
  items: ChecklistItem[];
  /** Toggle item completion */
  onToggle: (id: string) => void;
  /** Update item text */
  onUpdateText: (id: string, text: string) => void;
  /** Add new item */
  onAdd: () => void;
  /** Remove item */
  onRemove: (id: string) => void;
  /** AI generate checklist handler (omit to hide button) */
  onAIGenerate?: () => void;
  /** Whether AI generation is in progress */
  isGeneratingAI?: boolean;
  /** Whether inputs are locked/read-only */
  locked?: boolean;
  /** Show progress bar (default: true) */
  showProgress?: boolean;
  /** Additional CSS classes */
  className?: string;
}

// ── Component ───────────────────────────────────────────────────────────────

export const ChecklistBlock: React.FC<ChecklistBlockProps> = ({
  items,
  onToggle,
  onUpdateText,
  onAdd,
  onRemove,
  onAIGenerate,
  isGeneratingAI = false,
  locked = false,
  showProgress = true,
  className = '',
}) => {
  const { t } = useTranslation();
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const completed = items.filter((i) => i.completed).length;
  const total = items.length;
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Progress bar */}
      {showProgress && total > 0 && (
        <div className="flex items-center gap-3">
          <div className="flex-1 h-1.5 bg-slate-200/60 dark:bg-navy-700/60 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all duration-300"
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="text-[11px] font-medium text-slate-600 dark:text-slate-500 tabular-nums">
            {completed}/{total}
          </span>
        </div>
      )}

      {/* Items */}
      {items.length === 0 ? (
        <div className="py-6 text-center">
          <p className="text-xs text-slate-600 dark:text-slate-500 mb-2">
            {t('sharedComponents.checklistBlock.noItems')}
          </p>
          <button
            onClick={onAdd}
            disabled={locked}
            className="text-xs font-medium text-primary-500 hover:text-primary-600 transition-colors disabled:opacity-40"
          >
            + {t('sharedComponents.checklistBlock.addItem')}
          </button>
        </div>
      ) : (
        <div className="space-y-1">
          {items.map((item, idx) => (
            <div
              key={item.id}
              className="group flex items-center gap-2.5 py-1.5 px-2 rounded-lg hover:bg-slate-50/50 dark:hover:bg-navy-800/30 transition-colors"
              onMouseEnter={() => setHoveredId(item.id)}
              onMouseLeave={() => setHoveredId(null)}
            >
              {/* Number */}
              <span className="w-5 text-right text-[10px] font-mono text-slate-600 dark:text-slate-400 flex-shrink-0">
                {idx + 1}.
              </span>
              {/* Checkbox */}
              <button
                onClick={() => onToggle(item.id)}
                disabled={locked}
                className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-all ${
                  item.completed
                    ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-500'
                    : 'border-slate-300/60 dark:border-navy-600/60 hover:border-primary-400'
                } disabled:opacity-50`}
              >
                {item.completed && <Check size={10} />}
              </button>
              {/* Text */}
              <input
                value={item.text}
                onChange={(e) => onUpdateText(item.id, e.target.value)}
                readOnly={locked}
                className={`flex-1 text-sm bg-transparent focus:outline-none placeholder-slate-400 dark:placeholder-slate-600 ${
                  item.completed
                    ? 'text-slate-600 dark:text-slate-500 line-through'
                    : 'text-slate-700 dark:text-slate-200'
                }`}
                placeholder={t('sharedComponents.checklistBlock.itemPlaceholder')}
              />
              {/* Delete */}
              {hoveredId === item.id && !locked && (
                <button
                  onClick={() => onRemove(item.id)}
                  className="p-0.5 text-slate-600 hover:text-danger-500 transition-colors flex-shrink-0"
                >
                  <Trash2 size={11} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-3">
        <button
          onClick={onAdd}
          disabled={locked}
          className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 dark:text-slate-500 hover:text-primary-500 transition-colors disabled:opacity-40"
        >
          <Plus size={12} />
          {t('sharedComponents.checklistBlock.addItem')}
        </button>
        {onAIGenerate && (
          <button
            onClick={onAIGenerate}
            disabled={locked || isGeneratingAI}
            className="inline-flex items-center gap-1 text-xs font-medium text-primary-500 dark:text-primary-400 hover:text-primary-600 transition-colors disabled:opacity-40"
          >
            {isGeneratingAI ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <Sparkles size={12} />
            )}
            {t('sharedComponents.checklistBlock.aiGenerate')}
          </button>
        )}
      </div>
    </div>
  );
};

export default ChecklistBlock;
