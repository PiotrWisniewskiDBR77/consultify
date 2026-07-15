import type { LucideIcon } from 'lucide-react';
import { CheckSquare2 } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { actionPillClass } from './previewStyles';

export interface BatchAction {
  label: string;
  icon?: LucideIcon;
  onClick: () => void;
  colorScheme?: 'emerald' | 'blue' | 'purple' | 'amber' | 'neutral' | 'red' | 'green' | 'primary';
  disabled?: boolean;
}

export interface CommonField {
  label: string;
  value: string;
  count: number;
}

export interface PreviewBatchPanelProps {
  selectedCount: number;
  totalCount?: number;
  commonFields?: CommonField[];
  actions: BatchAction[];
  onDeselectAll?: () => void;
}

export const PreviewBatchPanel: React.FC<PreviewBatchPanelProps> = ({
  selectedCount,
  totalCount,
  commonFields,
  actions,
  onDeselectAll,
}) => {
  const { t } = useTranslation();

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-2 mb-4">
        <CheckSquare2 size={16} className="text-c-info" />
        <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          {selectedCount} {t('sharedComponents.previewBatchPanel.selected')}
          {totalCount ? <span className="text-slate-600 font-normal"> / {totalCount}</span> : null}
        </span>
        {onDeselectAll ? (
          <button
            onClick={onDeselectAll}
            className="ml-auto text-[11px] text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
          >
            {t('sharedComponents.previewBatchPanel.deselectAll')}
          </button>
        ) : null}
      </div>

      {commonFields && commonFields.length > 0 ? (
        <div className="mb-4 space-y-1.5">
          <div className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            {t('sharedComponents.previewBatchPanel.commonFields')}
          </div>
          {commonFields.map((field) => (
            <div key={field.label} className="flex items-center justify-between text-xs">
              <span className="text-slate-500 dark:text-slate-400">{field.label}</span>
              <span className="text-slate-700 dark:text-slate-200 font-medium">
                {field.value}
                {field.count < selectedCount ? (
                  <span className="text-slate-600 ml-1">
                    ({field.count}/{selectedCount})
                  </span>
                ) : null}
              </span>
            </div>
          ))}
        </div>
      ) : null}

      <div className="mt-auto space-y-2">
        <div className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
          {t('sharedComponents.previewBatchPanel.batchActions')}
        </div>
        {actions.map((action, idx) => {
          const Icon = action.icon;
          return (
            <button
              key={idx}
              onClick={action.onClick}
              disabled={action.disabled}
              className={actionPillClass(
                action.colorScheme ?? 'neutral',
                `w-full${action.disabled ? ' opacity-50 cursor-not-allowed' : ''}`
              )}
            >
              {Icon ? <Icon size={14} /> : null}
              {action.label}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default PreviewBatchPanel;
