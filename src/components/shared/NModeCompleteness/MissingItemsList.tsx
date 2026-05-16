/**
 * MissingItemsList — Popover/panel showing missing fields
 *
 * List grouped by section. AI Fill button per item and bulk.
 * DBR77: card in popover, grouped by section, text-sm.
 *
 * @see V3-K01: N-mode required sections/fields + completeness + AI assist
 */

import { ChevronRight, Sparkles } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import type { MissingItem } from './types';

interface MissingItemsListProps {
  missingItems: MissingItem[];
  criticalMissing: MissingItem[];
  onScrollToField?: (fieldPath: string, sectionId: string) => void;
  onAIFill?: (item: MissingItem) => void;
  onAIFillAll?: () => void;
  onClose?: () => void;
}

function groupBySection(items: MissingItem[]): Map<string, MissingItem[]> {
  const map = new Map<string, MissingItem[]>();
  for (const item of items) {
    const list = map.get(item.sectionId) ?? [];
    list.push(item);
    map.set(item.sectionId, list);
  }
  return map;
}

export const MissingItemsList: React.FC<MissingItemsListProps> = ({
  missingItems,
  criticalMissing,
  onScrollToField,
  onAIFill,
  onAIFillAll,
}) => {
  const { t } = useTranslation();
  const grouped = groupBySection(missingItems);
  const hasCritical = criticalMissing.length > 0;

  if (missingItems.length === 0) {
    return (
      <div className="p-4 text-sm text-slate-500 dark:text-slate-400">
        {t('nmodeCompleteness.noMissing')}
      </div>
    );
  }

  return (
    <div className="flex flex-col max-h-[300px]">
      <div className="px-4 py-3 border-b border-slate-200/60 dark:border-navy-600/40 shrink-0">
        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
          {t('nmodeCompleteness.missingTitle')}
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          {t('nmodeCompleteness.missingSubtitle', { count: missingItems.length })}
        </p>
        {onAIFillAll && missingItems.length > 1 && (
          <button
            type="button"
            onClick={onAIFillAll}
            className="mt-2 flex items-center gap-1.5 text-xs font-medium text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 transition-colors"
          >
            <Sparkles size={14} />
            {t('nmodeCompleteness.aiFillAll')}
          </button>
        )}
      </div>
      <div className="overflow-y-auto flex-1 p-2">
        {Array.from(grouped.entries()).map(([sectionId, items]) => {
          const sectionLabel = items[0]?.sectionLabel ?? sectionId;
          return (
            <div key={sectionId} className="mb-3 last:mb-0">
              <div className="text-[11px] font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400 px-2 mb-1">
                {sectionLabel}
              </div>
              <div className="space-y-0.5">
                {items.map((item) => (
                  <div
                    key={item.fieldId}
                    className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-slate-100/80 dark:hover:bg-navy-800/60 transition-colors group"
                  >
                    <button
                      type="button"
                      onClick={() => onScrollToField?.(item.fieldPath, item.sectionId)}
                      className="flex-1 flex items-center gap-2 text-left min-w-0"
                    >
                      <span className="text-slate-800 dark:text-slate-100 truncate">
                        {item.fieldLabel}
                      </span>
                      {item.isCritical && (
                        <span className="shrink-0 px-1.5 py-0.5 rounded text-[10px] font-medium bg-rose-500/20 text-rose-600 dark:text-rose-400">
                          {t('nmodeCompleteness.critical')}
                        </span>
                      )}
                      <ChevronRight
                        size={14}
                        className="shrink-0 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity"
                      />
                    </button>
                    {onAIFill && (
                      <button
                        type="button"
                        onClick={() => onAIFill(item)}
                        className="shrink-0 flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium text-primary-600 dark:text-primary-400 bg-primary-500/10 hover:bg-primary-500/15 transition-colors"
                        title={t('nmodeCompleteness.aiFill')}
                      >
                        <Sparkles size={12} />
                        <span className="hidden sm:inline">{t('nmodeCompleteness.aiFill')}</span>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      {hasCritical && (
        <div className="px-4 py-2 border-t border-slate-200/60 dark:border-navy-600/40 bg-amber-500/5 dark:bg-amber-500/5">
          <p className="text-xs text-amber-700 dark:text-amber-400">
            {t('nmodeCompleteness.gateBlockedHint')}
          </p>
        </div>
      )}
    </div>
  );
};

export default MissingItemsList;
